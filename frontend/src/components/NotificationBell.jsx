// components/NotificationBell.jsx — колокольчик уведомлений в топбаре.
import React from 'react';
import { api, unwrap } from '../lib/api.js';
import { Icon } from './Icon.jsx';

const TYPE_ICON = { problem: '⚠', order_done: '✓', order_in_work: '🔧', shift_handoff: '🔄' };

export function NotificationBell() {
  const [items, setItems]   = React.useState([]);
  const [unread, setUnread] = React.useState(0);
  const [open, setOpen]     = React.useState(false);
  const boxRef = React.useRef(null);

  async function load() {
    try {
      const r = await api.get('/notifications');
      setItems(unwrap(r));
      setUnread(r?.unread || 0);
    } catch (e) { /* тихо */ }
  }

  React.useEffect(() => {
    load();
    const iv = setInterval(load, 60000); // опрос раз в минуту
    return () => clearInterval(iv);
  }, []);

  React.useEffect(() => {
    const onDoc = e => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  async function openPanel() {
    setOpen(o => !o);
    if (!open && unread > 0) {
      try { await api.post('/notifications/read-all', {}); setUnread(0); } catch (e) {}
    }
  }

  function timeAgo(ts) {
    if (!ts) return '';
    const d = new Date(ts.replace(' ', 'T') + 'Z');
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return 'только что';
    if (mins < 60) return mins + ' мин назад';
    const h = Math.floor(mins / 60);
    if (h < 24) return h + ' ч назад';
    return Math.floor(h / 24) + ' дн назад';
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button className="icon-btn" onClick={openPanel} title="Уведомления" style={{ position: 'relative' }}>
        <Icon name="bell" size={18} />
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, padding: '0 4px',
            borderRadius: 8, background: 'var(--danger)', color: '#fff', fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className='notif-panel' style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, width: 340, maxHeight: 440,
          overflowY: 'auto', background: 'var(--bg-0,#fff)', border: '1px solid var(--line-1)', borderRadius: 12,
          boxShadow: '0 12px 32px rgba(0,0,0,.22)', zIndex: 100 }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line-2)', fontWeight: 700, fontSize: 14 }}>
            Уведомления
          </div>
          {items.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-2)', fontSize: 13 }}>Нет уведомлений</div>
          ) : items.map(n => (
            <div key={n.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--line-2)',
              background: +n.is_read === 0 ? 'rgba(217,72,15,.05)' : 'transparent', display: 'flex', gap: 10 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{TYPE_ICON[n.type] || '🔔'}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</div>
                {n.body && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{n.body}</div>}
                <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{timeAgo(n.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
