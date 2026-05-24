#!/bin/sh
set -e

echo "=== Marshrut startup ==="

# Ждём MySQL (всегда — и локально и на Timeweb DBaaS)
echo "Waiting for MySQL at ${DB_HOST}:${DB_PORT:-3306}..."
attempts=0
until php -r "
    try {
        new PDO(
            'mysql:host=${DB_HOST};port=${DB_PORT:-3306};dbname=${DB_NAME}',
            '${DB_USER}', '${DB_PASSWORD}'
        );
        exit(0);
    } catch(Exception \$e) {
        exit(1);
    }
" 2>/dev/null; do
    attempts=$((attempts + 1))
    if [ $attempts -ge 60 ]; then
        echo "ERROR: MySQL not available after 60 attempts"
        exit 1
    fi
    echo "  waiting... ($attempts/60)"
    sleep 3
done
echo "MySQL ready."

# Применяем миграции через обычного пользователя (не root)
echo "Running migrations..."
for f in /var/www/api/mysql-init/01_schema.sql \
          /var/www/api/mysql-init/03_auth.sql \
          /var/www/api/mysql-init/02_seed.sql; do
    if [ -f "$f" ]; then
        echo "  Applying $(basename $f)..."
        php -r "
            \$pdo = new PDO(
                'mysql:host=${DB_HOST};port=${DB_PORT:-3306};dbname=${DB_NAME};charset=utf8mb4',
                '${DB_USER}', '${DB_PASSWORD}',
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_SILENT]
            );
            \$sql = file_get_contents('$f');
            // Split by ; to run statement by statement
            foreach (array_filter(array_map('trim', explode(';', \$sql))) as \$stmt) {
                if (\$stmt) {
                    try { \$pdo->exec(\$stmt); } catch(Exception \$e) { /* skip existing */ }
                }
            }
        " 2>/dev/null || true
    fi
done

# Создаём admin-пользователя
echo "Creating admin..."
php /var/www/api/scripts/create-admin.php || true

echo "=== Starting nginx + php-fpm ==="
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
