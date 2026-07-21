<?php
namespace Marshrut\Controllers;

use Marshrut\Database\Connection;
use Marshrut\Middleware\Auth;
use function Marshrut\json_out;
use function Marshrut\json_error;
use function Marshrut\request_body;
use function Marshrut\sanitize_string;
use function Marshrut\app_log;

/**
 * Спецификации — заказ на производство от менеджера.
 *
 * Жизненный цикл:
 *   draft         — менеджер создал перечень деталей
 *   in_production — начальник производства пустил в работу
 *   done          — всё произведено
 *   cancelled     — отменена
 *
 * По каждой детали в спецификации видно:
 *   nomenclature_ready — технолог создал номенклатуру (техкарту)
 *   order_created      — создан заказ на производство
 */
class SpecificationsController
{
    // GET /api/specifications — список спецификаций со сводкой по позициям
    public static function index(array $params): void
    {
        Auth::require();
        $db = Connection::get();

        $status = $_GET['status'] ?? null;
        $where  = '';
        $args   = [];
        if ($status && in_array($status, ['development','waiting','in_production','done','cancelled'], true)) {
            $where = ' WHERE s.status = :status';
            $args[':status'] = $status;
        }

        $stmt = $db->prepare(
            "SELECT s.*,
                    (SELECT COUNT(*) FROM specification_items i WHERE i.spec_id = s.id) AS items_total,
                    (SELECT COUNT(*) FROM specification_items i WHERE i.spec_id = s.id AND i.order_created = 1) AS items_ordered,
                    (SELECT COUNT(*) FROM specification_items i WHERE i.spec_id = s.id AND i.nomenclature_ready = 1) AS items_ready
               FROM specifications s
               {$where}
              ORDER BY s.created_at DESC"
        );
        $stmt->execute($args);
        $rows = $stmt->fetchAll();
        json_out(['data' => $rows, 'total' => count($rows)]);
    }

    // GET /api/specifications/{id} — спецификация с позициями
    public static function show(array $params): void
    {
        Auth::require();
        $db = Connection::get();
        self::ensureTreeColumns($db);

        $spec = $db->prepare('SELECT * FROM specifications WHERE id = :id');
        $spec->execute([':id' => $params['id']]);
        $spec = $spec->fetch();
        if (!$spec) json_out(['error' => 'Спецификация не найдена'], 404);

        // Позиции (плоский список с parent_id — дерево строит фронт) + статус заказа
        $items = $db->prepare(
            "SELECT i.*,
                    o.number AS order_number,
                    o.status AS order_status,
                    CASE WHEN d.id IS NOT NULL THEN 1 ELSE 0 END AS detail_exists
               FROM specification_items i
               LEFT JOIN orders  o ON o.id = i.order_id
               LEFT JOIN details d ON d.id = i.detail_id
              WHERE i.spec_id = :id
              ORDER BY i.parent_id IS NOT NULL, i.parent_id, i.id"
        );
        $items->execute([':id' => $params['id']]);
        $rows = $items->fetchAll();

        // ── Готовность сборок снизу вверх ────────────────────────────────
        // Узел-сборка готов, когда готовы все его прямые дети (рекурсивно).
        $byParent = [];
        foreach ($rows as $r) {
            $pid = $r['parent_id'] ?? 0;
            $byParent[$pid][] = $r['id'];
        }
        $readyCache = [];
        $visiting   = [];
        $isReady = function ($row, $allById) use (&$isReady, &$readyCache, &$visiting, $byParent) {
            $id = $row['id'];
            if (isset($readyCache[$id])) return $readyCache[$id];
            if (isset($visiting[$id])) return false; // защита от цикла parent_id (A→B→A)
            if (($row['node_type'] ?? 'detail') !== 'assembly') {
                // Деталь «готова» (выполнена) только когда её заказ ВЫПОЛНЕН/ОТГРУЖЕН.
                $os = $row['order_status'] ?? null;
                $r  = in_array($os, ['done', 'shipped', 'archived'], true);
                return $readyCache[$id] = $r;
            }
            $children = $byParent[$id] ?? [];
            if (!$children) return $readyCache[$id] = false;
            $visiting[$id] = true;
            foreach ($children as $cid) {
                if (!isset($allById[$cid]) || !$isReady($allById[$cid], $allById)) {
                    unset($visiting[$id]);
                    return $readyCache[$id] = false;
                }
            }
            unset($visiting[$id]);
            return $readyCache[$id] = true;
        };
        $allById = [];
        foreach ($rows as $r) $allById[$r['id']] = $r;
        foreach ($rows as &$r) {
            $r['computed_ready'] = $isReady($r, $allById) ? 1 : 0;
            $r['child_count']    = count($byParent[$r['id']] ?? []);
            if (($r['node_type'] ?? 'detail') === 'assembly') {
                $r['node_state'] = $r['computed_ready'] ? 'done' : 'in_production';
            } else {
                $os = $r['order_status'] ?? null;
                if (in_array($os, ['done','shipped','archived'], true))      $r['node_state'] = 'done';
                elseif (!empty($r['order_id']))                              $r['node_state'] = 'in_production';
                elseif ((int)$r['nomenclature_ready'] === 1 && (int)$r['detail_exists'] === 1) $r['node_state'] = 'ready';
                else                                                         $r['node_state'] = 'no_nomenclature';
            }
        }
        unset($r);

        $spec['items'] = $rows;

        // Автозакрытие: если спецификация в производстве и ВСЕ корневые узлы готовы → «Выполнена».
        if (($spec['status'] ?? '') === 'in_production') {
            $roots = array_filter($rows, fn($r) => empty($r['parent_id']));
            if ($roots && count(array_filter($roots, fn($r) => (int)$r['computed_ready'] === 1)) === count($roots)) {
                try {
                    $db->prepare("UPDATE specifications SET status = 'done' WHERE id = :id AND status = 'in_production'")
                       ->execute([':id' => $params['id']]);
                    $spec['status'] = 'done';
                    app_log('info', 'spec.auto_completed', ['spec' => $params['id']]);
                } catch (\Throwable $e) {}
            }
        }

        json_out($spec);
    }

    // POST /api/specifications — создать спецификацию
    public static function create(array $params): void
    {
        Auth::can('orders.create');
        $db   = Connection::get();
        $body = request_body();

        $name = sanitize_string($body['name'] ?? '', 255);
        if ($name === '') json_out(['error' => 'Укажите название спецификации'], 422);

        $id     = 'SP-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 8));
        $number = self::nextNumber($db);

        $db->beginTransaction();
        try {
            $db->prepare(
                'INSERT INTO specifications (id, number, name, customer, manager, due_date, status, comment)
                 VALUES (:id, :num, :name, :cust, :mgr, :due, :status, :comment)'
            )->execute([
                ':id'      => $id,
                ':num'     => $number,
                ':name'    => $name,
                ':cust'    => sanitize_string($body['customer'] ?? '', 255),
                ':mgr'     => sanitize_string($body['manager'] ?? '', 100),
                ':due'     => $body['due_date'] ?: null,
                ':status'  => 'development',
                ':comment' => sanitize_string($body['comment'] ?? '', 1000) ?: null,
            ]);

            if (!empty($body['items']) && is_array($body['items'])) {
                self::insertItems($db, $id, $body['items']);
            }

            $db->commit();
            app_log('info', 'spec.created', ['id' => $id, 'number' => $number]);
        } catch (\Throwable $e) {
            $db->rollBack();
            json_error($e);
        }

        self::show(['id' => $id]);
    }

    // PUT /api/specifications/{id} — обновить шапку и позиции
    public static function update(array $params): void
    {
        Auth::can('orders.edit');
        $db   = Connection::get();
        $body = request_body();

        $spec = $db->prepare('SELECT * FROM specifications WHERE id = :id');
        $spec->execute([':id' => $params['id']]);
        if (!$spec->fetch()) json_out(['error' => 'Не найдена'], 404);

        $db->beginTransaction();
        try {
            $fields = [];
            $args   = [':id' => $params['id']];
            foreach (['name','customer','manager','comment'] as $f) {
                if (array_key_exists($f, $body)) {
                    $fields[] = "$f = :$f";
                    $args[":$f"] = sanitize_string($body[$f] ?? '', 1000);
                }
            }
            if (array_key_exists('due_date', $body)) {
                $fields[] = 'due_date = :due';
                $args[':due'] = $body['due_date'] ?: null;
            }
            if (array_key_exists('status', $body) &&
                in_array($body['status'], ['development','waiting','in_production','done','cancelled'], true)) {
                $fields[] = 'status = :status';
                $args[':status'] = $body['status'];
            }
            if ($fields) {
                $db->prepare('UPDATE specifications SET ' . implode(', ', $fields) . ' WHERE id = :id')
                   ->execute($args);
            }

            // Полная замена позиций (если переданы)
            if (isset($body['items']) && is_array($body['items'])) {
                $db->prepare('DELETE FROM specification_items WHERE spec_id = :id')
                   ->execute([':id' => $params['id']]);
                self::insertItems($db, $params['id'], $body['items']);
            }

            $db->commit();
        } catch (\Throwable $e) {
            $db->rollBack();
            json_error($e);
        }

        self::show($params);
    }

    // POST /api/specifications/{id}/release — пустить в производство
    public static function release(array $params): void
    {
        Auth::can('orders.edit');
        $db = Connection::get();

        $spec = $db->prepare('SELECT * FROM specifications WHERE id = :id');
        $spec->execute([':id' => $params['id']]);
        $spec = $spec->fetch();
        if (!$spec) json_out(['error' => 'Не найдена'], 404);

        $db->prepare("UPDATE specifications SET status = 'in_production' WHERE id = :id")
           ->execute([':id' => $params['id']]);
        app_log('info', 'spec.released', ['id' => $params['id']]);

        self::show($params);
    }

    // POST /api/specifications/{id}/items/{item}/create-order
    // Создать заказ на производство по позиции спецификации
    public static function createOrderFromItem(array $params): void
    {
        Auth::can('orders.create');
        $db = Connection::get();

        $item = $db->prepare(
            'SELECT i.*, s.customer, s.due_date AS spec_due, s.manager
               FROM specification_items i
               JOIN specifications s ON s.id = i.spec_id
              WHERE i.id = :item AND i.spec_id = :spec'
        );
        $item->execute([':item' => $params['item'], ':spec' => $params['id']]);
        $item = $item->fetch();
        if (!$item) json_out(['error' => 'Позиция не найдена'], 404);

        if ((int)$item['order_created'] === 1) {
            json_out(['error' => 'Заказ по этой позиции уже создан'], 422);
        }
        if (empty($item['detail_id'])) {
            json_out(['error' => 'Сначала технолог должен создать номенклатуру детали'], 422);
        }

        $year    = str_pad((string)((int) date('y')), 2, '0', STR_PAD_LEFT);
        $prefix  = "W_{$year}_";
        $orderId = 'O-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));

        // Номер из MAX+1 с retry при коллизии (если два заказа создают одновременно)
        $nextNumber = function() use ($db, $prefix) {
            $stmt = $db->prepare(
                "SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(number, '_', -1) AS UNSIGNED)), 0)
                   FROM orders WHERE number LIKE :pfx"
            );
            $stmt->execute([':pfx' => $prefix . '%']);
            return $prefix . str_pad((string)((int)$stmt->fetchColumn() + 1), 6, '0', STR_PAD_LEFT);
        };

        $number = $nextNumber();
        $maxRetries = 3;

        for ($attempt = 1; $attempt <= $maxRetries; $attempt++) {
            $db->beginTransaction();
            try {
                $db->prepare(
                    'INSERT INTO orders (id, number, customer, status, priority, due_date, created_at, comment)
                     VALUES (:id, :num, :cust, :status, :pri, :due, :cr, :comment)'
                )->execute([
                    ':id'      => $orderId,
                    ':num'     => $number,
                    ':cust'    => $item['customer'] ?? '',
                    ':status'  => 'plan',
                    ':pri'     => 'normal',
                    ':due'     => $item['spec_due'] ?: null,
                    ':cr'      => date('Y-m-d'),
                    ':comment' => 'Из спецификации',
                ]);

                $db->prepare(
                    'INSERT INTO order_items (order_id, detail_id, quantity) VALUES (:oid, :did, :qty)'
                )->execute([
                    ':oid' => $orderId,
                    ':did' => $item['detail_id'],
                    ':qty' => (int)$item['quantity'],
                ]);

                OrdersController::generateTasksPublic($db, $orderId);

                $db->prepare(
                    'UPDATE specification_items SET order_id = :oid, order_created = 1 WHERE id = :item'
                )->execute([':oid' => $orderId, ':item' => $params['item']]);

                $db->commit();
                app_log('info', 'spec.order_created', [
                    'spec' => $params['id'], 'item' => $params['item'],
                    'order' => $orderId, 'number' => $number,
                ]);
                break;
            } catch (\PDOException $e) {
                $db->rollBack();
                if ($e->getCode() === '23000' && $attempt < $maxRetries) {
                    $number = $nextNumber();   // номер занят — берём следующий
                    continue;
                }
                json_error($e);
                return;
            } catch (\Throwable $e) {
                $db->rollBack();
                json_error($e);
                return;
            }
        }

        json_out(['ok' => true, 'order_id' => $orderId, 'number' => $number]);
    }

    // POST /api/specifications/{id}/items/{item}/create-detail
    // Создать деталь в номенклатуре по позиции (для технолога)
    public static function createDetailFromItem(array $params): void
    {
        Auth::can('details.create');
        $db   = Connection::get();
        $body = request_body();

        $item = $db->prepare('SELECT * FROM specification_items WHERE id = :item AND spec_id = :spec');
        $item->execute([':item' => $params['item'], ':spec' => $params['id']]);
        $item = $item->fetch();
        if (!$item) json_out(['error' => 'Позиция не найдена'], 404);

        if (!empty($item['detail_id'])) {
            json_out(['error' => 'Номенклатура уже привязана к этой позиции'], 422);
        }

        $detailId = 'D-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
        $code = sanitize_string($body['code'] ?? $item['detail_code'] ?? '', 50);
        if ($code === '') $code = $detailId;

        $db->beginTransaction();
        try {
            $db->prepare(
                'INSERT INTO details (id, code, name, material, unit, drawing)
                 VALUES (:id, :code, :name, :material, :unit, :drawing)'
            )->execute([
                ':id'       => $detailId,
                ':code'     => $code,
                ':name'     => sanitize_string($body['name'] ?? $item['detail_name'], 255),
                ':material' => sanitize_string($body['material'] ?? '', 255),
                ':unit'     => sanitize_string($body['unit'] ?? 'шт', 10),
                ':drawing'  => sanitize_string($body['drawing'] ?? '', 100) ?: null,
            ]);

            // Операции (если переданы)
            if (!empty($body['operations']) && is_array($body['operations'])) {
                $ins = $db->prepare(
                    'INSERT INTO operations (detail_id, num, name, work_center, time_min, setup_time_min)
                     VALUES (:did, :num, :name, :wc, :time, :setup)'
                );
                foreach ($body['operations'] as $op) {
                    $ins->execute([
                        ':did'   => $detailId,
                        ':num'   => (int)($op['num'] ?? 10),
                        ':name'  => sanitize_string($op['name'] ?? '', 255),
                        ':wc'    => sanitize_string($op['work_center'] ?? '', 100),
                        ':time'  => max(0, (int)($op['time_min'] ?? 0)),
                        ':setup' => max(0, (int)($op['setup_time_min'] ?? 0)),
                    ]);
                }
            }

            // Привязываем к позиции
            $db->prepare(
                'UPDATE specification_items
                    SET detail_id = :did, nomenclature_ready = 1
                  WHERE id = :item'
            )->execute([':did' => $detailId, ':item' => $params['item']]);

            $db->commit();
            app_log('info', 'spec.detail_created', [
                'spec' => $params['id'], 'item' => $params['item'], 'detail' => $detailId,
            ]);
        } catch (\Throwable $e) {
            $db->rollBack();
            json_error($e);
        }

        json_out(['ok' => true, 'detail_id' => $detailId]);
    }

    // Привязать существующую деталь из номенклатуры к позиции
    public static function linkDetail(array $params): void
    {
        Auth::can('orders.edit');
        $db   = Connection::get();
        $body = request_body();
        $detailId = sanitize_string($body['detail_id'] ?? '', 50);
        if ($detailId === '') json_out(['error' => 'Укажите деталь'], 422);

        $exists = $db->prepare('SELECT 1 FROM details WHERE id = :id');
        $exists->execute([':id' => $detailId]);
        if (!$exists->fetch()) json_out(['error' => 'Деталь не найдена в номенклатуре'], 404);

        $db->prepare(
            'UPDATE specification_items
                SET detail_id = :did, nomenclature_ready = 1
              WHERE id = :item AND spec_id = :spec'
        )->execute([':did' => $detailId, ':item' => $params['item'], ':spec' => $params['id']]);

        self::show(['id' => $params['id']]);
    }

    // DELETE /api/specifications/{id}
    public static function delete(array $params): void
    {
        Auth::can('orders.delete');
        $db = Connection::get();
        // FK убран — удаляем позиции явно (каскад в коде)
        $db->beginTransaction();
        try {
            $db->prepare('DELETE FROM specification_items WHERE spec_id = :id')
               ->execute([':id' => $params['id']]);
            $db->prepare('DELETE FROM specifications WHERE id = :id')
               ->execute([':id' => $params['id']]);
            $db->commit();
        } catch (\Throwable $e) {
            $db->rollBack();
            json_error($e);
        }
        json_out(['deleted' => true]);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static function insertItems(\PDO $db, string $specId, array $items, ?int $parentId = null): void
    {
        self::ensureTreeColumns($db);
        $ins = $db->prepare(
            'INSERT INTO specification_items
                (spec_id, parent_id, node_type, detail_id, detail_name, detail_code, quantity, nomenclature_ready, comment)
             VALUES (:spec, :parent, :ntype, :did, :name, :code, :qty, :ready, :comment)'
        );
        foreach ($items as $it) {
            $type     = (($it['node_type'] ?? 'detail') === 'assembly') ? 'assembly' : 'detail';
            $detailId = $it['detail_id'] ?? null;
            $ins->execute([
                ':spec'    => $specId,
                ':parent'  => $parentId,
                ':ntype'   => $type,
                ':did'     => $detailId ?: null,
                ':name'    => sanitize_string($it['detail_name'] ?? $it['name'] ?? '', 255),
                ':code'    => sanitize_string($it['detail_code'] ?? '', 50),
                ':qty'     => max(1, (int)($it['quantity'] ?? 1)),
                // сборка не «готова» сама по себе — готовность считается по детям
                ':ready'   => $type === 'assembly' ? 0 : ($detailId ? 1 : 0),
                ':comment' => sanitize_string($it['comment'] ?? '', 500),
            ]);
            $childId = (int)$db->lastInsertId();
            // Рекурсивно вставляем вложенные узлы (дети сборки)
            if (!empty($it['children']) && is_array($it['children'])) {
                self::insertItems($db, $specId, $it['children'], $childId);
            }
        }
    }

    // Гарантирует наличие колонок дерева (если миграция 009 не доехала)
    private static function ensureTreeColumns(\PDO $db): void
    {
        static $checked = false;
        if ($checked) return;
        $checked = true;
        $cols = ['parent_id' => 'INT NULL', 'node_type' => "VARCHAR(20) NOT NULL DEFAULT 'detail'"];
        foreach ($cols as $col => $def) {
            $has = $db->query("SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'specification_items' AND COLUMN_NAME = '$col'")->fetchColumn();
            if (!$has) { try { $db->exec("ALTER TABLE specification_items ADD COLUMN $col $def"); \Marshrut\app_log('warn', 'schema_drift: добавлена колонка миграцией во время запроса', ['table' => 'specification_items', 'column' => $col]); } catch (\Throwable $e) {} }
        }
    }

    private static function nextNumber(\PDO $db): string
    {
        $year = date('y');
        $prefix = "СП-{$year}-";
        $stmt = $db->prepare(
            "SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(number, '-', -1) AS UNSIGNED)), 0)
               FROM specifications WHERE number LIKE :pfx"
        );
        $stmt->execute([':pfx' => $prefix . '%']);
        $next = (int)$stmt->fetchColumn() + 1;
        return $prefix . str_pad((string)$next, 4, '0', STR_PAD_LEFT);
    }

    // POST /api/specifications/{id}/items — добавить узел (деталь или сборку)
    public static function addItem(array $params): void
    {
        Auth::can('orders.edit');
        $db   = Connection::get();
        self::ensureTreeColumns($db);
        $body = request_body();

        $type     = (($body['node_type'] ?? 'detail') === 'assembly') ? 'assembly' : 'detail';
        $name     = sanitize_string($body['detail_name'] ?? $body['name'] ?? '', 255);
        if ($name === '') json_out(['error' => 'Укажите название узла'], 422);
        $parentId = isset($body['parent_id']) && $body['parent_id'] !== '' ? (int)$body['parent_id'] : null;
        $detailId = $body['detail_id'] ?? null;

        $db->prepare(
            'INSERT INTO specification_items
                (spec_id, parent_id, node_type, detail_id, detail_name, detail_code, quantity, nomenclature_ready, comment)
             VALUES (:spec, :parent, :ntype, :did, :name, :code, :qty, :ready, :comment)'
        )->execute([
            ':spec'    => $params['id'],
            ':parent'  => $parentId,
            ':ntype'   => $type,
            ':did'     => $detailId ?: null,
            ':name'    => $name,
            ':code'    => sanitize_string($body['detail_code'] ?? '', 50),
            ':qty'     => max(1, (int)($body['quantity'] ?? 1)),
            ':ready'   => $type === 'assembly' ? 0 : ($detailId ? 1 : 0),
            ':comment' => sanitize_string($body['comment'] ?? '', 500),
        ]);
        app_log('info', 'spec.item_added', ['spec' => $params['id'], 'type' => $type, 'parent' => $parentId]);
        self::show(['id' => $params['id']]);
    }

    // DELETE /api/specifications/{id}/items/{item} — удалить узел и всех потомков
    public static function deleteItem(array $params): void
    {
        Auth::can('orders.edit');
        $db = Connection::get();
        self::ensureTreeColumns($db);

        // Собираем поддерево (узел + все потомки) обходом
        $toDelete = [(int)$params['item']];
        $queue    = [(int)$params['item']];
        while ($queue) {
            $pid = array_shift($queue);
            $stmt = $db->prepare('SELECT id FROM specification_items WHERE parent_id = :pid AND spec_id = :spec');
            $stmt->execute([':pid' => $pid, ':spec' => $params['id']]);
            foreach ($stmt->fetchAll(\PDO::FETCH_COLUMN) as $childId) {
                $toDelete[] = (int)$childId;
                $queue[]    = (int)$childId;
            }
        }
        $in = implode(',', array_fill(0, count($toDelete), '?'));
        $db->prepare("DELETE FROM specification_items WHERE id IN ($in)")->execute($toDelete);
        app_log('info', 'spec.item_deleted', ['spec' => $params['id'], 'deleted' => count($toDelete)]);
        self::show(['id' => $params['id']]);
    }

    // POST /api/specifications/{id}/items/{item}/link-order — привязать существующий заказ
    public static function linkOrder(array $params): void
    {
        Auth::can('orders.create');
        $db   = Connection::get();
        $body = request_body();
        $orderId = sanitize_string($body['order_id'] ?? '', 50);
        if ($orderId === '') json_out(['error' => 'Не указан заказ'], 422);
        $ord = $db->prepare('SELECT id FROM orders WHERE id = :id');
        $ord->execute([':id' => $orderId]);
        if (!$ord->fetch()) json_out(['error' => 'Заказ не найден'], 404);
        $db->prepare('UPDATE specification_items SET order_id = :oid, order_created = 1 WHERE id = :item AND spec_id = :spec')
           ->execute([':oid' => $orderId, ':item' => $params['item'], ':spec' => $params['id']]);

        // Авто-дата: привязанный заказ получает срок из спецификации
        $spec = $db->prepare('SELECT due_date FROM specifications WHERE id = :id');
        $spec->execute([':id' => $params['id']]);
        $specDue = $spec->fetchColumn();
        if ($specDue) {
            $db->prepare('UPDATE orders SET due_date = :dd WHERE id = :oid')
               ->execute([':dd' => $specDue, ':oid' => $orderId]);
            app_log('info', 'order.due_from_spec', ['order' => $orderId, 'due' => $specDue]);
        }

        app_log('info', 'spec.order_linked', ['spec' => $params['id'], 'item' => $params['item'], 'order' => $orderId]);
        self::show(['id' => $params['id']]);
    }

    // PATCH /api/specifications/{id}/items/{item} — редактировать позицию (количество)
    public static function updateItem(array $params): void
    {
        Auth::can('orders.edit');
        $db   = Connection::get();
        $body = request_body();
        $fields = [];
        $args = [':item' => $params['item'], ':spec' => $params['id']];
        if (isset($body['quantity'])) {
            $qty = max(1, (int)$body['quantity']);
            $fields[] = 'quantity = :qty';
            $args[':qty'] = $qty;
        }
        if (array_key_exists('detail_name', $body)) {
            $fields[] = 'detail_name = :dn';
            $args[':dn'] = sanitize_string($body['detail_name'], 200);
        }
        if (!$fields) json_out(['error' => 'Нет полей для обновления'], 422);
        $db->prepare('UPDATE specification_items SET ' . implode(', ', $fields) . ' WHERE id = :item AND spec_id = :spec')
           ->execute($args);
        app_log('info', 'spec.item_updated', ['spec' => $params['id'], 'item' => $params['item']]);
        self::show(['id' => $params['id']]);
    }
}
