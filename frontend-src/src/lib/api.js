// lib/api.js — HTTP client + SSE real-time events

const API_BASE = '/api';

// ── Auth storage ────────────────────────────────────────────────────
// access_token: in-memory only (XSS-safe)
// refresh_token: localStorage (would be HttpOnly cookie in production)
let _accessToken = null;

export const Auth = {
  getToken:    () => _accessToken,
  setToken:    (t) => { _accessToken = t; },
  getRefresh:  () => localStorage.getItem('refresh_token'),
  setRefresh:  (t) => { if (t) localStorage.setItem('refresh_token', t); },
  getUser:     () => { try { return JSON.parse(localStorage.getItem('auth_user') || 'null'); } catch { return null; } },
  setUser:     (u) => localStorage.setItem('auth_user', JSON.stringify(u)),
  clear:       () => {
    _accessToken = null;
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('auth_user');
  },
  can:         (perm) => Auth.getUser()?.permissions?.includes(perm) ?? false,
  isAdmin:     () => Auth.getUser()?.role === 'admin',
  isLoggedIn:  () => !!Auth.getRefresh() || !!_accessToken,
};

// ── HTTP client ─────────────────────────────────────────────────────
let _onAuthExpired = null;
export const setAuthExpiredHandler = (fn) => { _onAuthExpired = fn; };

async function _fetch(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = Auth.getToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);

  let r = await fetch(API_BASE + path, opts);

  // Auto-refresh on 401
  if (r.status === 401 && Auth.getRefresh()) {
    const ref = await fetch(API_BASE + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: Auth.getRefresh() }),
    });

    if (ref.ok) {
      const data = await ref.json();
      Auth.setToken(data.access_token);
      Auth.setRefresh(data.refresh_token);
      headers['Authorization'] = 'Bearer ' + data.access_token;
      r = await fetch(API_BASE + path, { ...opts, headers });
    } else {
      Auth.clear();
      _onAuthExpired?.();
      throw new Error('Session expired');
    }
  }

  if (!r.ok) {
    const txt = await r.text();
    let msg = txt;
    try { msg = JSON.parse(txt).error || txt; } catch {}
    throw new Error(msg);
  }
  return r.json();
}

export const api = {
  get:    (p)    => _fetch('GET',    p),
  post:   (p, b) => _fetch('POST',   p, b),
  put:    (p, b) => _fetch('PUT',    p, b),
  patch:  (p, b) => _fetch('PATCH',  p, b),
  delete: (p)    => _fetch('DELETE', p),
};

// ── SSE real-time events ────────────────────────────────────────────
let _eventSource = null;
let _handlers = {};
let _reconnectTimer = null;

export const Events = {
  /**
   * Connect to SSE stream.
   * @param {Object} handlers  { task_updated, scan_logged, order_updated, connected }
   */
  connect(handlers = {}) {
    _handlers = handlers;
    this._open();
  },

  _open() {
    if (_eventSource) { _eventSource.close(); _eventSource = null; }

    const token = Auth.getToken();
    if (!token) return;

    const since = Math.floor(Date.now() / 1000) - 5;
    const url = `${API_BASE}/events?token=${encodeURIComponent(token)}&since=${since}`;

    _eventSource = new EventSource(url);

    _eventSource.onopen = () => {
      if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
    };

    // Bind all event types
    ['task_updated', 'scan_logged', 'order_updated', 'connected', 'reconnect'].forEach(type => {
      _eventSource.addEventListener(type, (e) => {
        try {
          const data = JSON.parse(e.data);
          if (type === 'reconnect') {
            // Server asked us to reconnect (max_age reached)
            setTimeout(() => Events._open(), 100);
            return;
          }
          _handlers[type]?.(data);
        } catch {}
      });
    });

    _eventSource.onerror = () => {
      _eventSource.close();
      _eventSource = null;
      // Reconnect after 3s
      if (!_reconnectTimer) {
        _reconnectTimer = setTimeout(() => {
          _reconnectTimer = null;
          Events._open();
        }, 3000);
      }
    };
  },

  disconnect() {
    if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
    if (_eventSource)    { _eventSource.close(); _eventSource = null; }
    _handlers = {};
  },

  isConnected() {
    return _eventSource?.readyState === EventSource.OPEN;
  },
};

// ── Data shape converters ───────────────────────────────────────────
export function apiOrderToData(orders, details) {
  return {
    orders: orders.map(o => ({
      id: o.id, number: o.number, createdAt: o.created_at,
      dueDate: o.due_date, customer: o.customer, foreman: o.foreman,
      status: o.status, priority: o.priority,
      items: (o.items || []).map(i => ({ detailId: i.detail_id, quantity: Number(i.quantity) })),
    })),
    details: details.map(d => ({
      id: d.id, code: d.code, name: d.name, material: d.material,
      unit: d.unit, drawing: d.drawing,
      operations: (d.operations || []).map(op => ({
        num: Number(op.num), name: op.name,
        workCenter: op.work_center, time: Number(op.time_min),
      })),
    })),
  };
}

export function apiTasksToFrontend(tasks) {
  return tasks.map(t => ({
    id: t.id, orderId: t.order_id, detailId: t.detail_id,
    opNum: Number(t.op_num), opName: t.op_name, workCenter: t.work_center,
    time: Number(t.time_min), planned: Number(t.planned), completed: Number(t.completed),
    status: t.status, qrText: t.qr_text, operator: t.operator, updatedAt: t.updated_at,
  }));
}

export function apiScanLogToFrontend(logs) {
  return logs.map(l => ({
    ts: l.scanned_at ? l.scanned_at.slice(11, 16) : '',
    taskId: l.task_id, qr: l.qr_text, detail: l.detail_id,
    op: l.op_info, operator: l.operator, result: l.result, quantity: l.quantity,
  }));
}
