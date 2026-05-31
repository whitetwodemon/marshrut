<?php
/**
 * ShiftsController.php — Управление производственными сменами
 *
 * Маршруты:
 *   GET  /api/shifts              — список смен (последние 30)
 *   GET  /api/shifts/active       — текущая открытая смена + передачи
 *   POST /api/shifts/open         — открыть смену
 *   POST /api/shifts/{id}/close   — закрыть смену
 *   POST /api/shifts/{id}/handoff — передать задание при смене
 *   GET  /api/shifts/{id}/report  — посменный отчёт
 *
 * Бизнес-правила:
 *   - Одновременно открыта только одна смена
 *   - При открытии новой смены предыдущая закрывается автоматически
 *   - Передача задания: оператор указывает сколько деталей сделал + время
 *   - Задание после передачи → статус waiting (готово для следующего оператора)
 */

namespace Marshrut\Controllers;

use Marshrut\Database\Connection;
use Marshrut\Middleware\Auth;
use function Marshrut\json_out;
use function Marshrut\request_body;
use function Marshrut\sanitize_string;
use function Marshrut\app_log;

class ShiftsController
{
    // GET /api/shifts — список смен (последние 30)
    public static function index(array $params): void
    {
        Auth::require();
        $db   = Connection::get();
        $stmt = $db->query(
            'SELECT s.*,
                    uo.name AS opened_by_name,
                    uc.name AS closed_by_name,
                    COUNT(h.id) AS handoff_count
               FROM shifts s
               JOIN users uo ON uo.id = s.opened_by
               LEFT JOIN users uc ON uc.id = s.closed_by
               LEFT JOIN shift_handoffs h ON h.shift_id = s.id
              GROUP BY s.id
              ORDER BY s.opened_at DESC
              LIMIT 30'
        );
        json_out(['data' => $stmt->fetchAll()]);
    }

    // GET /api/shifts/active — текущая открытая смена
    public static function active(array $params): void
    {
        Auth::require();
        $db   = Connection::get();
        $stmt = $db->query(
            'SELECT s.*, u.name AS opened_by_name
               FROM shifts s
               JOIN users u ON u.id = s.opened_by
              WHERE s.closed_at IS NULL
              ORDER BY s.opened_at DESC
              LIMIT 1'
        );
        $shift = $stmt->fetch();
        if (!$shift) { json_out(['shift' => null]); return; }

        // Передачи в этой смене
        $h = $db->prepare(
            'SELECT h.*, t.op_name, t.work_center, o.number AS order_number
               FROM shift_handoffs h
               JOIN tasks t ON t.id = h.task_id
               JOIN orders o ON o.id = t.order_id
              WHERE h.shift_id = :sid
              ORDER BY h.handed_at DESC'
        );
        $h->execute([':sid' => $shift['id']]);
        $shift['handoffs'] = $h->fetchAll();
        json_out(['shift' => $shift]);
    }

    // POST /api/shifts/open — открыть смену
    public static function open(array $params): void
    {
        $user = Auth::require();
        $body = request_body();
        $db   = Connection::get();

        // Закрываем незакрытые смены
        $db->prepare('UPDATE shifts SET closed_at = NOW() WHERE closed_at IS NULL')
           ->execute();

        $name = sanitize_string($body['name'] ?? 'Смена ' . date('d.m H:i'), 100);
        $db->prepare(
            'INSERT INTO shifts (name, opened_by) VALUES (:name, :uid)'
        )->execute([':name' => $name, ':uid' => (int)$user->sub]);
        $id = $db->lastInsertId();

        $stmt = $db->prepare('SELECT s.*, u.name AS opened_by_name FROM shifts s JOIN users u ON u.id=s.opened_by WHERE s.id=:id');
        $stmt->execute([':id' => $id]);
        app_log('info', 'shift.opened', ['shift_id' => $id, 'name' => $name]);
        json_out($stmt->fetch());
    }

    // POST /api/shifts/{id}/close — закрыть смену
    public static function close(array $params): void
    {
        $user = Auth::require();
        $body = request_body();
        $db   = Connection::get();

        $db->prepare(
            'UPDATE shifts SET closed_at=NOW(), closed_by=:uid, notes=:notes WHERE id=:id AND closed_at IS NULL'
        )->execute([
            ':uid'   => (int)$user->sub,
            ':notes' => sanitize_string($body['notes'] ?? '', 1000) ?: null,
            ':id'    => $params['id'],
        ]);

        app_log('info', 'shift.closed', ['shift_id' => $params['id']]);
        json_out(['closed' => true]);
    }

    // POST /api/shifts/{id}/handoff — передача задания при смене
    public static function handoff(array $params): void
    {
        $user = Auth::require();
        $body = request_body();
        $db   = Connection::get();

        if (empty($body['task_id']) || empty($body['from_operator'])) {
            json_out(['error' => 'task_id и from_operator обязательны'], 422);
        }

        $taskId  = sanitize_string($body['task_id'],      50);
        $fromOp  = sanitize_string($body['from_operator'], 100);
        $toOp    = sanitize_string($body['to_operator'] ?? '', 100) ?: null;
        $count   = (int)($body['completed_count'] ?? 0);
        $workMin = (int)($body['work_min']    ?? 0);
        $pauseMin= (int)($body['pause_min']   ?? 0);
        $notes   = sanitize_string($body['notes'] ?? '', 1000) ?: null;

        $db->beginTransaction();
        try {
            // Записываем передачу
            $db->prepare(
                'INSERT INTO shift_handoffs
                   (shift_id, task_id, from_operator, to_operator, completed_count, work_min, pause_min, notes)
                 VALUES (:sid, :tid, :from, :to, :cnt, :wmin, :pmin, :notes)'
            )->execute([
                ':sid'   => $params['id'],
                ':tid'   => $taskId,
                ':from'  => $fromOp,
                ':to'    => $toOp,
                ':cnt'   => $count,
                ':wmin'  => $workMin,
                ':pmin'  => $pauseMin,
                ':notes' => $notes,
            ]);

            // Обновляем completed в задании + переводим в waiting (готово к новому оператору)
            // Если сделал всё — не меняем статус
            $task = $db->prepare('SELECT * FROM tasks WHERE id=:id');
            $task->execute([':id' => $taskId]);
            $task = $task->fetch();
            if ($task && $count < $task['planned']) {
                $db->prepare(
                    'UPDATE tasks SET completed=:cnt, status="waiting", operator=NULL, started_at=NULL WHERE id=:id'
                )->execute([':cnt' => $count, ':id' => $taskId]);
            }

            $db->commit();
            app_log('info', 'shift.handoff', ['task_id' => $taskId, 'from' => $fromOp, 'count' => $count]);
            json_out(['handed_off' => true]);
        } catch (\Exception $e) {
            $db->rollBack();
            json_out(['error' => $e->getMessage()], 500);
        }
    }

    // GET /api/shifts/{id}/report — отчёт по смене
    public static function report(array $params): void
    {
        Auth::require();
        $db = Connection::get();

        $shift = $db->prepare('SELECT s.*, u.name AS opened_by_name FROM shifts s JOIN users u ON u.id=s.opened_by WHERE s.id=:id');
        $shift->execute([':id' => $params['id']]);
        $shift = $shift->fetch();
        if (!$shift) { json_out(['error' => 'Смена не найдена'], 404); }

        // Закрытые операции за смену (из scan_log по времени смены)
        $end = $shift['closed_at'] ?: date('Y-m-d H:i:s');
        $scans = $db->prepare(
            'SELECT l.*, d.name AS detail_name, o.number AS order_number
               FROM scan_log l
               LEFT JOIN tasks t ON t.id = l.task_id
               LEFT JOIN details d ON d.id = l.detail_id
               LEFT JOIN orders o ON o.id = t.order_id
              WHERE l.scanned_at BETWEEN :start AND :end
              ORDER BY l.scanned_at ASC'
        );
        $scans->execute([':start' => $shift['opened_at'], ':end' => $end]);
        $shift['scans'] = $scans->fetchAll();

        // Передачи в смене
        $handoffs = $db->prepare(
            'SELECT h.*, t.op_name, t.work_center, o.number AS order_number
               FROM shift_handoffs h
               JOIN tasks t ON t.id = h.task_id
               JOIN orders o ON o.id = t.order_id
              WHERE h.shift_id = :sid'
        );
        $handoffs->execute([':sid' => $params['id']]);
        $shift['handoffs'] = $handoffs->fetchAll();

        // Статистика по операторам
        $byOp = [];
        foreach ($shift['scans'] as $s) {
            $op = $s['operator'] ?: 'Неизвестно';
            if (!isset($byOp[$op])) $byOp[$op] = ['closed' => 0, 'qty' => 0, 'actual_min' => 0];
            $byOp[$op]['closed']++;
            $byOp[$op]['qty']        += (int)($s['quantity'] ?? 0);
            $byOp[$op]['actual_min'] += (int)($s['actual_time_min'] ?? 0);
        }
        foreach ($shift['handoffs'] as $h) {
            $op = $h['from_operator'];
            if (!isset($byOp[$op])) $byOp[$op] = ['closed' => 0, 'qty' => 0, 'actual_min' => 0];
            $byOp[$op]['work_min']  = ($byOp[$op]['work_min']  ?? 0) + $h['work_min'];
            $byOp[$op]['pause_min'] = ($byOp[$op]['pause_min'] ?? 0) + $h['pause_min'];
        }
        $shift['by_operator'] = $byOp;

        json_out(['shift' => $shift]);
    }

    /**
     * GET /api/shifts/by-date?date=2026-05-28
     * Все смены за указанный день + сводка по операторам.
     * Доступно только роли foreman и admin.
     */
    public static function byDate(array $params): void
    {
        $user = Auth::require();
        // Только мастер и выше
        if (!in_array($user->role, ['admin', 'foreman'])) {
            json_out(['error' => 'Доступ запрещён'], 403);
        }

        $db   = Connection::get();
        $date = $_GET['date'] ?? date('Y-m-d');

        // Все смены за этот день
        $stmt = $db->prepare(
            'SELECT s.*,
                    uo.name AS opened_by_name,
                    uc.name AS closed_by_name
               FROM shifts s
               JOIN users uo ON uo.id = s.opened_by
               LEFT JOIN users uc ON uc.id = s.closed_by
              WHERE DATE(s.opened_at) = :date1
                 OR DATE(s.closed_at)  = :date2
              ORDER BY s.opened_at ASC'
        );
        $stmt->execute([':date1' => $date, ':date2' => $date]);
        $shifts = $stmt->fetchAll();

        // Для каждой смены — собираем детальный отчёт по операторам
        foreach ($shifts as &$shift) {
            $shift['operators'] = self::buildOperatorStats($db, $shift);
        }

        // Сводка за весь день по всем сменам
        $dayStats = self::buildDayStats($shifts);

        json_out([
            'date'      => $date,
            'shifts'    => $shifts,
            'day_stats' => $dayStats,
        ]);
    }

    /**
     * Собрать детальную статистику по операторам одной смены.
     * Учитывает:
     * - scan_log — закрытые операции (кол-во, факт время)
     * - task_pauses — паузы (обед, перерыв, технолог и т.д.)
     * - shift_operator_log — старты и закрытия
     * - shift_handoffs — передачи заданий с указанием рабочего времени
     */
    private static function buildOperatorStats(\PDO $db, array $shift): array
    {
        $end = $shift['closed_at'] ?: date('Y-m-d H:i:s');

        // ── Закрытые операции ────────────────────────────────────────────
        $scans = $db->prepare(
            'SELECT l.operator,
                    COUNT(*)                    AS ops_count,
                    SUM(l.quantity)             AS qty_total,
                    SUM(l.actual_time_min)      AS actual_min
               FROM scan_log l
              WHERE l.scanned_at BETWEEN :start AND :end
                AND l.operator IS NOT NULL AND l.operator != \'\'
              GROUP BY l.operator'
        );
        $scans->execute([':start' => $shift['opened_at'], ':end' => $end]);

        $byOp = [];
        foreach ($scans->fetchAll() as $row) {
            $op = $row['operator'];
            $byOp[$op] = [
                'operator'    => $op,
                'ops_closed'  => (int)$row['ops_count'],
                'qty_total'   => (int)$row['qty_total'],
                'actual_min'  => (int)$row['actual_min'],
                'pause_min'   => 0,
                'lunch_min'   => 0,
                'break_min'   => 0,
                'work_min'    => 0,
                'pauses'      => [],
                'handoffs'    => 0,
            ];
        }

        // ── Паузы из task_pauses ──────────────────────────────────────────
        $pauses = $db->prepare(
            'SELECT t.operator,
                    p.reason,
                    SUM(TIMESTAMPDIFF(MINUTE, p.started_at,
                        COALESCE(p.ended_at, NOW()))) AS total_min,
                    COUNT(*)                          AS pause_count
               FROM task_pauses p
               JOIN tasks t ON t.id = p.task_id
              WHERE p.started_at BETWEEN :start AND :end
                AND t.operator IS NOT NULL AND t.operator != \'\'
              GROUP BY t.operator, p.reason'
        );
        $pauses->execute([':start' => $shift['opened_at'], ':end' => $end]);

        foreach ($pauses->fetchAll() as $row) {
            $op  = $row['operator'];
            $min = (int)$row['total_min'];
            if (!isset($byOp[$op])) {
                $byOp[$op] = [
                    'operator' => $op, 'ops_closed' => 0, 'qty_total' => 0,
                    'actual_min' => 0, 'pause_min' => 0, 'lunch_min' => 0,
                    'break_min' => 0, 'work_min' => 0, 'pauses' => [], 'handoffs' => 0,
                ];
            }
            $byOp[$op]['pause_min'] += $min;
            if ($row['reason'] === 'lunch')  $byOp[$op]['lunch_min'] += $min;
            if ($row['reason'] === 'break')  $byOp[$op]['break_min'] += $min;
            $byOp[$op]['pauses'][] = [
                'reason'      => $row['reason'],
                'total_min'   => $min,
                'pause_count' => (int)$row['pause_count'],
            ];
        }

        // ── Передачи заданий (handoff содержит явное рабочее время) ──────
        $handoffs = $db->prepare(
            'SELECT h.from_operator AS operator,
                    COUNT(*)         AS handoff_count,
                    SUM(h.work_min)  AS work_min,
                    SUM(h.pause_min) AS pause_min
               FROM shift_handoffs h
              WHERE h.shift_id = :sid
              GROUP BY h.from_operator'
        );
        $handoffs->execute([':sid' => $shift['id']]);

        foreach ($handoffs->fetchAll() as $row) {
            $op = $row['operator'];
            if (!isset($byOp[$op])) {
                $byOp[$op] = [
                    'operator' => $op, 'ops_closed' => 0, 'qty_total' => 0,
                    'actual_min' => 0, 'pause_min' => 0, 'lunch_min' => 0,
                    'break_min' => 0, 'work_min' => 0, 'pauses' => [], 'handoffs' => 0,
                ];
            }
            $byOp[$op]['handoffs']    = (int)$row['handoff_count'];
            // Данные из handoff более точные (оператор сам указывал)
            $byOp[$op]['work_min']  += (int)$row['work_min'];
            $byOp[$op]['pause_min'] += (int)$row['pause_min'];
        }

        // Если work_min не заполнен из handoff — считаем из actual_min
        foreach ($byOp as $op => &$stats) {
            if ($stats['work_min'] === 0 && $stats['actual_min'] > 0) {
                $stats['work_min'] = max(0, $stats['actual_min'] - $stats['pause_min']);
            }
        }

        return array_values($byOp);
    }

    /**
     * Сводка по всем операторам за день (агрегация по всем сменам).
     */
    private static function buildDayStats(array $shifts): array
    {
        $combined = [];
        foreach ($shifts as $shift) {
            foreach ($shift['operators'] as $stat) {
                $op = $stat['operator'];
                if (!isset($combined[$op])) {
                    $combined[$op] = [
                        'operator'   => $op,
                        'ops_closed' => 0, 'qty_total' => 0,
                        'actual_min' => 0, 'pause_min' => 0,
                        'lunch_min'  => 0, 'break_min' => 0,
                        'work_min'   => 0, 'handoffs'  => 0,
                    ];
                }
                foreach (['ops_closed','qty_total','actual_min','pause_min',
                          'lunch_min','break_min','work_min','handoffs'] as $key) {
                    $combined[$op][$key] += $stat[$key] ?? 0;
                }
            }
        }
        return array_values($combined);
    }
}
