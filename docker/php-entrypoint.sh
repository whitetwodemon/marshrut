#!/bin/sh
set -e

echo "[php] Starting PHP-FPM..."

# Ждём MySQL
echo "[migrate] Waiting for MySQL..."
for i in $(seq 1 30); do
    php -r "new PDO('mysql:host=${DB_HOST:-mysql};dbname=${DB_NAME:-marshrut}', '${DB_USER:-marshrut}', '${DB_PASSWORD:-${DB_PASS:-marshrut}}');" 2>/dev/null && break
    echo "[migrate] Attempt $i/30, waiting..."
    sleep 2
done

# Запускаем миграции
echo "[migrate] Running migrations..."
MIGRATIONS_DIR=/var/www/migrations php /var/www/api/scripts/migrate.php up
echo "[migrate] Done."

# Создаём admin если нет
echo "[init] Creating admin user if needed..."
php /var/www/api/scripts/create-admin.php
echo "[init] Done."

exec php-fpm
