#!/bin/sh
set -e

# Генерируем случайный JWT_SECRET при первом запуске если он не задан или дефолтный
SECRET_FILE="/var/www/api/.jwt_secret"

if [ "${JWT_SECRET}" = "change-me-in-production" ] || [ -z "${JWT_SECRET}" ]; then
    if [ -f "$SECRET_FILE" ]; then
        export JWT_SECRET=$(cat "$SECRET_FILE")
        echo "[startup] JWT_SECRET loaded from file"
    else
        export JWT_SECRET=$(head -c 48 /dev/urandom | base64 | tr -d '/+=' | head -c 64)
        echo "$JWT_SECRET" > "$SECRET_FILE"
        chmod 600 "$SECRET_FILE"
        echo "[startup] JWT_SECRET generated and saved to $SECRET_FILE"
    fi
else
    echo "[startup] JWT_SECRET set from environment"
fi

# Создаём admin-пользователя
php /var/www/api/scripts/create-admin.php

# Запускаем PHP-FPM
exec php-fpm
