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

        // Если меняется timezone — обновляем текущее соединение
        if ($key === 'timezone_offset') {
            try { $db->exec("SET time_zone = '{$value}'"); } catch (\Exception $e) {}
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
}
