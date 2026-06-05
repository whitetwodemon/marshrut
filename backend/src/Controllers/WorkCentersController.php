<?php
/**
 * WorkCentersController.php — Рабочие центры и приоритет заказов
 *
 * Маршруты:
 *   GET    /api/work-centers                        — список РЦ с кол-вом заданий
 *   POST   /api/work-centers                        — создать РЦ
 *   PUT    /api/work-centers/{id}                   — обновить РЦ
 *   DELETE /api/work-centers/{id}                   — удалить РЦ
 *   GET    /api/work-centers/{id}/tasks             — активные задания на РЦ
 *   GET    /api/work-centers/{id}/order-priority    — сохранённый порядок заказов
 *   POST   /api/work-centers/{id}/order-priority    — сохранить порядок (drag&drop)
 *   POST   /api/orders/next-number                  — следующий номер заказа
 *
 * Нумерация заказов:
 *   Тип W → W_26_000001, D → D_26_000001, K → K_26_000001
 *   Каждый тип имеет отдельный счётчик в order_sequences.
 */

namespace Marshrut\Controllers;

use Marshrut\Database\Connection;
use Marshrut\Middleware\Auth;
use function Marshrut\json_out;
use function Marshrut\request_body;
use function Marshrut\sanitize_string;
use function Marshrut\app_log;

class WorkCentersController
{
    // GET /api/work-centers
    public static function index(array $params): void
    {
        Auth::require();
        $db = Connection::get();
        $stmt = $db->query(
            'SELECT wc.*,
                    COUNT(DISTINCT t.id) AS active_tasks,
                    SUM(t.status = "in_progress") AS in_progress
               FROM work_centers wc
               LEFT JOIN tasks t ON t.work_center_id = wc.id
                                 AND t.status NOT IN ("done","rejected","cancelled")
              GROUP BY wc.id
              ORDER BY CAST(wc.code AS UNSIGNED), wc.code'
        );
        json_out(['data' => $stmt->fetchAll()]);
    }

    // POST /api/work-centers
    public static function create(array $params): void
    {
        Auth::can('orders.edit');
        $body = request_body();
        if (empty($body['code']) || empty($body['name'])) {
            json_out(['error' => 'code и name обязательны'], 422);
        }
        $db = Connection::get();
        $db->prepare(
            'INSERT INTO work_centers (code, name, is_active) VALUES (:code, :name, 1)'
        )->execute([
            ':code' => sanitize_string($body['code'], 20),
            ':name' => sanitize_string($body['name'], 150),
        ]);
        $id = $db->lastInsertId();
        $stmt = $db->prepare('SELECT * FROM work_centers WHERE id = :id');
        $stmt->execute([':id' => $id]);
        json_out($stmt->fetch());
    }

    // PUT /api/work-centers/{id}
    public static function update(array $params): void
    {
        Auth::can('orders.edit');
        $body = request_body();
        $db = Connection::get();
        $db->prepare(
            'UPDATE work_centers SET code=:code, name=:name, is_active=:active WHERE id=:id'
        )->execute([
            ':code'   => sanitize_string($body['code'] ?? '', 20),
            ':name'   => sanitize_string($body['name'] ?? '', 150),
            ':active' => (int)($body['is_active'] ?? 1),
            ':id'     => $params['id'],
        ]);
        $stmt = $db->prepare('SELECT * FROM work_centers WHERE id = :id');
        $stmt->execute([':id' => $params['id']]);
        json_out($stmt->fetch());
    }

    // DELETE /api/work-centers/{id}
    public static function delete(array $params): void
    {
        Auth::can('orders.edit');
        $db = Connection::get();
        $db->prepare('DELETE FROM work_centers WHERE id = :id')
           ->execute([':id' => $params['id']]);
        json_out(['deleted' => true]);
    }

    // GET /api/work-centers/{id}/tasks — активные задания на рабочем центре
    public static function tasks(array $params): void
    {
        Auth::require();
        $db = Connection::get();
        $stmt = $db->prepare(
            'SELECT t.*, o.number AS order_number, o.customer, d.name AS detail_name, d.code AS detail_code
               FROM tasks t
               JOIN orders o ON o.id = t.order_id
               JOIN details d ON d.id = t.detail_id
              WHERE t.work_center_id = :id
                AND t.status NOT IN ("done","rejected","cancelled")
              ORDER BY FIELD(t.status,"in_progress","waiting","rework","paused"),
                       o.due_date ASC, t.op_num ASC'
        );
        $stmt->execute([':id' => $params['id']]);
        json_out(['data' => $stmt->fetchAll()]);
    }

    // POST /api/orders/next-number — генерация следующего номера с префиксом типа
    // Берёт реальный максимальный номер из таблицы orders для данного типа и года
    public static function nextOrderNumber(array $params): void
    {
        Auth::require();
        $db   = Connection::get();
        $body = request_body();
        $year = (int) date('y');
        $yearStr = str_pad($year, 2, '0', STR_PAD_LEFT); // "26"

        $allowed = ['W', 'D', 'K'];
        $type    = strtoupper(trim($body['type'] ?? 'W'));
        if (!in_array($type, $allowed)) $type = 'W';

        try {
            // 1. Максимальный номер из реальных заказов этого типа/года
            $maxFromOrders = 0;
            try {
                $maxStmt = $db->prepare(
                    "SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(number, '_', -1) AS UNSIGNED)), 0)
                       FROM orders WHERE number LIKE :prefix"
                );
                $maxStmt->execute([':prefix' => $type . '_' . $yearStr . '_%']);
                $maxFromOrders = (int)$maxStmt->fetchColumn();
            } catch (\Exception $e) { /* таблица orders может быть пустой */ }

            // 2. Значение из счётчика (может отсутствовать)
            $seqKey       = $year * 10 + array_search($type, $allowed);
            $seqFromTable = 0;
            try {
                $seqStmt = $db->prepare('SELECT COALESCE(seq,0) FROM order_sequences WHERE year = :y');
                $seqStmt->execute([':y' => $seqKey]);
                $seqFromTable = (int)($seqStmt->fetchColumn() ?: 0);
            } catch (\Exception $e) { /* таблица order_sequences может не существовать */ }

            $nextSeq = max($maxFromOrders, $seqFromTable) + 1;

            // 3. Сохраняем счётчик (игнорируем если таблица не существует)
            try {
                $db->prepare(
                    'INSERT INTO order_sequences (year, seq) VALUES (:y, :seq)
                     ON DUPLICATE KEY UPDATE seq = GREATEST(seq, :seq2)'
                )->execute([':y' => $seqKey, ':seq' => $nextSeq, ':seq2' => $nextSeq]);
            } catch (\Exception $e) { /* игнорируем ошибку счётчика */ }

            $number = $type . '_' . $yearStr . '_' . str_pad($nextSeq, 6, '0', STR_PAD_LEFT);
            json_out(['number' => $number, 'type' => $type]);
        } catch (\Exception $e) {
            json_out(['error' => $e->getMessage()], 500);
        }
    }

    // GET /api/work-centers/{id}/order-priority
    public static function getPriority(array $params): void
    {
        Auth::require();
        $db   = Connection::get();
        $stmt = $db->prepare(
            'SELECT order_id, position FROM wc_order_priority
              WHERE work_center_id = :id ORDER BY position ASC'
        );
        $stmt->execute([':id' => $params['id']]);
        json_out(['data' => $stmt->fetchAll()]);
    }

    // POST /api/work-centers/{id}/order-priority  body: {order_ids: [...]}
    public static function setPriority(array $params): void
    {
        Auth::can('orders.edit');
        $db   = Connection::get();
        $body = request_body();
        $ids  = $body['order_ids'] ?? [];
        if (!is_array($ids)) json_out(['error' => 'order_ids must be array'], 422);

        $wcId = (int)$params['id'];
        $db->beginTransaction();
        try {
            $db->prepare('DELETE FROM wc_order_priority WHERE work_center_id = :id')
               ->execute([':id' => $wcId]);
            $ins = $db->prepare(
                'INSERT INTO wc_order_priority (work_center_id, order_id, position) VALUES (:wid, :oid, :pos)'
            );
            foreach ($ids as $pos => $orderId) {
                $ins->execute([':wid' => $wcId, ':oid' => sanitize_string($orderId, 50), ':pos' => $pos]);
            }
            $db->commit();
            json_out(['saved' => count($ids)]);
        } catch (\Exception $e) {
            $db->rollBack();
            json_out(['error' => $e->getMessage()], 500);
        }
    }
}
