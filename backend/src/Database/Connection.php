<?php
// src/Database/Connection.php

namespace Marshrut\Database;

use PDO;
use PDOException;

class Connection
{
    private static ?PDO $instance = null;

    /** Получить смещение часового пояса из настроек или окружения */
    private static function getTimezone(): string
    {
        // ВСЕГДА UTC в БД — фронтенд отображает в локальном времени браузера
        // APP_TIMEZONE_OFFSET используется только для отображения в AdminPanel настройках
        return '+00:00';
    }

    public static function get(): PDO
    {
        if (self::$instance === null) {
            $host = getenv('DB_HOST')     ?: 'mysql';
            $port = getenv('DB_PORT')     ?: '3306';
            $name = getenv('DB_NAME')     ?: 'marshrut';
            $user = getenv('DB_USER')     ?: 'marshrut';
            $pass = getenv('DB_PASSWORD') ?: 'marshrut';

            $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";

            try {
                self::$instance = new PDO($dsn, $user, $pass, [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET time_zone = '" . self::getTimezone() . "'"  ,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false,
                ]);
                self::$instance->exec("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'");
            } catch (PDOException $e) {
                http_response_code(503);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Database unavailable: ' . $e->getMessage()]);
                exit;
            }
        }

        return self::$instance;
    }
}
