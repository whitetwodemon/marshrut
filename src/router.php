<?php
// src/router.php — lightweight router

namespace Marshrut;

class Router
{
    private array $routes = [];

    public function add(string $method, string $pattern, callable $handler): void
    {
        $this->routes[] = compact('method', 'pattern', 'handler');
    }

    public function dispatch(string $method, string $path): void
    {
        foreach ($this->routes as $route) {
            if (strtoupper($route['method']) !== strtoupper($method)) {
                continue;
            }

            $regex = preg_replace('/\{(\w+)\}/', '(?P<$1>[^/]+)', $route['pattern']);
            $regex = '#^' . $regex . '$#';

            if (preg_match($regex, $path, $matches)) {
                $params = array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY);
                ($route['handler'])($params);
                return;
            }
        }

        http_response_code(404);
        json_out(['error' => 'Route not found', 'path' => $path]);
    }
}

// ---- Helpers -------------------------------------------------------

function json_out(mixed $data, int $code = 200): never
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Ошибка сервера: реальная причина пишется в лог, клиенту — обобщённое сообщение.
 * Защита от утечки структуры БД / путей через $e->getMessage().
 */
function json_error(\Throwable $e, string $publicMsg = 'Внутренняя ошибка сервера', int $code = 500, array $ctx = []): never
{
    app_log('error', 'server_error: ' . $e->getMessage(), $ctx + [
        'file' => basename($e->getFile()),
        'line' => $e->getLine(),
    ]);
    json_out(['error' => $publicMsg], $code);
}

function request_body(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function validate(array $body, array $required): ?string
{
    foreach ($required as $field) {
        if (!isset($body[$field]) || $body[$field] === '') {
            return "Поле «{$field}» обязательно";
        }
    }
    return null;
}

function sanitize_string(mixed $val, int $maxLen = 500): string
{
    $s = trim((string)($val ?? ''));
    return strlen($s) > $maxLen ? substr($s, 0, $maxLen) : $s;
}

function validate_email(string $email): bool
{
    return (bool) filter_var($email, FILTER_VALIDATE_EMAIL);
}

function validate_int(mixed $val, int $min = 0, int $max = PHP_INT_MAX): bool
{
    $n = filter_var($val, FILTER_VALIDATE_INT);
    return $n !== false && $n >= $min && $n <= $max;
}

function app_log(string $level, string $msg, array $ctx = []): void
{
    $entry = json_encode([
        'ts'      => date('c'),
        'level'   => $level,
        'msg'     => $msg,
        'ctx'     => $ctx,
        'ip'      => $_SERVER['REMOTE_ADDR'] ?? '',
        'path'    => $_SERVER['REQUEST_URI'] ?? '',
        'method'  => $_SERVER['REQUEST_METHOD'] ?? '',
    ], JSON_UNESCAPED_UNICODE);
    error_log($entry);
}

