<?php
// src/Controllers/TasksController.php

namespace Marshrut\Controllers;

use Marshrut\Database\Connection;
use function Marshrut\json_out;
use function Marshrut\request_body;
use function Marshrut\sanitize_string;
use function Marshrut\app_log;

class TasksController
{
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
            $where[] = 'status = :status';
            $args[':status'] = $_GET['status'];
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
        $operator  = $body['operator'] ?? $task['operator'];

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

        self::show($params);
    }

    // POST /api/tasks/{id}/close  — close via QR scan (also writes scan_log)
    public static function close(array $params): void
    {
        $db   = Connection::get();
        $body = request_body();

        $stmt = $db->prepare('SELECT * FROM tasks WHERE id = :id');
        $stmt->execute([':id' => $params['id']]);
        $task = $stmt->fetch();

        if (!$task) {
            json_out(['error' => 'Task not found'], 404);
        }

        $operator      = sanitize_string($body['operator']  ?? 'Оператор', 100);
        $comment       = sanitize_string($body['comment']   ?? '', 500);
        $completed     = isset($body['completed']) ? (int)$body['completed'] : (int)$task['planned'];
        $actualTimeMin = null;
        if (!empty($task['started_at'])) {
            $actualTimeMin = (int) round((time() - strtotime($task['started_at'])) / 60);
        }

        try {
            $db->beginTransaction();

            $db->prepare(
                'UPDATE tasks SET status="done", completed=:completed,
                                  operator=:operator, updated_at=NOW()
                  WHERE id = :id'
            )->execute([':completed' => $completed, ':operator' => $operator, ':id' => $params['id']]);

            $db->prepare(
                'INSERT INTO scan_log (task_id, qr_text, detail_id, op_info, operator, result, quantity, comment, actual_time_min)
                 VALUES (:tid, :qr, :did, :op, :operator, "closed", :qty, :comment, :atm)'
            )->execute([
                ':tid'      => $task['id'],
                ':qr'       => $body['qr_text'] ?? $task['qr_text'],
                ':did'      => $task['detail_id'],
                ':op'       => $task['op_num'] . ' ' . $task['op_name'],
                ':operator' => $operator,
                ':qty'      => $completed,
                ':comment'  => $comment ?: null,
                ':atm'      => $actualTimeMin,
            ]);
            \Marshrut\app_log('info', 'task.closed', [
                'task_id'        => $task['id'],
                'operator'       => $operator,
                'actual_time_min'=> $actualTimeMin,
                'completed'      => $completed,
            ]);

            // Автоматически переводим заказ в «done» если все задания выполнены
            $remaining = $db->prepare(
                'SELECT COUNT(*) FROM tasks WHERE order_id = :oid AND status NOT IN ("done","rejected","cancelled")'
            );
            $remaining->execute([':oid' => $task['order_id']]);
            if ((int)$remaining->fetchColumn() === 0) {
                $db->prepare(
                    'UPDATE orders SET status = "done" WHERE id = :oid AND status NOT IN ("cancelled","done")'
                )->execute([':oid' => $task['order_id']]);
                \Marshrut\app_log('info', 'order.auto_done', ['order_id' => $task['order_id']]);
            }

            $db->commit();
        } catch (\Exception $e) {
            $db->rollBack();
            json_out(['error' => $e->getMessage()], 500);
        }

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
}
