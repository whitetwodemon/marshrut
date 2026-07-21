<?php
// src/Middleware/Cors.php

namespace Marshrut\Middleware;

class Cors
{
    public static function handle(): void
    {
        if (PHP_SAPI === 'cli') return;

        $origin  = $_SERVER['HTTP_ORIGIN'] ?? '*';
        $allowed = getenv('CORS_ORIGIN') ?: '*';

        if ($allowed === '*' || $origin === $allowed) {
            header('Access-Control-Allow-Origin: ' . $origin);
        }

        header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
        header('Access-Control-Max-Age: 86400');

        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
    }
}
