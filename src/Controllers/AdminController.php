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
use function Marshrut\json_error;
use function Marshrut\request_body;
use function Marshrut\sanitize_string;

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
    // ── IP Blocking ─────────────────────────────────────────────────────────

    public static function listBlockedIps(): void
    {
        Auth::can('settings.manage');
        $db = Connection::get();
        $rows = $db->query(
            "SELECT b.*, u.name as blocked_by_name
               FROM blocked_ips b
               LEFT JOIN users u ON u.id = b.blocked_by
              ORDER BY b.blocked_at DESC"
        )->fetchAll();
        json_out(['data' => $rows, 'total' => count($rows)]);
    }

    public static function blockIp(): void
    {
        Auth::can('settings.manage');
        $db   = Connection::get();
        $user = Auth::require();
        $body = request_body();

        $ip = trim($body['ip'] ?? '');
        if (!filter_var($ip, FILTER_VALIDATE_IP)) {
            json_out(['error' => 'Неверный IP адрес'], 422);
            return;
        }

        $db->prepare(
            "INSERT INTO blocked_ips (ip, reason, blocked_by, expires_at)
             VALUES (:ip, :reason, :uid, :expires)
             ON DUPLICATE KEY UPDATE reason=:reason2, blocked_by=:uid2, expires_at=:expires2"
        )->execute([
            ':ip'       => $ip,
            ':reason'   => sanitize_string($body['reason'] ?? ''),
            ':uid'      => $user->id,
            ':expires'  => $body['expires_at'] ?? null,
            ':reason2'  => sanitize_string($body['reason'] ?? ''),
            ':uid2'     => $user->id,
            ':expires2' => $body['expires_at'] ?? null,
        ]);
        json_out(['ok' => true, 'ip' => $ip]);
    }

    public static function unblockIp(array $params): void
    {
        Auth::can('settings.manage');
        $db = Connection::get();
        $db->prepare("DELETE FROM blocked_ips WHERE id = :id")
           ->execute([':id' => $params['id']]);
        json_out(['ok' => true]);
    }

    // ── Orders management ────────────────────────────────────────────────────

    public static function listOrders(): void
    {
        Auth::can('settings.manage');
        $db = Connection::get();
        $rows = $db->query(
            "SELECT id, number, order_type, customer, status, priority,
                    due_date, created_at
               FROM orders
              ORDER BY created_at DESC
              LIMIT 200"
        )->fetchAll();
        json_out(['data' => $rows, 'total' => count($rows)]);
    }

    public static function updateOrder(array $params): void
    {
        Auth::can('orders.edit');
        $db   = Connection::get();
        $body = request_body();

        $allowed = ['customer','foreman','status','priority','due_date','comment'];
        $sets = []; $vals = [];
        foreach ($allowed as $f) {
            if (array_key_exists($f, $body)) {
                $sets[]   = "`{$f}` = :{$f}";
                $vals[":$f"] = $body[$f];
            }
        }
        if (empty($sets)) { json_out(['error' => 'Нечего обновлять'], 422); return; }

        $vals[':id']      = $params['id'];
        $vals[':updated'] = date('Y-m-d H:i:s');
        $sets[]           = "updated_at = :updated";

        $db->prepare("UPDATE orders SET " . implode(', ', $sets) . " WHERE id = :id")
           ->execute($vals);
        json_out(['ok' => true]);
    }

    // ── Shifts management ────────────────────────────────────────────────────

    public static function listShifts(): void
    {
        Auth::can('settings.manage');
        $db = Connection::get();
        $rows = $db->query(
            "SELECT s.*, u.name as opened_by_name
               FROM shifts s
               LEFT JOIN users u ON u.id = s.opened_by
              ORDER BY s.opened_at DESC
              LIMIT 100"
        )->fetchAll();
        json_out(['data' => $rows, 'total' => count($rows)]);
    }

    public static function updateShift(array $params): void
    {
        Auth::can('settings.manage');
        $db   = Connection::get();
        $body = request_body();

        $allowed = ['name','notes']; // только редактируемые поля (opened_at/closed_at менять опасно)
        $sets = []; $vals = [];
        foreach ($allowed as $f) {
            if (array_key_exists($f, $body)) {
                $sets[] = "`{$f}` = :{$f}";
                $vals[":$f"] = $body[$f];
            }
        }
        if (empty($sets)) { json_out(['error' => 'Нечего обновлять'], 422); return; }
        $vals[':id'] = $params['id'];

        $db->prepare("UPDATE shifts SET " . implode(', ', $sets) . " WHERE id = :id")
           ->execute($vals);
        json_out(['ok' => true]);
    }

    public static function deleteShift(array $params): void
    {
        Auth::can('settings.manage');
        $db = Connection::get();
        $id = $params['id'];

        $db->beginTransaction();
        try {
            $db->prepare("DELETE FROM shift_handoffs WHERE shift_id = :id")->execute([':id' => $id]);
            $db->prepare("DELETE FROM shift_operator_log WHERE shift_id = :id")->execute([':id' => $id]);
            $db->prepare("DELETE FROM shifts WHERE id = :id")->execute([':id' => $id]);
            $db->commit();
            json_out(['ok' => true]);
        } catch (\Exception $e) {
            $db->rollBack();
            json_error($e);
        }
    }
    // ── User Export / Bulk Import ────────────────────────────────────────────

    public static function exportUsers(): void
    {
        Auth::can('settings.manage');
        $db = Connection::get();

        // Включаем password_hash — чтобы можно было полностью восстановить
        // пользователей с теми же паролями (импорт через importUsers).
        $users = $db->query(
            "SELECT u.id, u.name, u.email, u.password_hash, r.name AS role,
                    u.is_active, u.created_at
               FROM users u
               LEFT JOIN roles r ON r.id = u.role_id
              ORDER BY u.id"
        )->fetchAll();

        if (empty($users)) {
            json_out(['warning' => 'Нет пользователей для экспорта', 'exported' => 0]);
            return;
        }

        if (headers_sent($hf, $hl)) {
            json_out(['error' => "Не удалось начать выгрузку (output на {$hf}:{$hl})"], 500);
            return;
        }
        header('Content-Type: application/json; charset=utf-8');
        header('Content-Disposition: attachment; filename="marshrut-users-' . date('Ymd-His') . '.json"');
        echo json_encode([
            'version'     => '2.0',
            'type'        => 'users',
            'exported_at' => date('Y-m-d H:i:s'),
            'count'       => count($users),
            'users'       => $users,
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }

    /** POST /api/admin/users/import — восстановление из экспорта (с хэшами) */
    public static function importUsers(): void
    {
        Auth::can('settings.manage');
        $db   = Connection::get();
        $body = request_body();

        $users = $body['users'] ?? [];
        if (empty($users) || !is_array($users)) {
            json_out(['error' => 'Передайте массив users'], 422);
            return;
        }

        // Карта ролей: имя → id
        $roles = [];
        foreach ($db->query('SELECT id, name FROM roles')->fetchAll() as $r) {
            $roles[strtolower($r['name'])] = $r['id'];
        }

        $imp = ['restored' => 0, 'skipped' => 0, 'errors' => []];

        $stmt = $db->prepare(
            'INSERT INTO users (name, email, password_hash, role_id, is_active)
             VALUES (:name, :email, :hash, :role_id, :active)
             ON DUPLICATE KEY UPDATE
                name          = VALUES(name),
                password_hash = VALUES(password_hash),
                role_id       = VALUES(role_id),
                is_active     = VALUES(is_active)'
        );

        foreach ($users as $u) {
            $email = trim($u['email'] ?? '');
            $name  = trim($u['name']  ?? '');
            $hash  = $u['password_hash'] ?? '';
            $role  = strtolower(trim($u['role'] ?? 'operator'));

            if (!$email || !$name || !$hash) {
                $imp['errors'][] = "Пропущено: {$email} — нет имени/почты/хэша";
                $imp['skipped']++;
                continue;
            }
            $roleId = $roles[$role] ?? $roles['operator'] ?? null;
            if (!$roleId) { $imp['errors'][] = "Нет роли: {$role}"; $imp['skipped']++; continue; }

            try {
                $stmt->execute([
                    ':name'    => sanitize_string($name, 100),
                    ':email'   => $email,
                    ':hash'    => $hash,
                    ':role_id' => $roleId,
                    ':active'  => (int)($u['is_active'] ?? 1),
                ]);
                $imp['restored']++;
            } catch (\PDOException $e) {
                $imp['errors'][] = "Ошибка {$email}: " . $e->getMessage();
                $imp['skipped']++;
            }
        }

        json_out(['ok' => true] + $imp);
    }

    public static function bulkCreateUsers(): void
    {
        Auth::can('settings.manage');
        $db   = Connection::get();
        $body = request_body();

        $users = $body['users'] ?? [];
        if (empty($users) || !is_array($users)) {
            json_out(['error' => 'Передайте массив users'], 422);
            return;
        }

        // Загружаем роли
        $rolesStmt = $db->query('SELECT id, name FROM roles');
        $roles     = [];
        foreach ($rolesStmt->fetchAll() as $r) {
            $roles[strtolower($r['name'])] = $r['id'];
        }

        $created = 0; $skipped = 0; $errors = [];

        foreach ($users as $u) {
            $email = trim($u['email'] ?? '');
            $name  = trim($u['name']  ?? '');
            $pass  = trim($u['password'] ?? '');
            $role  = strtolower(trim($u['role'] ?? 'operator'));

            if (!$email || !$name || !$pass) {
                $errors[] = "Пропущено: {$email} — имя/почта/пароль обязательны";
                $skipped++;
                continue;
            }
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $errors[] = "Неверный email: {$email}";
                $skipped++;
                continue;
            }
            $roleId = $roles[$role] ?? $roles['operator'] ?? null;
            if (!$roleId) {
                $errors[] = "Неизвестная роль: {$role}";
                $skipped++;
                continue;
            }

            try {
                $db->prepare(
                    'INSERT INTO users (name, email, password_hash, role_id, is_active)
                     VALUES (:name, :email, :hash, :role_id, 1)'
                )->execute([
                    ':name'    => sanitize_string($name, 100),
                    ':email'   => $email,
                    ':hash'    => password_hash($pass, PASSWORD_BCRYPT, ['cost' => 12]),
                    ':role_id' => $roleId,
                ]);
                $created++;
            } catch (\PDOException $e) {
                if ($e->getCode() === '23000') {
                    $errors[] = "Дубликат email: {$email}";
                } else {
                    $errors[] = "Ошибка {$email}: " . $e->getMessage();
                }
                $skipped++;
            }
        }

        json_out([
            'ok'      => true,
            'created' => $created,
            'skipped' => $skipped,
            'errors'  => $errors,
        ]);
    }

    // POST /api/admin/clear-shift-history — удалить историю закрытых смен
    public static function clearShiftHistory(array $p): void
    {
        Auth::can('settings.manage');
        $db = Connection::get();
        $n = 0;
        try {
            // удаляем журнал операторов закрытых смен + сами закрытые смены
            $db->exec("DELETE FROM shift_operator_log WHERE shift_id IN (SELECT id FROM shifts WHERE closed_at IS NOT NULL)");
            $stmt = $db->prepare("DELETE FROM shifts WHERE closed_at IS NOT NULL");
            $stmt->execute();
            $n = $stmt->rowCount();
        } catch (\Throwable $e) {
            json_error($e);
        }
        app_log('warn', 'admin.clear_shift_history', ['deleted' => $n]);
        json_out(['ok' => true, 'deleted' => $n]);
    }

    // POST /api/admin/clear-change-history — очистить историю операций/изменений
    public static function clearChangeHistory(array $p): void
    {
        Auth::can('settings.manage');
        $db = Connection::get();
        $scan = 0; $events = 0;
        try {
            $s = $db->query("DELETE FROM scan_log"); $scan = $s ? $s->rowCount() : 0;
        } catch (\Throwable $e) {}
        try {
            $e2 = $db->query("DELETE FROM task_events"); $events = $e2 ? $e2->rowCount() : 0;
        } catch (\Throwable $e) {}
        app_log('warn', 'admin.clear_change_history', ['scan' => $scan, 'events' => $events]);
        json_out(['ok' => true, 'scan_deleted' => $scan, 'events_deleted' => $events]);
    }
}
