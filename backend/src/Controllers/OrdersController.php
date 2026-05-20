<?php
// src/Controllers/OrdersController.php

namespace Marshrut\Controllers;

use Marshrut\Database\Connection;
use function Marshrut\json_out;
use function Marshrut\request_body;
use function Marshrut\validate;

class OrdersController
{
    // GET /api/orders
    public static function index(array $params): void
    {
        $db     = Connection::get();
        $status = $_GET['status'] ?? '';

        $sql  = 'SELECT * FROM orders';
        $args = [];

        if ($status !== '') {
            $sql  .= ' WHERE status = :status';
            $args[':status'] = $status;
        }

        $sql .= ' ORDER BY created_at DESC';

        $stmt = $db->prepare($sql);
        $stmt->execute($args);
        $orders = $stmt->fetchAll();

        foreach ($orders as &$order) {
            $order['items'] = self::loadItems($db, $order['id']);
            $order['stats'] = self::loadStats($db, $order['id']);
        }

        json_out(['data' => $orders, 'total' => count($orders)]);
    }

    // GET /api/orders/{id}
    public static function show(array $params): void
    {
        $db   = Connection::get();
        $stmt = $db->prepare('SELECT * FROM orders WHERE id = :id');
        $stmt->execute([':id' => $params['id']]);
        $order = $stmt->fetch();

        if (!$order) {
            json_out(['error' => 'Order not found'], 404);
        }

        $order['items'] = self::loadItems($db, $order['id']);
        $order['stats'] = self::loadStats($db, $order['id']);

        json_out($order);
    }

    // POST /api/orders
    public static function create(array $params): void
    {
        $body = request_body();
        if ($err = validate($body, ['number', 'customer', 'due_date'])) {
            json_out(['error' => $err], 422);
        }

        $db = Connection::get();

        // Generate unique ID on server — never trust client-supplied IDs
        $id = self::generateId($db);

        // Extra guard: if somehow same ID slipped through, regenerate
        $check = $db->prepare('SELECT 1 FROM orders WHERE id = :id');
        $check->execute([':id' => $id]);
        if ($check->fetch()) {
            $id = self::generateId($db);
        }

        try {
            $db->beginTransaction();

            $db->prepare(
                'INSERT INTO orders (id, number, customer, foreman, status, priority, due_date, created_at)
                 VALUES (:id, :number, :customer, :foreman, :status, :priority, :due_date, :created_at)'
            )->execute([
                ':id'         => $id,
                ':number'     => $body['number'],
                ':customer'   => $body['customer'],
                ':foreman'    => $body['foreman']    ?? null,
                ':status'     => $body['status']     ?? 'plan',
                ':priority'   => $body['priority']   ?? 'normal',
                ':due_date'   => $body['due_date'],
                ':created_at' => $body['created_at'] ?? date('Y-m-d'),
            ]);

            if (!empty($body['items'])) {
                self::insertItems($db, $id, $body['items']);
                self::generateTasks($db, $id);
            }

            $db->commit();
        } catch (\Exception $e) {
            $db->rollBack();
            json_out(['error' => $e->getMessage()], 500);
        }

        self::show(['id' => $id]);
    }

    // PUT /api/orders/{id}
    public static function update(array $params): void
    {
        $db   = Connection::get();
        $body = request_body();

        $db->prepare(
            'UPDATE orders SET number=:number, customer=:customer, foreman=:foreman,
                               status=:status, priority=:priority, due_date=:due_date
              WHERE id = :id'
        )->execute([
            ':id'       => $params['id'],
            ':number'   => $body['number']   ?? '',
            ':customer' => $body['customer'] ?? '',
            ':foreman'  => $body['foreman']  ?? null,
            ':status'   => $body['status']   ?? 'plan',
            ':priority' => $body['priority'] ?? 'normal',
            ':due_date' => $body['due_date'] ?? date('Y-m-d'),
        ]);

        if (isset($body['items'])) {
            // Remove tasks that belong to this order, then regenerate
            $db->prepare('DELETE FROM tasks WHERE order_id = :id')
               ->execute([':id' => $params['id']]);
            $db->prepare('DELETE FROM order_items WHERE order_id = :id')
               ->execute([':id' => $params['id']]);

            self::insertItems($db, $params['id'], $body['items']);
            self::generateTasks($db, $params['id']);
        }

        self::show($params);
    }

    // DELETE /api/orders/{id}
    public static function delete(array $params): void
    {
        $db = Connection::get();
        $db->prepare('DELETE FROM orders WHERE id = :id')
           ->execute([':id' => $params['id']]);
        json_out(['deleted' => true]);
    }

    // ----------------------------------------------------------------
    // Private helpers
    // ----------------------------------------------------------------

    private static function generateId(\PDO $db): string
    {
        do {
            $id = 'O-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
            $exists = $db->prepare('SELECT 1 FROM orders WHERE id = :id');
            $exists->execute([':id' => $id]);
        } while ($exists->fetch());
        return $id;
    }

    private static function loadItems(\PDO $db, string $orderId): array
    {
        $stmt = $db->prepare(
            'SELECT oi.detail_id, oi.quantity, d.code, d.name, d.unit
               FROM order_items oi
               JOIN details d ON d.id = oi.detail_id
              WHERE oi.order_id = :id'
        );
        $stmt->execute([':id' => $orderId]);
        return $stmt->fetchAll();
    }

    private static function loadStats(\PDO $db, string $orderId): array
    {
        $stmt = $db->prepare(
            'SELECT
                COUNT(*) AS total_tasks,
                SUM(CASE WHEN status="done" THEN 1 ELSE 0 END) AS done_tasks,
                SUM(CASE WHEN status="in_progress" THEN 1 ELSE 0 END) AS in_progress_tasks,
                SUM(CASE WHEN status="waiting" THEN 1 ELSE 0 END) AS waiting_tasks,
                SUM(time_min * planned) AS total_time_min
               FROM tasks
              WHERE order_id = :id'
        );
        $stmt->execute([':id' => $orderId]);
        return $stmt->fetch();
    }

    private static function insertItems(\PDO $db, string $orderId, array $items): void
    {
        // Дедупликация: если одна деталь добавлена дважды — берём последнее количество
        $unique = [];
        foreach ($items as $item) {
            $did = $item['detail_id'] ?? $item['detailId'] ?? null;
            if ($did) $unique[$did] = (int) $item['quantity'];
        }

        $stmt = $db->prepare(
            'INSERT IGNORE INTO order_items (order_id, detail_id, quantity) VALUES (:oid, :did, :qty)'
        );
        foreach ($unique as $did => $qty) {
            $stmt->execute([':oid' => $orderId, ':did' => $did, ':qty' => $qty]);
        }
    }

    private static function generateTasks(\PDO $db, string $orderId): void
    {
        $items = $db->prepare(
            'SELECT oi.detail_id, oi.quantity, o.num, o.name, o.work_center, o.time_min
               FROM order_items oi
               JOIN operations o ON o.detail_id = oi.detail_id
              WHERE oi.order_id = :id
              ORDER BY oi.detail_id, o.num'
        );
        $items->execute([':id' => $orderId]);

        $ins = $db->prepare(
            'INSERT IGNORE INTO tasks
                (id, order_id, detail_id, op_num, op_name, work_center, time_min, planned, qr_text)
             VALUES (:id, :oid, :did, :num, :name, :wc, :time, :qty, :qr)'
        );

        $orderNum = str_starts_with($orderId, 'O-') ? substr($orderId, 2) : $orderId;

        foreach ($items->fetchAll() as $row) {
            $detId  = $row['detail_id'];
            $detNum = str_starts_with($detId, 'D-') ? substr($detId, 2) : $detId;
            $taskId = "OT-{$orderNum}-{$detNum}-{$row['num']}";
            $qr     = "OTASK:{$orderNum}-{$detNum}-{$row['num']}";

            $ins->execute([
                ':id'   => $taskId,
                ':oid'  => $orderId,
                ':did'  => $row['detail_id'],
                ':num'  => (int) $row['num'],
                ':name' => $row['name'],
                ':wc'   => $row['work_center'],
                ':time' => (int) $row['time_min'],
                ':qty'  => (int) $row['quantity'],
                ':qr'   => $qr,
            ]);
        }
    }
}
