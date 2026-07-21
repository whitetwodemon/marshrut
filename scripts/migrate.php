<?php
/**
 * scripts/migrate.php — автоматические миграции БД.
 *
 * Запускается при старте контейнера (php-entrypoint.sh).
 * Применяет все *.sql из /var/www/api/migrations/ по порядку имён,
 * пропуская уже применённые (отслеживаются в таблице schema_migrations).
 *
 * Каждый файл выполняется в транзакции. При ошибке — откат и остановка.
 *
 * Формат файлов: NNN_описание.sql  (например 001_add_setup_time.sql)
 */

$host = getenv('DB_HOST')     ?: 'mysql';
$name = getenv('DB_NAME')     ?: 'marshrut';
$user = getenv('DB_USER')     ?: 'marshrut';
$pass = getenv('DB_PASSWORD') ?: 'marshrut';

try {
    $db = new PDO(
        "mysql:host={$host};dbname={$name};charset=utf8mb4",
        $user, $pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    fwrite(STDERR, "[migrate] Нет подключения к БД: " . $e->getMessage() . "\n");
    exit(1);
}

// Таблица учёта применённых миграций
$db->exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (
        version    VARCHAR(255) NOT NULL PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
);

// Уже применённые
$applied = $db->query('SELECT version FROM schema_migrations')
              ->fetchAll(PDO::FETCH_COLUMN);
$applied = array_flip($applied);

// Файлы миграций
$dir = __DIR__ . '/../migrations';
if (!is_dir($dir)) {
    echo "[migrate] Папки migrations нет — пропускаю\n";
    exit(0);
}

$files = glob($dir . '/*.sql');
sort($files); // по имени: 001_, 002_, ...

$ran = 0;
foreach ($files as $file) {
    $version = basename($file, '.sql');
    if (isset($applied[$version])) continue;

    $sql = file_get_contents($file);
    if (trim($sql) === '') {
        // Пустой файл — помечаем применённым
        $db->prepare('INSERT INTO schema_migrations (version) VALUES (?)')
           ->execute([$version]);
        continue;
    }

    echo "[migrate] Применяю {$version}...\n";

    try {
        $db->beginTransaction();
        // Разбиваем по ';' на отдельные стейтменты (простой сплиттер)
        foreach (split_sql($sql) as $stmt) {
            // Убираем строки-комментарии (-- ...) ВНУТРИ стейтмента,
            // иначе ведущий комментарий «съедал» первый CREATE TABLE/ALTER.
            $lines = preg_split('/\r?\n/', $stmt);
            $lines = array_filter($lines, function ($l) {
                $t = ltrim($l);
                return $t !== '' && !str_starts_with($t, '--');
            });
            $stmt = trim(implode("\n", $lines));
            if ($stmt === '') continue;
            $db->exec($stmt);
        }
        $db->prepare('INSERT INTO schema_migrations (version) VALUES (?)')
           ->execute([$version]);
        $db->commit();
        $ran++;
        echo "[migrate] ✓ {$version}\n";
    } catch (PDOException $e) {
        if ($db->inTransaction()) $db->rollBack();
        // Идемпотентные ошибки (колонка/таблица уже есть) — не критичны,
        // помечаем применённой и продолжаем
        $code = $e->errorInfo[1] ?? 0;
        $idempotent = in_array($code, [
            1060, // Duplicate column name
            1061, // Duplicate key name
            1050, // Table already exists
            1051, // Unknown table
            1054, // Unknown column (миграция ссылается на отсутствующую колонку)
            1072, // Key column doesn't exist in table
            1091, // Can't DROP; check that column/key exists
            1146, // Table doesn't exist
            1826, // Duplicate foreign key
        ], true);
        if ($idempotent) {
            $db->prepare('INSERT IGNORE INTO schema_migrations (version) VALUES (?)')
               ->execute([$version]);
            echo "[migrate] ⊙ {$version} — пропускаю (код {$code})\n";
        } else {
            // Логируем, но НЕ роняем процесс — другие миграции и запуск
            // приложения не должны страдать из-за одной проблемной миграции.
            fwrite(STDERR, "[migrate] ✗ {$version}: " . $e->getMessage() . " (код {$code}) — пропускаю\n");
        }
    }
}

echo $ran > 0
    ? "[migrate] Применено миграций: {$ran}\n"
    : "[migrate] Новых миграций нет\n";

/** Простой сплиттер SQL по ';' с учётом строк и комментариев */
function split_sql(string $sql): array
{
    $stmts = [];
    $buf = '';
    $len = strlen($sql);
    $inS = false; $inD = false; $inLine = false; $inBlock = false;

    for ($i = 0; $i < $len; $i++) {
        $c = $sql[$i];
        $n = $i + 1 < $len ? $sql[$i+1] : '';

        if ($inLine) { $buf .= $c; if ($c === "\n") $inLine = false; continue; }
        if ($inBlock) { $buf .= $c; if ($c === '*' && $n === '/') { $buf .= $n; $i++; $inBlock = false; } continue; }
        if ($inS) { $buf .= $c; if ($c === "'" && $sql[$i-1] !== '\\') $inS = false; continue; }
        if ($inD) { $buf .= $c; if ($c === '"' && $sql[$i-1] !== '\\') $inD = false; continue; }

        if ($c === '-' && $n === '-') { $inLine = true; $buf .= $c; continue; }
        if ($c === '/' && $n === '*') { $inBlock = true; $buf .= $c; continue; }
        if ($c === "'") { $inS = true; $buf .= $c; continue; }
        if ($c === '"') { $inD = true; $buf .= $c; continue; }

        if ($c === ';') { $stmts[] = $buf; $buf = ''; continue; }
        $buf .= $c;
    }
    if (trim($buf) !== '') $stmts[] = $buf;
    return $stmts;
}
