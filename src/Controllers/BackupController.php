<?php
namespace Marshrut\Controllers;

use Marshrut\Database\Connection;
use Marshrut\Middleware\Auth;
use function Marshrut\json_out;
use function Marshrut\json_error;

class BackupController
{
    /** Сколько строк в одном INSERT — защита от max_allowed_packet */
    private const BATCH = 200;

    /** GET /api/backup/orders — экспорт заказов в JSON */
    public static function exportOrders(): void
    {
        Auth::can('orders.view');
        $db = Connection::get();

        $data = [
            'version'     => '3.0',
            'type'        => 'orders',
            'exported_at' => date('Y-m-d H:i:s'),
            'orders'      => $db->query('SELECT * FROM orders ORDER BY created_at')->fetchAll() ?: [],
            'order_items' => $db->query('SELECT * FROM order_items')->fetchAll() ?: [],
            'tasks'       => $db->query('SELECT * FROM tasks ORDER BY order_id, op_num')->fetchAll() ?: [],
            'scan_log'    => $db->query('SELECT * FROM scan_log ORDER BY scanned_at')->fetchAll() ?: [],
        ];

        if (count($data['orders']) === 0) {
            json_out(['warning' => 'Нет заказов для экспорта', 'exported' => 0]);
            return;
        }

        self::sendJson($data, 'marshrut-orders-' . date('Ymd-His') . '.json');
    }

    /** GET /api/backup/dump — полный SQL-дамп всей базы */
    public static function dump(): void
    {
        Auth::can('settings.manage');
        $db   = Connection::get();
        $name = getenv('DB_NAME') ?: 'marshrut';

        $tables = $db->query('SHOW TABLES')->fetchAll(\PDO::FETCH_COLUMN);

        if (empty($tables)) {
            json_out(['error' => 'В базе нет таблиц'], 500);
            return;
        }

        if (headers_sent($hf, $hl)) {
            json_out(['error' => "Не удалось начать выгрузку (output на {$hf}:{$hl})"], 500);
            return;
        }
        header('Content-Type: application/sql; charset=utf-8');
        header('Content-Disposition: attachment; filename="marshrut-dump-' . date('Ymd-His') . '.sql"');

        echo "-- Маршрут MES — полный дамп базы данных\n";
        echo "-- База: {$name}\n";
        echo "-- Дата: " . date('Y-m-d H:i:s') . "\n";
        echo "-- Таблиц: " . count($tables) . "\n\n";
        echo "SET NAMES utf8mb4;\n";
        echo "SET FOREIGN_KEY_CHECKS=0;\n";
        echo "SET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';\n\n";

        foreach ($tables as $table) {
            $create = $db->query("SHOW CREATE TABLE `{$table}`")->fetch(\PDO::FETCH_ASSOC);
            $ddl = $create['Create Table'] ?? $create['Create View'] ?? null;
            if (!$ddl) continue;

            echo "-- ──────────────────────────────────────\n";
            echo "-- Таблица: {$table}\n";
            echo "-- ──────────────────────────────────────\n";
            echo "DROP TABLE IF EXISTS `{$table}`;\n";
            echo $ddl . ";\n\n";

            $stmt    = $db->query("SELECT * FROM `{$table}`");
            $batch   = [];
            $colList = null;
            $count   = 0;

            while ($row = $stmt->fetch(\PDO::FETCH_ASSOC)) {
                if ($colList === null) {
                    $colList = implode(', ', array_map(fn($c) => "`{$c}`", array_keys($row)));
                }
                $vals = array_map(function ($v) use ($db) {
                    if ($v === null) return 'NULL';
                    if (is_int($v))  return (string)$v;
                    if (is_bool($v)) return $v ? '1' : '0';
                    return $db->quote((string)$v);
                }, array_values($row));

                $batch[] = '(' . implode(', ', $vals) . ')';
                $count++;

                if (count($batch) >= self::BATCH) {
                    echo "INSERT INTO `{$table}` ({$colList}) VALUES\n";
                    echo implode(",\n", $batch) . ";\n";
                    $batch = [];
                }
            }
            if ($batch) {
                echo "INSERT INTO `{$table}` ({$colList}) VALUES\n";
                echo implode(",\n", $batch) . ";\n";
            }
            echo $count > 0 ? "-- строк: {$count}\n\n" : "-- (пусто)\n\n";
        }

        echo "SET FOREIGN_KEY_CHECKS=1;\n";
        echo "-- Готово.\n";
        exit;
    }

    /** POST /api/backup/restore — восстановление заказов из JSON */
    public static function restore(): void
    {
        Auth::can('settings.manage');
        $db = Connection::get();

        $body = file_get_contents('php://input');
        if (!$body) { json_out(['error' => 'Пустой запрос'], 422); return; }

        $data = json_decode($body, true);
        if (!is_array($data)) { json_out(['error' => 'Неверный JSON'], 422); return; }

        $orders = $data['orders']      ?? [];
        $items  = $data['order_items'] ?? [];
        $tasks  = $data['tasks']       ?? [];

        if (empty($orders)) {
            json_out(['warning' => 'В файле нет заказов', 'imported' => ['orders'=>0]]);
            return;
        }

        $imp = ['orders'=>0, 'items'=>0, 'tasks'=>0, 'skipped'=>0];

        $db->beginTransaction();
        try {
            $oStmt = $db->prepare(
                'INSERT IGNORE INTO orders
                 (id,number,order_type,customer,foreman,workshop_id,status,priority,due_date,comment,created_at,updated_at)
                 VALUES(:id,:num,:type,:cust,:fore,:wid,:st,:pri,:due,:com,:cr,:up)'
            );
            foreach ($orders as $o) {
                if (empty($o['id']) || empty($o['number'])) { $imp['skipped']++; continue; }
                $oStmt->execute([
                    ':id'  => $o['id'],          ':num' => $o['number'],
                    ':type'=> $o['order_type']  ?? 'W',
                    ':cust'=> $o['customer']    ?? '',
                    ':fore'=> $o['foreman']     ?? null,
                    ':wid' => $o['workshop_id'] ?? null,
                    ':st'  => $o['status']      ?? 'plan',
                    ':pri' => $o['priority']    ?? 'normal',
                    ':due' => $o['due_date']    ?? null,
                    ':com' => $o['comment']     ?? null,
                    ':cr'  => $o['created_at']  ?? date('Y-m-d H:i:s'),
                    ':up'  => $o['updated_at']  ?? date('Y-m-d H:i:s'),
                ]);
                $imp['orders'] += $oStmt->rowCount() > 0 ? 1 : 0;
            }

            $iStmt = $db->prepare(
                'INSERT IGNORE INTO order_items (order_id,detail_id,quantity) VALUES(:oid,:did,:qty)'
            );
            foreach ($items as $it) {
                if (empty($it['order_id'])) continue;
                $iStmt->execute([
                    ':oid'=> $it['order_id'],
                    ':did'=> $it['detail_id'] ?? '',
                    ':qty'=> $it['quantity']  ?? 1,
                ]);
                $imp['items']++;
            }

            $tStmt = $db->prepare(
                'INSERT IGNORE INTO tasks
                 (id,order_id,detail_id,op_num,op_name,work_center,work_center_id,
                  time_min,planned,completed,status,operator,qr_text,
                  actual_time_min,accumulated_time,created_at,updated_at)
                 VALUES(:id,:oid,:did,:num,:name,:wc,:wcid,
                  :time,:planned,:completed,:status,:op,:qr,
                  :actual,:acc,:cr,:up)'
            );
            foreach ($tasks as $t) {
                if (empty($t['id']) || empty($t['order_id'])) continue;
                $tStmt->execute([
                    ':id'      => $t['id'],
                    ':oid'     => $t['order_id'],
                    ':did'     => $t['detail_id']        ?? '',
                    ':num'     => $t['op_num']           ?? 0,
                    ':name'    => $t['op_name']          ?? '',
                    ':wc'      => $t['work_center']      ?? '',
                    ':wcid'    => $t['work_center_id']   ?? null,
                    ':time'    => $t['time_min']         ?? 0,
                    ':planned' => $t['planned']          ?? 1,
                    ':completed'=> $t['completed']       ?? 0,
                    ':status'  => $t['status']           ?? 'waiting',
                    ':op'      => $t['operator']         ?? null,
                    ':qr'      => $t['qr_text']          ?? '',
                    ':actual'  => $t['actual_time_min']  ?? null,
                    ':acc'     => $t['accumulated_time'] ?? 0,
                    ':cr'      => $t['created_at']       ?? date('Y-m-d H:i:s'),
                    ':up'      => $t['updated_at']       ?? date('Y-m-d H:i:s'),
                ]);
                $imp['tasks']++;
            }

            $db->commit();
            json_out(['ok' => true, 'imported' => $imp]);
        } catch (\Throwable $e) {
            $db->rollBack();
            json_error($e);
        }
    }

    /** Безопасная отправка JSON-файла на скачивание */
    private static function sendJson(array $data, string $filename): void
    {
        if (headers_sent($hf, $hl)) {
            json_out(['error' => "Не удалось начать выгрузку (output на {$hf}:{$hl})"], 500);
            return;
        }
        header('Content-Type: application/json; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }

    /**
     * POST /api/backup/restore-sql — восстановление из SQL-дампа (созданного /backup/dump).
     * ОПАСНО: перезаписывает данные. Только settings.manage, с явным подтверждением.
     */
    public static function restoreSql(): void
    {
        Auth::can('settings.manage');

        if (($_SERVER['HTTP_X_CONFIRM'] ?? '') !== 'RESTORE') {
            json_out(['error' => 'Требуется подтверждение (заголовок X-Confirm: RESTORE)'], 428);
        }

        $sql = file_get_contents('php://input');
        if (!$sql || strlen($sql) < 50) { json_out(['error' => 'Пустой или слишком короткий дамп'], 422); }
        if (!str_contains($sql, 'Маршрут MES') && !str_contains($sql, 'CREATE TABLE')) {
            json_out(['error' => 'Файл не похож на дамп Маршрут MES'], 422);
        }

        $db = Connection::get();
        $executed = 0; $errors = [];
        $stmts = preg_split('/;\s*\n/', $sql);
        foreach ($stmts as $stmt) {
            $stmt = trim($stmt);
            if ($stmt === '' || str_starts_with($stmt, '--')) continue;
            try { $db->exec($stmt); $executed++; }
            catch (\Throwable $e) {
                $errors[] = mb_substr($e->getMessage(), 0, 120);
                if (count($errors) > 20) break;
            }
        }

        app_log('warn', 'backup.restored', ['statements' => $executed, 'errors' => count($errors)]);
        json_out(['ok' => true, 'executed' => $executed, 'errors' => $errors]);
    }
}
