#!/bin/sh
# НЕ ставим set -e на весь скрипт — миграции/админ не должны ронять контейнер
echo "[boot] Starting Marshrut MES..."

# Ждём MySQL
echo "[boot] Waiting for MySQL..."
i=0
while [ $i -lt 30 ]; do
    php -r "new PDO('mysql:host=${DB_HOST:-mysql};dbname=${DB_NAME:-marshrut}', '${DB_USER:-marshrut}', '${DB_PASSWORD:-marshrut}');" 2>/dev/null && break
    i=$((i+1))
    echo "[boot] Attempt $i/30..."
    sleep 2
done
echo "[boot] MySQL ready."

# Миграции — если упадут, логируем но НЕ роняем контейнер
echo "[boot] Running migrations..."
if php /var/www/api/scripts/migrate.php; then
    echo "[boot] Migrations OK."
else
    echo "[boot] WARNING: migrations failed (см. лог выше), продолжаю запуск."
fi

# Создание админа — тоже не критично для запуска
echo "[boot] Initializing admin user..."
if php /var/www/api/scripts/create-admin.php; then
    echo "[boot] Admin ready."
else
    echo "[boot] WARNING: create-admin failed, продолжаю запуск."
fi

echo "[boot] Starting php-fpm..."
exec php-fpm
