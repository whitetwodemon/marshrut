// hooks/useRealtime.js — React hook для SSE подключения
import { useEffect, useRef, useState } from 'react';
import { Events, Auth } from '../lib/api.js';

/**
 * useRealtime — подключает SSE и возвращает статус соединения.
 *
 * @param {Object} handlers  { onTaskUpdated, onScanLogged, onOrderUpdated }
 * @returns {{ connected: boolean }}
 */
export function useRealtime({ onTaskUpdated, onScanLogged, onOrderUpdated } = {}) {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef({});

  // Храним handlers в ref чтобы не пересоздавать EventSource при каждом рендере
  useEffect(() => {
    handlersRef.current = { onTaskUpdated, onScanLogged, onOrderUpdated };
  }, [onTaskUpdated, onScanLogged, onOrderUpdated]);

  useEffect(() => {
    if (!Auth.isLoggedIn()) return;

    Events.connect({
      connected:     ()  => setConnected(true),
      task_updated:  (d) => handlersRef.current.onTaskUpdated?.(d),
      scan_logged:   (d) => handlersRef.current.onScanLogged?.(d),
      order_updated: (d) => handlersRef.current.onOrderUpdated?.(d),
    });

    // Периодически проверяем статус
    const check = setInterval(() => {
      setConnected(Events.isConnected());
    }, 3000);

    return () => {
      clearInterval(check);
      Events.disconnect();
    };
  }, []);

  return { connected };
}
