FROM php:8.3-fpm-alpine

RUN docker-php-ext-install pdo pdo_mysql

RUN { \
    echo "default_charset = UTF-8"; \
    echo "display_errors = Off"; \
    echo "log_errors = On"; \
    echo "error_reporting = E_ALL & ~E_DEPRECATED & ~E_STRICT"; \
} > /usr/local/etc/php/conf.d/app.ini

RUN { \
    echo "[www]"; \
    echo "listen = 0.0.0.0:9000"; \
} > /usr/local/etc/php-fpm.d/zzz-app.conf

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/api
COPY backend/composer.json ./
RUN composer install --no-dev --optimize-autoloader --no-scripts
COPY backend/ .
COPY migrations/ /var/www/migrations/

COPY docker/php-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 9000
CMD ["/entrypoint.sh"]
