<?php
/**
 * TechPrepController.php — Техподготовка ЧПУ: файлы деталей/операций и очередь готовности
 *
 * Маршруты:
 *   GET    /api/details/{id}/files              — файлы детали
 *   POST   /api/details/{id}/files              — загрузить файл (multipart)
 *   GET    /api/files/{id}/download              — скачать файл
 *   DELETE /api/files/{id}                       — удалить файл
 *   GET    /api/tech-prep/queue                  — очередь: детали в заказах с ЧПУ-операциями без УП
 *
 * Файлы хранятся на диске в STORAGE_PATH/details/{detail_id}/, в БД — только метаданные.
 * Требует feature_tech_prep и право tech.manage (для записи; чтение — details.view).
 */

namespace Marshrut\Controllers;

use Marshrut\Database\Connection;
use Marshrut\Middleware\Auth;
use function Marshrut\json_out;
use function Marshrut\json_error;
use function Marshrut\app_log;

class TechPrepController
{
    private const ALLOWED_EXT = ['pdf', 'dxf', 'dwg', 'step', 'stp', 'nc', 'mpf', 'tap', 'h', 'xlsx', 'xls'];
    private const MAX_BYTES   = 25 * 1024 * 1024; // 25 МБ
    private const FILE_TYPES  = ['drawing', 'nc_program', 'setup_sheet', 'model'];

    private static function storageDir(): string
    {
        $dir = getenv('STORAGE_PATH') ?: '/var/www/storage';
        return rtrim($dir, '/') . '/details';
    }

    // GET /api/details/{id}/files
    public static function index(array $params): void
    {
        Auth::can('details.view');
        $db = Connection::get();
        $stmt = $db->prepare(
            'SELECT id, detail_id, op_num, file_type, filename, size_bytes, version, uploaded_by, created_at
               FROM detail_files WHERE detail_id = :id ORDER BY op_num IS NULL DESC, op_num, file_type, version DESC'
        );
        $stmt->execute([':id' => $params['id']]);
        json_out(['data' => $stmt->fetchAll()]);
    }

    // POST /api/details/{id}/files  (multipart: file, file_type, op_num?)
    public static function upload(array $params): void
    {
        SettingsController::requireFeature('feature_tech_prep', 'Техподготовка');
        $user = Auth::can('tech.manage');
        $detailId = $params['id'];

        if (empty($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            json_out(['error' => 'Файл не передан или ошибка загрузки'], 422);
        }
        $file = $_FILES['file'];
        if ($file['size'] > self::MAX_BYTES) {
            json_out(['error' => 'Файл больше 25 МБ'], 422);
        }
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, self::ALLOWED_EXT, true)) {
            json_out(['error' => 'Недопустимый тип файла: .' . $ext], 422);
        }
        $fileType = $_POST['file_type'] ?? 'drawing';
        if (!in_array($fileType, self::FILE_TYPES, true)) {
            json_out(['error' => 'Некорректный тип: ' . $fileType], 422);
        }
        $opNum = isset($_POST['op_num']) && $_POST['op_num'] !== '' ? (int) $_POST['op_num'] : null;

        $db = Connection::get();
        $exists = $db->prepare('SELECT id FROM details WHERE id = :id');
        $exists->execute([':id' => $detailId]);
        if (!$exists->fetch()) json_out(['error' => 'Деталь не найдена'], 404);

        // Версия: следующая для этой пары (op_num, file_type)
        $verStmt = $db->prepare(
            'SELECT COALESCE(MAX(version), 0) + 1 FROM detail_files
              WHERE detail_id = :did AND file_type = :ft AND ' . ($opNum === null ? 'op_num IS NULL' : 'op_num = :op')
        );
        $verParams = [':did' => $detailId, ':ft' => $fileType];
        if ($opNum !== null) $verParams[':op'] = $opNum;
        $verStmt->execute($verParams);
        $version = (int) $verStmt->fetchColumn();

        $dir = self::storageDir() . '/' . $detailId;
        if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
            json_out(['error' => 'Не удалось создать директорию хранения'], 500);
        }
        $id = bin2hex(random_bytes(16));
        $storedName = $id . '.' . $ext;
        if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $storedName)) {
            json_out(['error' => 'Не удалось сохранить файл'], 500);
        }

        $insId = self::uuid();
        $ins = $db->prepare(
            'INSERT INTO detail_files (id, detail_id, op_num, file_type, filename, stored_name, size_bytes, version, uploaded_by)
             VALUES (:id, :did, :op, :ft, :fn, :sn, :sz, :ver, :by)'
        );
        $ins->execute([
            ':id' => $insId, ':did' => $detailId, ':op' => $opNum, ':ft' => $fileType,
            ':fn' => mb_substr($file['name'], 0, 255), ':sn' => $storedName,
            ':sz' => (int) $file['size'], ':ver' => $version, ':by' => $user->sub ?? null,
        ]);

        app_log('info', 'tech.file_uploaded', ['detail_id' => $detailId, 'file_type' => $fileType, 'op_num' => $opNum]);
        json_out(['id' => $insId, 'version' => $version, 'filename' => $file['name']]);
    }

    // GET /api/files/{id}/download
    public static function download(array $params): void
    {
        Auth::can('details.view');
        $db = Connection::get();
        $stmt = $db->prepare('SELECT * FROM detail_files WHERE id = :id');
        $stmt->execute([':id' => $params['id']]);
        $row = $stmt->fetch();
        if (!$row) json_out(['error' => 'Файл не найден'], 404);

        $path = self::storageDir() . '/' . $row['detail_id'] . '/' . $row['stored_name'];
        if (!is_file($path)) json_out(['error' => 'Файл отсутствует на диске'], 404);

        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . rawurlencode($row['filename']) . '"');
        header('Content-Length: ' . filesize($path));
        readfile($path);
        exit;
    }

    // DELETE /api/files/{id}
    public static function delete(array $params): void
    {
        SettingsController::requireFeature('feature_tech_prep', 'Техподготовка');
        Auth::can('tech.manage');
        $db = Connection::get();
        $stmt = $db->prepare('SELECT * FROM detail_files WHERE id = :id');
        $stmt->execute([':id' => $params['id']]);
        $row = $stmt->fetch();
        if (!$row) json_out(['error' => 'Файл не найден'], 404);

        $path = self::storageDir() . '/' . $row['detail_id'] . '/' . $row['stored_name'];
        if (is_file($path)) @unlink($path);
        $db->prepare('DELETE FROM detail_files WHERE id = :id')->execute([':id' => $params['id']]);
        app_log('info', 'tech.file_deleted', ['detail_id' => $row['detail_id'], 'file_type' => $row['file_type']]);
        json_out(['ok' => true]);
    }

    // GET /api/tech-prep/queue — детали активных заказов с ЧПУ-операциями без УП
    public static function queue(array $params): void
    {
        SettingsController::requireFeature('feature_tech_prep', 'Техподготовка');
        Auth::can('details.view');
        $db = Connection::get();

        $rows = $db->query(
            "SELECT o.id AS order_id, o.number AS order_number, o.due_date, o.status,
                    d.id AS detail_id, d.name AS detail_name, d.code AS detail_code,
                    op.num AS op_num, op.name AS op_name, op.work_center,
                    (SELECT COUNT(*) FROM detail_files df
                      WHERE df.detail_id = d.id AND df.op_num = op.num AND df.file_type = 'nc_program') AS has_nc
               FROM operations op
               JOIN details d ON d.id = op.detail_id
               JOIN order_items oi ON oi.detail_id = d.id
               JOIN orders o ON o.id = oi.order_id
              WHERE op.requires_cnc = 1
                AND o.status NOT IN ('done', 'cancelled')
              ORDER BY o.due_date ASC, o.number, d.code, op.num"
        )->fetchAll();

        // Группировка: заказ → деталь → операции
        $byOrder = [];
        foreach ($rows as $r) {
            $oid = $r['order_id'];
            if (!isset($byOrder[$oid])) {
                $byOrder[$oid] = [
                    'order_id' => $oid, 'order_number' => $r['order_number'],
                    'due_date' => $r['due_date'], 'details' => [],
                ];
            }
            $did = $r['detail_id'];
            if (!isset($byOrder[$oid]['details'][$did])) {
                $byOrder[$oid]['details'][$did] = [
                    'detail_id' => $did, 'detail_name' => $r['detail_name'], 'detail_code' => $r['detail_code'],
                    'operations' => [],
                ];
            }
            $byOrder[$oid]['details'][$did]['operations'][] = [
                'op_num' => (int) $r['op_num'], 'op_name' => $r['op_name'], 'work_center' => $r['work_center'],
                'has_nc' => (bool) $r['has_nc'],
            ];
        }

        $result = [];
        foreach ($byOrder as $o) {
            $o['details'] = array_values($o['details']);
            // Оставляем только заказы, где есть хотя бы одна операция без УП
            $pending = 0; $total = 0;
            foreach ($o['details'] as $d) {
                foreach ($d['operations'] as $op) { $total++; if (!$op['has_nc']) $pending++; }
            }
            if ($pending > 0) { $o['pending'] = $pending; $o['total'] = $total; $result[] = $o; }
        }

        json_out(['data' => $result]);
    }

    private static function uuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
