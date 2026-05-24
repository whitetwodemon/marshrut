#!/bin/sh
set -e

echo "[php] Waiting for MySQL at ${DB_HOST:-mysql}:${DB_PORT:-3306}..."
attempts=0
until php -r "
  try {
    \$pdo = new PDO(
      'mysql:host=${DB_HOST:-mysql};port=${DB_PORT:-3306};dbname=${DB_NAME:-marshrut}',
      '${DB_USER:-marshrut}', '${DB_PASSWORD:-marshrut}'
    );
    exit(0);
  } catch(Exception \$e) { exit(1); }
" 2>/dev/null; do
  attempts=$((attempts+1))
  [ $attempts -ge 30 ] && echo "[php] ERROR: MySQL unavailable" && exit 1
  echo "[php] waiting... ($attempts/30)"
  sleep 3
done

echo "[php] MySQL ready. Creating admin..."
php /var/www/api/scripts/create-admin.php || true

echo "[php] Starting PHP-FPM..."
exec php-fpm --nodaemonize
