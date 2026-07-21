import React from 'react'
import { api, Auth, API_BASE, parseServerDate, unwrap } from '../lib/api.js'
import { Icon } from '../components/Icon.jsx'
import { QrCode, generateQrSvg } from '../components/QrCode.jsx'
import { routeSheetToPdf } from '../lib/routeSheetPdf.js'
import { useStrings, StatusPill, OrderPicker, ORDER_STATUS_RU, STATUS_LABEL_RU } from '../lib/data.jsx'

// Экранирование HTML — защита от XSS в печати/экспорте (модульный уровень)
function escHtml(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function OrderItemOpsEditor({ det, orderId, tasks, lang, onChanged }) {
  const [expanded, setExpanded] = React.useState(false);
  const [adding,   setAdding]   = React.useState(false);
  const [form,     setForm]     = React.useState({ name:'', workCenter:'', time:'', setup:'' });
  const [saving,   setSaving]   = React.useState(false);

  // Задания этой детали в заказе
  const detTasks = tasks.filter(t => t.orderId === orderId && t.detailId === det.id)
                        .sort((a,b) => a.opNum - b.opNum);

  // Объединяем операции детали (техкарта) с заданиями заказа.
  // Добавленная операция создаётся как ЗАДАНИЕ (task), а не операция детали —
  // поэтому без объединения она не появлялась в списке.
  const _opsMap = new Map();
  (det.operations||[]).forEach(op => _opsMap.set(op.num, {
    num: op.num, name: op.name,
    workCenter: op.workCenter || op.work_center || '',
    time: op.time || op.time_min || 0,
  }));
  detTasks.forEach(t => {
    if (!_opsMap.has(t.opNum)) _opsMap.set(t.opNum, {
      num: t.opNum, name: t.opName || '—',
      workCenter: t.workCenter || '',
      time: t.time || 0,
    });
  });
  const ops = [..._opsMap.values()].sort((a,b) => a.num - b.num);

  const STATUS_DOT = {
    waiting: '#888', in_progress: 'var(--accent)',
    done: 'var(--st-done-line)', paused: 'var(--warning,#c07820)',
    rejected: 'var(--danger)',
  };

  async function addOp() {
    if (!form.name || !form.workCenter) return;
    setSaving(true);
    try {
      // Find max op_num for this detail in this order
      const maxNum = detTasks.reduce((m, t) => Math.max(m, t.opNum), 0);
      const newNum = Math.ceil((maxNum + 10) / 10) * 10;
      // Add task directly via API
      await api.post('/orders/' + orderId + '/add-task', {
        detail_id: det.id,
        op_num: newNum,
        op_name: form.name,
        work_center: form.workCenter,
        time_min: Number(form.time) || 0,
        setup_time_min: Number(form.setup) || 0,
      });
      setForm({ name:'', workCenter:'', time:'', setup:'' });
      setAdding(false);
      onChanged && await onChanged();   // перезагрузка — иначе операция не появляется
    } catch(e) { alert('Ошибка: ' + e.message); }
    setSaving(false);
  }

  if (!expanded) {
    return (
      <div className="ops-tag-list" style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
        {ops.slice(0, 5).map(op => {
          const task = detTasks.find(t => t.opNum === op.num);
          const color = task ? STATUS_DOT[task.status] || '#888' : '#ccc';
          return (
            <span key={op.num} className="ops-tag" style={{ display:'flex', alignItems:'center', gap:3 }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:color, flexShrink:0 }}/>
              {String(op.num).padStart(3,'0')} {op.name.slice(0,12)}
            </span>
          );
        })}
        {ops.length > 5 && <span className="ops-tag muted">+{ops.length - 5}</span>}
        <button style={{ fontSize:10, padding:'1px 6px', borderRadius:4, border:'1px solid var(--line-1)',
          background:'transparent', cursor:'pointer', color:'var(--fg-2)', fontFamily:'var(--ui-font)' }}
          onClick={() => setExpanded(true)}>▼ операции</button>
      </div>
    );
  }

  return (
    <div style={{ marginTop:8, border:'1px solid var(--line-2)', borderRadius:8, overflow:'hidden' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'6px 10px', background:'var(--bg-3)' }}>
        <span style={{ fontSize:11, fontWeight:600, color:'var(--fg-1)' }}>
          Операции · {ops.length}
        </span>
        <div style={{ display:'flex', gap:6 }}>
          <button className="btn ghost" style={{ fontSize:11, height:26, padding:'0 8px' }}
            onClick={() => setAdding(true)}>
            <Icon name="plus" size={11}/>Добавить
          </button>
          <button className="icon-btn" style={{ fontSize:10 }} onClick={() => setExpanded(false)}>
            <Icon name="chevron-up" size={12}/>
          </button>
        </div>
      </div>

      {ops.map(op => {
        const task = detTasks.find(t => t.opNum === op.num);
        const color = task ? STATUS_DOT[task.status] || '#888' : '#ccc';
        const label = task ? {waiting:'Ожидает',in_progress:'В работе',done:'Выполнено',paused:'Пауза',rejected:'Брак'}[task.status] : '—';
        return (
          <div key={op.num} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 10px',
            borderBottom:'1px solid var(--line-2)', fontSize:12 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:color, flexShrink:0 }}/>
            <span className="mono" style={{ width:32, color:'var(--accent)', fontWeight:700 }}>{String(op.num).padStart(3,'0')}</span>
            <span style={{ flex:2 }}>{op.name}</span>
            <span className="mono muted" style={{ fontSize:11, flex:1 }}>{op.workCenter}</span>
            <span className="num muted" style={{ fontSize:11, width:36, textAlign:'right' }}>{op.time}′</span>
            {task && <span style={{ fontSize:10, color, fontWeight:500, minWidth:60, textAlign:'right' }}>{label}</span>}
          </div>
        );
      })}

      {adding && (
        <div style={{ display:'flex', gap:6, padding:'8px 10px', background:'rgba(217,72,15,.06)',
          borderTop:'1px solid var(--accent)', flexWrap:'wrap', alignItems:'center' }}>
          <input className="input" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}
            placeholder="Название операции" style={{ flex:2, minWidth:120 }} autoFocus/>
          <input className="input" value={form.workCenter} onChange={e=>setForm(p=>({...p,workCenter:e.target.value}))}
            placeholder="Код РЦ (101, 710…)" list="wc-list" style={{ flex:1, minWidth:70 }}/>
          <input className="input" type="number" value={form.time} onChange={e=>setForm(p=>({...p,time:e.target.value}))}
            placeholder="мин" style={{ width:60 }}/>
          <input className="input" type="number" value={form.setup} onChange={e=>setForm(p=>({...p,setup:e.target.value}))}
            placeholder="ТПЗ" title="Время наладки (ТПЗ)" style={{ width:60 }}/>
          <button className="btn primary" onClick={addOp} disabled={saving} style={{ fontSize:12 }}>
            {saving ? '…' : 'Добавить'}
          </button>
          <button className="icon-btn" onClick={()=>setAdding(false)}><Icon name="x" size={14}/></button>
          <datalist id="wc-list">
            {[101,104,120,124,128,129,136,301,710,711,720,721,722,731,901,1101].map(c=>(
              <option key={c} value={String(c)}/>
            ))}
          </datalist>
        </div>
      )}
    </div>
  );
}



export function OrderBuilder({ data, tasks, lang, onPrint, onSave, onDeleteOrder, onSelectOrder, activeOrderId, onReload }) {
  const S = useStrings(lang);
  const order = data.orders[0];

  if (!order) return (
    <div style={{ padding:48, textAlign:'center', color:'var(--fg-2)' }}>
      <p style={{ marginBottom:16 }}>Нет активных заказов</p>
    </div>
  );

  const [items, setItems] = React.useState(() => order.items.map(it => ({ ...it })));
  const [number] = React.useState(order.number);
  const [customer, setCustomer] = React.useState(order.customer);
  const [dueDate, setDueDate] = React.useState(order.dueDate);
  const [foreman, setForeman] = React.useState(order.foreman);

  const [showProblem, setShowProblem] = React.useState(false);
  const [problemText, setProblemText] = React.useState('');

  async function markProblem() {
    if (!problemText.trim()) return;
    try {
      await api.post('/orders/' + order.id + '/problem', { comment: problemText.trim() });
      setShowProblem(false); setProblemText('');
      onReload && await onReload();
    } catch (e) { alert('Ошибка: ' + e.message); }
  }
  async function resolveProblem() {
    try {
      await api.post('/orders/' + order.id + '/resolve', { status: 'in_work' });
      onReload && await onReload();
    } catch (e) { alert('Ошибка: ' + e.message); }
  }
  const [adding, setAdding] = React.useState(false);

  const updateQty = (idx, v) => {
    const next = [...items];
    next[idx] = { ...next[idx], quantity: Math.max(1, v) };
    setItems(next);
  };
  const removeLine = (idx) => setItems(items.filter((_, i) => i !== idx));
  const addLine = (detailId) => {
    if (items.find(i => i.detailId === detailId)) return setAdding(false);
    setItems([...items, { detailId, quantity: 1 }]);
    setAdding(false);
  };

  // Computed: total ops, total time
  const totalOps = items.reduce((s, it) => {
    const det = data.details.find(d => d.id === it.detailId);
    return s + (det ? (det.operations||[]).length : 0);
  }, 0);
  const totalTime = items.reduce((s, it) => {
    const det = data.details.find(d => d.id === it.detailId);
    if (!det) return s;
    return s + (det.operations||[]).reduce((ss, o) => ss + o.time, 0) * it.quantity;
  }, 0);
  const totalUnits = items.reduce((s, it) => s + it.quantity, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{lang === 'en' ? 'Order' : 'Заказ'} {number}</h1>
          <div className="page-sub">
            {S.created} {order.createdAt} · {order.status === 'problem'
              ? <span className="pill" style={{padding:'1px 8px',background:'rgba(239,68,68,.15)',color:'#ef4444'}}>⚠ Проблема</span>
              : <span className="pill prog" style={{padding:'1px 6px'}}><span className="dot"/>{lang === 'en' ? 'In progress' : 'В работе'}</span>}
          </div>
        </div>
        <div className="row">
          {order.status !== 'problem'
            ? <button className="btn" style={{ color:'#ef4444', borderColor:'#ef4444' }} onClick={()=>setShowProblem(true)}><Icon name="alert-triangle" size={14}/>Проблема</button>
            : (Auth.can('orders.edit') || Auth.isAdmin())
              ? <button className="btn primary" style={{ background:'#22c55e', borderColor:'#22c55e' }} onClick={resolveProblem}><Icon name="check" size={14}/>Вернуть в работу</button>
              : <span className="muted" style={{ fontSize:12, alignSelf:'center' }}>снять может только мастер</span>}
          <button className="btn" onClick={() => onSelectOrder && onSelectOrder(order)}><Icon name="edit" size={14} />{lang === 'en' ? 'Edit' : 'Редактировать'}</button>
          <button className="btn" style={{ color:'var(--danger)' }} onClick={() => onDeleteOrder && onDeleteOrder(order)}><Icon name="trash" size={14} />{lang === 'en' ? 'Delete' : 'Удалить'}</button>
          <button className="btn" onClick={()=>onSave({items, number, customer, foreman, dueDate, status: order.status, priority: order.priority})}><Icon name="check" size={14} />{S.saveOrder}</button>
          <button className="btn primary" onClick={onPrint}><Icon name="print" size={14} />{S.generateSheet}</button>
        </div>
      </div>

      {order.status === 'problem' && (
        <div style={{ margin:'0 0 14px', padding:'12px 16px', borderRadius:8,
          background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.35)' }}>
          <div style={{ fontWeight:700, color:'#ef4444', marginBottom:4 }}>⚠ Заказ остановлен — Проблема</div>
          <div style={{ fontSize:13 }}>{order.problemComment || 'Причина не указана'}</div>
          <div className="muted" style={{ fontSize:11, marginTop:6 }}>Операции заблокированы. Снять может только мастер.</div>
        </div>
      )}

      {showProblem && (
        <div className="modal-back">
          <div className="modal" style={{ width:'min(480px,92vw)' }}>
            <div className="modal-head"><h3 className="modal-title">Отметить проблему</h3>
              <button className="icon-btn" onClick={()=>setShowProblem(false)}><Icon name="close" size={16}/></button></div>
            <div className="modal-body">
              <div className="field"><span className="field-label">Причина (увидит мастер) *</span>
                <textarea className="input" rows={3} value={problemText} onChange={e=>setProblemText(e.target.value)}
                  placeholder="Нет материала / нет инструмента / ждём согласования…" style={{ width:'100%' }}/></div>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={()=>setShowProblem(false)}>Отмена</button>
              <button className="btn primary" style={{ background:'#ef4444',borderColor:'#ef4444' }} onClick={markProblem}>Отметить проблему</button>
            </div>
          </div>
        </div>
      )}

      <div className="builder">
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h3 className="card-title">{lang === 'en' ? 'Order header' : 'Параметры заказа'}</h3>
              <span className="muted" style={{ fontSize: 11 }}>{lang === 'en' ? 'Editable until generated' : 'Можно править до выпуска'}</span>
            </div>
            <div className="grid-3">
              <div className="field">
                <span className="field-label">{S.customer}</span>
                <input className="input" value={customer} onChange={e => setCustomer(e.target.value)} />
              </div>
              <div className="field">
                <span className="field-label">{S.dueDate}</span>
                <input className="input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
              <div className="field">
                <span className="field-label">{S.foreman}</span>
                <input className="input" value={foreman} onChange={e => setForeman(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="toolbar">
              <Icon name="orders" size={14} className="muted" />
              <b style={{ fontSize: 13 }}>{S.orderComp}</b>
              <span className="tag mono">{items.length} {lang === 'en' ? 'lines' : 'строк'}</span>
              <span className="topbar-spacer" />
              <button className="btn ghost" onClick={() => setAdding(!adding)}>
                <Icon name="plus" size={14} />{S.addLine}
              </button>
            </div>

            {adding && (
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line-2)', background: 'var(--bg-1)' }}>
                <select className="select" autoFocus
                  defaultValue=""
                  onChange={e => e.target.value && addLine(e.target.value)}
                  style={{ width: '100%' }}>
                  <option value="" disabled>{lang === 'en' ? 'Pick a part…' : 'Выбрать деталь…'}</option>
                  {data.details
                    .filter(d => !items.find(i => i.detailId === d.id))
                    .map(d => (
                      <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                    ))}
                </select>
              </div>
            )}

            {items.length === 0 && (
              <div style={{ padding: 20 }}>
                <div className="empty-state">{lang === 'en' ? 'No parts added yet' : 'Детали не добавлены'}</div>
              </div>
            )}

            {items.map((it, idx) => {
              const det = data.details.find(d => d.id === it.detailId);
              if (!det) return null;
              return (
                <div key={it.detailId} className="order-line">
                  <div>
                    <div className="order-line-name">{det.name}</div>
                    <div className="order-line-meta">
                      <span className="mono" style={{ color: 'var(--accent)' }}>{det.code}</span>
                      <span className="muted" style={{ marginLeft: 10 }}>{det.material}</span>
                    </div>
                    <OrderItemOpsEditor det={det} orderId={order.id} tasks={tasks} lang={lang} onChanged={onReload}/>
                  </div>
                  <div className="qty-stepper">
                    <button onClick={() => updateQty(idx, it.quantity - 1)}>−</button>
                    <input value={it.quantity} onChange={e => updateQty(idx, parseInt(e.target.value) || 1)} className="num" />
                    <button onClick={() => updateQty(idx, it.quantity + 1)}>+</button>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11 }}>
                    <div className="num"><b>{(det.operations||[]).length * it.quantity}</b> <span className="muted">{S.ops}</span></div>
                    <div className="muted num">{(det.operations||[]).reduce((s, o) => s + o.time, 0) * it.quantity}{S.min}</div>
                  </div>
                  <button className="icon-btn" onClick={() => removeLine(idx)} title={lang === 'en' ? 'Remove' : 'Удалить'}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="builder-summary stack">
          <div className="card">
            <div className="card-head">
              <h3 className="card-title">{S.summary}</h3>
              <span className="muted mono" style={{ fontSize: 11 }}>{number}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <div className="kpi-label">{S.detailsCt}</div>
                <div className="kpi-value num" style={{ fontSize: 22 }}>{items.length}</div>
              </div>
              <div>
                <div className="kpi-label">{S.partsCt}</div>
                <div className="kpi-value num" style={{ fontSize: 22 }}>{totalUnits}<span className="unit">{S.pcs}</span></div>
              </div>
              <div>
                <div className="kpi-label">{S.totalOps}</div>
                <div className="kpi-value num" style={{ fontSize: 22 }}>{items.reduce((s, it) => {
                  const det = data.details.find(d => d.id === it.detailId);
                  return s + (det ? (det.operations||[]).length * it.quantity : 0);
                }, 0)}</div>
              </div>
              <div>
                <div className="kpi-label">{S.totalTime}</div>
                <div className="kpi-value num" style={{ fontSize: 22 }}>{Math.round(totalTime / 60)}<span className="unit">{S.hr} {totalTime % 60}{S.min}</span></div>
              </div>
            </div>
            <div style={{ height: 1, background: 'var(--line-1)', margin: '14px 0' }} />
            <div style={{ fontSize: 11.5, color: 'var(--fg-1)', lineHeight: 1.5 }}>
              {lang === 'en'
                ? 'Generating the route sheet will create operation tasks for every part-operation pair and a unique QR code per task.'
                : 'При выпуске будут созданы задания на каждую пару «деталь × операция» и уникальный QR-код для каждого.'}
            </div>
            <button className="btn primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12, height: 36 }} onClick={onPrint}>
              <Icon name="print" size={14} />{S.generateSheet}
            </button>
          </div>

          <div className="card">
            <div className="card-head">
              <h3 className="card-title" style={{ fontSize: 12 }}>{lang === 'en' ? 'Workload preview' : 'Загрузка рабочих центров'}</h3>
            </div>
            <WorkCenterPreview items={items} data={data} lang={lang} />
          </div>

          <OrderOperatorComments orderId={order.id} lang={lang} />
        </div>
      </div>
    </>
  );
}

// Все комментарии операторов по операциям заказа

function OrderOperatorComments({ orderId, lang }) {
  const [comments, setComments] = React.useState(null);
  const [open, setOpen] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    api.get('/orders/' + orderId + '/comments')
      .then(d => { if (alive) setComments(unwrap(d)); })
      .catch(() => { if (alive) setComments([]); });
    return () => { alive = false; };
  }, [orderId]);

  const typeLabel = { close: 'при закрытии', comment: 'комментарий', pause: 'пауза', handoff: 'передача смены', start: 'старт' };

  return (
    <div className="card">
      <div className="card-head" style={{ cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <h3 className="card-title" style={{ fontSize: 12 }}>
          {lang === 'en' ? 'Operator comments' : 'Комментарии операторов'}
          {comments && <span className="muted" style={{ marginLeft: 6, fontWeight: 400 }}>({comments.length})</span>}
        </h3>
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={14} />
      </div>
      {open && (
        comments === null ? (
          <div className="muted" style={{ padding: 12, fontSize: 13 }}>Загрузка…</div>
        ) : comments.length === 0 ? (
          <div className="muted" style={{ padding: 12, fontSize: 13 }}>
            {lang === 'en' ? 'No operator comments yet' : 'Комментариев операторов пока нет'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
            {comments.map(c => (
              <div key={c.id} style={{ padding: '8px 12px', borderLeft: '3px solid var(--accent)',
                background: 'var(--bg-1)', borderRadius: '0 6px 6px 0' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 3 }}>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>
                    оп. {c.op_num}{c.op_name ? ' · ' + c.op_name : ''}
                  </span>
                  {c.detail_name && <span className="muted" style={{ fontSize: 11 }}>{c.detail_name}</span>}
                  <span className="muted" style={{ fontSize: 11, marginLeft: 'auto' }}>
                    {c.operator || '—'}{c.created_at ? ' · ' + String(c.created_at).slice(0, 16).replace('T', ' ') : ''}
                  </span>
                </div>
                <div style={{ fontSize: 13 }}>{c.comment}</div>
                {c.event_type && c.event_type !== 'comment' && (
                  <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>{typeLabel[c.event_type] || c.event_type}</div>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}


export function WorkCenterPreview({ items, data, lang }) {
  const wcMap = {};
  items.forEach(it => {
    const det = data.details.find(d => d.id === it.detailId);
    if (!det) return;
    det.operations.forEach(o => {
      const key = o.workCenter;
      wcMap[key] = (wcMap[key] || 0) + o.time * it.quantity;
    });
  });
  const entries = Object.entries(wcMap).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(e => e[1]));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
      {entries.map(([wc, mins]) => (
        <div key={wc}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 2 }}>
            <span className="mono" style={{ fontSize: 10.5 }}>{wc}</span>
            <span className="num muted">{mins}{lang === 'en' ? 'm' : 'м'}</span>
          </div>
          <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: (mins / max * 100) + '%', background: 'var(--accent)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}


// Редактируемое примечание к операции — печатается на маршрутном листе
function OperationNote({ task }) {
  const [val, setVal] = React.useState(task.note || '');
  const [saved, setSaved] = React.useState(false);
  const canEdit = Auth.can('orders.edit') || Auth.isAdmin();

  async function save() {
    if (val === (task.note || '')) return;
    try {
      await api.patch(`/tasks/${task.id}/note`, { comment: val });
      task.note = val;
      setSaved(true); setTimeout(() => setSaved(false), 1500);
    } catch (e) { /* тихо */ }
  }

  if (!canEdit) {
    return task.note ? <div style={{ fontSize: 11, color: '#8a6d3b', marginTop: 3, fontStyle: 'italic' }}>✎ {task.note}</div> : null;
  }
  return (
    <input
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={save}
      placeholder="+ примечание к операции"
      className="print-hide"
      style={{ display: 'block', width: '100%', marginTop: 4, fontSize: 11, padding: '2px 6px',
        border: '1px dashed var(--line-1)', borderRadius: 4, background: saved ? 'rgba(34,197,94,.1)' : 'transparent',
        color: 'var(--fg-1)', fontStyle: val ? 'italic' : 'normal' }}
    />
  );
}

export function RouteSheetView({ data, tasks, scanLog, lang, qrSize, onClose, onScanQR }) {
  const S = useStrings(lang);
  const order = data.orders[0];

  if (!order) return (
    <div style={{ padding:48, textAlign:'center', color:'var(--fg-2)' }}>
      <p>Нет заказа для печати</p>
      <button className="btn" onClick={onClose} style={{ marginTop:16 }}>← Назад</button>
    </div>
  );

  const items = order.items.map(it => ({
    ...it,
    det: data.details.find(d => d.id === it.detailId),
    tasks: tasks.filter(t => t.orderId === order.id && t.detailId === it.detailId),
  }));

  // Печать: компактный маршрутный лист на А4
  function buildBodyHtml() {
    const rowsHTML = items.map((it, idx) => {
      if (!it.det) return '';
      const opsRows = it.tasks.map(t => {
        const qrSVG = generateQrSvg(t.qrText, 110) ||
          `<div style="width:110px;height:110px;border:1px solid #ccc;font-size:7pt;color:#999;display:flex;align-items:center;justify-content:center;text-align:center">${(t.qrText || '').slice(-8)}</div>`;

        // QR для закрытой операции — ссылка на информацию о закрытии
        const doneQrText = t.status === 'done' ? `DONE:${t.qrText}` : null;
        const doneQrSVG  = doneQrText ? (generateQrSvg(doneQrText, 100) || '') : '';

        const rowBg = t.status === 'done' ? '#f0faf0' : t.status === 'in_progress' ? '#fff8f0' : '#fff';
        const isDone = t.status === 'done';

        // Нормоконтроль для выполненных
        const normStr = isDone && t.actualTime
          ? `<div style="font-size:7pt;font-family:monospace;margin-top:2px;color:${t.actualTime > t.time * 1.15 ? '#c00' : '#2d7a2d'}">
               факт: ${t.actualTime}′ / пл: ${t.time}′
             </div>`
          : '';

        // Дата закрытия из scan_log если есть
        const scanEntry = (scanLog||[]).find(s => s.qrText === t.qrText || s.taskId === t.id);
        const closedAt  = scanEntry?.ts || '';
        const closedBy  = scanEntry?.operator || t.operator || '';

        return `<tr style="background:${rowBg};${isDone ? 'border-left:3px solid #2d7a2d' : ''}">
          <td style="padding:3px 4px;border-bottom:1px solid #e8e0d0;font-family:monospace;font-weight:700;font-size:9pt;text-align:center">${String(t.opNum).padStart(3,'0')}</td>
          <td style="padding:3px 4px;border-bottom:1px solid #e8e0d0;font-size:9pt;word-wrap:break-word;overflow:hidden">
            <b>${escHtml(t.opName)}</b>
            ${t.note ? `<div style="font-size:8pt;color:#8a6d3b;font-style:italic;margin-top:2px">✎ ${escHtml(t.note)}</div>` : ''}
            ${isDone ? `<div style="font-size:7pt;color:#2d7a2d;margin-top:2px">✓ ЗАКРЫТА</div>` : ''}
            ${normStr}
          </td>
          <td style="padding:3px 4px;border-bottom:1px solid #e8e0d0;font-size:8pt;font-family:monospace;color:#444;word-wrap:break-word;overflow:hidden">${t.workCenter}</td>
          <td style="padding:3px 4px;border-bottom:1px solid #e8e0d0;font-size:9pt;text-align:center;font-family:monospace;font-weight:700">${t.planned}</td>
          <td style="padding:3px 4px;border-bottom:1px solid #e8e0d0;font-size:7pt;font-family:monospace;color:#666;text-align:center">${t.time}′</td>
          <td style="padding:4px 4px;border-bottom:1px solid #e8e0d0;text-align:center;overflow:hidden">
            ${isDone ? `
              <div style="display:flex;gap:4px;align-items:flex-start;justify-content:center;flex-wrap:wrap">
                <div style="text-align:center">
                  ${qrSVG}
                  <div style="font-size:5pt;font-family:monospace;color:#2d7a2d">открыть</div>
                </div>
                ${doneQrSVG ? `<div style="text-align:center">
                  ${doneQrSVG}
                  <div style="font-size:5pt;font-family:monospace;color:#555">закрыть</div>
                </div>` : ''}
              </div>
            ` : `
              ${qrSVG}
            `}
          </td>
          <td style="border-bottom:1px solid #e8e0d0;padding:3px 5px;min-width:100px">
            ${isDone ? `
              <div style="font-size:7pt;background:#e6f4ea;color:#2d7a2d;padding:1px 4px;border-radius:3px;font-weight:700;display:inline-block;margin-bottom:2px">✓ ЗАКРЫТА</div>
              <div style="font-size:8pt;color:#2d7a2d;font-weight:600;margin-top:1px">${closedBy || t.operator||'—'}</div>
              ${closedAt ? `<div style="font-size:7pt;font-family:monospace;color:#444">${closedAt}</div>` : ''}
              ${t.actualTime ? `<div style="font-size:7pt;font-family:monospace;margin-top:1px;color:${t.actualTime > t.time * 1.15 ? '#c00' : '#2d7a2d'};font-weight:${t.actualTime > t.time*1.15?'700':'400'}">факт: ${t.actualTime}′ / план: ${t.time}′</div>` : ''}
            ` : `<div style="font-size:7pt;color:#999;margin-bottom:2px">исполнитель:</div><div style="font-size:8pt;color:#444;min-height:18px;border-bottom:1px solid #ccc">&nbsp;</div>`}
          </td>
        </tr>`;
      }).join('');

      const detDone  = it.tasks.filter(t=>t.status==='done').length;
      const detTotal = it.tasks.length;
      const detPct   = detTotal > 0 ? Math.round(detDone*100/detTotal) : 0;

      return `<div style="margin-bottom:8px;page-break-inside:avoid">
        <div style="display:flex;justify-content:space-between;align-items:center;
                    background:#f5efe0;padding:4px 8px;border-left:3px solid #c07820;margin-bottom:0">
          <div style="display:flex;align-items:center;gap:12px">
            <span style="font-size:10pt;font-weight:700">${idx+1}. ${it.det.name}</span>
            <span style="font-family:monospace;font-size:8pt;color:#666">${escHtml(it.det.code)}</span>
            <span style="font-size:8pt;color:#555">чертёж: <b>${it.det.drawing||'—'}</b></span>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <span style="font-size:9pt">кол-во: <b>${it.quantity} ${it.det.unit}</b></span>
            <div style="display:flex;align-items:center;gap:4px">
              <div style="width:50px;height:5px;background:#ddd;border-radius:3px;overflow:hidden">
                <div style="width:${detPct}%;height:100%;background:#2d7a2d;border-radius:3px"></div>
              </div>
              <span style="font-size:8pt;font-family:monospace">${detDone}/${detTotal}</span>
            </div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:9pt;table-layout:fixed">
          <colgroup>
            <col style="width:6%"/>
            <col style="width:31%"/>
            <col style="width:14%"/>
            <col style="width:6%"/>
            <col style="width:6%"/>
            <col style="width:25%"/>
            <col style="width:12%"/>
          </colgroup>
          <thead><tr style="background:#ede5d0">
            <th style="padding:3px 4px;text-align:center;font-size:7pt;border-bottom:2px solid #c07820">№</th>
            <th style="padding:3px 4px;text-align:left;font-size:7pt;border-bottom:2px solid #c07820">ОПЕРАЦИЯ</th>
            <th style="padding:3px 4px;text-align:left;font-size:7pt;border-bottom:2px solid #c07820">РАБ. ЦЕНТР</th>
            <th style="padding:3px 4px;text-align:center;font-size:7pt;border-bottom:2px solid #c07820">КОЛ</th>
            <th style="padding:3px 4px;text-align:center;font-size:7pt;border-bottom:2px solid #c07820">МИН</th>
            <th style="padding:3px 4px;text-align:center;font-size:7pt;border-bottom:2px solid #c07820">QR-КОД</th>
            <th style="padding:3px 4px;text-align:left;font-size:7pt;border-bottom:2px solid #c07820">ИСПОЛНИТЕЛЬ / ДАТА</th>
          </tr></thead>
          <tbody>${opsRows}</tbody>
        </table>
      </div>`;
    }).join('');

    const allT    = items.flatMap(it=>it.tasks);
    const doneAll = allT.filter(t=>t.status==='done').length;
    const pctAll  = allT.length > 0 ? Math.round(doneAll*100/allT.length) : 0;

    return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;
                border-bottom:2px solid #14110b;padding-bottom:6px;margin-bottom:8px">
      <div>
        <div style="font-size:7pt;font-weight:700;letter-spacing:.2em;color:#7a6840;text-transform:uppercase">Маршрутный лист</div>
        <div style="font-size:18pt;font-weight:700;line-height:1;margin:2px 0">№ ${escHtml(order.number)}</div>
        <div style="font-size:8pt;color:#7a6840">к заказу на производство</div>
      </div>
      <div style="display:flex;gap:20px;align-items:flex-start">
        <table style="font-size:8pt;border-collapse:collapse">
          <tr><td style="color:#888;padding:1px 8px 1px 0">Получатель:</td><td style="font-weight:500">${escHtml(order.customer)}</td></tr>
          <tr><td style="color:#888;padding:1px 8px 1px 0">Ст. мастер:</td><td>${escHtml(order.foreman)||'—'}</td></tr>
          <tr><td style="color:#888;padding:1px 8px 1px 0">Создан:</td><td style="font-family:monospace">${escHtml(order.createdAt)}</td></tr>
          <tr><td style="color:#888;padding:1px 8px 1px 0">Срок:</td><td><span style="font-family:monospace;font-weight:700;color:#c0392b;background:#fdecea;padding:1px 6px;border-radius:3px">${escHtml(order.dueDate)}</span></td></tr>
        </table>
        <div style="text-align:center;min-width:60px">
          <div style="font-size:7pt;color:#888;margin-bottom:2px">прогресс</div>
          <div style="font-size:14pt;font-weight:700">${pctAll}%</div>
          <div style="font-size:7pt;color:#888">${doneAll}/${allT.length} оп.</div>
        </div>
      </div>
    </div>
    ${doneAll > 0 ? `<div style="margin-bottom:8px;padding:5px 10px;background:#fff4e6;border:1px solid #e0a040;border-radius:4px;font-size:9pt;font-weight:700;color:#a05000">
      ⟳ ПОВТОРНАЯ ПЕЧАТЬ — выполнено операций: ${doneAll} из ${allT.length}. Закрытые операции отмечены ✓ и не сканируются повторно.
    </div>` : ''}
    ${rowsHTML}
    ${(() => {
      const pausedTasks = items.flatMap(it=>it.tasks).filter(t=>t.status==='paused');
      if (!pausedTasks.length) return '';
      return `<div style="margin-top:8px;padding:6px 8px;background:#fffbf0;border:1px solid #e0c060;border-radius:4px;font-size:8pt">
        <b style="color:#7a5000">⏸ Задания на паузе:</b>
        ${pausedTasks.map(t=>`<span style="margin-left:8px;font-family:monospace">${String(t.opNum).padStart(3,'0')} ${escHtml(t.opName)}</span>`).join('')}
      </div>`;
    })()}
    <div style="display:flex;justify-content:space-between;border-top:1px solid #ccc;
                padding-top:4px;font-size:7pt;color:#888;margin-top:6px">
      <span>Принял: _____________________</span>
      <span>Дата: __________</span>
      <span style="font-family:monospace">${escHtml(order.number)} · ${new Date().toLocaleDateString('ru-RU')}</span>
    </div>`;
  }

  // PDF — основной способ (браузер рендерит кириллицу и QR, вёрстка не съезжает)
  async function handlePdf() {
    try {
      const bodyHtml = buildBodyHtml();
      await routeSheetToPdf(bodyHtml, { filename: `МЛ-${order.number}.pdf`, open: true });
    } catch (e) {
      alert('Не удалось сформировать PDF: ' + (e.message || e));
    }
  }

  // Печать через окно браузера (запасной способ)
  function handlePrint() {
    const printWin = window.open('', '_blank', 'width=820,height=1000');
    if (!printWin) { window.print(); return; }
    const bodyHtml = buildBodyHtml();
    printWin.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>МЛ ${escHtml(order.number)}</title>
      <style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      body{font-family:Arial,sans-serif;font-size:9pt;color:#14110b;margin:0}
      table{page-break-inside:auto}tr{page-break-inside:avoid}thead{display:table-header-group}</style>
      </head><body>${bodyHtml}<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script></body></html>`);
    printWin.document.close();
  }

  // Excel-экспорт маршрутного листа
  async function handleExcel() {
    const XLSX = await import('xlsx');

    const wb = XLSX.utils.book_new();

    items.forEach((it, idx) => {
      const rows = [
        ['Маршрутный лист', order.number],
        ['Получатель', order.customer],
        ['Ст. мастер', order.foreman || '—'],
        ['Дата создания', order.createdAt],
        ['Срок', order.dueDate],
        [],
        [`${idx+1}. ${escHtml(it.det.name)}`],
        [`Код: ${escHtml(it.det.code)}  Кол-во: ${it.quantity} ${escHtml(it.det.unit)}  Чертёж: ${escHtml(it.det.drawing)||'—'}`],
        [],
        ['№ оп.', 'Операция', 'Раб. центр', 'Кол-во', 'QR-код', 'Статус', 'Исполнитель', 'Подпись'],
        ...it.tasks.map(t => [
          String(t.opNum).padStart(3,'0'),
          t.opName,
          t.workCenter,
          t.planned,
          t.qrText,
          t.status === 'done' ? 'Выполнена' : t.status === 'in_progress' ? 'В работе' : 'Ожидает',
          t.operator || '',
          '',
        ]),
        [],
      ];

      const ws = XLSX.utils.aoa_to_sheet(rows);

      // Ширина столбцов
      ws['!cols'] = [
        {wch:8},{wch:30},{wch:20},{wch:8},{wch:22},{wch:14},{wch:20},{wch:16}
      ];

      const sheetName = it.det.code.slice(0, 31).replace(/[\\/\?\*\[\]]/g,'_');
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    // Сводный лист заказа
    const summaryRows = [
      ['МАРШРУТНЫЙ ЛИСТ — СВОДНЫЙ'],
      ['Заказ', order.number],
      ['Получатель', order.customer],
      ['Ст. мастер', order.foreman || '—'],
      ['Создан', order.createdAt],
      ['Срок', order.dueDate],
      [],
      ['Деталь', 'Код', 'Кол-во', 'Операций', 'Выполнено', 'В работе', 'Ожидает'],
      ...items.map(it => {
        const doneCt  = it.tasks.filter(t=>t.status==='done').length;
        const progCt  = it.tasks.filter(t=>t.status==='in_progress').length;
        const waitCt  = it.tasks.filter(t=>t.status==='waiting').length;
        return [it.det.name, it.det.code, it.quantity, it.tasks.length, doneCt, progCt, waitCt];
      }),
    ];
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
    summaryWs['!cols'] = [{wch:35},{wch:16},{wch:8},{wch:10},{wch:10},{wch:10},{wch:10}];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Сводный');

    XLSX.writeFile(wb, `МЛ-${order.number}-${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{S.routesheet} {order.number}</h1>
          <div className="page-sub">{S.preview} · A4</div>
        </div>
        <div className="row">
          <button className="btn ghost" onClick={onClose}><Icon name="arrow-left" size={14}/>{lang === 'en' ? 'Back' : 'К заказу'}</button>
          <button className="btn" onClick={handleExcel}><Icon name="table" size={14}/>Excel</button>
          <button className="btn" onClick={handlePrint}><Icon name="print" size={14}/>{lang === 'en' ? 'Print' : 'Печать'}</button>
          <button className="btn primary" onClick={handlePdf}><Icon name="download" size={14}/>PDF</button>
          <button className="btn primary" onClick={onScanQR}><Icon name="scan" size={14}/>{S.scanQR}</button>
        </div>
      </div>

      {/* Повторная печать */}
      <div className="card" style={{ maxWidth:880, margin:'0 auto 12px', padding:14 }}>
        {(() => {
          const allTasks = items.flatMap(it=>it.tasks);
          const done = allTasks.filter(t=>t.status==='done').length;
          return done > 0 ? (
            <div style={{ marginTop:10, padding:'6px 10px', background:'var(--bg-1)', borderRadius:6, fontSize:12,
              borderLeft:'3px solid var(--warning,#c07820)' }}>
              <b style={{ color:'var(--warning,#c07820)' }}>⟳ Повторная печать:</b> выполнено {done} из {allTasks.length} операций — закрытые будут отмечены ✓ на форме.
            </div>
          ) : null;
        })()}
      </div>

      {/* Превью маршрутного листа */}
      <div className="print-area" style={{ maxWidth:880, margin:'0 auto' }}>
        <div className="routesheet">
          <div className="rs-head">
            <div>
              <div className="rs-title">{S.sheetTitle}</div>
              <div className="rs-number">№ {order.number}</div>
              <div style={{ fontSize:11, color:'#5a5240', marginTop:4 }}>{S.sheetSubtitle}</div>
            </div>
            <div className="rs-meta">
              <span className="lbl">{S.customer}:</span><span>{order.customer}</span>
              <span className="lbl">{S.foreman}:</span><span>{order.foreman}</span>
              <span className="lbl">{S.created}:</span><span className="mono">{order.createdAt}</span>
              <span className="lbl">{S.dueDate}:</span><span className="mono">{order.dueDate}</span>
              <span className="lbl">{S.page}:</span><span className="mono">1 {S.of} 1</span>
            </div>
          </div>

          {items.map((it, idx) => (
            <React.Fragment key={it.detailId}>
              <div className="rs-detail-head">
                <div className="rs-detail-title">{idx+1}. {it.det.name}</div>
                <div className="rs-detail-meta">{it.det.code} · {S.qtyShort}: <b>{it.quantity}</b> {it.det.unit} · {it.det.drawing}</div>
              </div>
              <table className="rs-ops">
                <thead><tr>
                  <th style={{ width:38 }}>№</th>
                  <th>{S.operation}</th>
                  <th style={{ width:130 }}>{S.workCenter}</th>
                  <th style={{ width:50 }}>{S.qtyShort}</th>
                  <th style={{ width:qrSize+16 }}>{S.qrCode}</th>
                  <th style={{ width:100 }}>{S.signatureCol}</th>
                </tr></thead>
                <tbody>
                  {it.tasks.map(t => (
                    <tr key={t.id}>
                      <td className="mono"><b>{String(t.opNum).padStart(3,'0')}</b></td>
                      <td><b>{t.opName}</b>
                        <OperationNote task={t} />
                      </td>
                      <td className="mono" style={{ fontSize:10 }}>{t.workCenter}</td>
                      <td className="mono num"><b>{t.planned}</b></td>
                      <td className="qr-cell">
                        <QrCode text={t.qrText} size={qrSize}/>
                        <div className="mono" style={{ fontSize:7.5, color:'#7a715b', marginTop:2 }}>{t.qrText}</div>
                      </td>
                      <td className="sign-cell"/>
                    </tr>
                  ))}
                </tbody>
              </table>
            </React.Fragment>
          ))}

          <div className="rs-foot">
            <span>{S.signedBy} ________________________</span>
            <span>{S.date} ____________</span>
            <span className="mono">{order.number} · {new Date().toISOString().slice(0,10)}</span>
          </div>
        </div>
      </div>
    </>
  );
}

