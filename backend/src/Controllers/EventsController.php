<?php
// src/Controllers/EventsController.php
// Server-Sent Events endpoint — push-уведомления в реальном времени
// Не требует внешних библиотек, работает через обычный HTTP/HTTPS

namespace Marshrut\Controllers;

use Marshrut\Database\Connection;
use Marshrut\Middleware\Auth;

class EventsController
{
    // Максимальное время держать соединение открытым
    private const MAX_AGE_SEC  = 55;
    // Интервал опроса БД
    private const POLL_SEC     = 2;

    /**
     * GET /api/events?since=<timestamp>
     *
     * SSE stream. Клиент подключается один раз, получает события по мере их появления.
     * При разрыве браузер автоматически переподключается (стандарт EventSource).
     */
    public static function stream(array $params): void
    {
        // Проверяем токен (из query-параметра, т.к. EventSource не поддерживает заголовки)
        $token = $_GET['token'] ?? '';
        if (!$token) {
            http_response_code(401);
            exit;
        }

        try {
            $payload = \Marshrut\Jwt::decode($token, \Marshrut\Middleware\Auth::getSecret());
        } catch (\RuntimeException) {
            http_response_code(401);
            exit;
        }

        // SSE headers
        header('Content-Type: text/event-stream; charset=utf-8');
        header('Cache-Control: no-cache, no-store');
        header('X-Accel-Buffering: no');    // отключить буферизацию nginx
        header('Connection: keep-alive');

        // Отключаем PHP output-буферизацию
        if (ob_get_level()) ob_end_clean();

        $since    = isset($_GET['since']) ? (int)$_GET['since'] : time() - 10;
        $started  = time();
        $db       = Connection::get();

        // Первичный пинг — даёт клиенту знать что соединение установлено
        self::emit('connected', ['ts' => time(), 'user' => $payload->name ?? '']);

        while (true) {
            // Ограничение времени сессии — браузер сам переподключится
            if (time() - $started >= self::MAX_AGE_SEC) {
                self::emit('reconnect', ['reason' => 'max_age']);
                break;
            }

            // Опрашиваем изменения с момента $since
            $events = self::poll($db, $since);

            foreach ($events as $event) {
                self::emit($event['type'], $event['payload']);
                $since = max($since, $event['ts']);
            }

            // Keepalive-комментарий раз в POLL_SEC — предотвращает таймаут прокси
            echo ": keepalive\n\n";
            flush();

            sleep(self::POLL_SEC);
        }

        exit;
    }

    // ----------------------------------------------------------------
    // Poll DB for changes since $since (unix timestamp)
    // ----------------------------------------------------------------
    private static function poll(\PDO $db, int $since): array
    {
        $events = [];

        // 1. Изменения статусов заданий
        $stmt = $db->prepare(
            'SELECT t.id, t.status, t.operator, t.completed, t.planned,
                    t.op_name, t.detail_id, t.order_id,
                    UNIX_TIMESTAMP(t.updated_at) AS ts
               FROM tasks t
              WHERE t.updated_at IS NOT NULL
                AND UNIX_TIMESTAMP(t.updated_at) > :since
              ORDER BY t.updated_at ASC
              LIMIT 50'
        );
        $stmt->execute([':since' => $since]);

        foreach ($stmt->fetchAll() as $row) {
            $events[] = [
                'type' => 'task_updated',
                'ts'   => (int) $row['ts'],
                'payload' => [
                    'id'        => $row['id'],
                    'status'    => $row['status'],
                    'operator'  => $row['operator'],
                    'completed' => (int) $row['completed'],
                    'planned'   => (int) $row['planned'],
                    'op_name'   => $row['op_name'],
                    'detail_id' => $row['detail_id'],
                    'order_id'  => $row['order_id'],
                ],
            ];
        }

        // 2. Новые записи в журнале сканирований
        $stmt = $db->prepare(
            'SELECT sl.id, sl.task_id, sl.qr_text, sl.detail_id, sl.op_info,
                    sl.operator, sl.result, sl.quantity,
                    UNIX_TIMESTAMP(sl.scanned_at) AS ts
               FROM scan_log sl
              WHERE UNIX_TIMESTAMP(sl.scanned_at) > :since
              ORDER BY sl.scanned_at ASC
              LIMIT 20'
        );
        $stmt->execute([':since' => $since]);

        foreach ($stmt->fetchAll() as $row) {
            $events[] = [
                'type' => 'scan_logged',
                'ts'   => (int) $row['ts'],
                'payload' => [
                    'task_id'  => $row['task_id'],
                    'qr_text'  => $row['qr_text'],
                    'detail'   => $row['detail_id'],
                    'op'       => $row['op_info'],
                    'operator' => $row['operator'],
                    'result'   => $row['result'],
                    'quantity' => (int) $row['quantity'],
                    'ts_label' => date('H:i', (int)$row['ts']),
                ],
            ];
        }

        // 3. Новые/изменённые заказы
        $stmt = $db->prepare(
            'SELECT id, number, status, customer,
                    UNIX_TIMESTAMP(updated_at) AS ts
               FROM orders
              WHERE UNIX_TIMESTAMP(updated_at) > :since
              ORDER BY updated_at ASC
              LIMIT 10'
        );
        $stmt->execute([':since' => $since]);

        foreach ($stmt->fetchAll() as $row) {
            $events[] = [
                'type' => 'order_updated',
                'ts'   => (int) $row['ts'],
                'payload' => [
                    'id'       => $row['id'],
                    'number'   => $row['number'],
                    'status'   => $row['status'],
                    'customer' => $row['customer'],
                ],
            ];
        }

        // Сортируем по времени
        usort($events, fn($a, $b) => $a['ts'] <=> $b['ts']);

        return $events;
    }

    private static function emit(string $event, array $data): void
    {
        echo "event: {$event}\n";
        echo 'data: ' . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n\n";
        flush();
    }
}
