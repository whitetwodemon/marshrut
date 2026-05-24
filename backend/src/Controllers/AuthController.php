<?php
// src/Controllers/AuthController.php

namespace Marshrut\Controllers;

use Marshrut\Database\Connection;
use Marshrut\Middleware\Auth;
use Marshrut\Middleware\RateLimit;
use function Marshrut\json_out;
use function Marshrut\request_body;

class AuthController
{
    // POST /api/auth/login
    public static function login(array $params): void
    {
        $body = request_body();
        $email    = trim($body['email']    ?? '');
        $password = trim($body['password'] ?? '');

        if (!$email || !$password) {
            json_out(['error' => 'Email и пароль обязательны'], 422);
        }

        // Rate limit check (before DB query to avoid timing oracle)
        RateLimit::checkLogin($email);

        $db   = Connection::get();
        $stmt = $db->prepare(
            'SELECT u.*, r.name AS role_name, r.label AS role_label
               FROM users u
               JOIN roles r ON r.id = u.role_id
              WHERE u.email = :email'
        );
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            json_out(['error' => 'Неверный email или пароль'], 401);
        }

        if (!$user['is_active']) {
            json_out(['error' => 'Аккаунт деактивирован'], 403);
        }

        $db->prepare('UPDATE users SET last_login = NOW() WHERE id = :id')
           ->execute([':id' => $user['id']]);

        // Clear failed attempts on successful login
        RateLimit::clearOnSuccess($email);

        $permissions = Auth::loadPermissions((int) $user['id']);
        $tokens      = Auth::makeTokens($user, $permissions);

        json_out([
            'user' => [
                'id'          => $user['id'],
                'name'        => $user['name'],
                'email'       => $user['email'],
                'role'        => $user['role_name'],
                'role_label'  => $user['role_label'],
                'permissions' => $permissions,
            ],
            ...$tokens,
        ]);
    }

    // POST /api/auth/register
    public static function register(array $params): void
    {
        $body  = request_body();
        $name  = trim($body['name']     ?? '');
        $email = trim($body['email']    ?? '');
        $pass  = trim($body['password'] ?? '');

        if (!$name || !$email || !$pass) {
            json_out(['error' => 'Имя, email и пароль обязательны'], 422);
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            json_out(['error' => 'Некорректный email'], 422);
        }
        if (strlen($pass) < 6) {
            json_out(['error' => 'Пароль минимум 6 символов'], 422);
        }

        $db = Connection::get();

        $exists = $db->prepare('SELECT id FROM users WHERE email = :email');
        $exists->execute([':email' => $email]);
        if ($exists->fetch()) {
            json_out(['error' => 'Email уже зарегистрирован'], 409);
        }

        $hash = password_hash($pass, PASSWORD_BCRYPT, ['cost' => 12]);
        $db->prepare(
            'INSERT INTO users (name, email, password_hash, role_id)
             VALUES (:name, :email, :hash, 3)' // role=operator by default
        )->execute([':name' => $name, ':email' => $email, ':hash' => $hash]);

        $userId = (int) $db->lastInsertId();

        $stmt = $db->prepare(
            'SELECT u.*, r.name AS role_name, r.label AS role_label
               FROM users u JOIN roles r ON r.id = u.role_id
              WHERE u.id = :id'
        );
        $stmt->execute([':id' => $userId]);
        $user = $stmt->fetch();

        $permissions = Auth::loadPermissions($userId);
        $tokens      = Auth::makeTokens($user, $permissions);

        json_out([
            'user' => [
                'id'          => $user['id'],
                'name'        => $user['name'],
                'email'       => $user['email'],
                'role'        => $user['role_name'],
                'role_label'  => $user['role_label'],
                'permissions' => $permissions,
            ],
            ...$tokens,
        ], 201);
    }

    // POST /api/auth/refresh
    public static function refresh(array $params): void
    {
        $body  = request_body();
        // Сначала из тела запроса, потом из HttpOnly cookie
        $token = $body['refresh_token'] ?? $_COOKIE['refresh_token'] ?? '';
        if (!$token) {
            json_out(['error' => 'refresh_token обязателен'], 422);
        }

        $hash = hash('sha256', $token);
        $db   = Connection::get();
        $stmt = $db->prepare(
            'SELECT rt.*, u.*, r.name AS role_name, r.label AS role_label
               FROM refresh_tokens rt
               JOIN users u ON u.id = rt.user_id
               JOIN roles r ON r.id = u.role_id
              WHERE rt.token_hash = :hash
                AND rt.expires_at > NOW()
                AND u.is_active = 1'
        );
        $stmt->execute([':hash' => $hash]);
        $row = $stmt->fetch();

        if (!$row) {
            json_out(['error' => 'Refresh token недействителен или истёк'], 401);
        }

        // Rotate: delete old, issue new
        $db->prepare('DELETE FROM refresh_tokens WHERE token_hash = :hash')
           ->execute([':hash' => $hash]);

        $permissions = Auth::loadPermissions((int) $row['user_id']);
        $tokens      = Auth::makeTokens($row, $permissions);

        json_out(['access_token' => $tokens['access_token'], 'refresh_token' => $tokens['refresh_token']]);
    }

    // POST /api/auth/logout
    public static function logout(array $params): void
    {
        $body  = request_body();
        $token = $body['refresh_token'] ?? $_COOKIE['refresh_token'] ?? '';
        if ($token) {
            $hash = hash('sha256', $token);
            Connection::get()
                ->prepare('DELETE FROM refresh_tokens WHERE token_hash = :hash')
                ->execute([':hash' => $hash]);
        }
        // Удаляем HttpOnly cookie
        setcookie('refresh_token', '', [
            'expires'  => time() - 3600,
            'path'     => '/',
            'secure'   => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
        json_out(['ok' => true]);
    }

    // GET /api/auth/me
    public static function me(array $params): void
    {
        $user = Auth::require();
        $db   = Connection::get();
        $stmt = $db->prepare(
            'SELECT u.id, u.name, u.email, u.is_active, u.last_login, u.created_at,
                    r.name AS role, r.label AS role_label
               FROM users u JOIN roles r ON r.id = u.role_id
              WHERE u.id = :id'
        );
        $stmt->execute([':id' => $user->sub]);
        $u = $stmt->fetch();
        if (!$u) json_out(['error' => 'User not found'], 404);

        $u['permissions'] = Auth::loadPermissions((int) $user->sub);
        json_out($u);
    }
}
