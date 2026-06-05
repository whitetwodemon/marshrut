import React from 'react'
import { WorkCenterPreview } from './RouteSheet.jsx'
import { Icon } from '../components/Icon.jsx'
import { QrCode, generateQrSvg } from '../components/QrCode.jsx'
import { useStrings, StatusPill, OrderPicker } from '../lib/data.jsx'
import { api } from '../lib/api.js'

function OrderItemOpsEditor({ det, orderId, tasks, lang, onAdded, workCenters }) {
  const [expanded, setExpanded] = React.useState(true); // default expanded
  const [adding,   setAdding]   = React.useState(false);
  const [form,     setForm]     = React.useState({ name:'', workCenter:'', time:'', opNum:'' });
  const [saving,   setSaving]   = React.useState(false);

  const ops = [...(det.operations||[])].sort((a,b) => a.num - b.num);

  // Задания этой детали в заказе
  const detTasks = tasks.filter(t => t.orderId === orderId && t.detailId === det.id)
                        .sort((a,b) => a.opNum - b.opNum);

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
      const autoNum = Math.ceil((maxNum + 10) / 10) * 10;
      const newNum  = form.opNum ? Number(form.opNum) : autoNum;
      await api.post('/orders/' + orderId + '/add-task', {
        detail_id: det.id,
        op_num:    newNum,
        op_name:   form.name,
        work_center: form.workCenter,
        time_min:  Number(form.time) || 0,
      });
      setForm({ name:'', workCenter:'', time:'', opNum:'' });
      setAdding(false);
      setExpanded(true); // stay expanded so user sees new operation
      if (onAdded) await onAdded();
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

function OrderBuilder({ data, tasks, lang, onPrint, onSave, onDeleteOrder, onSelectOrder, activeOrderId, onRefresh, workCenters }) {
  const S = useStrings(lang);
  // Safe access: data or data.orders may be undefined during initial load
  const order = (data?.orders||[])[0];

  // Hooks MUST be before any conditional return (React rules)
  const [items, setItems]       = React.useState(() => (order?.items||[]).map(it => ({ ...it })));
  const [number]                = React.useState(order?.number   || '');
  const [customer, setCustomer] = React.useState(order?.customer || '');
  const [dueDate, setDueDate]   = React.useState(order?.dueDate  || '');
  const [foreman, setForeman]   = React.useState(order?.foreman  || '');
  const [adding, setAdding]     = React.useState(false);

  // Guard AFTER all hooks
  if (!order) return (
    <div style={{ padding:48, textAlign:'center', color:'var(--fg-2)' }}>
      <p style={{ marginBottom:16 }}>Нет активных заказов</p>
    </div>
  );

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
    const det = (data?.details||[]).find(d => d.id === it.detailId);
    return s + (det ? (det.operations||[]).length : 0);
  }, 0);
  const totalTime = items.reduce((s, it) => {
    const det = (data?.details||[]).find(d => d.id === it.detailId);
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
            {S.created} {order.createdAt} · <span className="pill prog" style={{padding:'1px 6px'}}><span className="dot"/>{lang === 'en' ? 'In progress' : 'В работе'}</span>
          </div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => onSelectOrder && onSelectOrder(order)}><Icon name="edit" size={14} />{lang === 'en' ? 'Edit' : 'Редактировать'}</button>
          <button className="btn" style={{ color:'var(--danger)' }} onClick={() => onDeleteOrder && onDeleteOrder(order)}><Icon name="trash" size={14} />{lang === 'en' ? 'Delete' : 'Удалить'}</button>
          <button className="btn" onClick={()=>onSave({items, number, customer, foreman, dueDate, status: order.status, priority: order.priority})}><Icon name="check" size={14} />{S.saveOrder}</button>
          <button className="btn primary" onClick={onPrint}><Icon name="print" size={14} />{S.generateSheet}</button>
        </div>
      </div>

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
              const det = (data?.details||[]).find(d => d.id === it.detailId);
              if (!det) return null;
              return (
                <div key={it.detailId} className="order-line">
                  <div>
                    <div className="order-line-name">{det.name}</div>
                    <div className="order-line-meta">
                      <span className="mono" style={{ color: 'var(--accent)' }}>{det.code}</span>
                      <span className="muted" style={{ marginLeft: 10 }}>{det.material}</span>
                    </div>
                    <OrderItemOpsEditor det={det} orderId={order.id} tasks={tasks} lang={lang} onAdded={onRefresh} workCenters={workCenters}/>
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
                  const det = (data?.details||[]).find(d => d.id === it.detailId);
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
        </div>
      </div>
    </>
  );
}

export { OrderBuilder }
