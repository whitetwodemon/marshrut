#!/bin/sh
set -e

# Create admin user if not exists
php /var/www/api/scripts/create-admin.php

# Start PHP-FPM
exec php-fpm
