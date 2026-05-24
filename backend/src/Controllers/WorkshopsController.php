<?php
namespace Marshrut\Controllers;

use Marshrut\Database\Connection;
use Marshrut\Middleware\Auth;
use function Marshrut\json_out;
use function Marshrut\request_body;
use function Marshrut\validate;
use function Marshrut\sanitize_string;
use function Marshrut\app_log;

class WorkshopsController
{
    // GET /api/workshops
    public static function index(array $params): void
    {
        $db = Connection::get();
        $stmt = $db->query(
            'SELECT w.*,
                    COUNT(DISTINCT o.id)  AS orders_count,
                    COUNT(DISTINCT t.id)  AS tasks_count,
                    SUM(t.status = "in_progress") AS tasks_in_progress
               FROM workshops w
               LEFT JOIN orders o ON o.workshop_id = w.id AND o.status NOT IN ("done","cancelled")
               LEFT JOIN tasks  t ON t.workshop_id = w.id
              GROUP BY w.id
              ORDER BY w.code'
        );
        json_out(['data' => $stmt->fetchAll()]);
    }

    // GET /api/workshops/{id}
    public static function show(array $params): void
    {
        $db = Connection::get();
        $stmt = $db->prepare('SELECT * FROM workshops WHERE id = :id');
        $stmt->execute([':id' => $params['id']]);
        $w = $stmt->fetch();
        if (!$w) json_out(['error' => 'Цех не найден'], 404);
        json_out($w);
    }

    // POST /api/workshops
    public static function create(array $params): void
    {
        Auth::can('orders.edit');
        $body = request_body();
        if ($err = validate($body, ['code', 'name'])) json_out(['error' => $err], 422);

        $db = Connection::get();
        $db->prepare(
            'INSERT INTO workshops (code, name, description, is_active)
             VALUES (:code, :name, :desc, 1)'
        )->execute([
            ':code' => sanitize_string($body['code'], 20),
            ':name' => sanitize_string($body['name'], 100),
            ':desc' => sanitize_string($body['description'] ?? '', 255) ?: null,
        ]);
        $id = $db->lastInsertId();
        app_log('info', 'workshop.created', ['id' => $id, 'code' => $body['code']]);
        self::show(['id' => $id]);
    }

    // PUT /api/workshops/{id}
    public static function update(array $params): void
    {
        Auth::can('orders.edit');
        $body = request_body();
        if ($err = validate($body, ['code', 'name'])) json_out(['error' => $err], 422);

        $db = Connection::get();
        $db->prepare(
            'UPDATE workshops SET code=:code, name=:name, description=:desc,
                                  is_active=:active
              WHERE id = :id'
        )->execute([
            ':code'   => sanitize_string($body['code'], 20),
            ':name'   => sanitize_string($body['name'], 100),
            ':desc'   => sanitize_string($body['description'] ?? '', 255) ?: null,
            ':active' => (int)($body['is_active'] ?? 1),
            ':id'     => $params['id'],
        ]);
        app_log('info', 'workshop.updated', ['id' => $params['id']]);
        self::show($params);
    }

    // DELETE /api/workshops/{id}
    public static function delete(array $params): void
    {
        Auth::can('orders.edit');
        $db = Connection::get();
        // Открепляем заказы от цеха
        $db->prepare('UPDATE orders SET workshop_id = NULL WHERE workshop_id = :id')
           ->execute([':id' => $params['id']]);
        $db->prepare('DELETE FROM workshops WHERE id = :id')
           ->execute([':id' => $params['id']]);
        app_log('info', 'workshop.deleted', ['id' => $params['id']]);
        json_out(['deleted' => true]);
    }

    // GET /api/workshops/{id}/load — загрузка оборудования цеха
    public static function load(array $params): void
    {
        Auth::require();
        $db   = Connection::get();
        $days = max(1, min(30, (int)($_GET['days'] ?? 7)));

        // Загрузка по рабочим центрам за N дней
        $stmt = $db->prepare(
            'SELECT
                t.work_center,
                COUNT(*) AS total_tasks,
                SUM(t.status = "done")        AS done,
                SUM(t.status = "in_progress") AS in_progress,
                SUM(t.status = "waiting")     AS waiting,
                SUM(t.status = "paused")      AS paused,
                SUM(t.status = "rejected")    AS rejected,
                SUM(t.time_min * t.planned)   AS planned_min,
                SUM(CASE WHEN t.status="done"
                    THEN t.time_min * t.completed
                    ELSE 0 END)               AS done_min,
                ROUND(SUM(t.status="done") * 100.0 / NULLIF(COUNT(*),0), 1) AS pct
             FROM tasks t
             WHERE t.workshop_id = :wid
               AND t.updated_at >= DATE_SUB(NOW(), INTERVAL :days DAY)
             GROUP BY t.work_center
             ORDER BY planned_min DESC'
        );
        $stmt->execute([':wid' => $params['id'], ':days' => $days]);
        $centers = $stmt->fetchAll();

        // Динамика по дням
        $daily = $db->prepare(
            'SELECT
                DATE(t.updated_at)            AS day,
                COUNT(*)                      AS operations,
                SUM(t.status = "done")        AS done,
                SUM(t.time_min * t.completed) AS actual_min
             FROM tasks t
             WHERE t.workshop_id = :wid
               AND t.updated_at >= DATE_SUB(NOW(), INTERVAL :days DAY)
               AND t.status = "done"
             GROUP BY DATE(t.updated_at)
             ORDER BY day ASC'
        );
        $daily->execute([':wid' => $params['id'], ':days' => $days]);

        // Активные заказы в цехе
        $orders = $db->prepare(
            'SELECT o.id, o.number, o.customer, o.status,
                    COUNT(t.id)                       AS total_tasks,
                    SUM(t.status = "done")            AS done_tasks,
                    SUM(t.status = "in_progress")     AS active_tasks,
                    SUM(t.time_min * t.planned)       AS planned_min,
                    SUM(CASE WHEN t.status="done"
                        THEN t.actual_time_min ELSE 0 END) AS actual_min
               FROM orders o
               JOIN tasks t ON t.order_id = o.id AND t.workshop_id = :wid
              WHERE o.status NOT IN ("done","cancelled")
              GROUP BY o.id
              ORDER BY o.due_date ASC'
        );
        $orders->execute([':wid' => $params['id']]);

        json_out([
            'centers'    => $centers,
            'daily'      => $daily->fetchAll(),
            'orders'     => $orders->fetchAll(),
        ]);
    }

    // GET /api/workshops/{id}/equipment
    public static function equipment(array $params): void
    {
        Auth::require();
        $db = Connection::get();
        $stmt = $db->prepare('SELECT * FROM equipment WHERE workshop_id = :id ORDER BY code');
        $stmt->execute([':id' => $params['id']]);
        json_out(['data' => $stmt->fetchAll()]);
    }

    // POST /api/workshops/{id}/equipment
    public static function addEquipment(array $params): void
    {
        Auth::can('orders.edit');
        $body = request_body();
        if ($err = validate($body, ['code', 'name'])) json_out(['error' => $err], 422);

        $db = Connection::get();
        $db->prepare(
            'INSERT INTO equipment (workshop_id, code, name, type, is_active) VALUES (:wid, :code, :name, :type, 1)'
        )->execute([
            ':wid'  => $params['id'],
            ':code' => sanitize_string($body['code'], 30),
            ':name' => sanitize_string($body['name'], 150),
            ':type' => sanitize_string($body['type'] ?? '', 100) ?: null,
        ]);
        $id = $db->lastInsertId();
        $db->prepare('SELECT * FROM equipment WHERE id = :id')->execute([':id' => $id]);
        $stmt = $db->prepare('SELECT * FROM equipment WHERE id = :id');
        $stmt->execute([':id' => $id]);
        json_out($stmt->fetch());
    }

    // DELETE /api/equipment/{id}
    public static function deleteEquipment(array $params): void
    {
        Auth::can('orders.edit');
        $db = Connection::get();
        $db->prepare('DELETE FROM equipment WHERE id = :id')->execute([':id' => $params['id']]);
        json_out(['deleted' => true]);
    }

    // GET /api/equipment — все станки для выбора в операциях
    public static function allEquipment(array $params): void
    {
        Auth::require();
        $db = Connection::get();
        $stmt = $db->query(
            'SELECT e.*, w.name AS workshop_name, w.code AS workshop_code
               FROM equipment e
               JOIN workshops w ON w.id = e.workshop_id
              WHERE e.is_active = 1
              ORDER BY w.code, e.code'
        );
        json_out(['data' => $stmt->fetchAll()]);
    }
}
