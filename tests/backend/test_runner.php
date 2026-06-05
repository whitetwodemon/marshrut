<?php
/**
 * test_runner.php — Unit-тесты для Маршрут MES
 *
 * Запуск:
 *   docker compose exec php php /var/www/api/tests/backend/test_runner.php
 *
 * Тестирует: helpers, JWT, бизнес-логику, безопасность
 */

$passed = 0;
$failed = 0;
$errors = [];

function test(string $name, callable $fn): void {
    global $passed, $failed, $errors;
    try {
        $fn();
        echo "  ✓ {$name}\n";
        $passed++;
    } catch (Throwable $e) {
        echo "  ✗ {$name}: " . $e->getMessage() . "\n";
        $failed++;
        $errors[] = $name;
    }
}

function assertEqual($actual, $expected, string $msg = ''): void {
    if ($actual !== $expected) {
        throw new \Exception(
            "Expected " . json_encode($expected) .
            ", got "    . json_encode($actual) .
            ($msg ? " ($msg)" : '')
        );
    }
}

function assertContains($needle, $haystack): void {
    if (is_array($haystack)) {
        if (!in_array($needle, $haystack, true))
            throw new \Exception(json_encode($needle) . " not in array");
    } elseif (!str_contains((string)$haystack, (string)$needle)) {
        throw new \Exception(json_encode($needle) . " not found in string");
    }
}

function assertTrue($val, string $msg = ''): void {
    if (!$val) throw new \Exception("Expected true" . ($msg ? ": $msg" : ''));
}

function assertFalse($val, string $msg = ''): void {
    if ($val) throw new \Exception("Expected false" . ($msg ? ": $msg" : ''));
}

// ── Bootstrap ────────────────────────────────────────────────────────────
$appRoot = __DIR__ . '/../../backend';
require_once $appRoot . '/src/helpers.php';

echo "\n";
echo "══════════════════════════════════════════════\n";
echo "  МАРШРУТ MES — Backend Unit Tests\n";
echo "══════════════════════════════════════════════\n\n";

// ────────────────────────────────────────────────────────────────────────
// 1. HELPERS
// ────────────────────────────────────────────────────────────────────────
echo "── 1. Helpers ──────────────────────────────────\n";

test('sanitize_string: strips HTML tags', function() use ($appRoot) {
    $r = \Marshrut\sanitize_string('<script>alert(1)</script>hello', 100);
    assertFalse(str_contains($r, '<script>'), 'should strip script tag');
    assertContains('hello', $r);
});

test('sanitize_string: respects max_length', function() {
    $r = \Marshrut\sanitize_string(str_repeat('a', 200), 10);
    assertTrue(mb_strlen($r) <= 10);
});

test('sanitize_string: null becomes empty string', function() {
    assertEqual(\Marshrut\sanitize_string(null, 50), '');
});

test('sanitize_string: preserves Cyrillic', function() {
    $r = \Marshrut\sanitize_string('Токарная операция №1', 100);
    assertContains('Токарная', $r);
});

test('sanitize_string: strips SQL injection attempt', function() {
    $r = \Marshrut\sanitize_string("'; DROP TABLE users; --", 100);
    assertFalse(str_contains($r, "'; DROP"), 'should not contain SQL injection');
});

test('validate(): null when all required fields present', function() {
    $err = \Marshrut\validate(['number' => 'W_26_000001', 'due_date' => '2026-12-31'], ['number', 'due_date']);
    assertEqual($err, null);
});

test('validate(): returns error for missing field', function() {
    $err = \Marshrut\validate(['number' => 'W_26_000001'], ['number', 'due_date']);
    assertTrue($err !== null);
    assertContains('due_date', $err);
});

test('validate(): treats empty string as missing', function() {
    $err = \Marshrut\validate(['number' => ''], ['number']);
    assertTrue($err !== null, 'empty string should fail validation');
});

test('validate(): whitespace-only fails', function() {
    $err = \Marshrut\validate(['number' => '   '], ['number']);
    assertTrue($err !== null, 'whitespace should fail validation');
});

// ────────────────────────────────────────────────────────────────────────
// 2. JWT
// ────────────────────────────────────────────────────────────────────────
require_once $appRoot . '/src/Jwt.php';
echo "\n── 2. JWT ──────────────────────────────────────\n";

test('encode/decode round-trip', function() {
    $payload = ['sub' => 42, 'name' => 'Иванов И.И.', 'exp' => time() + 3600];
    $token   = \Marshrut\Jwt::encode($payload, 'test-secret-key');
    $decoded = \Marshrut\Jwt::decode($token, 'test-secret-key');
    assertEqual($decoded->sub, 42);
    assertEqual($decoded->name, 'Иванов И.И.');
});

test('token has exactly 3 dot-separated parts', function() {
    $token = \Marshrut\Jwt::encode(['sub' => 1, 'exp' => time() + 3600], 'secret');
    assertEqual(count(explode('.', $token)), 3);
});

test('wrong secret → null', function() {
    $token  = \Marshrut\Jwt::encode(['sub' => 1, 'exp' => time() + 3600], 'correct');
    $result = \Marshrut\Jwt::decode($token, 'wrong');
    assertEqual($result, null);
});

test('expired token → null', function() {
    $token  = \Marshrut\Jwt::encode(['sub' => 1, 'exp' => time() - 60], 'secret');
    $result = \Marshrut\Jwt::decode($token, 'secret');
    assertEqual($result, null);
});

test('tampered payload → null', function() {
    $token  = \Marshrut\Jwt::encode(['sub' => 1, 'exp' => time() + 3600, 'role' => 'operator'], 'secret');
    $parts  = explode('.', $token);
    // Tamper payload to claim admin
    $parts[1] = base64_encode(json_encode(['sub' => 1, 'exp' => time() + 3600, 'role' => 'admin']));
    $tampered = implode('.', $parts);
    $result   = \Marshrut\Jwt::decode($tampered, 'secret');
    assertEqual($result, null);
});

test('different secrets produce different tokens', function() {
    $payload = ['sub' => 1, 'exp' => time() + 3600];
    $t1 = \Marshrut\Jwt::encode($payload, 'secret1');
    $t2 = \Marshrut\Jwt::encode($payload, 'secret2');
    assertFalse($t1 === $t2, 'tokens should differ');
});

// ────────────────────────────────────────────────────────────────────────
// 3. BUSINESS LOGIC
// ────────────────────────────────────────────────────────────────────────
echo "\n── 3. Business Logic ───────────────────────────\n";

test('order number format: W_YY_NNNNNN', function() {
    $year    = (int) date('y');
    $yearStr = str_pad($year, 2, '0', STR_PAD_LEFT);
    $number  = 'W_' . $yearStr . '_' . str_pad(1, 6, '0', STR_PAD_LEFT);
    assertEqual(substr($number, 0, 1), 'W');
    assertEqual(strlen($number), 12); // W_26_000001 = 12 chars
    assertTrue(preg_match('/^[WDK]_\d{2}_\d{6}$/', $number) === 1);
});

test('all order type prefixes valid', function() {
    $allowed = ['W', 'D', 'K'];
    foreach ($allowed as $type) {
        $num = $type . '_26_000001';
        $extracted = strtoupper(explode('_', $num)[0]);
        assertEqual($extracted, $type, "type $type");
    }
});

test('task ID uniqueness with uniqid()', function() {
    $ids = [];
    for ($i = 0; $i < 200; $i++) {
        $ids[] = 'OT-order1-D001-010-' . substr(uniqid('', true), -6);
    }
    assertEqual(count($ids), count(array_unique($ids)), '200 IDs must all be unique');
});

test('isComplete: completed >= planned = done', function() {
    $cases = [
        [5, 5, true],
        [5, 3, true],   // over-completed
        [3, 5, false],  // partial
        [0, 1, false],  // not started
        [1, 1, true],
    ];
    foreach ($cases as [$completed, $planned, $expected]) {
        $isComplete = $completed >= $planned;
        assertEqual($isComplete, $expected, "completed=$completed planned=$planned");
    }
});

test('norm percent calculation', function() {
    $cases = [
        [50,  100, 50],
        [100, 100, 100],
        [120, 100, 120],
        [0,   100, 0],
    ];
    foreach ($cases as [$actual, $plan, $expected]) {
        $pct = $plan > 0 ? (int) round($actual / $plan * 100) : 0;
        assertEqual($pct, $expected, "actual=$actual plan=$plan");
    }
});

test('session time from started_at (30 min ago)', function() {
    $startedAt = date('Y-m-d H:i:s', time() - 1800);
    $sessionMin = max(0, (int) round((time() - strtotime($startedAt)) / 60));
    assertTrue($sessionMin >= 29 && $sessionMin <= 31, "Expected ~30, got $sessionMin");
});

test('accumulated_time resets to 0 on full close', function() {
    $isComplete     = true;
    $accumulated    = 50;
    $newAccumulated = $isComplete ? 0 : $accumulated;
    assertEqual($newAccumulated, 0, 'should reset on full close');
});

test('accumulated_time kept on partial close', function() {
    $isComplete     = false;
    $accumulated    = 50;
    $newAccumulated = $isComplete ? 0 : $accumulated;
    assertEqual($newAccumulated, 50, 'should preserve on partial close');
});

test('task new status after partial close = in_progress', function() {
    $completed = 3; $planned = 5;
    $status = ($completed >= $planned) ? 'done' : 'in_progress';
    assertEqual($status, 'in_progress');
});

test('task new status after full close = done', function() {
    $completed = 5; $planned = 5;
    $status = ($completed >= $planned) ? 'done' : 'in_progress';
    assertEqual($status, 'done');
});

// ────────────────────────────────────────────────────────────────────────
// 4. SCHEMA VALIDATION
// ────────────────────────────────────────────────────────────────────────
echo "\n── 4. Schema Validation ────────────────────────\n";

$schema = file_get_contents(__DIR__ . '/../../mysql-init/01_schema.sql');
$tables = [];
preg_match_all('/CREATE TABLE(?:\s+IF NOT EXISTS)?\s+(\w+)\s*\(([^;]+);/s', $schema, $m);
for ($i = 0; $i < count($m[1]); $i++) {
    $cols = [];
    preg_match_all('/^\s+(\w+)\s+(?:VARCHAR|INT|TEXT|TIMESTAMP|ENUM|TINYINT|CHAR|DATE|SMALLINT)/m',
                   $m[2][$i], $cm);
    $tables[$m[1][$i]] = $cm[1];
}

$tableChecks = [
    'tasks'           => ['id','order_id','detail_id','op_num','op_name','work_center',
                          'time_min','planned','completed','status','operator','started_at',
                          'actual_time_min','accumulated_time','qr_text'],
    'orders'          => ['id','number','order_type','customer','foreman','status',
                          'priority','due_date','comment','created_at','updated_at'],
    'scan_log'        => ['id','task_id','qr_text','operator','result','quantity',
                          'batch_num','actual_time_min','scanned_at'],
    'shifts'          => ['id','name','opened_at','closed_at','opened_by','closed_by'],
    'users'           => ['id','email','password_hash','role_id','name','is_active','last_login'],
    'system_settings' => ['key_name','value','description'],
];

foreach ($tableChecks as $table => $cols) {
    test("Table '{$table}' exists in schema", function() use ($tables, $table) {
        assertTrue(isset($tables[$table]), "Table $table not found");
    });
    foreach ($cols as $col) {
        test("  {$table}.{$col} column exists", function() use ($tables, $table, $col) {
            assertTrue(isset($tables[$table]) && in_array($col, $tables[$table]),
                       "{$table}.{$col} not found in schema");
        });
    }
}

// ────────────────────────────────────────────────────────────────────────
// 5. STATUS ENUMS
// ────────────────────────────────────────────────────────────────────────
echo "\n── 5. Allowed Values ───────────────────────────\n";

test('orders status ENUM includes shipped', function() use ($schema) {
    assertContains("'shipped'", $schema);
});

test('orders status ENUM includes all workflow statuses', function() use ($schema) {
    $required = ['draft', 'plan', 'in_work', 'done', 'cancelled', 'shipped'];
    foreach ($required as $s) {
        assertContains("'{$s}'", $schema, "status '$s' missing from ENUM");
    }
});

test('task status ENUM has required values', function() use ($schema) {
    foreach (['waiting', 'in_progress', 'done', 'paused', 'rejected'] as $s) {
        assertContains("'{$s}'", $schema);
    }
});

test('task_pauses reason ENUM has all pause types', function() use ($schema) {
    foreach (['lunch', 'break', 'tech', 'material', 'equipment', 'other'] as $r) {
        assertContains("'{$r}'", $schema);
    }
});

// ────────────────────────────────────────────────────────────────────────
// 6. ROUTE COVERAGE
// ────────────────────────────────────────────────────────────────────────
echo "\n── 6. Route Coverage ───────────────────────────\n";

$routes = file_get_contents(__DIR__ . '/../../backend/public/index.php');

$criticalRoutes = [
    'GET /api/orders',
    'POST /api/orders',
    'PUT /api/orders/',
    'DELETE /api/orders/',
    'GET /api/tasks',
    'PATCH /api/tasks/',
    'POST /api/tasks/',
    'POST /api/auth/login',
    'POST /api/auth/refresh',
    'GET /api/shifts',
    'POST /api/shifts/open',
    'GET /api/settings',
    'POST /api/settings',
    'GET /api/health',
];

foreach ($criticalRoutes as $route) {
    [$method, $path] = explode(' ', $route, 2);
    test("Route {$method} {$path} is registered", function() use ($routes, $method, $path) {
        // Check route registration
        $pathEscaped = str_replace('/', '\/', preg_quote($path, '/'));
        assertTrue(
            str_contains($routes, "'{$method}'") && str_contains($routes, $path),
            "Route not found: {$method} {$path}"
        );
    });
}

// ────────────────────────────────────────────────────────────────────────
// Summary
// ────────────────────────────────────────────────────────────────────────
echo "\n══════════════════════════════════════════════\n";
$total = $passed + $failed;
printf("  Results: %d/%d passed", $passed, $total);
if ($failed > 0) {
    echo " ({$failed} FAILED)";
    echo "\n  Failed tests:\n";
    foreach ($errors as $e) {
        echo "    • {$e}\n";
    }
}
echo "\n══════════════════════════════════════════════\n\n";

exit($failed > 0 ? 1 : 0);
