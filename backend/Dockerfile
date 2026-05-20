FROM php:8.3-fpm-alpine

# System deps
RUN docker-php-ext-install pdo pdo_mysql

# Force UTF-8 в PHP и явно отключаем deprecated директивы mbstring
RUN { \
    echo "default_charset = UTF-8"; \
    echo "mbstring.language = neutral"; \
    echo "display_errors = Off"; \
    echo "log_errors = On"; \
    echo "error_reporting = E_ALL & ~E_DEPRECATED & ~E_STRICT"; \
} > /usr/local/etc/php/conf.d/charset.ini

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/api

# Install dependencies (no external packages needed — only generates autoloader)
COPY composer.json ./
RUN composer install --no-dev --optimize-autoloader --no-scripts

# Copy application
COPY . .

# PHP-FPM config
RUN echo "[www]" > /usr/local/etc/php-fpm.d/zzz-docker.conf && \
    echo "listen = 0.0.0.0:9000" >> /usr/local/etc/php-fpm.d/zzz-docker.conf

# Entrypoint: create admin then start php-fpm
COPY scripts/docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 9000
CMD ["/usr/local/bin/entrypoint.sh"]
