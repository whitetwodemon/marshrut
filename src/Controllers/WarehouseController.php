<?php
/**
 * WarehouseController.php — Склад инструмента и материалов для ЧПУ
 *
 * Маршруты:
 *   GET    /api/tools               — список инструмента (фрезы, метчики, свёрла, пластины…)
 *   POST   /api/tools               — создать позицию
 *   PUT    /api/tools/{id}          — обновить
 *   DELETE /api/tools/{id}          — удалить (мягко: is_active=0, если есть история)
 *   POST   /api/tools/{id}/adjust   — приход/расход (delta), лог в app_log
 *
 *   GET    /api/materials-stock             — остатки материалов
 *   POST   /api/materials-stock             — создать позицию
 *   PUT    /api/materials-stock/{id}        — обновить
 *   DELETE /api/materials-stock/{id}        — удалить
 *   POST   /api/materials-stock/{id}/adjust — приход/расход
 *
 * Требует feature_tech_prep. Чтение — details.view, запись — warehouse.manage.
 */

namespace Marshrut\Controllers;

use Marshrut\Database\Connection;
use Marshrut\Middleware\Auth;
use function Marshrut\json_out;
use function Marshrut\request_body;
use function Marshrut\sanitize_string;
use function Marshrut\app_log;

class WarehouseController
{
    private const TOOL_TYPES = ['mill', 'drill', 'tap', 'turn_insert', 'bore', 'reamer', 'other'];

    // ───────────────────────── Инструмент ─────────────────────────

    public static function toolsIndex(array $params): void
    {
        SettingsController::requireFeature('feature_tech_prep', 'Техподготовка');
        Auth::can('details.view');
        $db = Connection::get();
        $rows = $db->query(
            "SELECT id, name, tool_type, size_info, qty, min_qty, location, comment, is_active
               FROM tools WHERE is_active = 1 ORDER BY tool_type, name"
        )->fetchAll();
        json_out(['data' => $rows]);
    }

    public static function toolsCreate(array $params): void
    {
        SettingsController::requireFeature('feature_tech_prep', 'Техподготовка');
        Auth::can('warehouse.manage');
        $b = request_body();
        $name = trim((string) ($b['name'] ?? ''));
        if ($name === '') json_out(['error' => 'Укажите название инструмента'], 422);
        $type = in_array($b['tool_type'] ?? '', self::TOOL_TYPES, true) ? $b['tool_type'] : 'other';

        $db = Connection::get();
        $id = self::uuid();
        $db->prepare(
            'INSERT INTO tools (id, name, tool_type, size_info, qty, min_qty, location, comment)
             VALUES (:id, :name, :type, :size, :qty, :min, :loc, :com)'
        )->execute([
            ':id' => $id, ':name' => sanitize_string($name, 200), ':type' => $type,
            ':size' => sanitize_string((string) ($b['size_info'] ?? ''), 80) ?: null,
            ':qty' => max(0, (int) ($b['qty'] ?? 0)), ':min' => max(0, (int) ($b['min_qty'] ?? 0)),
            ':loc' => sanitize_string((string) ($b['location'] ?? ''), 80) ?: null,
            ':com' => sanitize_string((string) ($b['comment'] ?? ''), 300) ?: null,
        ]);
        app_log('info', 'warehouse.tool_created', ['id' => $id, 'name' => $name]);
        json_out(['id' => $id], 201);
    }

    public static function toolsUpdate(array $params): void
    {
        SettingsController::requireFeature('feature_tech_prep', 'Техподготовка');
        Auth::can('warehouse.manage');
        $b = request_body();
        $db = Connection::get();
        $type = in_array($b['tool_type'] ?? '', self::TOOL_TYPES, true) ? $b['tool_type'] : 'other';
        $stmt = $db->prepare(
            'UPDATE tools SET name = :name, tool_type = :type, size_info = :size, qty = :qty,
               min_qty = :min, location = :loc, comment = :com WHERE id = :id'
        );
        $stmt->execute([
            ':id' => $params['id'], ':name' => sanitize_string((string) ($b['name'] ?? ''), 200), ':type' => $type,
            ':size' => sanitize_string((string) ($b['size_info'] ?? ''), 80) ?: null,
            ':qty' => max(0, (int) ($b['qty'] ?? 0)), ':min' => max(0, (int) ($b['min_qty'] ?? 0)),
            ':loc' => sanitize_string((string) ($b['location'] ?? ''), 80) ?: null,
            ':com' => sanitize_string((string) ($b['comment'] ?? ''), 300) ?: null,
        ]);
        json_out(['ok' => true]);
    }

    public static function toolsDelete(array $params): void
    {
        SettingsController::requireFeature('feature_tech_prep', 'Техподготовка');
        Auth::can('warehouse.manage');
        Connection::get()->prepare('UPDATE tools SET is_active = 0 WHERE id = :id')->execute([':id' => $params['id']]);
        json_out(['ok' => true]);
    }

    public static function toolsAdjust(array $params): void
    {
        SettingsController::requireFeature('feature_tech_prep', 'Техподготовка');
        Auth::can('warehouse.manage');
        $b = request_body();
        $delta = (int) ($b['delta'] ?? 0);
        if ($delta === 0) json_out(['error' => 'delta не может быть 0'], 422);

        $db = Connection::get();
        $db->prepare('UPDATE tools SET qty = GREATEST(0, qty + :d) WHERE id = :id')
           ->execute([':d' => $delta, ':id' => $params['id']]);
        $row = $db->prepare('SELECT qty, name, min_qty FROM tools WHERE id = :id');
        $row->execute([':id' => $params['id']]);
        $tool = $row->fetch();
        app_log('info', 'warehouse.tool_adjusted', ['id' => $params['id'], 'delta' => $delta, 'new_qty' => $tool['qty'] ?? null]);
        json_out(['ok' => true, 'qty' => $tool['qty'] ?? null, 'low_stock' => $tool && $tool['qty'] <= $tool['min_qty']]);
    }

    // ───────────────────────── Материалы (остатки) ─────────────────────────

    public static function materialsIndex(array $params): void
    {
        SettingsController::requireFeature('feature_tech_prep', 'Техподготовка');
        Auth::can('details.view');
        $rows = Connection::get()->query(
            "SELECT id, material, assortment, qty, unit, min_qty, location, comment, is_active
               FROM materials_stock WHERE is_active = 1 ORDER BY material, assortment"
        )->fetchAll();
        json_out(['data' => $rows]);
    }

    public static function materialsCreate(array $params): void
    {
        SettingsController::requireFeature('feature_tech_prep', 'Техподготовка');
        Auth::can('warehouse.manage');
        $b = request_body();
        $material = trim((string) ($b['material'] ?? ''));
        if ($material === '') json_out(['error' => 'Укажите материал'], 422);

        $db = Connection::get();
        $id = self::uuid();
        $db->prepare(
            'INSERT INTO materials_stock (id, material, assortment, qty, unit, min_qty, location, comment)
             VALUES (:id, :mat, :ass, :qty, :unit, :min, :loc, :com)'
        )->execute([
            ':id' => $id, ':mat' => sanitize_string($material, 120),
            ':ass' => sanitize_string((string) ($b['assortment'] ?? ''), 120) ?: null,
            ':qty' => max(0, (float) ($b['qty'] ?? 0)), ':unit' => sanitize_string((string) ($b['unit'] ?? 'кг'), 20),
            ':min' => max(0, (float) ($b['min_qty'] ?? 0)),
            ':loc' => sanitize_string((string) ($b['location'] ?? ''), 80) ?: null,
            ':com' => sanitize_string((string) ($b['comment'] ?? ''), 300) ?: null,
        ]);
        app_log('info', 'warehouse.material_created', ['id' => $id, 'material' => $material]);
        json_out(['id' => $id], 201);
    }

    public static function materialsUpdate(array $params): void
    {
        SettingsController::requireFeature('feature_tech_prep', 'Техподготовка');
        Auth::can('warehouse.manage');
        $b = request_body();
        Connection::get()->prepare(
            'UPDATE materials_stock SET material = :mat, assortment = :ass, qty = :qty, unit = :unit,
               min_qty = :min, location = :loc, comment = :com WHERE id = :id'
        )->execute([
            ':id' => $params['id'], ':mat' => sanitize_string((string) ($b['material'] ?? ''), 120),
            ':ass' => sanitize_string((string) ($b['assortment'] ?? ''), 120) ?: null,
            ':qty' => max(0, (float) ($b['qty'] ?? 0)), ':unit' => sanitize_string((string) ($b['unit'] ?? 'кг'), 20),
            ':min' => max(0, (float) ($b['min_qty'] ?? 0)),
            ':loc' => sanitize_string((string) ($b['location'] ?? ''), 80) ?: null,
            ':com' => sanitize_string((string) ($b['comment'] ?? ''), 300) ?: null,
        ]);
        json_out(['ok' => true]);
    }

    public static function materialsDelete(array $params): void
    {
        SettingsController::requireFeature('feature_tech_prep', 'Техподготовка');
        Auth::can('warehouse.manage');
        Connection::get()->prepare('UPDATE materials_stock SET is_active = 0 WHERE id = :id')->execute([':id' => $params['id']]);
        json_out(['ok' => true]);
    }

    public static function materialsAdjust(array $params): void
    {
        SettingsController::requireFeature('feature_tech_prep', 'Техподготовка');
        Auth::can('warehouse.manage');
        $b = request_body();
        $delta = (float) ($b['delta'] ?? 0);
        if ($delta == 0.0) json_out(['error' => 'delta не может быть 0'], 422);

        $db = Connection::get();
        $db->prepare('UPDATE materials_stock SET qty = GREATEST(0, qty + :d) WHERE id = :id')
           ->execute([':d' => $delta, ':id' => $params['id']]);
        $row = $db->prepare('SELECT qty, material, min_qty FROM materials_stock WHERE id = :id');
        $row->execute([':id' => $params['id']]);
        $m = $row->fetch();
        app_log('info', 'warehouse.material_adjusted', ['id' => $params['id'], 'delta' => $delta]);
        json_out(['ok' => true, 'qty' => $m['qty'] ?? null, 'low_stock' => $m && $m['qty'] <= $m['min_qty']]);
    }

    private static function uuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
