<?php
// src/Middleware/Auth.php

namespace Marshrut\Middleware;

use Marshrut\Jwt;
use Marshrut\Database\Connection;
use function Marshrut\json_out;

class Auth
{
    public static function getSecret(): string
    {
        return getenv('JWT_SECRET') ?: 'marshrut-secret-change-in-production';
    }

    public static function require(): object
    {
        $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (!preg_match('/^Bearer\s+(.+)$/i', $header, $m)) {
            json_out(['error' => 'Unauthorized: no token'], 401);
        }

        try {
            $payload = Jwt::decode($m[1], self::getSecret());
        } catch (\RuntimeException $e) {
            $code = str_contains($e->getMessage(), 'expired') ? 401 : 401;
            json_out(['error' => $e->getMessage()], $code);
        }

        return $payload;
    }

    public static function can(string $permission): object
    {
        $user = self::require();
        $perms = (array) ($user->permissions ?? []);
        if (!in_array($permission, $perms, true)) {
            json_out(['error' => "Forbidden: missing permission '{$permission}'"], 403);
        }
        return $user;
    }

    public static function loadPermissions(int $userId): array
    {
        $db   = Connection::get();
        $stmt = $db->prepare(
            'SELECT p.name
               FROM permissions p
               JOIN role_permissions rp ON rp.permission_id = p.id
               JOIN users u ON u.role_id = rp.role_id
              WHERE u.id = :uid AND u.is_active = 1'
        );
        $stmt->execute([':uid' => $userId]);
        return $stmt->fetchAll(\PDO::FETCH_COLUMN);
    }

    public static function makeTokens(array $user, array $permissions): array
    {
        $now    = time();
        $secret = self::getSecret();

        $access = Jwt::encode([
            'sub'         => $user['id'],
            'name'        => $user['name'],
            'email'       => $user['email'],
            'role'        => $user['role_name'],
            'role_id'     => $user['role_id'],
            'permissions' => $permissions,
            'iat'         => $now,
            'exp'         => $now + 3600,
        ], $secret);

        $refreshRaw  = bin2hex(random_bytes(32));
        $refreshHash = hash('sha256', $refreshRaw);

        $db = Connection::get();
        $db->prepare(
            'INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
             VALUES (:uid, :hash, DATE_ADD(NOW(), INTERVAL 30 DAY))'
        )->execute([':uid' => $user['id'], ':hash' => $refreshHash]);

        // Отправляем refresh token как HttpOnly cookie (XSS-безопасно)
        $secure   = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
        $sameSite = $secure ? 'Strict' : 'Lax';
        setcookie('refresh_token', $refreshRaw, [
            'expires'  => time() + 86400 * 30,
            'path'     => '/',
            'secure'   => $secure,
            'httponly' => true,
            'samesite' => $sameSite,
        ]);

        return ['access_token' => $access, 'refresh_token' => $refreshRaw]; // refresh_token также в HttpOnly cookie
    }
}
