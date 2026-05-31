<?php
/**
 * HealthController.php — Эндпоинт проверки работоспособности системы
 *
 * Используется для:
 * - Docker HEALTHCHECK
 * - Мониторинга (Uptime Robot, Grafana, etc.)
 * - CI/CD проверки готовности после деплоя
 *
 * GET /api/health — возвращает статус всех компонентов системы
 *
 * Ответ 200: система работает нормально
 * Ответ 503: один из компонентов недоступен
 */

namespace Marshrut\Controllers;

use Marshrut\Database\Connection;
use function Marshrut\json_out;

class HealthController
{
    public static function check(array $params): void
    {
        $checks = [];
        $ok     = true;

        // ── Проверка базы данных ────────────────────────────────────────
        try {
            $db   = Connection::get();
            $stmt = $db->query('SELECT 1');
            $checks['database'] = [
                'status'  => 'ok',
                'latency' => self::measure(fn() => $db->query('SELECT COUNT(*) FROM tasks')),
            ];
        } catch (\Exception $e) {
            $checks['database'] = ['status' => 'error', 'error' => $e->getMessage()];
            $ok = false;
        }

        // ── Информация о системе ────────────────────────────────────────
        $checks['php']    = ['status' => 'ok', 'version' => PHP_VERSION];
        $checks['uptime'] = (int) shell_exec('cat /proc/uptime | awk '{print $1}'');

        // ── Метрики БД ──────────────────────────────────────────────────
        if ($checks['database']['status'] === 'ok') {
            try {
                $db = Connection::get();
                $checks['metrics'] = [
                    'orders_active' => (int) $db->query(
                        "SELECT COUNT(*) FROM orders WHERE status NOT IN ('done','cancelled')"
                    )->fetchColumn(),
                    'tasks_in_progress' => (int) $db->query(
                        "SELECT COUNT(*) FROM tasks WHERE status='in_progress'"
                    )->fetchColumn(),
                    'shift_open' => (bool) $db->query(
                        "SELECT COUNT(*) FROM shifts WHERE closed_at IS NULL"
                    )->fetchColumn(),
                ];
            } catch (\Exception $e) {
                // Метрики не критичны — просто пропускаем
            }
        }

        $httpCode = $ok ? 200 : 503;
        http_response_code($httpCode);
        json_out([
            'status'    => $ok ? 'ok' : 'degraded',
            'timestamp' => date('c'),
            'version'   => '2.0',
            'checks'    => $checks,
        ]);
    }

    /** @private Измерить время выполнения функции в миллисекундах */
    private static function measure(\Closure $fn): float
    {
        $start = microtime(true);
        $fn();
        return round((microtime(true) - $start) * 1000, 2);
    }
}
