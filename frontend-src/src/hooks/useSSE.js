/**
 * useSSE.js — хук для SSE (Server-Sent Events) с автопереподключением
 *
 * Решает проблему: EventSource разрывается при потере сети или ошибке сервера
 * и не восстанавливается автоматически.
 *
 * Особенности:
 * - Exponential backoff: 1с → 2с → 4с → 8с → 16с (максимум)
 * - Reconnect при любой ошибке (onerror)
 * - Очистка при размонтировании компонента
 * - Передаёт JWT токен для авторизации
 *
 * @param {Object} handlers - объект с обработчиками событий
 * @param {Function} handlers.onTaskUpdated - задание обновлено
 * @param {Function} handlers.onScanLogged  - операция отсканирована
 * @param {Function} handlers.onOrderUpdated - заказ обновлён
 * @param {boolean} enabled - включить/выключить SSE
 *
 * @example
 *   useSSE({
 *     onTaskUpdated: (data) => dispatch({ type: 'UPDATE_TASK', payload: data }),
 *     onScanLogged:  ()     => reloadScanLog(),
 *     onOrderUpdated: ()    => reloadOrders(),
 *   }, !!authUser);
 */

import React from 'react';
import { Auth } from '../lib/api.js';

/** Максимальная задержка переподключения в миллисекундах */
const MAX_RETRY_DELAY = 16000;

/** Начальная задержка переподключения в миллисекундах */
const INITIAL_RETRY_DELAY = 1000;

export function useSSE(handlers, enabled = true) {
  // Refs используем чтобы не пересоздавать EventSource при изменении handlers
  const handlersRef = React.useRef(handlers);
  handlersRef.current = handlers;

  // Текущая задержка для exponential backoff
  const retryDelayRef = React.useRef(INITIAL_RETRY_DELAY);

  React.useEffect(() => {
    if (!enabled) return;

    let es = null;
    let retryTimer = null;
    let destroyed = false; // флаг размонтирования

    function connect() {
      if (destroyed) return;

      const token = Auth.getToken();
      if (!token) return;

      // since: не получать события старше 10 секунд (защита от дублей при реконнекте)
      const since = Math.floor(Date.now() / 1000 - 10);
      const url   = `/api/events?token=${encodeURIComponent(token)}&since=${since}`;

      es = new EventSource(url);

      // ── Обработчики событий от сервера ─────────────────────────────

      /** Задание изменило статус/оператора/количество */
      es.addEventListener('task_updated', e => {
        try {
          const data = JSON.parse(e.data);
          handlersRef.current.onTaskUpdated?.(data);
          // Успешное получение события — сбрасываем задержку
          retryDelayRef.current = INITIAL_RETRY_DELAY;
        } catch (err) {
          console.warn('[SSE] Failed to parse task_updated:', err);
        }
      });

      /** Операция закрыта через сканер */
      es.addEventListener('scan_logged', () => {
        handlersRef.current.onScanLogged?.();
        retryDelayRef.current = INITIAL_RETRY_DELAY;
      });

      /** Заказ создан/изменён/удалён */
      es.addEventListener('order_updated', () => {
        handlersRef.current.onOrderUpdated?.();
        retryDelayRef.current = INITIAL_RETRY_DELAY;
      });

      /** Сервер просит переподключиться (например, при деплое) */
      es.addEventListener('reconnect', () => {
        // reconnect requested
        es.close();
        retryTimer = setTimeout(connect, 1000);
      });

      /** Ошибка соединения → exponential backoff */
      es.onerror = () => {
        es.close();
        if (destroyed) return;

        const delay = retryDelayRef.current;
        // retrying connection
        retryTimer = setTimeout(connect, delay);

        // Увеличиваем задержку для следующей попытки (но не больше MAX)
        retryDelayRef.current = Math.min(delay * 2, MAX_RETRY_DELAY);
      };
    }

    connect();

    // Очистка при размонтировании или смене authUser
    return () => {
      destroyed = true;
      if (es)         es.close();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [enabled]); // пересоздаём только при изменении enabled (authUser)
}
