<?php
/**
 * OrdersController.php — CRUD заказов и генерация заданий
 *
 * Маршруты:
 *   GET    /api/orders           — список заказов (с фильтром по статусу)
 *   GET    /api/orders/{id}      — один заказ с позициями
 *   POST   /api/orders           — создать заказ + сгенерировать задания
 *   PUT    /api/orders/{id}      — обновить заказ
 *   DELETE /api/orders/{id}      — удалить заказ и все задания
 *   POST   /api/orders/{id}/add-task — добавить операцию в существующий заказ
 *   POST   /api/orders/next-number   — сгенерировать следующий номер (W/D/K)
 *
 * Логика generateTasks():
 *   При создании заказа для каждой позиции (деталь × количество) создаётся
 *   набор заданий по операциям из техкарты детали. Каждое задание привязывается
 *   к рабочему центру и получает уникальный QR код.
 */

// src/Controllers/OrdersController.php

namespace Marshrut\Controllers;

use Marshrut\Database\Connection;
use function Marshrut\json_out;
use function Marshrut\json_error;
use function Marshrut\request_body;
use function Marshrut\validate;
use function Marshrut\sanitize_string;
use function Marshrut\app_log;

class OrdersController
{
    // GET /api/orders
    public static function index(array $params): void
    {
        $db     = Connection::get();
        $status = $_GET['status'] ?? '';
        $limit  = max(1, min(200, (int)($_GET['limit']  ?? 100)));
        $offset = max(0, (int)($_GET['offset'] ?? 0));

        $statusAll = ($status === 'all' || $status === '');
        $where = !$statusAll ? ' WHERE status = :status' : '';
        $args  = !$statusAll ? [':status' => $status] : [];

        $total = $db->prepare("SELECT COUNT(*) FROM orders{$where}");
        $total->execute($args);
        $totalCount = (int)$total->fetchColumn();

        $stmt = $db->prepare("SELECT * FROM orders{$where} ORDER BY created_at DESC LIMIT :lim OFFSET :off");
        $args[':lim'] = $limit;
        $args[':off'] = $offset;
        $stmt->execute($args);
        $orders = $stmt->fetchAll();

        foreach ($orders as &$order) {
            $order['items'] = self::loadItems($db, $order['id']);
            $order['stats'] = self::loadStats($db, $order['id']);
        }

        json_out(['data' => $orders, 'total' => $totalCount, 'limit' => $limit, 'offset' => $offset]);
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
        if ($err = validate($body, ['number', 'due_date'])) {
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

        $allowed_statuses = ['draft','plan','waiting_material','waiting_equipment','waiting_approval','in_work','paused','done','cancelled','problem','shipped','archived'];
        $status = in_array($body['status'] ?? 'draft', $allowed_statuses) ? ($body['status'] ?? 'draft') : 'draft';

        $number = sanitize_string($body['number'], 50);

        // Защита от коллизии номера: если номер уже занят (два пользователя
        // открыли форму одновременно) — сервер перегенерирует следующий и повторит.
        $maxRetries = 3;
        for ($attempt = 1; $attempt <= $maxRetries; $attempt++) {
            try {
                $db->beginTransaction();

                $db->prepare(
                    'INSERT INTO orders (id, number, customer, foreman, workshop_id, status, priority, due_date, created_at, comment)
                     VALUES (:id, :number, :customer, :foreman, :workshop_id, :status, :priority, :due_date, :created_at, :comment)'
                )->execute([
                    ':id'          => $id,
                    ':number'      => $number,
                    ':customer'    => sanitize_string($body['customer'], 255),
                    ':foreman'     => sanitize_string($body['foreman'] ?? '', 100) ?: null,
                    ':workshop_id' => $body['workshop_id'] ?? null,
                    ':status'      => $status,
                    ':priority'    => $body['priority']   ?? 'normal',
                    ':due_date'    => $body['due_date'],
                    ':created_at'  => $body['created_at'] ?? date('Y-m-d'),
                    ':comment'     => sanitize_string($body['comment'] ?? '', 1000) ?: null,
                ]);

                if (!empty($body['items'])) {
                    self::insertItems($db, $id, $body['items']);
                    self::generateTasks($db, $id);
                }

                $db->commit();
                break; // успех — выходим из цикла
            } catch (\PDOException $e) {
                $db->rollBack();
                // 23000 = нарушение UNIQUE (номер уже занят)
                if ($e->getCode() === '23000' && $attempt < $maxRetries) {
                    // Перегенерируем следующий номер из реального MAX и повторяем
                    $number = self::regenerateNumber($db, $number);
                    continue;
                }
                json_error($e);
                return;
            } catch (\Exception $e) {
                $db->rollBack();
                json_error($e);
                return;
            }
        }

        self::show(['id' => $id]);
    }

    // PUT /api/orders/{id}
    public static function update(array $params): void
    {
        $db   = Connection::get();
        $body = request_body();

        $allowed_statuses = ['draft','plan','waiting_material','waiting_equipment','waiting_approval','in_work','paused','done','cancelled','problem','shipped','archived'];
        $allowed_priority = ['low', 'normal', 'high', 'urgent'];

        // Если передан только статус (например при отгрузке) — читаем текущие данные из БД
        $existing = $db->prepare('SELECT * FROM orders WHERE id = :id');
        $existing->execute([':id' => $params['id']]);
        $current = $existing->fetch();
        if (!$current) { json_out(['error' => 'Order not found'], 404); }

        $number   = sanitize_string($body['number']   ?? $current['number'],   50);
        $customer = sanitize_string($body['customer'] ?? $current['customer']  ?? '', 255);
        $foreman  = sanitize_string($body['foreman']  ?? $current['foreman']   ?? '', 100) ?: null;
        $dueDate  = $body['due_date'] ?? $current['due_date'];
        $status   = in_array($body['status']   ?? $current['status'],   $allowed_statuses, true) ? ($body['status']   ?? $current['status'])   : $current['status'];
        $priority = in_array($body['priority'] ?? $current['priority'], $allowed_priority, true) ? ($body['priority'] ?? $current['priority']) : $current['priority'];
        $comment  = sanitize_string($body['comment'] ?? $current['comment'] ?? '', 1000) ?: null;
        $wshop    = $body['workshop_id'] ?? $current['workshop_id'];

        try {
            $db->beginTransaction();

            $db->prepare(
                'UPDATE orders SET number=:number, customer=:customer, foreman=:foreman,
                                   workshop_id=:workshop_id, status=:status, priority=:priority,
                                   due_date=:due_date, comment=:comment, updated_at=NOW()
                  WHERE id = :id'
            )->execute([
                ':id'          => $params['id'],
                ':number'      => $number,
                ':customer'    => $customer,
                ':foreman'     => $foreman,
                ':workshop_id' => $wshop,
                ':status'      => $status,
                ':priority'    => $priority,
                ':due_date'    => $dueDate,
                ':comment'     => $comment,
            ]);

            if (isset($body['items'])) {
                $db->prepare('DELETE FROM tasks WHERE order_id = :id')->execute([':id' => $params['id']]);
                $db->prepare('DELETE FROM order_items WHERE order_id = :id')->execute([':id' => $params['id']]);
                self::insertItems($db, $params['id'], $body['items']);
                self::generateTasks($db, $params['id']);
            }

            $db->commit();
            app_log('info', 'order.updated', ['id' => $params['id'], 'status' => $status]);
            // Уведомления по смене статуса
            if ($status === 'done') {
                \Marshrut\Controllers\NotificationsController::notify('foreman', 'order_done', 'Заказ ' . $params['id'] . ' выполнен', null, $params['id']);
            } elseif ($status === 'in_work') {
                \Marshrut\Controllers\NotificationsController::notify('operator', 'order_in_work', 'Новый заказ в работе: ' . $params['id'], 'Появились задания на постах', $params['id']);
            }
        } catch (\Exception $e) {
            $db->rollBack();
            app_log('error', 'order.update_failed', ['id' => $params['id'], 'err' => $e->getMessage()]);
            json_error($e);
        }

        self::show($params);
    }

    // DELETE /api/orders/{id}
    public static function delete(array $params): void
    {
        $db = Connection::get();
        $id = $params['id'];

        $db->beginTransaction();
        try {
            // Удаляем все связанные данные вручную (нет FK CASCADE в схеме)
            $taskIds = $db->prepare('SELECT id FROM tasks WHERE order_id = :id');
            $taskIds->execute([':id' => $id]);
            $ids = $taskIds->fetchAll(\PDO::FETCH_COLUMN);

            if ($ids) {
                $placeholders = implode(',', array_fill(0, count($ids), '?'));
                $db->prepare("DELETE FROM task_events  WHERE task_id IN ($placeholders)")->execute($ids);
                $db->prepare("DELETE FROM task_pauses  WHERE task_id IN ($placeholders)")->execute($ids);
                $db->prepare("DELETE FROM scan_log     WHERE task_id IN ($placeholders)")->execute($ids);
                $db->prepare("DELETE FROM tasks        WHERE order_id = ?")->execute([$id]);
            }

            $db->prepare('DELETE FROM order_items WHERE order_id = :id')->execute([':id' => $id]);
            $db->prepare('DELETE FROM wc_order_priority WHERE order_id = :id')->execute([':id' => $id]);
            $db->prepare('DELETE FROM orders WHERE id = :id')->execute([':id' => $id]);

            $db->commit();
            json_out(['deleted' => true]);
        } catch (\Exception $e) {
            $db->rollBack();
            json_error($e);
        }
    }

    // ----------------------------------------------------------------
    // Private helpers
    // ----------------------------------------------------------------

    /** Перегенерация номера при коллизии: префикс из старого + MAX+1 */
    private static function regenerateNumber(\PDO $db, string $oldNumber): string
    {
        // Формат: W_26_000008 → префикс "W_26_", далее счётчик
        if (preg_match('/^([A-Z]_\d{2}_)(\d+)$/', $oldNumber, $m)) {
            $prefix = $m[1];
            $stmt = $db->prepare(
                "SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(number, '_', -1) AS UNSIGNED)), 0)
                   FROM orders WHERE number LIKE :pfx"
            );
            $stmt->execute([':pfx' => $prefix . '%']);
            $next = (int) $stmt->fetchColumn() + 1;
            return $prefix . str_pad((string) $next, 6, '0', STR_PAD_LEFT);
        }
        // Неизвестный формат — суффикс времени гарантирует уникальность
        return $oldNumber . '-' . substr((string) time(), -4);
    }

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

    /** Публичная обёртка для вызова из SpecificationsController */
    public static function generateTasksPublic(\PDO $db, string $orderId): void
    {
        self::generateTasks($db, $orderId);
    }

    private static function generateTasks(\PDO $db, string $orderId): void
    {
        // Страховка: колонки comment могли не появиться (миграция 013 не прошла) —
        // и в operations (для SELECT), и в tasks (для INSERT ниже).
        try {
            $hasOp = $db->query("SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'operations' AND COLUMN_NAME = 'comment'")->fetchColumn();
            if (!$hasOp) {
                $db->exec("ALTER TABLE operations ADD COLUMN comment VARCHAR(500) NULL");
                app_log('warn', 'schema_drift', ['table' => 'operations', 'column' => 'comment']);
            }
            $hasTask = $db->query("SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'comment'")->fetchColumn();
            if (!$hasTask) {
                $db->exec("ALTER TABLE tasks ADD COLUMN comment TEXT NULL");
                app_log('warn', 'schema_drift', ['table' => 'tasks', 'column' => 'comment']);
            }
        } catch (\Throwable $e) { /* SQLite/тесты — пропускаем */ }

        $items = $db->prepare(
            'SELECT oi.detail_id, oi.quantity, o.num, o.name, o.work_center, o.time_min, o.setup_time_min, o.comment
               FROM order_items oi
               JOIN operations o ON o.detail_id = oi.detail_id
              WHERE oi.order_id = :id
              ORDER BY oi.detail_id, o.num'
        );
        $items->execute([':id' => $orderId]);

        $ins = $db->prepare(
            'INSERT IGNORE INTO tasks
                (id, order_id, detail_id, op_num, op_name, work_center, workshop_id, time_min, setup_time_min, planned, qr_text, comment)
             VALUES (:id, :oid, :did, :num, :name, :wc, :wid, :time, :setup, :qty, :qr, :comment)'
        );

        $orderNum = str_starts_with($orderId, 'O-') ? substr($orderId, 2) : $orderId;

        // Get workshop_id from order
        $workshopStmt = $db->prepare('SELECT workshop_id FROM orders WHERE id = :id');
        $workshopStmt->execute([':id' => $orderId]);
        $workshopId = $workshopStmt->fetchColumn() ?: null;

        foreach ($items->fetchAll() as $row) {
            $detId  = $row['detail_id'];
            $detNum = str_starts_with($detId, 'D-') ? substr($detId, 2) : $detId;
            $taskId = "OT-{$orderNum}-{$detNum}-{$row['num']}";
            $qr     = "OTASK:{$orderNum}-{$detNum}-{$row['num']}";

            $ins->execute([
                ':id'    => $taskId,
                ':oid'   => $orderId,
                ':did'   => $row['detail_id'],
                ':num'   => (int) $row['num'],
                ':name'  => $row['name'],
                ':wc'    => $row['work_center'],
                ':wid'   => $workshopId,
                ':time'  => (int) $row['time_min'],
                ':setup' => (int) ($row['setup_time_min'] ?? 0),
                ':qty'   => (int) $row['quantity'],
                ':qr'    => $qr,
                ':comment' => $row['comment'] ?? null,
            ]);
        }
    }

    // POST /api/orders/{id}/add-task — добавить операцию в существующий заказ
    public static function addTask(array $params): void
    {
        $db   = Connection::get();
        $body = request_body();

        if (empty($body['detail_id']) || empty($body['op_name']) || empty($body['work_center'])) {
            json_out(['error' => 'detail_id, op_name, work_center обязательны'], 422);
        }

        // Проверяем заказ
        $order = $db->prepare('SELECT * FROM orders WHERE id = :id');
        $order->execute([':id' => $params['id']]);
        $order = $order->fetch();
        if (!$order) json_out(['error' => 'Order not found'], 404);

        $orderId  = $params['id'];
        $orderNum = str_starts_with($orderId, 'O-') ? substr($orderId, 2) : $orderId;
        $detId    = sanitize_string($body['detail_id'], 20);
        $detNum   = str_starts_with($detId, 'D-') ? substr($detId, 2) : $detId;
        $opNum    = (int) ($body['op_num'] ?? 10);
        $opName   = sanitize_string($body['op_name'], 255);
        $wc       = sanitize_string($body['work_center'], 100);
        $timeMin  = (int) ($body['time_min'] ?? 0);
        $setupMin = (int) ($body['setup_time_min'] ?? 0);

        // Найти количество деталей из order_items
        $qi = $db->prepare('SELECT quantity FROM order_items WHERE order_id=:oid AND detail_id=:did');
        $qi->execute([':oid' => $orderId, ':did' => $detId]);
        $qty = (int) ($qi->fetchColumn() ?: 1);

        // Use timestamp to avoid ID collision on duplicate op_num
        $taskId = "OT-" . substr($orderId, 0, 8) . "-" . $detNum . "-" . $opNum . "-" . substr(uniqid(), -4);
        $qr     = "OTASK:{$orderNum}-{$detNum}-{$opNum}";

        // Найти work_center_id если есть
        $wcId = null;
        $wcRow = $db->prepare('SELECT id FROM work_centers WHERE code = :code LIMIT 1');
        $wcRow->execute([':code' => $wc]);
        $wcId = $wcRow->fetchColumn() ?: null;

        try {
            $db->prepare(
                'INSERT INTO tasks (id, order_id, detail_id, op_num, op_name, work_center, work_center_id, time_min, setup_time_min, planned, qr_text, status)
                 VALUES (:id, :oid, :did, :num, :name, :wc, :wcid, :time, :setup, :planned, :qr, "waiting")'
            )->execute([
                ':id'      => $taskId,
                ':oid'     => $orderId,
                ':did'     => $detId,
                ':num'     => $opNum,
                ':name'    => $opName,
                ':wc'      => $wc,
                ':wcid'    => $wcId,
                ':time'    => $timeMin,
                ':setup'   => $setupMin,
                ':planned' => $qty,
                ':qr'      => $qr,
            ]);
            app_log('info', 'task.added_manually', ['task_id' => $taskId, 'order_id' => $orderId]);
            json_out(['id' => $taskId, 'op_num' => $opNum, 'op_name' => $opName, 'work_center' => $wc]);
        } catch (\Exception $e) {
            json_error($e);
        }
    }
    // Гарантирует, что orders поддерживает статус «problem» и комментарий
    private static function ensureProblemColumns(\PDO $db): void
    {
        static $checked = false;
        if ($checked) return;
        $checked = true;
        // status должен быть VARCHAR (ENUM мог не содержать 'problem')
        try { $db->exec("ALTER TABLE orders MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'plan'"); }
        catch (\Throwable $e) { /* уже VARCHAR — игнор */ }
        // колонка problem_comment
        $has = $db->query(
            "SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'problem_comment'"
        )->fetchColumn();
        if (!$has) {
            try { $db->exec("ALTER TABLE orders ADD COLUMN problem_comment TEXT NULL"); app_log('warn', 'schema_drift', ['table' => 'orders', 'column' => 'problem_comment']); }
            catch (\Throwable $e) { /* гонка — игнор */ }
        }
    }

    // POST /api/orders/{id}/problem — пометить заказ как «Проблема» (нет материала/инструмента)
    public static function markProblem(array $params): void
    {
        $body = request_body();
        $db   = Connection::get();
        self::ensureProblemColumns($db);
        $comment = sanitize_string($body['comment'] ?? '', 500);
        if ($comment === '') json_out(['error' => 'Укажите причину проблемы'], 422);

        $order = $db->prepare('SELECT id, status FROM orders WHERE id = :id');
        $order->execute([':id' => $params['id']]);
        if (!$order->fetch()) json_out(['error' => 'Заказ не найден'], 404);

        $db->prepare("UPDATE orders SET status = 'problem', problem_comment = :c, updated_at = NOW() WHERE id = :id")
           ->execute([':c' => $comment, ':id' => $params['id']]);
        app_log('warn', 'order.problem', ['order_id' => $params['id'], 'comment' => $comment]);
        // Уведомляем старших мастеров о проблеме
        \Marshrut\Controllers\NotificationsController::notify(
            'foreman', 'problem', 'Проблема по заказу ' . $params['id'], $comment, $params['id']
        );
        json_out(['ok' => true, 'status' => 'problem', 'problem_comment' => $comment]);
    }

    // POST /api/orders/{id}/resolve — снять «Проблему» (только мастер/админ)
    public static function resolveProblem(array $params): void
    {
        $body = request_body();
        $db   = Connection::get();
        self::ensureProblemColumns($db);
        $new  = sanitize_string($body['status'] ?? 'in_work', 30);
        $allowed = ['plan', 'in_work'];
        if (!in_array($new, $allowed, true)) $new = 'in_work';

        $order = $db->prepare('SELECT id, status FROM orders WHERE id = :id');
        $order->execute([':id' => $params['id']]);
        $o = $order->fetch();
        if (!$o) json_out(['error' => 'Заказ не найден'], 404);

        $db->prepare("UPDATE orders SET status = :s, problem_comment = NULL, updated_at = NOW() WHERE id = :id")
           ->execute([':s' => $new, ':id' => $params['id']]);
        app_log('info', 'order.resolved', ['order_id' => $params['id'], 'new_status' => $new]);
        json_out(['ok' => true, 'status' => $new]);
    }
    // GET /api/orders/{id}/comments — все комментарии операторов по операциям заказа
    public static function comments(array $params): void
    {
        $db = Connection::get();
        // task_events может ещё не существовать на старых инстансах — создаём при необходимости
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

        $sql = "SELECT te.id, te.task_id, te.event_type, te.operator, te.comment, te.created_at,
                       t.op_num, t.op_name, t.detail_id, t.work_center,
                       d.name AS detail_name, d.code AS detail_code
                FROM task_events te
                JOIN tasks t ON t.id = te.task_id
                LEFT JOIN details d ON d.id = t.detail_id
                WHERE t.order_id = :oid
                  AND te.comment IS NOT NULL AND TRIM(te.comment) <> ''
                ORDER BY t.op_num ASC, te.created_at DESC";
        $stmt = $db->prepare($sql);
        $stmt->execute([':oid' => $params['id']]);
        $rows = $stmt->fetchAll();
        json_out(['data' => $rows, 'total' => count($rows)]);
    }
}
