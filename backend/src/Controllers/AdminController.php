<?php
/**
 * AdminController.php — Управление пользователями и ролями
 *
 * Маршруты:
 *   GET    /api/admin/users         — список пользователей
 *   POST   /api/admin/users         — создать пользователя
 *   PUT    /api/admin/users/{id}    — обновить пользователя
 *   DELETE /api/admin/users/{id}    — удалить пользователя
 *   GET    /api/admin/roles         — список ролей
 *   PUT    /api/admin/roles/{id}/permissions — обновить права роли
 *
 * Роли:
 *   admin   — полный доступ
 *   foreman — старший мастер (создание/редактирование заказов)
 *   operator — оператор (только выполнение операций)
 *   viewer  — наблюдатель (только чтение)
 */

// src/Controllers/AdminController.php

namespace Marshrut\Controllers;

use Marshrut\Database\Connection;
use Marshrut\Middleware\Auth;
use function Marshrut\json_out;
use function Marshrut\request_body;

class AdminController
{
    // ── Users ────────────────────────────────────────────────────────

    // GET /api/admin/users
    public static function listUsers(array $p): void
    {
        Auth::can('users.view');
        $db   = Connection::get();
        $rows = $db->query(
            'SELECT u.id, u.name, u.email, u.is_active, u.last_login, u.created_at,
                    r.id AS role_id, r.name AS role, r.label AS role_label
               FROM users u JOIN roles r ON r.id = u.role_id
              ORDER BY u.id'
        )->fetchAll();
        json_out(['data' => $rows, 'total' => count($rows)]);
    }

    // GET /api/admin/users/{id}
    public static function getUser(array $p): void
    {
        Auth::can('users.view');
        $db   = Connection::get();
        $stmt = $db->prepare(
            'SELECT u.id, u.name, u.email, u.is_active, u.last_login, u.created_at,
                    r.id AS role_id, r.name AS role, r.label AS role_label
               FROM users u JOIN roles r ON r.id = u.role_id
              WHERE u.id = :id'
        );
        $stmt->execute([':id' => $p['id']]);
        $user = $stmt->fetch();
        if (!$user) json_out(['error' => 'Пользователь не найден'], 404);
        $user['permissions'] = Auth::loadPermissions((int) $p['id']);
        json_out($user);
    }

    // POST /api/admin/users
    public static function createUser(array $p): void
    {
        Auth::can('users.manage');
        $body = request_body();

        foreach (['name','email','password','role_id'] as $f) {
            if (empty($body[$f])) json_out(['error' => "Поле {$f} обязательно"], 422);
        }
        if (!filter_var($body['email'], FILTER_VALIDATE_EMAIL)) {
            json_out(['error' => 'Некорректный email'], 422);
        }

        $db   = Connection::get();
        $chk  = $db->prepare('SELECT id FROM users WHERE email = :e');
        $chk->execute([':e' => $body['email']]);
        if ($chk->fetch()) json_out(['error' => 'Email уже используется'], 409);

        $hash = password_hash($body['password'], PASSWORD_BCRYPT, ['cost' => 12]);
        $db->prepare(
            'INSERT INTO users (name, email, password_hash, role_id, is_active)
             VALUES (:name, :email, :hash, :role_id, :active)'
        )->execute([
            ':name'    => $body['name'],
            ':email'   => $body['email'],
            ':hash'    => $hash,
            ':role_id' => (int) $body['role_id'],
            ':active'  => isset($body['is_active']) ? (int) $body['is_active'] : 1,
        ]);

        self::getUser(['id' => $db->lastInsertId()]);
    }

    // PUT /api/admin/users/{id}
    public static function updateUser(array $p): void
    {
        Auth::can('users.manage');
        $body = request_body();
        $db   = Connection::get();

        $stmt = $db->prepare('SELECT id FROM users WHERE id = :id');
        $stmt->execute([':id' => $p['id']]);
        if (!$stmt->fetch()) json_out(['error' => 'Пользователь не найден'], 404);

        $db->prepare(
            'UPDATE users SET name=:name, email=:email, role_id=:role_id, is_active=:active
              WHERE id = :id'
        )->execute([
            ':name'    => $body['name']      ?? '',
            ':email'   => $body['email']     ?? '',
            ':role_id' => (int) ($body['role_id'] ?? 2),
            ':active'  => (int) ($body['is_active'] ?? 1),
            ':id'      => $p['id'],
        ]);

        if (!empty($body['password'])) {
            $hash = password_hash($body['password'], PASSWORD_BCRYPT, ['cost' => 12]);
            $db->prepare('UPDATE users SET password_hash=:h WHERE id=:id')
               ->execute([':h' => $hash, ':id' => $p['id']]);
        }

        self::getUser($p);
    }

    // DELETE /api/admin/users/{id}
    public static function deleteUser(array $p): void
    {
        $me = Auth::can('users.manage');
        if ((int) $p['id'] === (int) $me->sub) {
            json_out(['error' => 'Нельзя удалить себя'], 400);
        }
        Connection::get()
            ->prepare('DELETE FROM users WHERE id = :id')
            ->execute([':id' => $p['id']]);
        json_out(['deleted' => true]);
    }

    // ── Roles ────────────────────────────────────────────────────────

    // GET /api/admin/roles
    public static function listRoles(array $p): void
    {
        Auth::can('users.view');
        $db   = Connection::get();
        $roles = $db->query('SELECT * FROM roles ORDER BY id')->fetchAll();

        foreach ($roles as &$role) {
            $stmt = $db->prepare(
                'SELECT p.name FROM permissions p
                   JOIN role_permissions rp ON rp.permission_id = p.id
                  WHERE rp.role_id = :rid'
            );
            $stmt->execute([':rid' => $role['id']]);
            $role['permissions'] = $stmt->fetchAll(\PDO::FETCH_COLUMN);
        }

        json_out(['data' => $roles]);
    }

    // PUT /api/admin/roles/{id}/permissions  — set permissions for role
    public static function setRolePermissions(array $p): void
    {
        Auth::can('roles.manage');
        $body        = request_body();
        $permissions = $body['permissions'] ?? [];

        $db = Connection::get();
        $db->prepare('DELETE FROM role_permissions WHERE role_id = :rid')
           ->execute([':rid' => $p['id']]);

        if ($permissions) {
            $ids = $db->prepare(
                'SELECT id FROM permissions WHERE name IN (' .
                implode(',', array_fill(0, count($permissions), '?')) . ')'
            );
            $ids->execute($permissions);
            $rows = $ids->fetchAll(\PDO::FETCH_COLUMN);

            $ins = $db->prepare(
                'INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)'
            );
            foreach ($rows as $permId) {
                $ins->execute([$p['id'], $permId]);
            }
        }

        self::listRoles([]);
    }

    // ── Permissions list ─────────────────────────────────────────────

    // GET /api/admin/permissions
    public static function listPermissions(array $p): void
    {
        Auth::can('users.view');
        $rows = Connection::get()
            ->query('SELECT * FROM permissions ORDER BY group_name, name')
            ->fetchAll();
        json_out(['data' => $rows]);
    }
}
