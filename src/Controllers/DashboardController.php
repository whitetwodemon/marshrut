<?php
// src/Controllers/DashboardController.php

namespace Marshrut\Controllers;

use Marshrut\Database\Connection;
use function Marshrut\json_out;

class DashboardController
{
    // GET /api/dashboard
    public static function index(array $params): void
    {
        $db = Connection::get();

        // Orders summary
        $orders = $db->query(
            'SELECT
                COUNT(*) AS total,
                SUM(status="in_work") AS in_work,
                SUM(status="done")    AS done,
                SUM(status="plan")    AS plan
             FROM orders'
        )->fetch();

        // Tasks summary
        $tasks = $db->query(
            'SELECT
                COUNT(*) AS total,
                SUM(status="done")        AS done,
                SUM(status="in_progress") AS in_progress,
                SUM(status="waiting")     AS waiting
             FROM tasks'
        )->fetch();

        // Overdue: orders past due_date still not done
        $overdue = $db->query(
            'SELECT COUNT(*) AS count FROM orders
              WHERE due_date < CURDATE() AND status != "done"'
        )->fetchColumn();

        // Today scans
        $today_scans = $db->query(
            'SELECT COUNT(*) FROM scan_log WHERE DATE(scanned_at) = CURDATE()'
        )->fetchColumn();

        // Recent scan log (last 10)
        $recent = $db->query(
            'SELECT sl.*, d.code AS detail_code
               FROM scan_log sl
               LEFT JOIN details d ON d.id = sl.detail_id
              ORDER BY sl.scanned_at DESC
              LIMIT 10'
        )->fetchAll();

        // In-progress tasks with detail info
        $active_tasks = $db->query(
            'SELECT t.*, d.code AS detail_code, d.name AS detail_name
               FROM tasks t
               JOIN details d ON d.id = t.detail_id
              WHERE t.status = "in_progress"
              ORDER BY t.updated_at DESC
              LIMIT 20'
        )->fetchAll();

        json_out([
            'orders'       => $orders,
            'tasks'        => $tasks,
            'overdue'      => (int) $overdue,
            'today_scans'  => (int) $today_scans,
            'recent_scans' => $recent,
            'active_tasks' => $active_tasks,
        ]);
    }
}
