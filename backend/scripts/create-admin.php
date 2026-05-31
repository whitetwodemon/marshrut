#!/usr/bin/env php
<?php
// scripts/create-admin.php
// Запускается автоматически при старте PHP-контейнера (см. Dockerfile CMD)
// Создаёт admin-пользователя если его нет

$host  = getenv('DB_HOST')     ?: 'mysql';
$port  = getenv('DB_PORT')     ?: '3306';
$name  = getenv('DB_NAME')     ?: 'marshrut';
$user  = getenv('DB_USER')     ?: 'marshrut';
$pass  = getenv('DB_PASSWORD') ?: 'marshrut';

$adminEmail    = getenv('ADMIN_EMAIL')    ?: 'admin@marshrut.local';
$adminPassword = getenv('ADMIN_PASSWORD') ?: 'Admin1234!';
$adminName     = getenv('ADMIN_NAME')     ?: 'Администратор';

// Ждём пока MySQL поднимется
$attempts = 0;
while ($attempts < 30) {
    try {
        $pdo = new PDO(
            "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4",
            $user, $pass,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
        break;
    } catch (PDOException $e) {
        $attempts++;
        echo "[create-admin] Waiting for MySQL... ({$attempts}/30)\n";
        sleep(2);
    }
}

if ($attempts >= 30) {
    echo "[create-admin] ERROR: MySQL not available\n";
    exit(1);
}

// Проверяем есть ли уже admin
$stmt = $pdo->prepare('SELECT id FROM users WHERE email = :email');
$stmt->execute([':email' => $adminEmail]);

if ($stmt->fetch()) {
    echo "[create-admin] Admin user already exists: {$adminEmail}\n";
    exit(0);
}

// Создаём с правильным bcrypt хэшем
$hash = password_hash($adminPassword, PASSWORD_BCRYPT, ['cost' => 10]);

$pdo->prepare(
    'INSERT INTO users (name, email, password_hash, role_id, is_active)
     VALUES (:name, :email, :hash, 1, 1)'
)->execute([
    ':name'  => $adminName,
    ':email' => $adminEmail,
    ':hash'  => $hash,
]);

echo "[create-admin] ✓ Admin created: {$adminEmail} / {$adminPassword}\n";

// ── Создаём тестовых пользователей если их нет ──────────────────────────
$testPassword = getenv('TEST_PASSWORD') ?: 'Test1234!';
$testHash     = password_hash($testPassword, PASSWORD_BCRYPT, ['cost' => 10]);

$testUsers = [
    ['name' => 'Колесников П.А.',  'email' => 'foreman@marshrut.local',   'role_id' => 2],
    ['name' => 'Гаврилов А.Б.',    'email' => 'operator1@marshrut.local', 'role_id' => 3],
    ['name' => 'Семёнов И.Н.',     'email' => 'operator2@marshrut.local', 'role_id' => 3],
    ['name' => 'Орлов Д.С.',       'email' => 'operator3@marshrut.local', 'role_id' => 3],
    ['name' => 'Наблюдатель',      'email' => 'viewer@marshrut.local',    'role_id' => 4],
];

$insertUser = $pdo->prepare(
    'INSERT IGNORE INTO users (name, email, password_hash, role_id, is_active) VALUES (:name, :email, :hash, :role, 1)'
);

foreach ($testUsers as $u) {
    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = :email');
    $stmt->execute([':email' => $u['email']]);
    if (!$stmt->fetch()) {
        $insertUser->execute([':name' => $u['name'], ':email' => $u['email'], ':hash' => $testHash, ':role' => $u['role_id']]);
        echo "[create-admin] ✓ User created: {$u['email']} / {$testPassword}\n";
    }
}
echo "[create-admin] ✓ Test users ready\n";

