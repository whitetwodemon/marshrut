/**
 * ShiftDayReport.jsx — Посменный учёт за день
 *
 * Доступно только ролям: admin, foreman (старший мастер).
 * Показывает: все смены за выбранный день, по каждой смене —
 * таблицу операторов с детальной статистикой рабочего времени,
 * пауз (обед/перерыв/технолог/...) и выполненных операций.
 *
 * Данные из:
 * - scan_log         — закрытые операции и факт.время
 * - task_pauses      — паузы с разбивкой по причинам
 * - shift_handoffs   — явно указанное рабочее время при передаче
 */

import React from 'react'
import { api, Auth } from '../lib/api.js'
import { Icon } from '../components/Icon.jsx'

// ── Вспомогательные константы ─────────────────────────────────────────────

/** Русские названия причин пауз */
const PAUSE_LABELS = {
  lunch:     '🍽 Обед',
  break:     '☕ Перерыв',
  tech:      '📐 Технолог',
  material:  '📦 Материал',
  equipment: '🔧 Поломка',
  other:     '📝 Прочее',
};

/** Цвет строки в зависимости от % использования рабочего времени */
function efficiencyColor(workMin, actualMin) {
  if (!actualMin || !workMin) return 'var(--fg-2)';
  const pct = Math.round(workMin / actualMin * 100);
  if (pct >= 85) return 'var(--st-done-line)';
  if (pct >= 60) return 'var(--warning,#c07820)';
  return 'var(--danger)';
}

/** Форматировать минуты → "Xч YYм" */
function fmtMin(min) {
  if (!min || min <= 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}ч ${String(m).padStart(2,'0')}м` : `${m}м`;
}

// ─────────────────────────────────────────────────────────────────────────
// OperatorRow — строка оператора в таблице смены
// ─────────────────────────────────────────────────────────────────────────
function OperatorRow({ stat, expanded, onToggle }) {
  const eff = stat.work_min && stat.actual_min
    ? Math.round(stat.work_min / stat.actual_min * 100)
    : null;

  return (
    <>
      {/* Основная строка */}
      <tr className="row-hover" style={{ cursor: stat.pauses?.length > 0 ? 'pointer' : 'default' }}
        onClick={onToggle}>
        <td>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {/* Аватар с первой буквой имени */}
            <div style={{ width:30, height:30, borderRadius:'50%', background:'var(--accent)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:13, fontWeight:700, color:'#fff', flexShrink:0 }}>
              {stat.operator?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <div style={{ fontWeight:600, fontSize:13 }}>{stat.operator}</div>
              {stat.handoffs > 0 && (
                <div style={{ fontSize:10, color:'var(--fg-2)' }}>
                  {stat.handoffs} передач
                </div>
              )}
            </div>
            {stat.pauses?.length > 0 && (
              <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={12}
                style={{ color:'var(--fg-3)', marginLeft:'auto' }} />
            )}
          </div>
        </td>

        {/* Закрыто операций */}
        <td className="num-col num" style={{ fontWeight:700, color:'var(--st-done-line)' }}>
          {stat.ops_closed || '—'}
        </td>

        {/* Количество деталей */}
        <td className="num-col num">{stat.qty_total || '—'}</td>

        {/* Рабочее время */}
        <td className="num-col">
          <div style={{ fontFamily:'monospace', fontWeight:600,
            color: efficiencyColor(stat.work_min, stat.actual_min) }}>
            {fmtMin(stat.work_min)}
          </div>
          {eff && (
            <div style={{ fontSize:9, color:'var(--fg-2)' }}>{eff}% КПД</div>
          )}
        </td>

        {/* Обед */}
        <td className="num-col" style={{ color: stat.lunch_min > 60 ? 'var(--danger)' : 'var(--fg-1)' }}>
          {fmtMin(stat.lunch_min)}
        </td>

        {/* Перерывы */}
        <td className="num-col" style={{ color: stat.break_min > 30 ? 'var(--warning,#c07820)' : 'var(--fg-2)' }}>
          {fmtMin(stat.break_min)}
        </td>

        {/* Прочие паузы */}
        <td className="num-col" style={{ color: 'var(--fg-2)' }}>
          {fmtMin(Math.max(0, (stat.pause_min||0) - (stat.lunch_min||0) - (stat.break_min||0)))}
        </td>

        {/* Итого паузы */}
        <td className="num-col" style={{ fontWeight:600,
          color: (stat.pause_min||0) > 90 ? 'var(--danger)' : 'var(--fg-1)' }}>
          {fmtMin(stat.pause_min)}
        </td>
      </tr>

      {/* Развёртка: детали пауз */}
      {expanded && stat.pauses?.length > 0 && (
        <tr>
          <td colSpan={8} style={{ padding:'6px 12px 10px 56px',
            background:'var(--bg-2)', borderBottom:'2px solid var(--line-2)' }}>
            <div style={{ fontSize:12, color:'var(--fg-2)', marginBottom:6 }}>Детализация пауз:</div>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              {stat.pauses.map((p, i) => (
                <div key={i} style={{ background:'var(--bg-1)', border:'1px solid var(--line-1)',
                  borderRadius:8, padding:'6px 12px', fontSize:12 }}>
                  <div style={{ fontWeight:600 }}>{PAUSE_LABELS[p.reason] || p.reason}</div>
                  <div style={{ color:'var(--fg-2)', marginTop:2 }}>
                    {p.pause_count} раз · {fmtMin(p.total_min)}
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ShiftCard — карточка одной смены с таблицей операторов
// ─────────────────────────────────────────────────────────────────────────
function ShiftCard({ shift }) {
  const [expanded, setExpanded]     = React.useState(true);
  const [expandedOps, setExpandedOps] = React.useState({});

  const toggleOp = (op) => setExpandedOps(prev => ({ ...prev, [op]: !prev[op] }));

  // Длительность смены
  const dur = shift.closed_at
    ? Math.round((new Date(shift.closed_at) - new Date(shift.opened_at)) / 60000)
    : Math.round((Date.now() - new Date(shift.opened_at).getTime()) / 60000);

  // Сумма по смене
  const totals = shift.operators.reduce((acc, s) => ({
    ops:   acc.ops   + (s.ops_closed || 0),
    qty:   acc.qty   + (s.qty_total  || 0),
    work:  acc.work  + (s.work_min   || 0),
    pause: acc.pause + (s.pause_min  || 0),
  }), { ops:0, qty:0, work:0, pause:0 });

  const isOpen = !shift.closed_at;
  const shiftIcon = shift.name.toLowerCase().includes('ноч') ? '🌙' : '☀️';

  return (
    <div className="card" style={{ padding:0, overflow:'hidden', marginBottom:16 }}>
      {/* Заголовок смены */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
        background:'var(--bg-2)', borderBottom:'1px solid var(--line-2)', cursor:'pointer' }}
        onClick={() => setExpanded(e => !e)}>
        <span style={{ fontSize:20 }}>{shiftIcon}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:14 }}>{shift.name}</div>
          <div style={{ fontSize:12, color:'var(--fg-2)', marginTop:2, display:'flex', gap:12 }}>
            <span>{shift.opened_at?.slice(11,16)} – {shift.closed_at?.slice(11,16) || 'сейчас'}</span>
            <span>{Math.floor(dur/60)}ч {dur%60}м</span>
            <span>Открыл: {shift.opened_by_name}</span>
            {shift.closed_by_name && <span>Закрыл: {shift.closed_by_name}</span>}
          </div>
        </div>

        {/* Статус и KPI */}
        <div style={{ display:'flex', gap:16, alignItems:'center', flexShrink:0 }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:18, fontWeight:800, color:'var(--st-done-line)' }}>{totals.ops}</div>
            <div style={{ fontSize:10, color:'var(--fg-2)' }}>операций</div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:18, fontWeight:800 }}>{shift.operators.length}</div>
            <div style={{ fontSize:10, color:'var(--fg-2)' }}>операторов</div>
          </div>
          <span className={'pill ' + (isOpen ? 'prog' : 'done')}>
            <span className="dot"/>{isOpen ? 'Открыта' : 'Закрыта'}
          </span>
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={14}
            style={{ color:'var(--fg-2)' }} />
        </div>
      </div>

      {/* Таблица операторов */}
      {expanded && (
        shift.operators.length === 0 ? (
          <div style={{ padding:'20px 16px', textAlign:'center',
            color:'var(--fg-2)', fontSize:13 }}>
            Нет данных об операторах за эту смену
          </div>
        ) : (
          <div className="tbl-wrap" style={{ overflowX:'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ minWidth:180 }}>Оператор</th>
                  <th className="num-col" title="Закрыто операций">Опер.</th>
                  <th className="num-col" title="Количество деталей">Дет.</th>
                  <th className="num-col" title="Чистое рабочее время">Раб. вр.</th>
                  <th className="num-col" title="Суммарное время обедов" style={{ color:'#e07b00' }}>🍽 Обед</th>
                  <th className="num-col" title="Суммарное время перерывов">☕ Перер.</th>
                  <th className="num-col" title="Прочие паузы (технолог, поломка...)">📋 Прочие</th>
                  <th className="num-col" title="Итого время пауз">Паузы</th>
                </tr>
              </thead>
              <tbody>
                {shift.operators
                  .sort((a, b) => (b.ops_closed || 0) - (a.ops_closed || 0))
                  .map(stat => (
                    <OperatorRow
                      key={stat.operator}
                      stat={stat}
                      expanded={!!expandedOps[stat.operator]}
                      onToggle={() => toggleOp(stat.operator)} />
                  ))
                }
                {/* Итоговая строка */}
                <tr style={{ background:'var(--bg-2)', fontWeight:700 }}>
                  <td style={{ fontSize:12, color:'var(--fg-2)' }}>
                    Итого по смене
                  </td>
                  <td className="num-col num" style={{ color:'var(--st-done-line)' }}>
                    {totals.ops}
                  </td>
                  <td className="num-col num">{totals.qty}</td>
                  <td className="num-col"
                    style={{ fontFamily:'monospace', color:'var(--fg-0)' }}>
                    {fmtMin(totals.work)}
                  </td>
                  <td className="num-col" colSpan={3}/>
                  <td className="num-col"
                    style={{ fontFamily:'monospace', color: totals.pause > 120 ? 'var(--danger)' : 'var(--fg-1)' }}>
                    {fmtMin(totals.pause)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Примечания к смене */}
      {expanded && shift.notes && (
        <div style={{ padding:'10px 16px', borderTop:'1px solid var(--line-2)',
          fontSize:13, color:'var(--fg-2)', background:'var(--bg-2)' }}>
          <b>Примечания:</b> {shift.notes}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ShiftDayReport — главная страница посменного учёта за день
// ─────────────────────────────────────────────────────────────────────────
export function ShiftDayReport() {
  const today = new Date().toISOString().slice(0, 10);
  const [date,    setDate]    = React.useState(today);
  const [data,    setData]    = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error,   setError]   = React.useState('');

  // Загрузить данные при смене даты
  React.useEffect(() => {
    if (!date) return;
    load(date);
  }, [date]);

  async function load(d) {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/shifts/by-date?date=' + d);
      setData(res);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  // Навигация по дням
  function prevDay() {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().slice(0, 10));
  }
  function nextDay() {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    const next = d.toISOString().slice(0, 10);
    if (next <= today) setDate(next);
  }

  // Форматировать дату для заголовка
  const dateLabel = date
    ? new Date(date + 'T12:00:00').toLocaleDateString('ru-RU', {
        weekday:'long', day:'numeric', month:'long', year:'numeric'
      })
    : '';

  // Сводка дня по всем операторам
  const dayStats = data?.day_stats || [];
  const totalOps = dayStats.reduce((s, o) => s + (o.ops_closed || 0), 0);
  const shifts   = data?.shifts || [];

  return (
    <>
      {/* Заголовок страницы */}
      <div className="page-head">
        <div>
          <h1 className="page-title">Посменный учёт</h1>
          <div className="page-sub" style={{ textTransform:'capitalize' }}>{dateLabel}</div>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <button className="btn ghost" onClick={prevDay} title="Предыдущий день">
            <Icon name="arrow-left" size={14}/>
          </button>
          <input type="date" className="input" value={date}
            max={today}
            onChange={e => setDate(e.target.value)}
            style={{ width:150, fontFamily:'monospace' }} />
          <button className="btn ghost" onClick={nextDay}
            disabled={date >= today} title="Следующий день">
            <Icon name="arrow-right" size={14}/>
          </button>
          <button className="btn" onClick={() => load(date)}>
            <Icon name="search" size={14}/>Обновить
          </button>
        </div>
      </div>

      {/* Состояния загрузки и ошибки */}
      {loading && (
        <div style={{ padding:32, textAlign:'center', color:'var(--fg-2)' }}>
          Загрузка…
        </div>
      )}
      {error && (
        <div style={{ padding:12, background:'rgba(220,38,38,.08)', borderRadius:8,
          color:'var(--danger)', fontSize:13, marginBottom:16 }}>
          {error === 'Доступ запрещён'
            ? '🔒 Этот раздел доступен только старшему мастеру и администратору.'
            : 'Ошибка: ' + error}
        </div>
      )}

      {/* Сводка за день */}
      {!loading && data && dayStats.length > 0 && (
        <div className="card" style={{ padding:16, marginBottom:16 }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>
            📊 Сводка за день — {shifts.length} {
              shifts.length === 1 ? 'смена' : shifts.length < 5 ? 'смены' : 'смен'
            } · {totalOps} операций
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Оператор</th>
                  <th className="num-col">Операций</th>
                  <th className="num-col">Деталей</th>
                  <th className="num-col">Раб. время</th>
                  <th className="num-col">🍽 Обед</th>
                  <th className="num-col">☕ Перерывы</th>
                  <th className="num-col">Паузы итого</th>
                  <th className="num-col" title="КПД = рабочее время / (рабочее + паузы)">КПД%</th>
                </tr>
              </thead>
              <tbody>
                {dayStats
                  .sort((a, b) => (b.ops_closed || 0) - (a.ops_closed || 0))
                  .map(stat => {
                    const totalTime = (stat.work_min || 0) + (stat.pause_min || 0);
                    const kpd = totalTime > 0
                      ? Math.round((stat.work_min || 0) / totalTime * 100)
                      : null;
                    return (
                      <tr key={stat.operator} className="row-hover">
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{ width:28, height:28, borderRadius:'50%',
                              background:'var(--accent)', display:'flex',
                              alignItems:'center', justifyContent:'center',
                              fontSize:12, fontWeight:700, color:'#fff' }}>
                              {stat.operator?.[0]?.toUpperCase() || '?'}
                            </div>
                            <span style={{ fontWeight:600 }}>{stat.operator}</span>
                          </div>
                        </td>
                        <td className="num-col num" style={{ color:'var(--st-done-line)', fontWeight:700 }}>
                          {stat.ops_closed || '—'}
                        </td>
                        <td className="num-col num">{stat.qty_total || '—'}</td>
                        <td className="num-col" style={{ fontFamily:'monospace', fontWeight:600 }}>
                          {fmtMin(stat.work_min)}
                        </td>
                        <td className="num-col" style={{ color: stat.lunch_min > 60 ? 'var(--danger)' : 'inherit' }}>
                          {fmtMin(stat.lunch_min)}
                        </td>
                        <td className="num-col" style={{ color:'var(--fg-2)' }}>
                          {fmtMin(stat.break_min)}
                        </td>
                        <td className="num-col" style={{ fontWeight:600,
                          color: (stat.pause_min||0) > 120 ? 'var(--danger)' : 'inherit' }}>
                          {fmtMin(stat.pause_min)}
                        </td>
                        <td className="num-col num" style={{ fontWeight:700,
                          color: kpd >= 85 ? 'var(--st-done-line)' :
                                 kpd >= 60 ? 'var(--warning,#c07820)' : 'var(--danger)' }}>
                          {kpd ? kpd + '%' : '—'}
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Нет смен за этот день */}
      {!loading && data && shifts.length === 0 && (
        <div style={{ padding:48, textAlign:'center', color:'var(--fg-2)', fontSize:13 }}>
          <div style={{ fontSize:32, marginBottom:12 }}>📋</div>
          Нет смен за {date}
        </div>
      )}

      {/* Карточки смен */}
      {!loading && shifts.map(shift => (
        <ShiftCard key={shift.id} shift={shift} />
      ))}
    </>
  );
}
