/**
 * useTaskActions.js — хук для действий над заданиями
 *
 * Инкапсулирует всю бизнес-логику работы с заданиями:
 * начало работы, закрытие, пауза, возобновление.
 *
 * Отделён от App.jsx чтобы:
 * 1. Упростить тестирование (мокируем api)
 * 2. Переиспользовать в WorkCenter, Dashboard, Scanner
 * 3. Убрать бизнес-логику из UI-компонента
 *
 * @param {Function} pushToast  - показать уведомление
 * @param {Function} dispatch   - dispatch стейта
 * @param {Array}    tasks      - текущие задания (для оптимистичных обновлений)
 * @param {Object}   authUser   - текущий пользователь
 *
 * @example
 *   const { closeTask, startTask } = useTaskActions(pushToast, dispatch, tasks, authUser);
 *   await closeTask(taskId, qrText, qty, operator, action, comment, status);
 */

import { api } from '../lib/api.js';

export function useTaskActions(pushToast, dispatch, tasks, authUser, onScanLogRefresh) {

  /**
   * Получить имя оператора для записи в задание.
   * Приоритет: явно переданный оператор → имя из authUser → заглушка.
   */
  function resolveOperator(operator, task) {
    return operator || authUser?.name || task?.operator || 'Оператор';
  }

  /**
   * Закрыть операцию / начать работу / изменить статус через сканер или кнопку.
   *
   * @param {string} taskId      - ID задания
   * @param {string} qrText      - QR-код операции (для scan_log)
   * @param {number} qty         - количество выполненных деталей
   * @param {string} operator    - имя оператора
   * @param {string} action      - 'start' | 'close' | 'rework' | 'reject'
   * @param {string} comment     - комментарий к закрытию
   * @param {string} closeStatus - итоговый статус задания ('done'|'rework'|'rejected')
   */
  async function closeTask(taskId, qrText, qty, operator, action, comment, closeStatus, actualMin) {
    const task = tasks.find(t => t.id === taskId);
    const op   = resolveOperator(operator, task);

    try {
      if (action === 'start') {
        // Взять задание в работу — проверки на сервере (смена, один оператор на РЦ)
        await api.patch('/tasks/' + taskId + '/status', {
          status:   'in_progress',
          operator: op,
        });

        // Оптимистичное обновление UI до ответа SSE
        dispatch({
          type: 'UPDATE_TASK',
          payload: { id: taskId, status: 'in_progress', operator: op },
        });

      } else {
        // Закрыть операцию (полностью или частично)
        if (navigator.vibrate) navigator.vibrate([100]);

        await api.post('/tasks/' + taskId + '/close', {
          operator:       op,
          qr_text:        qrText,
          completed:      qty,
          comment:        comment || undefined,
          actual_time_min: actualMin || undefined,
        });

        // Если нужен нестандартный статус (брак, переделка) — обновляем отдельно
        if (closeStatus && closeStatus !== 'done') {
          await api.patch('/tasks/' + taskId + '/status', {
            status:   closeStatus,
            operator: op,
          });
        }

        // Оптимистичное обновление
        const newCompleted = qty ?? task?.planned ?? 0;
        const newStatus    = newCompleted >= (task?.planned || 1) ? 'done' : 'in_progress';
        dispatch({
          type: 'UPDATE_TASK',
          payload: { id: taskId, status: newStatus, completed: newCompleted, operator: op },
        });

        // Haptic: двойной импульс при успехе
        if (navigator.vibrate) navigator.vibrate([50, 30, 80]);

        // Обновляем scan_log (он не через SSE) — передаётся через колбэк
        onScanLogRefresh?.();
      }

      const taskName = task?.opName || taskId;
      pushToast((action === 'start' ? '▶ В работе: ' : '✓ Закрыто: ') + taskName);

    } catch (e) {
      pushToast('Ошибка: ' + e.message);
      throw e; // пробрасываем для обработки в компоненте
    }
  }

  /**
   * Поставить задание на паузу с указанием причины.
   * @param {string} taskId  - ID задания
   * @param {string} reason  - код причины (lunch|break|tech|material|equipment|other)
   * @param {string} note    - доп. комментарий
   */
  async function pauseTask(taskId, reason, note) {
    try {
      await api.post('/tasks/' + taskId + '/pause', { reason, note });
      dispatch({ type: 'UPDATE_TASK', payload: { id: taskId, status: 'paused' } });
      pushToast('⏸ Задание на паузе');
    } catch (e) {
      pushToast('Ошибка: ' + e.message);
      throw e;
    }
  }

  /**
   * Возобновить задание после паузы.
   * @param {string} taskId - ID задания
   */
  async function resumeTask(taskId) {
    try {
      await api.post('/tasks/' + taskId + '/resume', {});
      dispatch({ type: 'UPDATE_TASK', payload: { id: taskId, status: 'in_progress' } });
      pushToast('▶ Задание возобновлено');
    } catch (e) {
      pushToast('Ошибка: ' + e.message);
      throw e;
    }
  }

  return { closeTask, pauseTask, resumeTask };
}
