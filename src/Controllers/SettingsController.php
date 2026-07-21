<?php
/**
 * SettingsController.php — Управление системными настройками
 *
 * Маршруты:
 *   GET  /api/settings         — все настройки (публичные)
 *   POST /api/settings         — обновить настройку (только admin)
 *
 * Настройки хранятся в таблице system_settings (key_name → value).
 * Часовой пояс влияет на отображение времени во фронтенде и SET time_zone в PDO.
 */

namespace Marshrut\Controllers;

use Marshrut\Database\Connection;
use Marshrut\Middleware\Auth;
use function Marshrut\json_out;
use function Marshrut\request_body;
use function Marshrut\sanitize_string;

class SettingsController
{
    /** GET /api/settings — вернуть все настройки */
    public static function index(array $params): void
    {
        Auth::require();
        $db   = Connection::get();
        $stmt = $db->query('SELECT key_name, value, description FROM system_settings ORDER BY key_name');
        $rows = $stmt->fetchAll();

        // Преобразуем в key→value для удобства фронтенда
        $map = [];
        foreach ($rows as $r) {
            $map[$r['key_name']] = ['value' => $r['value'], 'description' => $r['description']];
        }
        json_out(['data' => $map]);
    }

    /** POST /api/settings — обновить одну или несколько настроек */
    public static function update(array $params): void
    {
        Auth::can('settings.manage');
        $db   = Connection::get();
        $body = request_body();

        if (empty($body['key']) || !array_key_exists('value', $body)) {
            json_out(['error' => 'key и value обязательны'], 422);
        }

        $key   = sanitize_string($body['key'],   80);
        $value = sanitize_string($body['value'], 500);

        $db->prepare(
            'INSERT INTO system_settings (key_name, value)
             VALUES (:k, :v)
             ON DUPLICATE KEY UPDATE value = :v2'
        )->execute([':k' => $key, ':v' => $value, ':v2' => $value]);

        // Если меняется timezone — обновляем текущее соединение.
        // ВАЖНО: значение НЕ биндится в SET, поэтому строго валидируем формат смещения
        // (+HH:MM / -HH:MM) — иначе была бы SQL-инъекция через настройку.
        if ($key === 'timezone_offset') {
            if (preg_match('/^[+-]\d{2}:\d{2}$/', $value)) {
                try { $db->exec("SET time_zone = '{$value}'"); } catch (\Exception $e) {}
            }
        }

        json_out(['saved' => true, 'key' => $key, 'value' => $value]);
    }

    /** Получить одну настройку (внутренний метод для других контроллеров) */
    public static function get(string $key, string $default = ''): string
    {
        try {
            $db   = Connection::get();
            $stmt = $db->prepare('SELECT value FROM system_settings WHERE key_name = :k');
            $stmt->execute([':k' => $key]);
            $val  = $stmt->fetchColumn();
            return $val !== false ? (string)$val : $default;
        } catch (\Exception $e) {
            return $default;
        }
    }

    /** GET /api/settings/public — публичные флаги для фронта (без авторизации) */
    public static function publicFlags(array $params): void
    {
        $db = Connection::get();
        $allowed = ['feature_analytics','feature_1c','company_name','materials_list','norm_warn_pct','norm_crit_pct'];
        $in = implode(',', array_fill(0, count($allowed), '?'));
        $stmt = $db->prepare("SELECT key_name, value FROM system_settings WHERE key_name IN ($in)");
        $stmt->execute($allowed);
        $map = [];
        foreach ($stmt->fetchAll() as $r) { $map[$r['key_name']] = $r['value']; }
        json_out(['data' => $map]);
    }

    /** Проверка фича-флага. true если настройка = '1'. */
    public static function feature(string $key): bool
    {
        static $cache = null;
        if ($cache === null) {
            $cache = [];
            try {
                $rows = Connection::get()->query("SELECT key_name, value FROM system_settings")->fetchAll();
                foreach ($rows as $r) { $cache[$r['key_name']] = $r['value']; }
            } catch (\Throwable $e) { $cache = []; }
        }
        return ($cache[$key] ?? '0') === '1';
    }

    /** Требует включённую фичу, иначе 403. */
    public static function requireFeature(string $key, string $name): void
    {
        if (!self::feature($key)) {
            json_out(['error' => $name . ' — функция не активирована. Разблокируйте в админ-панели.'], 403);
        }
    }
}
