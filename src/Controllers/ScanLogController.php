<?php
/**
 * ScanLogController.php — Журнал сканирований ОТК
 *
 * Маршруты:
 *   GET /api/scan-log  — журнал (последние N записей, ?limit=50)
 *
 * Каждая запись содержит:
 *   - task_id, qr_text   — какая операция была отсканирована
 *   - operator           — кто выполнил операцию
 *   - quantity, batch_num — сколько деталей, номер партии (для частичной сдачи)
 *   - actual_time_min    — фактическое время на операцию
 *   - scanned_at         — timestamp
 *
 * TODO: Добавить пагинацию (сейчас возвращает всё без ограничения)
 */

// src/Controllers/ScanLogController.php

namespace Marshrut\Controllers;

use Marshrut\Database\Connection;
use function Marshrut\json_out;
use function Marshrut\request_body;

class ScanLogController
{
    // GET /api/scan-log  ?limit=&task_id=
    public static function index(array $params): void
    {
        $db    = Connection::get();
        $limit = min((int) ($_GET['limit'] ?? 100), 500);
        $where = [];
        $args  = [];

        if (!empty($_GET['task_id'])) {
            $where[] = 'task_id = :task_id';
            $args[':task_id'] = $_GET['task_id'];
        }
        if (!empty($_GET['result'])) {
            $where[] = 'result = :result';
            $args[':result'] = $_GET['result'];
        }
        if (!empty($_GET['date'])) {
            $where[] = 'DATE(scanned_at) = :date';
            $args[':date'] = $_GET['date'];
        }

        $sql = 'SELECT * FROM scan_log'
             . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
             . ' ORDER BY scanned_at DESC LIMIT ' . $limit;

        $stmt = $db->prepare($sql);
        $stmt->execute($args);
        json_out(['data' => $stmt->fetchAll()]);
    }

    // POST /api/scan-log  — manual scan entry
    public static function create(array $params): void
    {
        $db   = Connection::get();
        $body = request_body();

        if (empty($body['qr_text'])) {
            json_out(['error' => 'qr_text is required'], 422);
        }

        // Try to match to a task
        $stmt = $db->prepare('SELECT * FROM tasks WHERE qr_text = :qr');
        $stmt->execute([':qr' => $body['qr_text']]);
        $task = $stmt->fetch();

        $result   = 'not_found';
        $taskId   = null;
        $detailId = null;
        $opInfo   = null;
        $quantity = null;

        if ($task) {
            if ($task['status'] === 'done') {
                $result = 'already_done';
            } else {
                $result = 'closed';
            }
            $taskId   = $task['id'];
            $detailId = $task['detail_id'];
            $opInfo   = $task['op_num'] . ' ' . $task['op_name'];
            $quantity = $task['planned'];
        }

        $db->prepare(
            'INSERT INTO scan_log (task_id, qr_text, detail_id, op_info, operator, result, quantity)
             VALUES (:tid, :qr, :did, :op, :operator, :result, :qty)'
        )->execute([
            ':tid'      => $taskId,
            ':qr'       => $body['qr_text'],
            ':did'      => $detailId,
            ':op'       => $opInfo,
            ':operator' => $body['operator'] ?? null,
            ':result'   => $result,
            ':qty'      => $quantity,
        ]);

        json_out(['result' => $result, 'task' => $task ?: null], 201);
    }
}
