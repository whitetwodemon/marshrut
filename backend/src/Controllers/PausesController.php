<?php
/**
 * PausesController.php — Учёт простоев и пауз в работе
 *
 * Маршруты:
 *   POST /api/tasks/{id}/pause   — начать простой (задание → paused)
 *   POST /api/tasks/{id}/resume  — завершить простой (задание → in_progress)
 *   GET  /api/tasks/{id}/pauses  — история простоев задания
 *
 * Причины простоя:
 *   lunch      — Обед
 *   break      — Перерыв
 *   tech       — Ожидание технолога / согласования
 *   material   — Ожидание материала/заготовки
 *   equipment  — Поломка оборудования
 *   other      — Прочее
 */

namespace Marshrut\Controllers;

use Marshrut\Database\Connection;
use Marshrut\Middleware\Auth;
use function Marshrut\json_out;
use function Marshrut\request_body;
use function Marshrut\sanitize_string;
use function Marshrut\app_log;

class PausesController
{
    const REASONS = [
        'lunch'     => 'Обед',
        'break'     => 'Перерыв',
        'tech'      => 'Технолог / согласование',
        'material'  => 'Ожидание материала',
        'equipment' => 'Поломка оборудования',
        'other'     => 'Прочее',
    ];

    // POST /api/tasks/{id}/pause — начать простой
    public static function start(array $params): void
    {
        $user = Auth::require();
        $body = request_body();
        $db   = Connection::get();

        // Проверяем что задание в работе
        $task = $db->prepare('SELECT * FROM tasks WHERE id = :id');
        $task->execute([':id' => $params['id']]);
        $task = $task->fetch();
        if (!$task) json_out(['error' => 'Task not found'], 404);
        if ($task['status'] !== 'in_progress') {
            json_out(['error' => 'Задание не в работе'], 422);
        }

        $reason = in_array($body['reason'] ?? '', array_keys(self::REASONS))
            ? $body['reason'] : 'other';

        $db->beginTransaction();
        try {
            // Меняем статус задания
            $db->prepare('UPDATE tasks SET status="paused" WHERE id=:id')
               ->execute([':id' => $params['id']]);

            // Записываем простой
            $db->prepare(
                'INSERT INTO task_pauses (task_id, reason, reason_note, started_at)
                 VALUES (:tid, :reason, :note, NOW())'
            )->execute([
                ':tid'    => $params['id'],
                ':reason' => $reason,
                ':note'   => sanitize_string($body['note'] ?? '', 255) ?: null,
            ]);
            $pauseId = $db->lastInsertId();
            $db->commit();
            app_log('info', 'task.paused', ['task_id' => $params['id'], 'reason' => $reason]);
            json_out(['pause_id' => $pauseId, 'reason' => $reason, 'label' => self::REASONS[$reason]]);
        } catch (\Exception $e) {
            $db->rollBack();
            json_out(['error' => $e->getMessage()], 500);
        }
    }

    // POST /api/tasks/{id}/resume — завершить простой, вернуть в работу
    public static function end(array $params): void
    {
        Auth::require();
        $db = Connection::get();

        $task = $db->prepare('SELECT * FROM tasks WHERE id=:id');
        $task->execute([':id' => $params['id']]);
        $task = $task->fetch();
        if (!$task || $task['status'] !== 'paused') {
            json_out(['error' => 'Задание не на паузе'], 422);
        }

        $db->beginTransaction();
        try {
            // Закрываем открытый простой
            $db->prepare(
                'UPDATE task_pauses SET ended_at=NOW()
                  WHERE task_id=:tid AND ended_at IS NULL'
            )->execute([':tid' => $params['id']]);

            $db->prepare('UPDATE tasks SET status="in_progress" WHERE id=:id')
               ->execute([':id' => $params['id']]);

            $db->commit();
            app_log('info', 'task.resumed', ['task_id' => $params['id']]);
            json_out(['status' => 'in_progress']);
        } catch (\Exception $e) {
            $db->rollBack();
            json_out(['error' => $e->getMessage()], 500);
        }
    }

    // GET /api/tasks/{id}/pauses — история простоев задания
    public static function list(array $params): void
    {
        Auth::require();
        $db = Connection::get();
        $stmt = $db->prepare(
            'SELECT p.*, TIMESTAMPDIFF(MINUTE, p.started_at, COALESCE(p.ended_at, NOW())) AS duration_min
               FROM task_pauses p WHERE p.task_id = :tid ORDER BY p.started_at DESC'
        );
        $stmt->execute([':tid' => $params['id']]);
        json_out(['data' => $stmt->fetchAll()]);
    }
}
