<?php
/**
 * DetailsController.php — Номенклатура деталей и техкарты
 *
 * Маршруты:
 *   GET    /api/details       — список деталей с операциями
 *   GET    /api/details/{id}  — одна деталь
 *   POST   /api/details       — создать деталь
 *   PUT    /api/details/{id}  — обновить деталь + операции (весь PUT)
 *   DELETE /api/details/{id}  — удалить деталь
 *
 * Техкарта (operations) обновляется целиком при PUT.
 * Операции привязаны к рабочим центрам по коду (101, 104, ...).
 */

// src/Controllers/DetailsController.php

namespace Marshrut\Controllers;

use Marshrut\Database\Connection;
use function Marshrut\json_out;
use function Marshrut\request_body;
use function Marshrut\validate;
use function Marshrut\sanitize_string;
use function Marshrut\app_log;

class DetailsController
{
    // GET /api/details
    public static function index(array $params): void
    {
        $db = Connection::get();

        $q    = $_GET['q'] ?? '';
        $sql  = 'SELECT * FROM details';
        $args = [];

        if ($q !== '') {
            $sql  .= ' WHERE code LIKE :q OR name LIKE :q';
            $args[':q'] = '%' . $q . '%';
        }

        $sql .= ' ORDER BY code';

        $stmt = $db->prepare($sql);
        $stmt->execute($args);
        $details = $stmt->fetchAll();

        // Attach operations to each detail
        foreach ($details as &$detail) {
            $ops = $db->prepare(
                'SELECT num, name, work_center, time_min
                   FROM operations
                  WHERE detail_id = :id
                  ORDER BY num'
            );
            $ops->execute([':id' => $detail['id']]);
            $detail['operations'] = $ops->fetchAll();
        }

        json_out(['data' => $details, 'total' => count($details)]);
    }

    // GET /api/details/{id}
    public static function show(array $params): void
    {
        $db   = Connection::get();
        $stmt = $db->prepare('SELECT * FROM details WHERE id = :id');
        $stmt->execute([':id' => $params['id']]);
        $detail = $stmt->fetch();

        if (!$detail) {
            json_out(['error' => 'Detail not found'], 404);
        }

        $ops = $db->prepare(
            'SELECT num, name, work_center, time_min
               FROM operations
              WHERE detail_id = :id
              ORDER BY num'
        );
        $ops->execute([':id' => $params['id']]);
        $detail['operations'] = $ops->fetchAll();

        json_out($detail);
    }

    // POST /api/details
    public static function create(array $params): void
    {
        $body = request_body();
        if ($err = validate($body, ['code', 'name', 'material'])) {
            json_out(['error' => $err], 422);
        }

        $db = Connection::get();

        // Generate unique ID on server
        $id = $body['id'] ?? self::generateId($db);

        try {
            $db->beginTransaction();

            $stmt = $db->prepare(
                'INSERT INTO details (id, code, name, material, unit, drawing)
                 VALUES (:id, :code, :name, :material, :unit, :drawing)'
            );
            $stmt->execute([
                ':id'       => $id,
                ':code'     => $body['code'],
                ':name'     => $body['name'],
                ':material' => $body['material'],
                ':unit'     => $body['unit']    ?? 'шт',
                ':drawing'  => $body['drawing'] ?? null,
            ]);

            if (!empty($body['operations'])) {
                $ins = $db->prepare(
                    'INSERT INTO operations (detail_id, num, name, work_center, time_min)
                     VALUES (:did, :num, :name, :wc, :time)'
                );
                foreach ($body['operations'] as $op) {
                    $ins->execute([
                        ':did'  => $id,
                        ':num'  => (int) $op['num'],
                        ':name' => $op['name'],
                        ':wc'   => $op['work_center'],
                        ':time' => (int) ($op['time_min'] ?? $op['time'] ?? 0),
                    ]);
                }
            }

            $db->commit();
        } catch (\Exception $e) {
            $db->rollBack();
            json_out(['error' => $e->getMessage()], 500);
        }

        self::show(['id' => $id]);
    }

    // PUT /api/details/{id}
    public static function update(array $params): void
    {
        $db   = Connection::get();
        $body = request_body();

        if ($err = validate($body, ['code', 'name', 'material'])) {
            json_out(['error' => $err], 422);
        }

        try {
            $db->beginTransaction();

            $db->prepare(
                'UPDATE details SET code=:code, name=:name, material=:material,
                                    unit=:unit, drawing=:drawing
                  WHERE id = :id'
            )->execute([
                ':id'       => $params['id'],
                ':code'     => sanitize_string($body['code'],     50),
                ':name'     => sanitize_string($body['name'],     255),
                ':material' => sanitize_string($body['material'], 255),
                ':unit'     => sanitize_string($body['unit']     ?? 'шт', 10),
                ':drawing'  => sanitize_string($body['drawing']  ?? '', 100) ?: null,
            ]);

            if (isset($body['operations'])) {
                $db->prepare('DELETE FROM operations WHERE detail_id = :id')
                   ->execute([':id' => $params['id']]);

                $ins = $db->prepare(
                    'INSERT INTO operations (detail_id, num, name, work_center, time_min)
                     VALUES (:did, :num, :name, :wc, :time)'
                );
                foreach ($body['operations'] as $op) {
                    $ins->execute([
                        ':did'  => $params['id'],
                        ':num'  => (int) $op['num'],
                        ':name' => sanitize_string($op['name'] ?? '', 255),
                        ':wc'   => sanitize_string($op['work_center'] ?? '', 100),
                        ':time' => max(0, (int) ($op['time_min'] ?? $op['time'] ?? 0)),
                    ]);
                }
            }

            $db->commit();
            app_log('info', 'detail.updated', ['id' => $params['id']]);
        } catch (\Exception $e) {
            $db->rollBack();
            app_log('error', 'detail.update_failed', ['id' => $params['id'], 'err' => $e->getMessage()]);
            json_out(['error' => $e->getMessage()], 500);
        }

        self::show($params);
    }

    // DELETE /api/details/{id}
    public static function delete(array $params): void
    {
        $db = Connection::get();
        $db->prepare('DELETE FROM details WHERE id = :id')
           ->execute([':id' => $params['id']]);
        json_out(['deleted' => true]);
    }

    private static function generateId(\PDO $db): string
    {
        do {
            $id = 'D-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
            $exists = $db->prepare('SELECT 1 FROM details WHERE id = :id');
            $exists->execute([':id' => $id]);
        } while ($exists->fetch());
        return $id;
    }
}
