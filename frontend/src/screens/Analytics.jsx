// screens/Analytics.jsx — Этап 2: аналитика производства.
// Загрузка РЦ, узкие места, план/факт, динамика. Данные с /analytics/production.
import React from 'react';
import { api } from '../lib/api.js';
import { Icon } from '../components/Icon.jsx';

export function Analytics({ lang }) {
  const [data, setData]     = React.useState(null);
  const [roadmap, setRoadmap] = React.useState(null);
  const [loading, setLoad]  = React.useState(true);
  const [err, setErr]       = React.useState('');
  const [view, setView]     = React.useState('production');

  React.useEffect(() => {
    let alive = true;
    api.get('/analytics/production')
      .then(d => { if (alive) { setData(d); setLoad(false); } })
      .catch(e => { if (alive) { setErr(e.message || 'Ошибка'); setLoad(false); } });
    api.get('/analytics/roadmap')
      .then(d => { if (alive) setRoadmap(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (loading) return <div style={{ padding: 24 }}><div className="empty-state">Загрузка аналитики…</div></div>;
  if (err)     return <div style={{ padding: 24 }}><div className="empty-state">Не удалось загрузить: {err}</div></div>;

  const centers = data?.centers || [];
  const bottlenecks = data?.bottlenecks || [];
  const summary = data?.summary || {};
  const daily = data?.daily || [];

  const maxTotal = Math.max(1, ...centers.map(c => c.total));
  const maxDaily = Math.max(1, ...daily.map(d => d.ops));
  const normColor = pct => pct == null ? 'var(--fg-2)' : pct > 115 ? 'var(--danger)' : pct > 100 ? '#c07820' : '#22c55e';

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Аналитика производства</h1>
          <div className="page-sub">Загрузка рабочих центров, узкие места и производственный роадмап</div>
        </div>
      </div>

      {/* Вкладки */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--line-1)' }}>
        {[['production', '📊 Загрузка'], ['roadmap', '🗺 Роадмап']].map(([id, label]) => (
          <button key={id} onClick={() => setView(id)}
            style={{ padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 14, fontWeight: view === id ? 700 : 500, color: view === id ? 'var(--accent)' : 'var(--fg-2)',
              borderBottom: view === id ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: -1 }}>
            {label}{id === 'roadmap' && roadmap && roadmap.overdue > 0 && (
              <span style={{ marginLeft: 6, fontSize: 11, background: 'var(--danger)', color: '#fff',
                borderRadius: 10, padding: '1px 6px' }}>{roadmap.overdue}</span>
            )}
          </button>
        ))}
      </div>

      {view === 'roadmap' ? <RoadmapView roadmap={roadmap} /> : (<>

      {/* KPI-сводка */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className="card" style={{ padding: 16 }}>
          <div className="kpi-label">Операций выполнено</div>
          <div className="kpi-value">{summary.done_ops || 0} <span className="muted" style={{ fontSize: 14 }}>/ {summary.total_ops || 0}</span></div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="kpi-label">План / Факт, ч</div>
          <div className="kpi-value">{summary.plan_hours || 0} <span className="muted" style={{ fontSize: 14 }}>/ {summary.fact_hours || 0}</span></div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div className="kpi-label">Нормоконтроль</div>
          <div className="kpi-value" style={{ color: normColor(summary.norm_pct) }}>
            {summary.norm_pct != null ? summary.norm_pct + '%' : '—'}
          </div>
        </div>
      </div>

      {/* Узкие места */}
      {bottlenecks.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 20, borderLeft: '3px solid var(--danger)' }}>
          <b style={{ fontSize: 15 }}>⚠ Узкие места</b>
          <div className="muted" style={{ fontSize: 12, margin: '4px 0 12px' }}>Рабочие центры с наибольшей очередью ожидающих заданий</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bottlenecks.map(b => (
              <div key={b.wc} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="mono" style={{ minWidth: 80, fontWeight: 700 }}>{b.wc}</span>
                <span style={{ fontSize: 13 }}>в очереди: <b style={{ color: 'var(--danger)' }}>{b.pending}</b></span>
                {b.in_progress > 0 && <span className="muted" style={{ fontSize: 12 }}>· в работе {b.in_progress}</span>}
                {b.norm_pct != null && <span style={{ fontSize: 12, marginLeft: 'auto', color: normColor(b.norm_pct) }}>норма {b.norm_pct}%</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Загрузка по РЦ */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <b style={{ fontSize: 15 }}>Загрузка рабочих центров</b>
        <div className="muted" style={{ fontSize: 12, margin: '4px 0 14px' }}>Задания по статусам · план/факт в часах</div>
        {centers.length === 0 ? (
          <div className="empty-state" style={{ border: 0 }}>Нет данных по заданиям</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {centers.map(c => (
              <div key={c.wc}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                  <span className="mono" style={{ fontWeight: 700, minWidth: 80 }}>{c.wc}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{c.total} заданий</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12 }}>
                    {c.plan_hours}ч план · {c.fact_hours}ч факт
                    {c.norm_pct != null && <span style={{ color: normColor(c.norm_pct), fontWeight: 700, marginLeft: 8 }}>{c.norm_pct}%</span>}
                  </span>
                </div>
                {/* Стек-бар по статусам */}
                <div style={{ display: 'flex', height: 18, borderRadius: 4, overflow: 'hidden', background: 'var(--bg-1)', width: (c.total / maxTotal * 100) + '%', minWidth: 60 }}>
                  {c.done > 0        && <div title={'Выполнено: ' + c.done}     style={{ flex: c.done,        background: '#22c55e' }} />}
                  {c.in_progress > 0 && <div title={'В работе: ' + c.in_progress} style={{ flex: c.in_progress, background: 'var(--accent)' }} />}
                  {c.pending > 0     && <div title={'В очереди: ' + c.pending}   style={{ flex: c.pending,     background: '#c07820' }} />}
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 11 }} className="muted">
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#22c55e', borderRadius: 2, marginRight: 4 }} />выполнено</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--accent)', borderRadius: 2, marginRight: 4 }} />в работе</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#c07820', borderRadius: 2, marginRight: 4 }} />в очереди</span>
        </div>
      </div>

      {/* Динамика за 14 дней */}
      {daily.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <b style={{ fontSize: 15 }}>Операций закрыто за 14 дней</b>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120, marginTop: 14 }}>
            {daily.map(d => (
              <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 10 }} className="muted">{d.ops}</div>
                <div title={d.date + ': ' + d.ops}
                  style={{ width: '100%', maxWidth: 28, background: 'var(--accent)', borderRadius: '3px 3px 0 0',
                    height: (d.ops / maxDaily * 90) + 'px', minHeight: 2 }} />
                <div style={{ fontSize: 9, transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }} className="muted">{d.date.slice(5)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      </>)}
    </div>
  );
}

// Производственный роадмап — Gantt-таймлайн заказов по срокам
function RoadmapView({ roadmap }) {
  if (!roadmap) return <div className="empty-state" style={{ border: 0, padding: 32 }}>Загрузка роадмапа…</div>;
  const orders = roadmap.orders || [];
  if (orders.length === 0) return <div className="empty-state">Нет активных заказов</div>;

  const today = new Date(roadmap.today + 'T00:00:00');
  // Диапазон времени: от min(created, today-7) до max(due, today+30)
  const dates = [];
  orders.forEach(o => { if (o.created_at) dates.push(new Date(o.created_at)); if (o.due_date) dates.push(new Date(o.due_date + 'T00:00:00')); });
  let minD = new Date(Math.min(today.getTime() - 7 * 864e5, ...dates.map(d => d.getTime())));
  let maxD = new Date(Math.max(today.getTime() + 30 * 864e5, ...dates.map(d => d.getTime())));
  const span = Math.max(1, (maxD - minD) / 864e5); // дней
  const pct = d => ((new Date(d) - minD) / 864e5 / span) * 100;

  const STATUS_COLOR = {
    plan: '#9ca3af', in_work: 'var(--accent)', paused: '#c07820',
    problem: '#ef4444', done: '#22c55e', shipped: '#3b82f6',
  };
  const STATUS_RU = {
    plan: 'План', in_work: 'В работе', paused: 'Пауза', problem: 'Проблема',
    done: 'Выполнен', shipped: 'Отгружен', waiting_material: 'Ждёт материал',
  };

  // Метки месяцев по оси
  const ticks = [];
  const t = new Date(minD.getFullYear(), minD.getMonth(), 1);
  while (t <= maxD) { ticks.push(new Date(t)); t.setMonth(t.getMonth() + 1); }

  return (
    <div>
      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 13 }}>
          <span>Активных заказов: <b>{orders.length}</b></span>
          <span style={{ color: 'var(--danger)' }}>Просрочено: <b>{roadmap.overdue}</b></span>
          <span className="muted">Ближайший срок: <b>{orders.find(o => o.due_date && !o.overdue)?.due_date || '—'}</b></span>
        </div>
      </div>

      <div className="card" style={{ padding: 16, overflowX: 'auto' }}>
        {/* Ось месяцев */}
        <div style={{ position: 'relative', height: 20, marginBottom: 8, marginLeft: 200 }}>
          {ticks.map((tk, i) => (
            <div key={i} style={{ position: 'absolute', left: pct(tk) + '%', fontSize: 11, color: 'var(--fg-2)', whiteSpace: 'nowrap' }}>
              {tk.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' })}
            </div>
          ))}
        </div>

        {/* Строки заказов */}
        <div style={{ position: 'relative' }}>
          {/* Линия «сегодня» */}
          <div style={{ position: 'absolute', left: `calc(200px + (100% - 200px) * ${pct(today) / 100})`,
            top: 0, bottom: 0, width: 2, background: 'var(--danger)', opacity: 0.5, zIndex: 1 }} />

          {orders.map(o => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', height: 34, borderBottom: '1px solid var(--line-2)' }}>
              <div style={{ width: 200, flexShrink: 0, paddingRight: 10, overflow: 'hidden' }}>
                <span className="mono" style={{ fontWeight: 700, fontSize: 12, color: o.overdue ? 'var(--danger)' : 'var(--fg-1)' }}>{o.number}</span>
                {o.customer && <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>{o.customer}</span>}
              </div>
              <div style={{ position: 'relative', flex: 1, height: 22 }}>
                {o.created_at && o.due_date && (
                  <div title={`${STATUS_RU[o.status] || o.status} · ${o.progress}% · срок ${o.due_date}${o.overdue ? ' (просрочен)' : ''}`}
                    style={{ position: 'absolute',
                      left: pct(o.created_at) + '%',
                      width: Math.max(2, pct(o.due_date) - pct(o.created_at)) + '%',
                      top: 3, height: 16, borderRadius: 4,
                      background: STATUS_COLOR[o.status] || '#9ca3af',
                      border: o.overdue ? '2px solid var(--danger)' : 'none',
                      overflow: 'hidden' }}>
                    {/* Заполнение прогресса */}
                    <div style={{ height: '100%', width: o.progress + '%', background: 'rgba(255,255,255,.35)' }} />
                  </div>
                )}
                {o.due_date && (
                  <div style={{ position: 'absolute', left: pct(o.due_date) + '%', top: -1, fontSize: 9,
                    color: o.overdue ? 'var(--danger)' : 'var(--fg-2)', whiteSpace: 'nowrap', transform: 'translateX(4px)' }}>
                    {o.progress}%
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Легенда */}
        <div style={{ display: 'flex', gap: 14, marginTop: 14, fontSize: 11, flexWrap: 'wrap' }} className="muted">
          {Object.entries(STATUS_COLOR).map(([k, col]) => (
            <span key={k}><span style={{ display: 'inline-block', width: 10, height: 10, background: col, borderRadius: 2, marginRight: 4 }} />{STATUS_RU[k] || k}</span>
          ))}
          <span><span style={{ display: 'inline-block', width: 2, height: 10, background: 'var(--danger)', marginRight: 4 }} />сегодня</span>
        </div>
      </div>
    </div>
  );
}
