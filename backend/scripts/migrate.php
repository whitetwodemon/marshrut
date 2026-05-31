<?php
/**
 * Система миграций БД для Маршрут MES
 *
 * Использование:
 *   php migrate.php status          — показать список миграций
 *   php migrate.php up              — применить все новые
 *   php migrate.php up 003          — применить до конкретной
 *   php migrate.php down 003        — откатить конкретную
 *   php migrate.php create add_telegram_notifications
 *
 * В продакшне (через Docker):
 *   docker compose exec php php /var/www/api/migrations/migrate.php up
 */

$dsn  = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4',
    getenv('DB_HOST') ?: '127.0.0.1',
    getenv('DB_NAME') ?: 'marshrut'
);
$user = getenv('DB_USER') ?: 'marshrut';
$pass = getenv('DB_PASS') ?: 'marshrut';

try {
    $db = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE                  => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE       => PDO::FETCH_ASSOC,
        PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true,   // Fix: unbuffered queries error
        PDO::ATTR_EMULATE_PREPARES         => true,   // Fix: multiple statements support
    ]);
} catch (PDOException $e) {
    die("❌ Не могу подключиться к БД: " . $e->getMessage() . "\n");
}

// Создаём таблицу миграций если нет
$db->exec("
    CREATE TABLE IF NOT EXISTS schema_migrations (
        version     VARCHAR(20)  NOT NULL,
        name        VARCHAR(200) NOT NULL,
        applied_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        checksum    VARCHAR(64)  NOT NULL,
        PRIMARY KEY (version)
    ) ENGINE=InnoDB CHARACTER SET utf8mb4
");

$migrDir = __DIR__;
$command = $argv[1] ?? 'status';

// ── Загрузить файлы миграций ──────────────────────────────────────────────
function loadFiles(string $dir): array {
    $files = glob($dir . '/[0-9][0-9][0-9]_*.sql');
    sort($files);
    return array_map(function($f) {
        preg_match('/(\d{3})_(.+)\.sql$/', basename($f), $m);
        return [
            'version'  => $m[1],
            'name'     => $m[2],
            'file'     => $f,
            'checksum' => md5(file_get_contents($f)),
        ];
    }, $files);
}

// ── Загрузить применённые миграции ────────────────────────────────────────
function loadApplied(PDO $db): array {
    return $db->query('SELECT * FROM schema_migrations ORDER BY version')
              ->fetchAll(PDO::FETCH_ASSOC);
}

function printStatus(array $files, array $applied): void {
    $appVersions = array_column($applied, null, 'version');
    echo "\n  Миграции:\n";
    foreach ($files as $f) {
        $a   = $appVersions[$f['version']] ?? null;
        $ok  = $a && $a['checksum'] === $f['checksum'];
        $mod = $a && $a['checksum'] !== $f['checksum'];
        echo sprintf("  %s  %s  %s%s\n",
            $a  ? '✅' : '⬜',
            $f['version'],
            $f['name'],
            $mod ? ' ⚠️  ИЗМЕНЁН после применения!' : ($a ? ' (применена ' . $a['applied_at'] . ')' : '')
        );
    }

    $pending = count(array_filter($files, fn($f) => !isset($appVersions[$f['version']])));
    echo "\n  Применено: " . count($applied) . "  Ожидают: $pending\n\n";
}

// ── Применить миграцию ────────────────────────────────────────────────────
function applyMigration(PDO $db, array $f): void {
    echo "  ➤ Применяю {$f['version']} {$f['name']}… ";
    $sql = file_get_contents($f['file']);

    // Выполняем каждый SQL-запрос отдельно с fetchAll() между ними
    // чтобы избежать "unbuffered queries" ошибки PDO
    try {
        // Убираем строчные комментарии
        $sql = preg_replace('/^--[^\n]*$/m', '', $sql);

        // Разбиваем на отдельные запросы по ";"
        // Игнорируем пустые строки и SET @var блоки не оборачиваем в транзакцию
        $statements = array_values(array_filter(
            array_map('trim', explode(';', $sql)),
            fn($s) => strlen(trim($s)) > 0
        ));

        foreach ($statements as $stmt) {
            $stmt = trim($stmt);
            if (empty($stmt)) continue;

            try {
                $result = $db->query($stmt);
                // Обязательно fetchAll() чтобы освободить буфер
                if ($result && $result->columnCount() > 0) {
                    $result->fetchAll();
                }
            } catch (PDOException $e) {
                // PREPARE/EXECUTE/DEALLOCATE могут возвращать ошибки — пропускаем
                if (strpos($stmt, 'PREPARE') === 0 ||
                    strpos($stmt, 'EXECUTE') === 0 ||
                    strpos($stmt, 'DEALLOCATE') === 0) {
                    continue;
                }
                throw $e;
            }
        }

        $db->prepare(
            'INSERT INTO schema_migrations (version, name, checksum) VALUES (:v, :n, :c)'
        )->execute([':v' => $f['version'], ':n' => $f['name'], ':c' => $f['checksum']]);

        echo "✅\n";
    } catch (PDOException $e) {
        echo "❌\n";
        throw new RuntimeException("Ошибка в {$f['version']}: " . $e->getMessage());
    }
}

// ── Создать новый файл миграции ───────────────────────────────────────────
function createMigration(string $dir, string $name): void {
    $files   = glob($dir . '/[0-9][0-9][0-9]_*.sql');
    $last    = empty($files) ? 0 : (int)substr(basename(end($files)), 0, 3);
    $version = str_pad($last + 1, 3, '0', STR_PAD_LEFT);
    $slug    = preg_replace('/[^a-z0-9_]/', '_', strtolower($name));
    $fname   = "$dir/{$version}_{$slug}.sql";
    $date    = date('Y-m-d H:i:s');

    file_put_contents($fname, "-- Migration {$version}: {$slug}\n-- Created: {$date}\n-- Description: TODO\n\n-- Write your SQL here:\n-- ALTER TABLE orders ADD COLUMN ...\n\n");
    echo "✅ Создан: $fname\n";
}

// ── Команды ───────────────────────────────────────────────────────────────
$files   = loadFiles($migrDir);
$applied = loadApplied($db);

switch ($command) {
    case 'status':
        printStatus($files, $applied);
        break;

    case 'up':
        $target    = $argv[2] ?? null;
        $appVers   = array_column($applied, 'version');
        $pending   = array_filter($files, fn($f) =>
            !in_array($f['version'], $appVers) &&
            (!$target || $f['version'] <= $target)
        );
        if (empty($pending)) {
            echo "\n  ✅ Нет новых миграций\n\n";
        } else {
            echo "\nПрименяю " . count($pending) . " миграций:\n";
            foreach ($pending as $f) {
                applyMigration($db, $f);
            }
            echo "\n✅ Готово\n\n";
        }
        break;

    case 'down':
        $target = $argv[2] ?? null;
        if (!$target) { die("Укажите версию: php migrate.php down 003\n"); }
        echo "\n⚠️  Откат миграции {$target} — напишите SQL вручную или восстановите из бекапа.\n";
        echo "Удаляю запись из schema_migrations…\n";
        $db->prepare('DELETE FROM schema_migrations WHERE version = :v')
           ->execute([':v' => $target]);
        echo "✅ Запись удалена. Теперь при 'up' миграция применится заново.\n\n";
        break;

    case 'create':
        $name = $argv[2] ?? null;
        if (!$name) { die("Укажите имя: php migrate.php create add_telegram_field\n"); }
        createMigration($migrDir, $name);
        break;

    default:
        echo "\nИспользование:\n";
        echo "  php migrate.php status\n";
        echo "  php migrate.php up\n";
        echo "  php migrate.php up 003\n";
        echo "  php migrate.php down 003\n";
        echo "  php migrate.php create add_telegram_notifications\n\n";
}
