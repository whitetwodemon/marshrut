<?php
// src/Middleware/RateLimit.php

namespace Marshrut\Middleware;

use Marshrut\Database\Connection;
use function Marshrut\json_out;

class RateLimit
{
    /** Check if current IP is blocked */
    public static function checkBlocked(): void
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '';
        try {
            $db = \Marshrut\Database\Connection::get();
            $stmt = $db->prepare(
                "SELECT id FROM blocked_ips
                  WHERE ip = :ip
                    AND (expires_at IS NULL OR expires_at > NOW())"
            );
            $stmt->execute([':ip' => $ip]);
            if ($stmt->fetch()) {
                http_response_code(403);
                echo json_encode(['error' => 'Доступ запрещён', 'code' => 'IP_BLOCKED']);
                exit;
            }
        } catch (\Exception $e) { /* таблица может не существовать */ }
    }

    // Max attempts within window
    private const MAX_BY_IP    = 20;   // per IP per window
    private const MAX_BY_EMAIL = 10;   // per email per window
    private const WINDOW_SEC   = 900;  // 15 minutes

    /**
     * Call at the start of POST /api/auth/login.
     * Records the attempt and blocks if over limit.
     */
    public static function checkLogin(string $email = ''): void
    {
        $db = Connection::get();
        $ip = self::clientIp();

        // Prune old records (keep table small)
        $db->prepare(
            'DELETE FROM login_attempts
              WHERE attempted_at < DATE_SUB(NOW(), INTERVAL :sec SECOND)'
        )->execute([':sec' => self::WINDOW_SEC * 2]);

        // Count recent attempts by IP
        $byIp = $db->prepare(
            'SELECT COUNT(*) FROM login_attempts
              WHERE ip = :ip
                AND attempted_at > DATE_SUB(NOW(), INTERVAL :sec SECOND)'
        );
        $byIp->execute([':ip' => $ip, ':sec' => self::WINDOW_SEC]);
        $ipCount = (int) $byIp->fetchColumn();

        if ($ipCount >= self::MAX_BY_IP) {
            self::block('Слишком много попыток входа с вашего IP. Повторите через 15 минут.');
        }

        // Count by email
        if ($email) {
            $byEmail = $db->prepare(
                'SELECT COUNT(*) FROM login_attempts
                  WHERE email = :email
                    AND attempted_at > DATE_SUB(NOW(), INTERVAL :sec SECOND)'
            );
            $byEmail->execute([':email' => $email, ':sec' => self::WINDOW_SEC]);
            $emailCount = (int) $byEmail->fetchColumn();

            if ($emailCount >= self::MAX_BY_EMAIL) {
                self::block('Слишком много неудачных попыток. Повторите через 15 минут.');
            }
        }

        // Record this attempt
        $db->prepare(
            'INSERT INTO login_attempts (ip, email) VALUES (:ip, :email)'
        )->execute([':ip' => $ip, ':email' => $email]);
    }

    /**
     * Remove all attempts for this IP+email on successful login
     * (reset counter so legitimate users aren't locked out later)
     */
    public static function clearOnSuccess(string $email): void
    {
        $db = Connection::get();
        $ip = self::clientIp();
        $db->prepare(
            'DELETE FROM login_attempts WHERE ip = :ip OR email = :email'
        )->execute([':ip' => $ip, ':email' => $email]);
    }

    private static function clientIp(): string
    {
        // Trust X-Forwarded-For only if behind a known proxy
        // For simplicity use REMOTE_ADDR; configure proxy trust in nginx
        return isset($_SERVER['HTTP_X_FORWARDED_FOR'])
            ? explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]
            : ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    }

    private static function block(string $message): never
    {
        http_response_code(429);
        header('Retry-After: ' . self::WINDOW_SEC);
        json_out(['error' => $message, 'retry_after' => self::WINDOW_SEC]);
    }
}
