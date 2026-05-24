// api.js — shared Auth + HTTP client (used by App, Modals, Screens)

export const API_BASE = '/api';

const Auth = {
  _token: null,
  // refresh_token теперь в HttpOnly cookie — браузер отправляет его автоматически
  // localStorage хранит только несекретные данные о пользователе (не токены)
  getToken:   () => Auth._token,
  setToken:   (t) => { Auth._token = t; },
  getRefresh: () => null,    // cookie читает только сервер
  setRefresh: (t) => {},     // сервер сам устанавливает cookie
  getUser:    () => { try { return JSON.parse(localStorage.getItem('auth_user') || 'null'); } catch { return null; } },
  setUser:    (u) => localStorage.setItem('auth_user', JSON.stringify(u)),
  clear:      () => { Auth._token = null; localStorage.removeItem('auth_user'); },
  can:        (p) => { const u = Auth.getUser(); return u?.permissions?.includes(p) ?? false; },
  isAdmin:    () => Auth.getUser()?.role === 'admin',
  isLoggedIn: () => !!Auth.getUser() || !!Auth._token,
};
let _onAuthExpired = null;

export function setAuthExpiredHandler(fn) { _onAuthExpired = fn; }

const api = {
  async _fetch(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = Auth.getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const opts = { method, headers };
    if (body !== undefined) opts.body = JSON.stringify(body);
    let r = await fetch(API_BASE + path, opts);
    if (r.status === 401 && Auth.getUser()) {
      const ref = await fetch(API_BASE + '/auth/refresh', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (ref.ok) {
        const d = await ref.json();
        Auth.setToken(d.access_token); Auth.setRefresh(d.refresh_token);
        headers['Authorization'] = 'Bearer ' + d.access_token;
        r = await fetch(API_BASE + path, { ...opts, headers });
      } else { Auth.clear(); _onAuthExpired?.(); throw new Error('Session expired'); }
    }
    if (!r.ok) { const t = await r.text(); let m = t; try { m = JSON.parse(t).error || t; } catch {} throw new Error(m); }
    return r.json();
  },
  get:    (p)    => api._fetch('GET',    p),
  post:   (p, b) => api._fetch('POST',   p, b),
  put:    (p, b) => api._fetch('PUT',    p, b),
  patch:  (p, b) => api._fetch('PATCH',  p, b),
  delete: (p)    => api._fetch('DELETE', p),
};

export { Auth, api };
