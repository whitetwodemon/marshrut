import { elapsedMinutes } from '../lib/dates.js'
import React from 'react'
import { Icon } from '../components/Icon.jsx'
import { api } from '../lib/api.js'

// =======================================================
// ShiftBar — панель текущей смены (показывается вверху)
// =======================================================
export function ShiftBar({ shift, onOpen, onClose, onHandoff, tasks, authUser }) {
  // Hooks MUST be before any conditional return (React rules)
  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(() => {
    if (!shift?.opened_at) return;
    const calc = () => setElapsed(elapsedMinutes(shift.opened_at));
    calc();
    const id = setInterval(calc, 60000);
    return () => clearInterval(id);
  }, [shift?.opened_at]);

  // No shift open - show open button
  if (!shift) return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 16px',
      background:'var(--bg-2)', borderBottom:'1px solid var(--line-2)' }}>
      <span style={{ fontSize:12, color:'var(--fg-2)' }}>Смена не открыта</span>
      <button className="btn primary" style={{ fontSize:11, height:28 }} onClick={onOpen}>
        ▶ Открыть смену
      </button>
    </div>
  );

  const h = Math.floor(elapsed/60), m = elapsed%60;
  const isDay  = shift.name.toLowerCase().includes('дн') || shift.name.toLowerCase().includes('day');
  const isNight = shift.name.toLowerCase().includes('ноч') || shift.name.toLowerCase().includes('night');
  const shiftIcon = isNight ? '🌙' : isDay ? '☀️' : '⏰';
  const maxMin = 12 * 60;
  const pct = Math.min(100, Math.round(elapsed / maxMin * 100));

  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'7px 16px',
      background:'rgba(217,72,15,.06)', borderBottom:'1px solid var(--accent)',
      flexWrap:'wrap' }}>
      <span style={{ fontSize:14 }}>{shiftIcon}</span>
      <span style={{ fontSize:12, fontWeight:700 }}>{shift.name}</span>
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <span style={{ fontSize:13, fontWeight:800, color:'var(--accent)', fontFamily:'monospace' }}>
          {h}ч {String(m).padStart(2,'0')}м
        </span>
        <div style={{ width:80, height:4, background:'var(--bg-3)', borderRadius:2, overflow:'hidden' }}>
          <div style={{ height:'100%', width:pct+'%', background: pct > 90 ? 'var(--danger)' : 'var(--accent)', borderRadius:2 }}/>
        </div>
        <span style={{ fontSize:10, color:'var(--fg-2)' }}>{pct}% из 12ч</span>
      </div>
      <span style={{ fontSize:11, color:'var(--fg-2)' }}>· {shift.opened_by_name}</span>
      <span style={{ flex:1 }}/>
      <button className="btn" style={{ fontSize:11, height:28 }} onClick={onHandoff}>
        ⇄ Передать задание
      </button>
      <button className="btn" style={{ fontSize:11, height:28, color:'var(--danger)', borderColor:'var(--danger)' }}
        onClick={onClose}>
        ■ Закрыть смену
      </button>
    </div>
  );
}

// =======================================================
// ModalOpenShift — открытие смены
// =======================================================
export function ModalOpenShift({ onClose, onOpened }) {
  const today = new Date().toLocaleDateString('ru-RU');
  const hour  = new Date().getHours();
  const PRESETS = [
    { label: '☀️ Дневная смена',  name: 'Дневная смена ' + today,  desc: '08:00 – 20:00 · 12 часов' },
    { label: '🌙 Ночная смена',   name: 'Ночная смена '  + today,  desc: '20:00 – 08:00 · 12 часов' },
  ];
  const [name, setName] = React.useState(
    hour >= 8 && hour < 20 ? PRESETS[0].name : PRESETS[1].name
  );
  const [saving, setSaving] = React.useState(false);

  async function handleOpen() {
    setSaving(true);
    try {
      const res = await api.post('/shifts/open', { name });
      onOpened(res);
      onClose();
    } catch(e) { alert('Ошибка: ' + e.message); }
    setSaving(false);
  }

  return (
    <div className="modal-back" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:400 }}>
        <div className="modal-head">
          <b>Открыть смену</b>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16}/></button>
        </div>
        <div className="modal-body">
          <div className="field">
            <span className="field-label">Название смены</span>
            <input className="input" value={name} onChange={e => setName(e.target.value)}
              placeholder="Утренняя смена 28.05"/>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:10 }}>
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => setName(p.name)}
                style={{ flex:1, padding:'10px 14px', borderRadius:10, border:'1px solid',
                  cursor:'pointer', fontFamily:'var(--ui-font)', textAlign:'left',
                  background: name === p.name ? 'var(--accent)' : 'var(--bg-1)',
                  borderColor: name === p.name ? 'var(--accent)' : 'var(--line-1)',
                  color: name === p.name ? '#fff' : 'var(--fg-0)' }}>
                <div style={{ fontSize:14, fontWeight:700 }}>{p.label}</div>
                <div style={{ fontSize:11, opacity:.8, marginTop:2 }}>{p.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Отмена</button>
          <button className="btn primary" onClick={handleOpen} disabled={saving || !name.trim()}>
            {saving ? 'Открытие…' : '▶ Открыть'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =======================================================
// ModalCloseShift — закрытие смены
// =======================================================
export function ModalCloseShift({ shift, onClose, onClosed }) {
  const [notes, setNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  async function handleClose() {
    setSaving(true);
    try {
      await api.post('/shifts/' + shift.id + '/close', { notes });
      onClosed();
      onClose();
    } catch(e) { alert('Ошибка: ' + e.message); }
    setSaving(false);
  }

  const dur = Math.round((Date.now() - new Date(shift.opened_at.replace(' ','T')+'Z').getTime()) / 60000);

  return (
    <div className="modal-back" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:440 }}>
        <div className="modal-head">
          <b>Закрыть смену</b>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16}/></button>
        </div>
        <div className="modal-body">
          <div style={{ background:'var(--bg-2)', borderRadius:8, padding:12, marginBottom:14 }}>
            <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>{shift.name}</div>
            <div style={{ fontSize:12, color:'var(--fg-2)' }}>
              Открыта: {shift.opened_at?.slice(0,16).replace('T',' ')} · {Math.floor(dur/60)}ч {dur%60}м
            </div>
            {shift.handoff_count > 0 && (
              <div style={{ fontSize:12, color:'var(--fg-2)', marginTop:4 }}>
                Передач заданий: {shift.handoff_count}
              </div>
            )}
          </div>
          <div className="field">
            <span className="field-label">Примечания (необязательно)</span>
            <textarea className="input" rows={3} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Итоги смены, замечания…" style={{ resize:'vertical' }}/>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Отмена</button>
          <button className="btn primary" onClick={handleClose} disabled={saving}
            style={{ background:'var(--danger)', borderColor:'var(--danger)' }}>
            {saving ? 'Закрытие…' : '■ Закрыть смену'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =======================================================
// ModalHandoff — передача задания при смене
// =======================================================
export function ModalHandoff({ shift, tasks, data, onClose, onHandedOff }) {
  const [taskId,    setTaskId]    = React.useState('');
  const [fromOp,    setFromOp]    = React.useState('');
  const [toOp,      setToOp]      = React.useState('');
  const [count,     setCount]     = React.useState(0);
  const [workMin,   setWorkMin]   = React.useState(0);
  const [pauseMin,  setPauseMin]  = React.useState(0);
  const [notes,     setNotes]     = React.useState('');
  const [saving,    setSaving]    = React.useState(false);

  // Активные задания — в работе или на паузе
  const activeTasks = tasks.filter(t => ['in_progress', 'paused', 'waiting'].includes(t.status));

  const selTask = activeTasks.find(t => t.id === taskId);

  // Автоматически считаем workMin из startedAt за вычетом пауз
  React.useEffect(() => {
    if (!selTask?.startedAt) return;
    const totalMin = Math.round((Date.now() - new Date(selTask.startedAt).getTime()) / 60000);
    setWorkMin(Math.max(0, totalMin - pauseMin));
    if (selTask.operator) setFromOp(selTask.operator);
    setCount(selTask.completed || 0);
  }, [taskId, selTask?.startedAt]);

  async function handleHandoff() {
    if (!taskId || !fromOp) return;
    setSaving(true);
    try {
      await api.post('/shifts/' + shift.id + '/handoff', {
        task_id: taskId, from_operator: fromOp, to_operator: toOp || null,
        completed_count: count, work_min: workMin, pause_min: pauseMin, notes,
      });
      onHandedOff();
      onClose();
    } catch(e) { alert('Ошибка: ' + e.message); }
    setSaving(false);
  }

  return (
    <div className="modal-back" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:520 }}>
        <div className="modal-head">
          <b>⇄ Передача задания</b>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16}/></button>
        </div>
        <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {/* Выбор задания */}
          <div className="field">
            <span className="field-label">Задание *</span>
            <select className="select" value={taskId} onChange={e => setTaskId(e.target.value)}>
              <option value="">Выбрать задание…</option>
              {activeTasks.map(t => {
                const order = data?.orders?.find(o => o.id === t.orderId);
                return (
                  <option key={t.id} value={t.id}>
                    {String(t.opNum).padStart(3,'0')} {t.opName} · {t.workCenter}
                    {order ? ' · ' + order.number : ''}
                    {t.status === 'in_progress' ? ' ▶' : t.status === 'paused' ? ' ⏸' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {selTask && (
            <div style={{ background:'var(--bg-2)', borderRadius:8, padding:10, fontSize:12 }}>
              <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                <div><span style={{color:'var(--fg-2)'}}>РЦ: </span><b>{selTask.workCenter}</b></div>
                <div><span style={{color:'var(--fg-2)'}}>Всего: </span><b>{selTask.planned} шт</b></div>
                <div><span style={{color:'var(--fg-2)'}}>Сделано: </span><b>{selTask.completed} шт</b></div>
                {selTask.startedAt && <div><span style={{color:'var(--fg-2)'}}>Начато: </span>{selTask.startedAt.slice(0,16).replace('T',' ')}</div>}
              </div>
            </div>
          )}

          {/* Оператор сдаёт */}
          <div className="grid-2" style={{ gap:10 }}>
            <div className="field">
              <span className="field-label">Сдаёт оператор *</span>
              <input className="input" value={fromOp} onChange={e => setFromOp(e.target.value)}
                placeholder="Иванов И.И."/>
            </div>
            <div className="field">
              <span className="field-label">Принимает оператор</span>
              <input className="input" value={toOp} onChange={e => setToOp(e.target.value)}
                placeholder="Петров П.П. (необязательно)"/>
            </div>
          </div>

          {/* Результаты */}
          <div className="grid-3" style={{ gap:10 }}>
            <div className="field">
              <span className="field-label">Сделано за смену, шт</span>
              <input className="input" type="number" min={0} value={count}
                onChange={e => setCount(Number(e.target.value))}/>
            </div>
            <div className="field">
              <span className="field-label">Рабочее время, мин</span>
              <input className="input" type="number" min={0} value={workMin}
                onChange={e => setWorkMin(Number(e.target.value))}/>
            </div>
            <div className="field">
              <span className="field-label">Паузы, мин</span>
              <input className="input" type="number" min={0} value={pauseMin}
                onChange={e => setPauseMin(Number(e.target.value))}/>
            </div>
          </div>

          <div className="field">
            <span className="field-label">Примечание</span>
            <input className="input" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Состояние детали, особенности…"/>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Отмена</button>
          <button className="btn primary" onClick={handleHandoff}
            disabled={saving || !taskId || !fromOp}>
            {saving ? 'Передача…' : '⇄ Передать задание'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =======================================================
// ShiftsView — страница истории смен + посменный отчёт
// =======================================================
export function ShiftsView({ authUser }) {
  const [shifts, setShifts]   = React.useState([]);
  const [report, setReport]   = React.useState(null);
  const [selId,  setSelId]    = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    api.get('/shifts').then(r => setShifts(r.data || [])).catch(() => {});
  }, []);

  async function loadReport(id) {
    if (selId === id) { setSelId(null); setReport(null); return; }
    setLoading(true);
    setSelId(id);
    try {
      const r = await api.get('/shifts/' + id + '/report');
      setReport(r.shift);
    } catch(e) { alert('Ошибка: ' + e.message); }
    setLoading(false);
  }

  const STATUS_LABEL = { null:'В работе', undefined:'В работе' };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Смены</h1>
          <div className="page-sub">История смен и посменные отчёты</div>
        </div>
      </div>

      <div style={{ display:'flex', gap:16, alignItems:'flex-start', flexWrap:'wrap' }}>
        {/* Список смен */}
        <div style={{ flex:'0 0 300px', minWidth:0 }}>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr>
                <th>Смена</th>
                <th className="hide-mobile">Длит.</th>
                <th>Статус</th>
              </tr></thead>
              <tbody>
                {shifts.length === 0 && (
                  <tr><td colSpan={3}>
                    <div className="empty-state" style={{border:0}}>Нет смен</div>
                  </td></tr>
                )}
                {shifts.map(s => {
                  const dur = s.closed_at
                    ? Math.round((new Date(s.closed_at.replace(' ','T')+'Z') - new Date(s.opened_at.replace(' ','T')+'Z')) / 60000)
                    : Math.round((Date.now() - new Date(s.opened_at.replace(' ','T')+'Z').getTime()) / 60000);
                  const isOpen = !s.closed_at;
                  return (
                    <tr key={s.id} className="row-hover" style={{ cursor:'pointer',
                      background: selId===s.id ? 'rgba(217,72,15,.06)' : undefined }}
                      onClick={() => loadReport(s.id)}>
                      <td>
                        <div style={{ fontSize:12, fontWeight:600 }}>{s.name}</div>
                        <div style={{ fontSize:10, color:'var(--fg-2)' }}>
                          {s.opened_at?.slice(0,16).replace('T',' ')}
                        </div>
                        <div style={{ fontSize:10, color:'var(--fg-2)' }}>{s.opened_by_name}</div>
                      </td>
                      <td className="hide-mobile" style={{ fontSize:11, fontFamily:'monospace' }}>
                        {Math.floor(dur/60)}ч{dur%60}м
                      </td>
                      <td>
                        <span className={'pill ' + (isOpen ? 'prog' : 'done')}>
                          <span className="dot"/>
                          {isOpen ? 'Открыта' : 'Закрыта'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Отчёт по смене */}
        <div style={{ flex:1, minWidth:0 }}>
          {loading && <div style={{ padding:32, textAlign:'center', color:'var(--fg-2)' }}>Загрузка…</div>}
          {!loading && !report && (
            <div style={{ padding:32, textAlign:'center', color:'var(--fg-2)', fontSize:13 }}>
              Выберите смену для просмотра отчёта
            </div>
          )}
          {!loading && report && <ShiftReport report={report}/>}
        </div>
      </div>
    </>
  );
}

// =======================================================
// ShiftReport — посменный отчёт
// =======================================================
function ShiftReport({ report: r }) {
  const dur = r.closed_at
    ? Math.round((new Date(r.closed_at.replace(' ','T')+'Z') - new Date(r.opened_at.replace(' ','T')+'Z')) / 60000)
    : Math.round((Date.now() - new Date(r.opened_at.replace(' ','T')+'Z').getTime()) / 60000);

  const totalClosed   = r.scans?.length || 0;
  const totalWorkMin  = Object.values(r.by_operator || {}).reduce((s, o) => s + (o.work_min || 0), 0);
  const totalPauseMin = Object.values(r.by_operator || {}).reduce((s, o) => s + (o.pause_min || 0), 0);

  return (
    <div>
      {/* Заголовок */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:18, fontWeight:800, marginBottom:4 }}>{r.name}</div>
        <div style={{ fontSize:12, color:'var(--fg-2)', display:'flex', gap:16, flexWrap:'wrap' }}>
          <span>Открыта: {r.opened_at?.slice(0,16).replace('T',' ')}</span>
          {r.closed_at && <span>Закрыта: {r.closed_at.slice(0,16).replace('T',' ')}</span>}
          <span>Длительность: {Math.floor(dur/60)}ч {dur%60}м</span>
          <span>Мастер: {r.opened_by_name}</span>
        </div>
      </div>

      {/* KPI */}
      <div className="kpi-scroll grid-4" style={{ marginBottom:16 }}>
        {[
          ['Закрыто операций', totalClosed, 'var(--st-done-line)'],
          ['Передач заданий', r.handoffs?.length || 0, 'var(--accent)'],
          ['Рабочее время', totalWorkMin ? Math.floor(totalWorkMin/60)+'ч '+totalWorkMin%60+'м' : '—', 'var(--fg-1)'],
          ['Паузы', totalPauseMin ? Math.floor(totalPauseMin/60)+'ч '+totalPauseMin%60+'м' : '—', 'var(--warning,#c07820)'],
        ].map(([label, value, color]) => (
          <div key={label} className="kpi">
            <div className="kpi-label">{label}</div>
            <div className="kpi-value" style={{ color, fontSize:18 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* По операторам */}
      {Object.keys(r.by_operator || {}).length > 0 && (
        <>
          <div className="subhead">По операторам</div>
          <div className="tbl-wrap" style={{ marginBottom:16 }}>
            <table className="tbl">
              <thead><tr>
                <th>Оператор</th>
                <th className="num-col">Закрыто оп.</th>
                <th className="num-col">Кол-во, шт</th>
                <th className="num-col">Факт. вр, мин</th>
                <th className="num-col">Рабочее, мин</th>
                <th className="num-col">Паузы, мин</th>
              </tr></thead>
              <tbody>
                {Object.entries(r.by_operator).map(([op, s]) => (
                  <tr key={op} className="row-hover">
                    <td style={{ fontWeight:600 }}>{op}</td>
                    <td className="num-col num">{s.closed || 0}</td>
                    <td className="num-col num">{s.qty || 0}</td>
                    <td className="num-col num">{s.actual_min || '—'}</td>
                    <td className="num-col num">{s.work_min || '—'}</td>
                    <td className="num-col num" style={{ color: s.pause_min > 30 ? 'var(--warning,#c07820)' : 'var(--fg-2)' }}>
                      {s.pause_min || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Передачи заданий */}
      {r.handoffs?.length > 0 && (
        <>
          <div className="subhead">Передачи заданий</div>
          <div className="tbl-wrap" style={{ marginBottom:16 }}>
            <table className="tbl">
              <thead><tr>
                <th>Заказ</th>
                <th>Операция</th>
                <th>РЦ</th>
                <th>От</th>
                <th>Кому</th>
                <th className="num-col">Сделано</th>
                <th className="num-col">Работал</th>
                <th className="num-col">Паузы</th>
                <th className="hide-mobile">Примечание</th>
              </tr></thead>
              <tbody>
                {r.handoffs.map(h => (
                  <tr key={h.id} className="row-hover">
                    <td className="mono" style={{ fontSize:12, color:'var(--accent)' }}>{h.order_number}</td>
                    <td style={{ fontSize:12 }}>{h.op_name}</td>
                    <td className="mono" style={{ fontSize:11 }}>{h.work_center}</td>
                    <td style={{ fontSize:12 }}>{h.from_operator}</td>
                    <td style={{ fontSize:12, color:'var(--fg-2)' }}>{h.to_operator || '—'}</td>
                    <td className="num-col num">{h.completed_count}</td>
                    <td className="num-col num">{h.work_min || '—'}</td>
                    <td className="num-col num" style={{ color: h.pause_min > 30 ? 'var(--warning,#c07820)' : undefined }}>
                      {h.pause_min || '—'}
                    </td>
                    <td className="hide-mobile" style={{ fontSize:11, color:'var(--fg-2)' }}>{h.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Закрытые операции */}
      {r.scans?.length > 0 && (
        <>
          <div className="subhead">Закрытые операции ({r.scans.length})</div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr>
                <th>Время</th>
                <th>Заказ</th>
                <th>Деталь</th>
                <th>Операция</th>
                <th>Оператор</th>
                <th className="num-col">Кол.</th>
                <th className="num-col">Факт, мин</th>
              </tr></thead>
              <tbody>
                {r.scans.map((s, i) => (
                  <tr key={i} className="row-hover">
                    <td className="mono" style={{ fontSize:11 }}>{s.scanned_at?.slice(11,16)}</td>
                    <td className="mono" style={{ fontSize:12, color:'var(--accent)' }}>{s.order_number}</td>
                    <td style={{ fontSize:12 }}>{s.detail_name || s.detail_id}</td>
                    <td style={{ fontSize:12 }}>{s.op_info}</td>
                    <td style={{ fontSize:12 }}>{s.operator}</td>
                    <td className="num-col num">{s.quantity}</td>
                    <td className="num-col num">{s.actual_time_min || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {r.notes && (
        <div style={{ marginTop:12, padding:12, background:'var(--bg-2)', borderRadius:8, fontSize:13 }}>
          <b>Примечания:</b> {r.notes}
        </div>
      )}
    </div>
  );
}
