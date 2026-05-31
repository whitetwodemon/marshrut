/**
 * api.js — Модуль авторизации и HTTP-клиента
 *
 * Предоставляет:
 * - Auth: управление JWT токенами и данными пользователя
 * - api: типизированный HTTP-клиент с авто-обновлением токена
 * - setAuthExpiredHandler: колбэк при протухании сессии
 *
 * Архитектура:
 * - Access token (JWT, 1ч) хранится только в памяти (_token)
 * - Refresh token хранится в HttpOnly cookie (недоступен JS)
 * - Данные пользователя дублируются в localStorage для восстановления при F5
 * - При получении 401 → автоматически обновляем access token через refresh
 */

/** Базовый URL API — совпадает с текущим origin (nginx проксирует) */
export const API_BASE = '/api';

// ── Auth: управление сессией ──────────────────────────────────────────────

export const Auth = {
  /** @private Текущий access token (только в памяти, теряется при F5) */
  _token:   null,

  /** @private Refresh token (обычно null — хранится в HttpOnly cookie) */
  _refresh: null,

  /** @private Данные текущего пользователя */
  _user:    null,

  // ── Токен ────────────────────────────────────────────────────────────

  /** Получить текущий access token */
  getToken()  { return this._token; },

  /** Сохранить access token */
  setToken(t) { this._token = t; },

  /** Получить refresh token */
  getRefresh()  { return this._refresh; },

  /** Сохранить refresh token */
  setRefresh(t) { this._refresh = t; },

  // ── Пользователь ─────────────────────────────────────────────────────

  /**
   * Получить данные текущего пользователя.
   * Сначала смотрит в памяти, затем в localStorage (восстановление после F5).
   */
  getUser() {
    if (this._user) return this._user;
    try {
      const saved = localStorage.getItem('_mu');
      if (saved) {
        this._user = JSON.parse(saved);
        return this._user;
      }
    } catch {
      // localStorage недоступен (приватный режим, Safari) — игнорируем
    }
    return null;
  },

  /**
   * Сохранить данные пользователя.
   * Дублирует в localStorage для восстановления после F5.
   */
  setUser(u) {
    this._user = u;
    try {
      if (u) localStorage.setItem('_mu', JSON.stringify(u));
      else   localStorage.removeItem('_mu');
    } catch {
      // Тихо игнорируем ошибки localStorage (режим инкогнито и т.д.)
    }
  },

  // ── Проверки ─────────────────────────────────────────────────────────

  /** Проверить, авторизован ли пользователь */
  isAuth()  { return !!this._token; },

  /** Проверить, является ли пользователь администратором */
  isAdmin() { return this._user?.role === 'admin'; },

  /**
   * Проверить наличие permission у текущего пользователя.
   * Администратор имеет все permissions автоматически.
   *
   * @param {string} perm - название permission (например 'orders.edit')
   */
  can(perm) {
    if (!this._user) return false;
    if (this._user.role === 'admin') return true;
    return (this._user.permissions || []).includes(perm);
  },

  // ── Жизненный цикл сессии ────────────────────────────────────────────

  /**
   * Очистить все данные сессии.
   * Вызывается при выходе из системы или протухании токена.
   */
  clear() {
    this._token   = null;
    this._refresh = null;
    this._user    = null;
    try { localStorage.removeItem('_mu'); } catch {}
  },

  /**
   * Обновить access token через HttpOnly cookie с refresh token.
   * Вызывается автоматически при получении 401 от API.
   *
   * @throws {Error} если refresh token тоже протух
   */
  async refresh() {
    const res = await fetch(API_BASE + '/auth/refresh', {
      method:      'POST',
      credentials: 'include', // отправляет HttpOnly cookie
    });
    if (!res.ok) throw new Error('Session expired');
    const data = await res.json();
    this.setToken(data.access_token);
    if (data.user) this.setUser(data.user);
    return data;
  },
};

// ── Глобальный обработчик истёкшей сессии ────────────────────────────────

/** @private Колбэк вызывается когда refresh тоже не работает */
let _onAuthExpired = null;

/**
 * Установить обработчик истёкшей сессии.
 * Обычно сбрасывает authUser → показывает LoginScreen.
 *
 * @param {Function} fn - вызывается без аргументов
 */
export function setAuthExpiredHandler(fn) {
  _onAuthExpired = fn;
}

// ── HTTP-клиент ───────────────────────────────────────────────────────────

export const api = {
  /**
   * Базовый метод выполнения HTTP-запроса.
   * Автоматически:
   * - Добавляет Authorization header
   * - Обновляет токен при 401
   * - Парсит JSON или возвращает текст
   *
   * @private
   * @param {string} method  - GET | POST | PUT | PATCH | DELETE
   * @param {string} path    - путь относительно API_BASE (например '/orders')
   * @param {*}      body    - тело запроса (будет сериализовано в JSON)
   */
  async _fetch(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (Auth.getToken()) headers['Authorization'] = 'Bearer ' + Auth.getToken();

    const makeRequest = (hdrs) => fetch(API_BASE + path, {
      method,
      headers:     hdrs,
      credentials: 'include',
      body:        body != null ? JSON.stringify(body) : undefined,
    });

    let res = await makeRequest(headers);

    // ── Авто-обновление токена при 401 ──────────────────────────────
    if (res.status === 401 && Auth.getToken()) {
      try {
        await Auth.refresh();
        headers['Authorization'] = 'Bearer ' + Auth.getToken();
        res = await makeRequest(headers);
      } catch {
        // Refresh тоже не удался — сессия мертва
        _onAuthExpired?.();
        throw new Error('Session expired');
      }
    }

    // ── Обработка ошибок ─────────────────────────────────────────────
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const d = await res.json();
        msg = d.error || d.message || msg;
      } catch {}
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }

    // ── Парсинг ответа ───────────────────────────────────────────────
    const ct = res.headers.get('content-type') || '';
    return ct.includes('json') ? res.json() : res.text();
  },

  /** GET-запрос */
  get   (path)       { return this._fetch('GET',    path, null); },

  /** POST-запрос с JSON-телом */
  post  (path, body) { return this._fetch('POST',   path, body); },

  /** PUT-запрос (полное обновление ресурса) */
  put   (path, body) { return this._fetch('PUT',    path, body); },

  /** PATCH-запрос (частичное обновление) */
  patch (path, body) { return this._fetch('PATCH',  path, body); },

  /** DELETE-запрос */
  delete(path)       { return this._fetch('DELETE', path, null); },
};
