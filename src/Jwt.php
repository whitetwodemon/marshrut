<?php
// src/Jwt.php — минимальная реализация JWT HS256 без зависимостей

namespace Marshrut;

class Jwt
{
    public static function encode(array $payload, string $secret): string
    {
        $header  = self::b64(json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
        $payload = self::b64(json_encode($payload));
        $sig     = self::b64(hash_hmac('sha256', "$header.$payload", $secret, true));
        return "$header.$payload.$sig";
    }

    public static function decode(string $token, string $secret): object
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            throw new \RuntimeException('Invalid token format');
        }

        [$header, $payload, $sig] = $parts;

        $expected = self::b64(hash_hmac('sha256', "$header.$payload", $secret, true));
        if (!hash_equals($expected, $sig)) {
            throw new \RuntimeException('Invalid token signature');
        }

        $data = json_decode(self::b64decode($payload));
        if (!$data) {
            throw new \RuntimeException('Invalid token payload');
        }

        if (isset($data->exp) && $data->exp < time()) {
            throw new \RuntimeException('Token expired');
        }

        return $data;
    }

    private static function b64(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function b64decode(string $data): string
    {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}
