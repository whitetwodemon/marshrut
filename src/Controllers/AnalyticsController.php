<?php
// AnalyticsController — Этап 2: аналитика производства.
// Агрегирует уже собираемые данные (нормоконтроль, ТПЗ, статусы) для визуализации.

namespace Marshrut\Controllers;

use Marshrut\Database\Connection;
use Marshrut\Middleware\Auth;
use function Marshrut\json_out;

class AnalyticsController
{
    // GET /api/analytics/roadmap — производственный роадмап: заказы по срокам
    public static function roadmap(array $params): void
    {
        Auth::require();
        \Marshrut\Controllers\SettingsController::requireFeature('feature_analytics', 'Аналитика');
        $db = Connection::get();

        // Заказы с прогрессом (по заданиям) и сроками
        $rows = $db->query(
            "SELECT o.id, o.number, o.customer, o.status, o.priority, o.created_at, o.due_date,
                    COUNT(t.id) AS total_tasks,
                    SUM(t.status = 'done') AS done_tasks
             FROM orders o
             LEFT JOIN tasks t ON t.order_id = o.id
             WHERE o.status NOT IN ('archived','cancelled')
             GROUP BY o.id
             ORDER BY (o.due_date IS NULL), o.due_date ASC, o.created_at ASC"
        )->fetchAll();

        $today = new \DateTimeImmutable('today');
        $items = [];
        foreach ($rows as $r) {
            $total = (int)$r['total_tasks'];
            $done  = (int)$r['done_tasks'];
            $due   = $r['due_date'] ? new \DateTimeImmutable($r['due_date']) : null;
            $daysLeft = $due ? (int)$today->diff($due)->format('%r%a') : null;
            $overdue  = ($due && $daysLeft !== null && $daysLeft < 0 && !in_array($r['status'], ['done','shipped'], true));
            $items[] = [
                'id'        => $r['id'],
                'number'    => $r['number'],
                'customer'  => $r['customer'],
                'status'    => $r['status'],
                'priority'  => $r['priority'],
                'created_at'=> $r['created_at'],
                'due_date'  => $r['due_date'],
                'progress'  => $total > 0 ? round($done / $total * 100) : 0,
                'total'     => $total,
                'done'      => $done,
                'days_left' => $daysLeft,
                'overdue'   => $overdue,
            ];
        }

        // Сводка по неделям (сколько заказов со сроком в каждую неделю вперёд)
        json_out([
            'orders'  => $items,
            'today'   => $today->format('Y-m-d'),
            'overdue' => count(array_filter($items, fn($i) => $i['overdue'])),
        ]);
    }

    // GET /api/analytics/production — загрузка РЦ, узкие места, план/факт
    public static function production(array $params): void
    {
        Auth::require();
        \Marshrut\Controllers\SettingsController::requireFeature('feature_analytics', 'Аналитика');
        $db = Connection::get();

        // ── Загрузка по рабочим центрам ──────────────────────────────
        // План = time * planned (мин), Факт = actual_time_min.
        $wc = $db->query(
            "SELECT
                COALESCE(NULLIF(t.work_center, ''), 'Без РЦ') AS wc,
                COUNT(*)                                       AS total,
                SUM(t.status = 'done')                         AS done,
                SUM(t.status = 'in_progress')                  AS in_progress,
                SUM(t.status IN ('waiting','paused') OR t.status IS NULL OR t.status = '') AS pending,
                SUM(t.time_min * t.planned)                        AS plan_min,
                SUM(CASE WHEN t.status = 'done' THEN t.time_min * t.planned ELSE 0 END) AS plan_done_min,
                SUM(CASE WHEN t.status = 'done' THEN COALESCE(t.actual_time_min,0) ELSE 0 END) AS fact_min
             FROM tasks t
             GROUP BY wc
             ORDER BY pending DESC, total DESC"
        )->fetchAll();

        // Приводим к числам + нормоконтроль и метка узкого места
        $centers = [];
        foreach ($wc as $r) {
            $plan = (int)$r['plan_min']; $fact = (int)$r['fact_min'];
            $planDone = (int)$r['plan_done_min'];
            $pending = (int)$r['pending'];
            // Нормоконтроль: факт vs план ТОЛЬКО по выполненным (иначе процент занижен)
            $normPct = ($planDone > 0 && $fact > 0) ? round($fact / $planDone * 100) : null;
            $centers[] = [
                'wc'          => $r['wc'],
                'total'       => (int)$r['total'],
                'done'        => (int)$r['done'],
                'in_progress' => (int)$r['in_progress'],
                'pending'     => $pending,
                'plan_hours'  => round($plan / 60, 1),
                'fact_hours'  => round($fact / 60, 1),
                'norm_pct'    => $normPct,
            ];
        }

        // ── Узкие места: больше всего ожидающих заданий + перерасход ──
        $bottlenecks = array_values(array_filter($centers, fn($c) => $c['pending'] > 0));
        usort($bottlenecks, fn($a, $b) => $b['pending'] <=> $a['pending']);
        $bottlenecks = array_slice($bottlenecks, 0, 5);

        // ── Сводка план/факт по выполненным операциям ────────────────
        $sum = $db->query(
            "SELECT
                SUM(t.time_min * t.planned)                                                      AS plan_min,
                SUM(CASE WHEN t.status='done' THEN t.time_min * t.planned ELSE 0 END)             AS plan_done_min,
                SUM(CASE WHEN t.status='done' THEN COALESCE(t.actual_time_min,0) ELSE 0 END) AS fact_min,
                SUM(t.status='done')                                                         AS done_ops,
                COUNT(*)                                                                     AS total_ops
             FROM tasks t"
        )->fetch();
        $planAll     = (int)($sum['plan_min'] ?? 0);
        $planDoneAll = (int)($sum['plan_done_min'] ?? 0);
        $factAll     = (int)($sum['fact_min'] ?? 0);

        // ── Динамика за 14 дней (операций закрыто в день) ────────────
        $daily = $db->query(
            "SELECT DATE(scanned_at) AS d, COUNT(*) AS ops
             FROM scan_log
             WHERE scanned_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
             GROUP BY DATE(scanned_at)
             ORDER BY d ASC"
        )->fetchAll();

        json_out([
            'centers'     => $centers,
            'bottlenecks' => $bottlenecks,
            'summary'     => [
                'plan_hours' => round($planAll / 60, 1),
                'fact_hours' => round($factAll / 60, 1),
                'norm_pct'   => ($planDoneAll > 0 && $factAll > 0) ? round($factAll / $planDoneAll * 100) : null,
                'done_ops'   => (int)($sum['done_ops'] ?? 0),
                'total_ops'  => (int)($sum['total_ops'] ?? 0),
            ],
            'daily'       => array_map(fn($r) => ['date' => $r['d'], 'ops' => (int)$r['ops']], $daily),
        ]);
    }
}
