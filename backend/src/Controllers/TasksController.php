<?php
// src/Controllers/TasksController.php

namespace Marshrut\Controllers;

use Marshrut\Database\Connection;
use function Marshrut\json_out;
use function Marshrut\request_body;

class TasksController
{
    // GET /api/tasks  ?order_id=&detail_id=&status=
    public static function index(array $params): void
    {
        $db     = Connection::get();
        $where  = [];
        $args   = [];

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

        $sql = 'SELECT * FROM tasks'
             . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
             . ' ORDER BY detail_id, op_num';

        $stmt = $db->prepare($sql);
        $stmt->execute($args);
        $tasks = $stmt->fetchAll();

        json_out(['data' => $tasks, 'total' => count($tasks)]);
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

        $allowed = ['waiting', 'in_progress', 'done'];
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

        $db->prepare(
            'UPDATE tasks SET status=:status, completed=:completed,
                              operator=:operator, updated_at=NOW()
              WHERE id = :id'
        )->execute([
            ':status'    => $status,
            ':completed' => $completed,
            ':operator'  => $operator,
            ':id'        => $params['id'],
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

        $operator  = $body['operator'] ?? 'Оператор';
        $completed = isset($body['completed']) ? (int)$body['completed'] : (int)$task['planned'];

        $db->prepare(
            'UPDATE tasks SET status="done", completed=:completed,
                              operator=:operator, updated_at=NOW()
              WHERE id = :id'
        )->execute([':completed' => $completed, ':operator' => $operator, ':id' => $params['id']]);

        // Write to scan log
        $db->prepare(
            'INSERT INTO scan_log (task_id, qr_text, detail_id, op_info, operator, result, quantity)
             VALUES (:tid, :qr, :did, :op, :operator, "closed", :qty)'
        )->execute([
            ':tid'      => $task['id'],
            ':qr'       => $body['qr_text'] ?? $task['qr_text'],
            ':did'      => $task['detail_id'],
            ':op'       => $task['op_num'] . ' ' . $task['op_name'],
            ':operator' => $operator,
            ':qty'      => $task['planned'],
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
}
