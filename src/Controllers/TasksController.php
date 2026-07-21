<?php
/**
 * TasksController.php — Управление статусами заданий
 *
 * Маршруты:
 *   GET    /api/tasks                — список заданий (все или по заказу)
 *   PATCH  /api/tasks/{id}/status   — сменить статус (взять в работу, пауза...)
 *   POST   /api/tasks/{id}/close    — закрыть операцию (с записью в scan_log)
 *
 * Бизнес-правила в close():
 *   1. Нужна открытая смена
 *   2. Оператор не может иметь >1 задание в работе на одном РЦ
 *   3. Частичная сдача: completed < planned → статус остаётся in_progress
 *   4. Полная сдача: completed >= planned → статус = done
 *   5. Если все задания заказа закрыты → заказ → done
 *   6. Запись в scan_log с номером партии (batch_num)
 */

// src/Controllers/TasksController.php

namespace Marshrut\Controllers;

use Marshrut\Database\Connection;
use function Marshrut\json_out;
use function Marshrut\request_body;
use function Marshrut\sanitize_string;
use function Marshrut\app_log;

class TasksController
{
    /**
     * Записать событие оператора в журнал смены.
     * Вызывается при старте, закрытии и паузах задания.
     *
     * @param PDO    $db         подключение к БД
     * @param string $taskId     ID задания
     * @param string $operator   имя оператора
     * @param string $event      start|close|pause_start|pause_end
     * @param string $workCenter код рабочего центра
     * @param int    $qty        количество (для close)
     */
    private static function logOperatorEvent(
        \PDO $db, string $taskId, string $operator,
        string $event, string $workCenter = '', int $qty = 0
    ): void {
        // Логирование никогда не должно ронять основную операцию
        try {
            // Находим текущую открытую смену
            $shiftStmt = $db->query('SELECT id FROM shifts WHERE closed_at IS NULL ORDER BY opened_at DESC LIMIT 1');
            $shiftId   = $shiftStmt->fetchColumn();
            if (!$shiftId) return; // нет открытой смены — не логируем

            // event раньше был ENUM без setup_*; на всякий случай гарантируем VARCHAR
            try { $db->exec("ALTER TABLE shift_operator_log MODIFY COLUMN event VARCHAR(30) NOT NULL"); }
            catch (\Throwable $e) { /* уже VARCHAR или нет прав — игнор */ }

            $db->prepare(
                'INSERT INTO shift_operator_log (shift_id, operator, task_id, event, work_center, qty)
                 VALUES (:sid, :op, :tid, :ev, :wc, :qty)'
            )->execute([
                ':sid' => $shiftId,
                ':op'  => $operator,
                ':tid' => $taskId,
                ':ev'  => $event,
                ':wc'  => $workCenter,
                ':qty' => $qty,
            ]);
        } catch (\Throwable $e) {
            \Marshrut\app_log('warn', 'operator_log.failed', ['error' => $e->getMessage(), 'event' => $event]);
        }
    }

    // GET /api/tasks  ?order_id=&detail_id=&status=
    public static function index(array $params): void
    {
        $db     = Connection::get();
        $where  = [];
        $args   = [];
        $limit  = max(1, min(500, (int)($_GET['limit']  ?? 200)));
        $offset = max(0, (int)($_GET['offset'] ?? 0));

        if (!empty($_GET['order_id'])) {
            $where[] = 'order_id = :order_id';
            $args[':order_id'] = $_GET['order_id'];
        }
        if (!empty($_GET['detail_id'])) {
            $where[] = 'detail_id = :detail_id';
            $args[':detail_id'] = $_GET['detail_id'];
        }
        if (!empty($_GET['status'])) {
            $rawStatuses = array_filter(array_map('trim', explode(',', $_GET['status'])));
            $allowed     = ['waiting','in_progress','done','paused','rejected','rework','cancelled'];
            $statuses    = array_values(array_intersect($rawStatuses, $allowed));
            if (count($statuses) === 1) {
                $where[] = 'status = :status';
                $args[':status'] = $statuses[0];
            } elseif (count($statuses) > 1) {
                $placeholders = implode(',', array_map(fn($i) => ":st{$i}", array_keys($statuses)));
                $where[] = "status IN ($placeholders)";
                foreach ($statuses as $i => $s) { $args[":st{$i}"] = $s; }
            }
        }

        // operator=me → filter by current user's name (requires auth)
        if (!empty($_GET['operator']) && $_GET['operator'] === 'me') {
            try {
                $u = \Marshrut\Middleware\Auth::require();
                $where[] = 'operator = :operator_me';
                $args[':operator_me'] = $u->name ?? $u->email ?? '';
            } catch (\Exception $e) { /* not authenticated — ignore */ }
        } elseif (!empty($_GET['operator'])) {
            $where[] = 'operator = :operator_filter';
            $args[':operator_filter'] = $_GET['operator'];
        }

        $wClause = $where ? ' WHERE ' . implode(' AND ', $where) : '';

        $total = $db->prepare("SELECT COUNT(*) FROM tasks{$wClause}");
        $total->execute($args);
        $totalCount = (int)$total->fetchColumn();

        $sql = "SELECT * FROM tasks{$wClause} ORDER BY detail_id, op_num LIMIT :lim OFFSET :off";
        $args[':lim'] = $limit;
        $args[':off'] = $offset;

        $stmt = $db->prepare($sql);
        $stmt->execute($args);
        $tasks = $stmt->fetchAll();

        json_out(['data' => $tasks, 'total' => $totalCount, 'limit' => $limit, 'offset' => $offset]);
    }


    // GET /api/tasks/{id}
    public static function show(array $params): void
    {
        $db   = Connection::get();
        $stmt = $db->prepare('SELECT * FROM tasks WHERE id = :id');
        $stmt->execute([':id' => $params['id']]);
        $task = $stmt->fetch();

        if (!$task) {
            json_out(['error' => 'Task not found'], 404);
        }

        json_out($task);
    }

    // PATCH /api/tasks/{id}/status  — update status + completed count
    public static function updateStatus(array $params): void
    {
        $db   = Connection::get();
        $body = request_body();

        $allowed = ['waiting', 'in_progress', 'done', 'paused', 'rejected', 'rework'];
        $status  = $body['status'] ?? '';

        if (!in_array($status, $allowed, true)) {
            json_out(['error' => 'Invalid status. Allowed: ' . implode(', ', $allowed)], 422);
        }

        $stmt = $db->prepare('SELECT * FROM tasks WHERE id = :id');
        $stmt->execute([':id' => $params['id']]);
        $task = $stmt->fetch();

        if (!$task) {
            json_out(['error' => 'Task not found'], 404);
        }

        $completed = (int) ($body['completed'] ?? ($status === 'done' ? $task['planned'] : $task['completed']));
        $operator  = sanitize_string($body['operator'] ?? $task['operator'] ?? '', 100);

        // ── Проверки при взятии задания в работу ─────────────────────────
        if ($status === 'in_progress') {
            // 0. Заказ не должен быть в статусе «Проблема»
            $ord = $db->prepare('SELECT o.status, o.problem_comment FROM orders o WHERE o.id = :oid');
            $ord->execute([':oid' => $task['order_id']]);
            $ordRow = $ord->fetch();
            if ($ordRow && $ordRow['status'] === 'problem') {
                json_out(['error' => 'Заказ помечен как «Проблема»: ' . ($ordRow['problem_comment'] ?? '') . '. Операции заблокированы до решения мастером.'], 422);
            }

            // 1. Нужна открытая смена
            $shiftCheck = $db->query('SELECT id FROM shifts WHERE closed_at IS NULL LIMIT 1');
            if (!$shiftCheck->fetch()) {
                json_out(['error' => 'Нет открытой смены. Откройте смену перед началом работы.'], 422);
            }

            // 2. Оператор не может иметь более одного задания в работе на одном РЦ
            if ($operator) {
                $conflictCheck = $db->prepare(
                    'SELECT t.id, t.op_name, t.work_center FROM tasks t
                      WHERE t.operator = :op AND t.status = "in_progress"
                        AND t.work_center = :wc AND t.id != :id'
                );
                $conflictCheck->execute([
                    ':op' => $operator,
                    ':wc' => $task['work_center'],
                    ':id' => $params['id'],
                ]);
                if ($conflict = $conflictCheck->fetch()) {
                    json_out([
                        'error' => "Оператор уже выполняет операцию '{$conflict['op_name']}' на этом рабочем центре ({$task['work_center']}). Сначала закройте её или поставьте на паузу.",
                    ], 422);
                }
            }
        }

        $startedAt = ($status === 'in_progress' && $task['status'] === 'waiting')
            ? 'NOW()' : ':started_old';

        $upd = $db->prepare(
            'UPDATE tasks SET status=:status, completed=:completed,
                              operator=:operator, updated_at=NOW(),
                              started_at = COALESCE(started_at, IF(status=:s2, NOW(), started_at))
              WHERE id = :id'
        );
        $upd->execute([
            ':status'    => $status,
            ':s2'        => 'in_progress',
            ':completed' => $completed,
            ':operator'  => $operator,
            ':id'        => $params['id'],
        ]);

        \Marshrut\app_log('info', 'task.status_changed', [
            'task_id'  => $params['id'],
            'from'     => $task['status'],
            'to'       => $status,
            'operator' => $operator,
        ]);

        // Логируем событие в журнал смены
        if ($operator && in_array($status, ['in_progress', 'paused'])) {
            $event = $status === 'in_progress' ? 'start' : 'pause_start';
            self::logOperatorEvent($db, $params['id'], $operator, $event, $task['work_center'] ?? '');
        }

        self::show($params);
    }

    // Гарантирует наличие колонок ТПЗ (если миграция 001 не доехала на инстанс)
    private static function ensureSetupColumns(\PDO $db): void
    {
        static $checked = false;
        if ($checked) return;
        $checked = true;
        $cols = [
            'setup_time_min'   => 'INT NOT NULL DEFAULT 0',
            'setup_started_at' => 'TIMESTAMP NULL',
            'setup_actual_min' => 'INT NULL',
            'setup_done'       => 'TINYINT NOT NULL DEFAULT 0',
        ];
        foreach ($cols as $name => $def) {
            $exists = $db->query(
                "SELECT COUNT(*) FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = '$name'"
            )->fetchColumn();
            if (!$exists) {
                try { $db->exec("ALTER TABLE tasks ADD COLUMN $name $def"); \Marshrut\app_log('warn', 'schema_drift', ['table' => 'tasks', 'column' => $name]); }
                catch (\PDOException $e) { /* уже есть или гонка — игнор */ }
            }
        }
    }

    // POST /api/tasks/{id}/setup-start — начать наладку (ТПЗ)
    public static function setupStart(array $params): void
    {
        $db   = Connection::get();
        self::ensureSetupColumns($db);
        $body = request_body();
        $operator = sanitize_string($body['operator'] ?? '', 100);

        $stmt = $db->prepare('SELECT * FROM tasks WHERE id = :id');
        $stmt->execute([':id' => $params['id']]);
        $task = $stmt->fetch();
        if (!$task) json_out(['error' => 'Task not found'], 404);

        // Нужна открытая смена
        if (!$db->query('SELECT id FROM shifts WHERE closed_at IS NULL LIMIT 1')->fetch()) {
            json_out(['error' => 'Нет открытой смены. Откройте смену перед наладкой.'], 422);
        }

        if ((int)$task['setup_done'] === 1) {
            json_out(['error' => 'Наладка уже завершена'], 422);
        }

        $db->prepare(
            'UPDATE tasks
                SET setup_started_at = NOW(),
                    operator         = COALESCE(NULLIF(:op, ""), operator),
                    updated_at       = NOW()
              WHERE id = :id'
        )->execute([':op' => $operator, ':id' => $params['id']]);

        \Marshrut\app_log('info', 'task.setup_start', [
            'task_id' => $params['id'], 'operator' => $operator,
        ]);
        if ($operator) {
            self::logOperatorEvent($db, $params['id'], $operator, 'setup_start', $task['work_center'] ?? '');
        }
        self::show($params);
    }

    // POST /api/tasks/{id}/setup-finish — завершить наладку, зафиксировать факт ТПЗ
    public static function setupFinish(array $params): void
    {
        $db   = Connection::get();
        self::ensureSetupColumns($db);
        $body = request_body();
        $operator = sanitize_string($body['operator'] ?? '', 100);

        $stmt = $db->prepare('SELECT * FROM tasks WHERE id = :id');
        $stmt->execute([':id' => $params['id']]);
        $task = $stmt->fetch();
        if (!$task) json_out(['error' => 'Task not found'], 404);

        // Считаем фактическое время наладки
        $actualMin = null;
        if (!empty($task['setup_started_at'])) {
            $started = strtotime($task['setup_started_at']);
            $actualMin = max(0, (int) round((time() - $started) / 60));
        }
        // Можно передать вручную
        if (isset($body['setup_actual_min'])) {
            $actualMin = max(0, (int) $body['setup_actual_min']);
        }

        $db->prepare(
            'UPDATE tasks
                SET setup_done       = 1,
                    setup_actual_min = :actual,
                    operator         = COALESCE(NULLIF(:op, ""), operator),
                    updated_at       = NOW()
              WHERE id = :id'
        )->execute([
            ':actual' => $actualMin,
            ':op'     => $operator,
            ':id'     => $params['id'],
        ]);

        \Marshrut\app_log('info', 'task.setup_finish', [
            'task_id' => $params['id'], 'operator' => $operator,
            'actual_min' => $actualMin, 'norm_min' => $task['setup_time_min'],
        ]);
        if ($operator) {
            self::logOperatorEvent($db, $params['id'], $operator, 'setup_finish', $task['work_center'] ?? '');
        }
        self::show($params);
    }

    // POST /api/tasks/{id}/close  — close via QR scan (also writes scan_log)
    public static function close(array $params): void
    {
        $db   = Connection::get();
        $body = request_body();

        // Загружаем задание
        $stmt = $db->prepare('SELECT * FROM tasks WHERE id = :id');
        $stmt->execute([':id' => $params['id']]);
        $task = $stmt->fetch();
        if (!$task) { json_out(['error' => 'Task not found'], 404); }

        // DEBUG: логируем входящие данные
        \Marshrut\app_log('info', 'task.close.request', [
            'task_id'   => $params['id'],
            'task_status' => $task['status'],
            'task_planned'=> $task['planned'],
            'body'      => $body,
        ]);

        $operator  = sanitize_string($body['operator'] ?? 'Оператор', 100);
        $comment   = sanitize_string($body['comment']  ?? '', 500);
        $completed = isset($body['completed']) ? (int)$body['completed'] : (int)$task['planned'];

        // Время текущей сессии:
        // 1. Если оператор/мастер вводит вручную — берём из body
        // 2. Иначе считаем из started_at
        $sessionMin = 0;
        if (isset($body['actual_time_min']) && (int)$body['actual_time_min'] > 0) {
            $sessionMin = (int)$body['actual_time_min'];
        } elseif (!empty($task['started_at'])) {
            $sessionMin = max(0, (int)round((time() - strtotime($task['started_at'])) / 60));
        }

        $isComplete = $completed >= (int)$task['planned'];
        $newStatus  = $isComplete ? 'done' : 'in_progress';

        // 1. Обновляем задание (+ накапливаем время для нормоконтроля)
        $db->prepare(
            'UPDATE tasks
                SET status           = :status,
                    completed        = :completed,
                    operator         = :operator,
                    actual_time_min  = :atm,
                    accumulated_time = accumulated_time + :acc,
                    started_at       = CASE WHEN :partial = 1 THEN NULL ELSE started_at END,
                    updated_at       = NOW()
              WHERE id = :id'
        )->execute([
            ':status'    => $newStatus,
            ':completed' => $completed,
            ':operator'  => $operator,
            ':atm'       => $sessionMin > 0 ? $sessionMin : null,
            ':acc'       => $sessionMin > 0 ? $sessionMin : 0,
            ':partial'   => $isComplete ? 0 : 1,
            ':id'        => $params['id'],
        ]);

        // DEBUG: проверяем что UPDATE сработал
        $check = $db->prepare('SELECT status, completed FROM tasks WHERE id = :id');
        $check->execute([':id' => $params['id']]);
        $after = $check->fetch() ?: ['status' => 'unknown', 'completed' => 0];
        \Marshrut\app_log('info', 'task.close.after_update', [
            'task_id'   => $params['id'],
            'new_status'=> $after['status'] ?? 'not found',
            'completed' => $after['completed'] ?? 0,
            'isComplete'=> $isComplete,
            'newStatus' => $newStatus,
        ]);

        // 2. Пишем в журнал сканирований
        $db->prepare(
            'INSERT INTO scan_log
                (task_id, qr_text, detail_id, op_info, operator, result, quantity, actual_time_min)
             VALUES (:tid, :qr, :did, :op, :operator, "closed", :qty, :atm)'
        )->execute([
            ':tid'      => $task['id'],
            ':qr'       => $body['qr_text'] ?? $task['qr_text'],
            ':did'      => $task['detail_id'],
            ':op'       => $task['op_num'] . ' ' . $task['op_name'],
            ':operator' => $operator,
            ':qty'      => $completed,
            ':atm'      => $sessionMin > 0 ? $sessionMin : null,
        ]);

        // 3. Если все задания заказа выполнены — переводим заказ в done
        if ($isComplete) {
            $remaining = $db->prepare(
                'SELECT COUNT(*) FROM tasks WHERE order_id=:oid AND status NOT IN ("done","rejected","cancelled")'
            );
            $remaining->execute([':oid' => $task['order_id']]);
            if ((int)$remaining->fetchColumn() === 0) {
                $db->prepare('UPDATE orders SET status="done" WHERE id=:oid')
                   ->execute([':oid' => $task['order_id']]);
            }
        }

        // 4. Логируем в историю задания
        self::logTaskEvent($db, $params['id'], 'close', $operator,
            $comment ?: '', $completed, $sessionMin);

        // 5. Логируем событие в смену
        try { self::logOperatorEvent($db, $params['id'], $operator, 'close', $task['work_center'] ?? '', $completed); }
        catch (\Exception $e) { /* смены может не быть — не критично */ }

        \Marshrut\app_log('info', 'task.closed', [
            'task_id'   => $task['id'],
            'operator'  => $operator,
            'completed' => $completed,
            'status'    => $newStatus,
        ]);

        self::show($params);
    }


    // GET /api/tasks/scan/{qr}  — lookup task by QR text
    public static function findByQr(array $params): void
    {
        $db   = Connection::get();
        $stmt = $db->prepare('SELECT * FROM tasks WHERE qr_text = :qr');
        $stmt->execute([':qr' => $params['qr']]);
        $task = $stmt->fetch();

        if (!$task) {
            json_out(['error' => 'No task for QR', 'qr' => $params['qr']], 404);
        }

        json_out($task);
    }
    /** GET /api/tasks/{id}/events — история операции */
    public static function events(array $params): void
    {
        $db   = Connection::get();
        // Create table if not exists (migration safety)
        $db->exec("CREATE TABLE IF NOT EXISTS task_events (
            id INT AUTO_INCREMENT PRIMARY KEY,
            task_id VARCHAR(100) NOT NULL,
            event_type ENUM('handoff','close','comment','start','pause') NOT NULL,
            operator VARCHAR(100),
            comment TEXT,
            qty_done INT DEFAULT 0,
            time_spent INT DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_task (task_id)
        ) ENGINE=InnoDB CHARACTER SET utf8mb4");

        $stmt = $db->prepare(
            'SELECT * FROM task_events WHERE task_id = :id ORDER BY created_at ASC'
        );
        $stmt->execute([':id' => $params['id']]);
        json_out(['data' => $stmt->fetchAll()]);
    }

    /** Записать событие в историю задания */
    public static function logTaskEvent(
        \PDO $db, string $taskId, string $type,
        string $operator = '', string $comment = '',
        int $qtyDone = 0, int $timeSpent = 0
    ): void {
        try {
            $db->prepare(
                'INSERT INTO task_events (task_id, event_type, operator, comment, qty_done, time_spent)
                 VALUES (:tid, :type, :op, :comment, :qty, :time)'
            )->execute([
                ':tid'     => $taskId,
                ':type'    => $type,
                ':op'      => $operator ?: '',
                ':comment' => $comment  ?: '',
                ':qty'     => $qtyDone,
                ':time'    => $timeSpent,
            ]);
        } catch (\Exception $e) { /* таблица может не существовать */ }
    }

    /** POST /api/tasks/{id}/comment — добавить комментарий/запись в историю */
    public static function addComment(array $params): void
    {
        $db   = Connection::get();
        $body = request_body();
        $comment  = sanitize_string($body['comment']  ?? '', 1000);
        $operator = sanitize_string($body['operator'] ?? '', 100);
        self::logTaskEvent($db, $params['id'], 'comment', $operator, $comment);
        json_out(['ok' => true]);
    }


    // POST /api/tasks/reorder — приоритет заданий. Body: { task_ids: [...] }
    public static function reorder(array $params): void
    {
        Auth::can('orders.edit');
        $db = Connection::get();
        try {
            $has = $db->query("SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'queue_pos'")->fetchColumn();
            if (!$has) { $db->exec("ALTER TABLE tasks ADD COLUMN queue_pos INT NOT NULL DEFAULT 0"); \Marshrut\app_log('warn', 'schema_drift', ['table' => 'tasks', 'column' => 'queue_pos']); }
        } catch (\Throwable $e) {}
        $body = request_body();
        $ids  = $body['task_ids'] ?? [];
        if (!is_array($ids) || !$ids) json_out(['error' => 'Не передан порядок'], 422);
        $upd = $db->prepare('UPDATE tasks SET queue_pos = :pos WHERE id = :id');
        $pos = 1;
        foreach ($ids as $tid) { $upd->execute([':pos' => $pos++, ':id' => (string)$tid]); }
        app_log('info', 'tasks.reorder', ['count' => count($ids)]);
        json_out(['ok' => true, 'reordered' => count($ids)]);
    }

    // PATCH /api/tasks/{id}/note — персистентное примечание к операции (для маршрутного листа)
    public static function setNote(array $params): void
    {
        Auth::can('orders.edit');
        $db   = Connection::get();
        $body = request_body();
        $note = sanitize_string($body['comment'] ?? '', 500);
        $db->prepare('UPDATE tasks SET comment = :c WHERE id = :id')
           ->execute([':c' => $note, ':id' => $params['id']]);
        json_out(['ok' => true, 'comment' => $note]);
    }
}
