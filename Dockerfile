FROM php:8.3-fpm-alpine AS php-base

# PHP extensions
RUN docker-php-ext-install pdo pdo_mysql

# PHP ini
RUN echo "default_charset = UTF-8" > /usr/local/etc/php/conf.d/charset.ini && \
    echo "display_errors = Off" >> /usr/local/etc/php/conf.d/charset.ini && \
    echo "log_errors = On" >> /usr/local/etc/php/conf.d/charset.ini && \
    echo "error_reporting = E_ALL & ~E_DEPRECATED & ~E_STRICT" >> /usr/local/etc/php/conf.d/charset.ini

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/api
COPY backend/composer.json ./
RUN composer install --no-dev --optimize-autoloader --no-scripts
COPY backend/ .
COPY mysql-init/ ./mysql-init/

# ── Nginx + supervisord ──────────────────────────────────────────────
FROM php-base

RUN apk add --no-cache nginx supervisor

# Frontend
COPY frontend/ /var/www/html/

# Nginx config
COPY deploy/nginx-single.conf /etc/nginx/nginx.conf

# Supervisord config
COPY deploy/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# PHP-FPM: слушать на сокете
RUN echo "[www]" > /usr/local/etc/php-fpm.d/zzz-docker.conf && \
    echo "listen = /run/php-fpm.sock" >> /usr/local/etc/php-fpm.d/zzz-docker.conf && \
    echo "listen.owner = nginx" >> /usr/local/etc/php-fpm.d/zzz-docker.conf && \
    echo "listen.group = nginx" >> /usr/local/etc/php-fpm.d/zzz-docker.conf && \
    echo "listen.mode = 0660" >> /usr/local/etc/php-fpm.d/zzz-docker.conf

EXPOSE 80

# Entrypoint: создать admin, затем запустить supervisord
COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]
