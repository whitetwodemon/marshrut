#!/bin/sh
set -e

echo "=== Marshrut startup ==="

# Ждём MySQL если он внешний (для Railway/Render с отдельным MySQL-сервисом)
if [ -n "$DB_HOST" ] && [ "$DB_HOST" != "localhost" ] && [ "$DB_HOST" != "127.0.0.1" ]; then
    echo "Waiting for MySQL at $DB_HOST:${DB_PORT:-3306}..."
    attempts=0
    while ! php -r "
        try {
            new PDO('mysql:host=${DB_HOST};port=${DB_PORT:-3306};dbname=${DB_NAME:-marshrut}',
                    '${DB_USER:-marshrut}', '${DB_PASSWORD:-marshrut}');
            exit(0);
        } catch(Exception \$e) { exit(1); }
    " 2>/dev/null; do
        attempts=$((attempts + 1))
        if [ $attempts -ge 30 ]; then
            echo "ERROR: MySQL not available after 30 attempts"
            exit 1
        fi
        echo "  waiting... ($attempts/30)"
        sleep 2
    done
    echo "MySQL ready."
fi

# Применяем SQL-миграции если таблиц ещё нет
echo "Running migrations..."
php -r "
    \$pdo = new PDO(
        'mysql:host=${DB_HOST:-localhost};port=${DB_PORT:-3306};charset=utf8mb4',
        '${DB_USER:-root}', '${DB_PASSWORD:-}',
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    \$pdo->exec('CREATE DATABASE IF NOT EXISTS \`${DB_NAME:-marshrut}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
" 2>/dev/null || true

for f in /var/www/api/mysql-init/*.sql; do
    if [ -f "\$f" ]; then
        echo "  Applying \$(basename \$f)..."
        php -r "
            \$pdo = new PDO(
                'mysql:host=${DB_HOST:-localhost};port=${DB_PORT:-3306};dbname=${DB_NAME:-marshrut};charset=utf8mb4',
                '${DB_USER:-root}', '${DB_PASSWORD:-}',
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_SILENT]
            );
            \$sql = file_get_contents('\$f');
            try { \$pdo->exec(\$sql); } catch(Exception \$e) { /* ignore duplicate tables */ }
        " 2>/dev/null || true
    fi
done

# Создаём admin-пользователя
php /var/www/api/scripts/create-admin.php

echo "=== Starting services ==="
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
