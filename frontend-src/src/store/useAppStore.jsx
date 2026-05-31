/**
 * useAppStore.js — Центральное хранилище состояния приложения
 *
 * Заменяет 26 useState хуков в App.jsx одним Context + useReducer.
 * Паттерн: Redux-lite без внешних зависимостей.
 *
 * Использование:
 *   const { state, dispatch } = useAppStore();
 *   dispatch({ type: 'SET_TASKS', payload: tasks });
 */

import React from 'react';
import { apiOrderToData, apiTasksToFrontend, apiScanLogToFrontend } from '../lib/api-helpers.jsx';
import { api, Auth } from '../lib/api.js';

// ── Начальное состояние ──────────────────────────────────────────────────
const initialState = {
  // Данные с сервера
  data:        null,        // { orders, details }
  tasks:       [],          // текущие задания
  scanLog:     [],          // журнал сканирований (последние 50)
  workshops:   [],          // цеха (legacy)
  workCenters: [],          // рабочие центры

  // Смена
  activeShift: null,        // текущая открытая смена

  // UI состояние
  route:         'dashboard',
  activeOrderId: null,
  modal:         null,      // string | { type, ...params }

  // Пользователи (для админки)
  appUsers: [],

  // Редактирование
  editingDetail: null,
  editingOrder:  null,
  confirmDlg:    null,

  // Уведомления
  toasts: [],

  // Флаги загрузки
  loading: false,
};

// ── Редюсер: чистые трансформации состояния ──────────────────────────────
function reducer(state, action) {
  switch (action.type) {

    // ─── Данные ─────────────────────────────────────────────────────────
    case 'SET_DATA':
      return { ...state, data: action.payload };

    case 'SET_TASKS':
      return { ...state, tasks: action.payload };

    case 'UPDATE_TASK': {
      // Обновить одно задание по id (от SSE или после действия)
      const upd = action.payload;
      return {
        ...state,
        tasks: state.tasks.map(t => t.id === upd.id ? { ...t, ...upd } : t),
      };
    }

    case 'SET_SCAN_LOG':
      return { ...state, scanLog: action.payload };

    case 'SET_WORKSHOPS':
      return { ...state, workshops: action.payload };

    case 'SET_WORK_CENTERS':
      return { ...state, workCenters: action.payload };

    case 'SET_ACTIVE_SHIFT':
      return { ...state, activeShift: action.payload };

    case 'SET_APP_USERS':
      return { ...state, appUsers: action.payload };

    // ─── Навигация ───────────────────────────────────────────────────────
    case 'SET_ROUTE':
      return { ...state, route: action.payload };

    case 'SET_ACTIVE_ORDER':
      return { ...state, activeOrderId: action.payload };

    // ─── Модальные окна ──────────────────────────────────────────────────
    case 'OPEN_MODAL':
      return { ...state, modal: action.payload };

    case 'CLOSE_MODAL':
      return { ...state, modal: null };

    // ─── Редактирование ──────────────────────────────────────────────────
    case 'SET_EDITING_DETAIL':
      return { ...state, editingDetail: action.payload };

    case 'SET_EDITING_ORDER':
      return { ...state, editingOrder: action.payload };

    case 'SET_CONFIRM_DLG':
      return { ...state, confirmDlg: action.payload };

    // ─── Уведомления ─────────────────────────────────────────────────────
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.payload] };

    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };

    // ─── Флаги ───────────────────────────────────────────────────────────
    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    default:
      return state;
  }
}

// ── Контекст ─────────────────────────────────────────────────────────────
export const AppContext = React.createContext(null);

/**
 * AppProvider — оборачивает приложение, предоставляет стейт через контекст
 */
export function AppProvider({ children }) {
  const [state, dispatch] = React.useReducer(reducer, initialState);

  // ── Вспомогательные action creators ─────────────────────────────────

  /** Показать toast-уведомление на 3 секунды */
  function pushToast(msg) {
    const id = Math.random().toString(36).slice(2);
    dispatch({ type: 'ADD_TOAST', payload: { id, msg } });
    setTimeout(() => dispatch({ type: 'REMOVE_TOAST', payload: id }), 3000);
  }

  /**
   * Полная перезагрузка данных с сервера.
   * Вызывается при старте и после значимых действий.
   * TODO: Заменить на инкрементальные обновления (Фаза 1.1)
   */
  async function loadAll() {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      // Параллельная загрузка всех необходимых данных
      const [ordersRes, detailsRes, tasksRes, logRes, workshopsRes] = await Promise.all([
        api.get('/orders'),
        api.get('/details'),
        api.get('/tasks'),
        api.get('/scan-log?limit=50'),
        api.get('/workshops'),
      ]);

      // Маппинг данных из API в формат фронтенда
      const mappedData  = apiOrderToData(ordersRes.data, detailsRes.data);
      const mappedTasks = apiTasksToFrontend(tasksRes.data);
      const mappedLog   = apiScanLogToFrontend(logRes.data);

      dispatch({ type: 'SET_DATA',      payload: mappedData });
      dispatch({ type: 'SET_TASKS',     payload: mappedTasks });
      dispatch({ type: 'SET_SCAN_LOG',  payload: mappedLog });
      dispatch({ type: 'SET_WORKSHOPS', payload: workshopsRes.data || [] });

      // Рабочие центры и активная смена — отдельными запросами (не блокируют основную загрузку)
      api.get('/work-centers')
         .then(r => dispatch({ type: 'SET_WORK_CENTERS', payload: r.data || [] }))
         .catch(() => {});

      api.get('/shifts/active')
         .then(r => dispatch({ type: 'SET_ACTIVE_SHIFT', payload: r.shift || null }))
         .catch(() => {});

      // Установить первый заказ активным если ничего не выбрано
      if (!state.activeOrderId && mappedData.orders.length > 0) {
        dispatch({ type: 'SET_ACTIVE_ORDER', payload: mappedData.orders[0].id });
      }
    } catch (e) {
      pushToast('Ошибка загрузки: ' + e.message);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }

  // Предоставляем стейт, dispatch и хелперы дочерним компонентам
  const value = React.useMemo(() => ({
    state,
    dispatch,
    pushToast,
    loadAll,
  }), [state]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

/**
 * useAppStore — хук для доступа к стейту из любого компонента
 *
 * @example
 *   const { state, dispatch, pushToast, loadAll } = useAppStore();
 */
export function useAppStore() {
  const ctx = React.useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used within AppProvider');
  return ctx;
}
