<?php
// NotificationsController — уведомления для старших мастеров и операторов.

namespace Marshrut\Controllers;

use Marshrut\Database\Connection;
use Marshrut\Middleware\Auth;
use function Marshrut\json_out;

class NotificationsController
{
    /**
     * Создать уведомление. Вызывается из других контроллеров на событиях.
     * @param string|null $role  роль-получатель ('foreman','operator') или null = всем
     */
    public static function notify(?string $role, string $type, string $title, ?string $body = null, ?string $orderId = null, ?int $userId = null): void
    {
        try {
            self::ensureTable();
            Connection::get()->prepare(
                'INSERT INTO notifications (target_role, target_user, type, title, body, order_id)
                 VALUES (:role, :user, :type, :title, :body, :oid)'
            )->execute([
                ':role' => $role, ':user' => $userId, ':type' => $type,
                ':title' => mb_substr($title, 0, 200), ':body' => $body, ':oid' => $orderId,
            ]);
        } catch (\Throwable $e) { /* уведомления не критичны — не роняем основную операцию */ }
    }

    // GET /api/notifications — для текущего пользователя (по роли + персональные)
    public static function index(array $params): void
    {
        $user = Auth::require();
        self::ensureTable();
        $db = Connection::get();

        $stmt = $db->prepare(
            "SELECT n.*, CASE WHEN r.user_id IS NULL THEN 0 ELSE 1 END AS is_read
             FROM notifications n
             LEFT JOIN notification_reads r ON r.notification_id = n.id AND r.user_id = :uid
             WHERE (n.target_role = :role OR n.target_role IS NULL OR n.target_user = :uid2)
             ORDER BY n.created_at DESC
             LIMIT 50"
        );
        $stmt->execute([':uid' => $user->sub, ':role' => $user->role, ':uid2' => $user->sub]);
        $rows = $stmt->fetchAll();
        $unread = count(array_filter($rows, fn($r) => (int)$r['is_read'] === 0));

        json_out(['data' => $rows, 'unread' => $unread, 'total' => count($rows)]);
    }

    // POST /api/notifications/read-all — отметить все прочитанными
    public static function readAll(array $params): void
    {
        $user = Auth::require();
        self::ensureTable();
        $db = Connection::get();

        // Помечаем прочитанными все видимые пользователю уведомления
        $db->prepare(
            "INSERT IGNORE INTO notification_reads (notification_id, user_id)
             SELECT n.id, :uid FROM notifications n
             WHERE (n.target_role = :role OR n.target_role IS NULL OR n.target_user = :uid2)"
        )->execute([':uid' => $user->sub, ':role' => $user->role, ':uid2' => $user->sub]);

        json_out(['ok' => true]);
    }

    private static function ensureTable(): void
    {
        static $done = false;
        if ($done) return;
        $done = true;
        try {
            $db = Connection::get();
            $db->exec("CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                target_role VARCHAR(30) NULL, target_user INT NULL,
                type VARCHAR(30) NOT NULL, title VARCHAR(200) NOT NULL,
                body TEXT NULL, order_id VARCHAR(50) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_role (target_role, created_at), INDEX idx_user (target_user, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
            $db->exec("CREATE TABLE IF NOT EXISTS notification_reads (
                notification_id INT NOT NULL, user_id INT NOT NULL,
                read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (notification_id, user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        } catch (\Throwable $e) {}
    }
}
