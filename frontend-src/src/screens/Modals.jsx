import React from 'react'
import { api, Auth, API_BASE } from '../lib/api.js'
import { Icon } from '../components/Icon.jsx'

function ModalEditDetail({ lang, detail, onClose, onSaved }) {
  const isEn = lang === 'en';
  const [code, setCode]         = React.useState(detail.code);
  const [name, setName]         = React.useState(detail.name);
  const [material, setMaterial] = React.useState(detail.material);
  const [unit, setUnit]         = React.useState(detail.unit || 'шт');
  const [drawing, setDrawing]   = React.useState(detail.drawing || '');
  const [ops, setOps]           = React.useState(
    (detail.operations||[]).map(o => ({ num: o.num, name: o.name, workCenter: o.workCenter||o.work_center||'', time: Number(o.time||o.time_min||0) }))
  );
  const [saving, setSaving] = React.useState(false);
  const [err, setErr]       = React.useState('');

  const addOp    = () => setOps(p => [...p, { num:(p[p.length-1]?.num||0)+10, name:'', workCenter:'', time:0 }]);
  const removeOp = idx => setOps(p => p.filter((_,i)=>i!==idx));
  const updateOp = (idx,k,v) => setOps(p => p.map((o,i)=>i===idx?{...o,[k]:v}:o));

  async function handleSave() {
    if (!code||!name||!material) { setErr(isEn?'Fill required fields':'Заполните обязательные поля'); return; }
    setSaving(true); setErr('');
    try {
      await api.put('/details/'+detail.id, {
        code, name, material, unit, drawing,
        operations: ops.filter(o=>o.name).map(o=>({ num:Number(o.num), name:o.name, work_center:o.workCenter, time_min:Number(o.time) })),
      });
      onSaved(); onClose();
    } catch(e) { setErr(e.message); }
    setSaving(false);
  }

  return (
    <div style={{ position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center' }}>
      <div className="card" style={{ width:640,maxHeight:'90vh',overflowY:'auto',padding:24,display:'flex',flexDirection:'column',gap:14 }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <b style={{ fontSize:16 }}>{isEn?'Edit Part':'Редактировать деталь'}</b>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={16}/></button>
        </div>
        <div className="grid-3" style={{ gap:10 }}>
          <div className="field"><span className="field-label">{isEn?'Code *':'Код *'}</span><input className="input" value={code} onChange={e=>setCode(e.target.value)}/></div>
          <div className="field"><span className="field-label">{isEn?'Unit':'Ед.'}</span><input className="input" value={unit} onChange={e=>setUnit(e.target.value)}/></div>
          <div className="field"><span className="field-label">{isEn?'Drawing':'Чертёж'}</span><input className="input" value={drawing} onChange={e=>setDrawing(e.target.value)}/></div>
        </div>
        <div className="field"><span className="field-label">{isEn?'Name *':'Наименование *'}</span><input className="input" value={name} onChange={e=>setName(e.target.value)}/></div>
        <div className="field"><span className="field-label">{isEn?'Material *':'Материал *'}</span><input className="input" value={material} onChange={e=>setMaterial(e.target.value)}/></div>
        <div>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
            <b style={{ fontSize:13 }}>{isEn?'Operations':'Операции'}</b>
            <button className="btn ghost" onClick={addOp}><Icon name="plus" size={13}/>{isEn?'Add':'Добавить'}</button>
          </div>
          <table className="tbl" style={{ fontSize:12 }}>
            <thead><tr><th style={{width:48}}>№</th><th>{isEn?'Operation':'Операция'}</th><th>{isEn?'Work center':'Раб. центр'}</th><th style={{width:64}}>{isEn?'Min':'Мин'}</th><th style={{width:32}}></th></tr></thead>
            <tbody>{ops.map((op,idx)=>(
              <tr key={idx}>
                <td><input className="input" type="number" value={op.num} onChange={e=>updateOp(idx,'num',e.target.value)} style={{width:44,padding:'2px 4px'}}/></td>
                <td><input className="input" value={op.name} onChange={e=>updateOp(idx,'name',e.target.value)} style={{width:'100%'}}/></td>
                <td><input className="input" value={op.workCenter} onChange={e=>updateOp(idx,'workCenter',e.target.value)} style={{width:'100%'}}/></td>
                <td><input className="input" type="number" min="0" value={op.time} onChange={e=>updateOp(idx,'time',e.target.value)} style={{width:52,padding:'2px 4px'}}/></td>
                <td><button className="icon-btn" onClick={()=>removeOp(idx)}><Icon name="trash" size={12}/></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {err && <div style={{ color:'var(--danger)',fontSize:12 }}>{err}</div>}
        <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
          <button className="btn" onClick={onClose}>{isEn?'Cancel':'Отмена'}</button>
          <button className="btn primary" onClick={handleSave} disabled={saving}>{saving?(isEn?'Saving…':'Сохранение…'):(isEn?'Save':'Сохранить')}</button>
        </div>
      </div>
    </div>
  );
}

function ModalEditOrder({ lang, order, details, workshops, onClose, onSaved }) {
  const isEn = lang === 'en';
  const [number, setNumber]     = React.useState(order.number);
  const [customer, setCustomer] = React.useState(order.customer);
  const [foreman, setForeman]   = React.useState(order.foreman || '');
  const [dueDate, setDueDate]   = React.useState(order.dueDate || order.due_date || '');
  const [status, setStatus]     = React.useState(order.status);
  const [priority, setPriority] = React.useState(order.priority || 'normal');
  const [workshopId, setWorkshopId] = React.useState(order.workshop_id || order.workshopId || '');
  const [comment, setComment]   = React.useState(order.comment || '');
  const [items, setItems]       = React.useState(
    (order.items||[]).map(i => ({ detailId: i.detailId||i.detail_id, quantity: Number(i.quantity) }))
  );
  const [saving, setSaving] = React.useState(false);
  const [err, setErr]       = React.useState('');

  const addItem    = () => setItems(p=>[...p,{detailId:'',quantity:1}]);
  const removeItem = idx => setItems(p=>p.filter((_,i)=>i!==idx));
  const updateItem = (idx,k,v) => setItems(p=>p.map((it,i)=>i===idx?{...it,[k]:v}:it));

  async function handleSave() {
    if (!number||!dueDate) { setErr(isEn?'Fill required fields':'Заполните обязательные поля'); return; }
    setSaving(true); setErr('');
    try {
      await api.put('/orders/'+order.id, {
        number, customer, foreman, due_date:dueDate, status, priority,
        workshop_id: workshopId ? Number(workshopId) : null,
        comment: comment || null,
        items: items.filter(i=>i.detailId).map(i=>({ detail_id:i.detailId, quantity:Number(i.quantity) })),
      });
      onSaved(); onClose();
    } catch(e) { setErr(e.message); }
    setSaving(false);
  }

  const STATUS_OPTS = [
    ['draft','Черновик'],['plan','Планируется'],
    ['waiting_material','Ждём материал'],['waiting_equipment','Ждём оборудование'],
    ['waiting_approval','Ждём согласование'],['in_work','В работе'],
    ['paused','Приостановлен'],['done','Выполнен'],['cancelled','Отменён'],
  ];
  const PRIORITY_OPTS = [['low','Низкий'],['normal','Нормальный'],['high','Высокий']];

  return (
    <div style={{ position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center' }}>
      <div className="card" style={{ width:560,maxHeight:'90vh',overflowY:'auto',padding:24,display:'flex',flexDirection:'column',gap:14 }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <b style={{ fontSize:16 }}>{isEn?'Edit Order':'Редактировать заказ'} <span className="mono" style={{color:'var(--accent)'}}>{order.number}</span></b>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={16}/></button>
        </div>
        <div className="grid-3" style={{ gap:10 }}>
          <div className="field"><span className="field-label">{isEn?'Number *':'Номер *'}</span><input className="input" value={number} onChange={e=>setNumber(e.target.value)}/></div>
          <div className="field"><span className="field-label">{isEn?'Due date *':'Срок *'}</span><input className="input" type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></div>
          <div className="field"><span className="field-label">{isEn?'Foreman':'Ст. мастер'}</span><input className="input" value={foreman} onChange={e=>setForeman(e.target.value)}/></div>
        </div>
        <div className="field"><span className="field-label">Назначение</span><input className="input" value={customer} onChange={e=>setCustomer(e.target.value)} placeholder="Необязательно"/></div>
        <div className="grid-2" style={{ gap:10 }}>
          <div className="field">
            <span className="field-label">Рабочий центр заказа</span>
            <select className="select" value={workshopId} onChange={e=>setWorkshopId(e.target.value)}>
              <option value="">Не выбран</option>
              {(workshops||[]).filter(w=>w.is_active).map(w=>(
                <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="field-label">Комментарий</span>
            <input className="input" value={comment} onChange={e=>setComment(e.target.value)} placeholder="Примечание к заказу…"/>
          </div>
        </div>
        <div className="grid-3" style={{ gap:10 }}>
          <div className="field"><span className="field-label">{isEn?'Status':'Статус'}</span>
            <select className="select" value={status} onChange={e=>setStatus(e.target.value)} style={{width:'100%'}}>
              {STATUS_OPTS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select></div>
          <div className="field"><span className="field-label">{isEn?'Priority':'Приоритет'}</span>
            <select className="select" value={priority} onChange={e=>setPriority(e.target.value)} style={{width:'100%'}}>
              {PRIORITY_OPTS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select></div>
        </div>
        <div>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
            <b style={{ fontSize:13 }}>{isEn?'Parts':'Детали'}</b>
            <button className="btn ghost" onClick={addItem}><Icon name="plus" size={13}/>{isEn?'Add':'Добавить'}</button>
          </div>
          {items.map((it,idx)=>(
            <div key={idx} style={{ display:'flex',gap:8,marginBottom:6,alignItems:'center' }}>
              <select className="select" style={{flex:1}} value={it.detailId} onChange={e=>updateItem(idx,'detailId',e.target.value)}>
                <option value="">{isEn?'Select part…':'Выбрать деталь…'}</option>
                {details.map(d=><option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
              </select>
              <input className="input" type="number" min="1" value={it.quantity} onChange={e=>updateItem(idx,'quantity',e.target.value)} style={{width:64}}/>
              <button className="icon-btn" onClick={()=>removeItem(idx)}><Icon name="trash" size={13}/></button>
            </div>
          ))}
        </div>
        {err && <div style={{ color:'var(--danger)',fontSize:12 }}>{err}</div>}
        <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
          <button className="btn" onClick={onClose}>{isEn?'Cancel':'Отмена'}</button>
          <button className="btn primary" onClick={handleSave} disabled={saving}>{saving?(isEn?'Saving…':'Сохранение…'):(isEn?'Save':'Сохранить')}</button>
        </div>
      </div>
    </div>
  );
}

function ModalNewOrder({ lang, details, workshops, onClose, onCreated }) {
  const isEn = lang === 'en';
  const [orderType,  setOrderType]  = React.useState('W');
  const [number,     setNumber]     = React.useState('');
  const [customer,   setCustomer]   = React.useState('');
  const [foreman,    setForeman]    = React.useState('');
  const [dueDate,    setDueDate]    = React.useState('');
  const [status,     setStatus]     = React.useState('plan');
  const [priority,   setPriority]   = React.useState('normal');
  const [workshopId, setWorkshopId] = React.useState('');
  const [comment,    setComment]    = React.useState('');
  const [items,      setItems]      = React.useState([{ detailId:'', quantity:1 }]);
  const [saving,     setSaving]     = React.useState(false);
  const [err,        setErr]        = React.useState('');

  // Автонумерация при открытии или смене типа
  React.useEffect(() => {
    api.post('/orders/next-number', { type: orderType })
       .then(r => setNumber(r.number)).catch(()=>{});
  }, [orderType]);

  const ORDER_STATUSES = [
    { v:'draft',              l:'Черновик' },
    { v:'plan',               l:'Планируется' },
    { v:'waiting_material',   l:'Ждём материал' },
    { v:'waiting_equipment',  l:'Ждём оборудование' },
    { v:'waiting_approval',   l:'Ждём согласование' },
    { v:'in_work',            l:'В работе' },
    { v:'paused',             l:'Приостановлен' },
  ];

  const needsComment = ['waiting_material','waiting_equipment','waiting_approval'].includes(status);

  const addItem    = () => setItems(p=>[...p,{detailId:'',quantity:1}]);
  const removeItem = idx => setItems(p=>p.filter((_,i)=>i!==idx));
  const updateItem = (idx,k,v) => setItems(p=>p.map((it,i)=>i===idx?{...it,[k]:v}:it));

  async function handleSave() {
    if (!number||!dueDate) { setErr('Заполните обязательные поля'); return; }
    const validItems = items.filter(i=>i.detailId);
    if (!validItems.length) { setErr('Добавьте хотя бы одну деталь'); return; }
    if (needsComment && !comment.trim()) { setErr('Укажите причину ожидания в комментарии'); return; }
    setSaving(true); setErr('');
    try {
      await api.post('/orders', {
        number, order_type: orderType, customer, foreman,
        due_date:    dueDate,
        created_at:  new Date().toISOString().slice(0,10),
        status,
        priority,
        workshop_id: workshopId ? Number(workshopId) : null,
        comment:     comment || null,
        items: validItems.map(i=>({ detail_id:i.detailId, quantity:Number(i.quantity) })),
      });
      onCreated(); onClose();
    } catch(e) { setErr(e.message); }
    setSaving(false);
  }

  return (
    <div className="modal-back" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:560 }}>
        <div className="modal-head">
          <b style={{ fontSize:16 }}>Новый заказ</b>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16}/></button>
        </div>
        <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:12 }}>

          {/* Основные поля */}
          <div className="grid-3" style={{ gap:10 }}>
            <div className="field">
              <span className="field-label">Тип заказа</span>
              <select className="select" value={orderType} onChange={e => setOrderType(e.target.value)}>
                <option value="W">W — Заказ</option>
                <option value="D">D — Доработка</option>
                <option value="K">K — Кооперация</option>
              </select>
            </div>
            <div className="field">
              <span className="field-label">Номер (авто)</span>
              <input className="input mono" value={number} readOnly
                style={{ color:'var(--accent)', fontWeight:700, opacity:.85, cursor:'not-allowed' }}/>
            </div>
            <div className="field"><span className="field-label">Срок *</span>
              <input className="input" type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/>
            </div>
            <div className="field"><span className="field-label">Приоритет</span>
              <select className="select" value={priority} onChange={e=>setPriority(e.target.value)}>
                <option value="low">Низкий</option>
                <option value="normal">Нормальный</option>
                <option value="high">Высокий</option>
              </select>
            </div>
          </div>

          <div className="field"><span className="field-label">Назначение / Получатель</span>
            <input className="input" value={customer} onChange={e=>setCustomer(e.target.value)} placeholder="Назначение заказа (необязательно)"/>
          </div>

          <div className="grid-2" style={{ gap:10 }}>
            <div className="field"><span className="field-label">Ст. мастер</span>
              <input className="input" value={foreman} onChange={e=>setForeman(e.target.value)}/>
            </div>
            <div className="field"><span className="field-label">Цех</span>
              <select className="select" value={workshopId} onChange={e=>setWorkshopId(e.target.value)}>
                <option value="">Не выбран</option>
                {(workshops||[]).filter(w=>w.is_active).map(w=>(
                  <option key={w.id} value={w.id}>{w.code} — {w.name.split('—')[0].trim()}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Статус */}
          <div className="field">
            <span className="field-label">Статус</span>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {ORDER_STATUSES.map(s=>(
                <button key={s.v} onClick={()=>setStatus(s.v)}
                  style={{ padding:'5px 10px', borderRadius:7, border:'1px solid', fontSize:12,
                    cursor:'pointer', fontFamily:'var(--ui-font)',
                    background: status===s.v ? 'var(--accent)' : 'var(--bg-1)',
                    borderColor: status===s.v ? 'var(--accent)' : 'var(--line-1)',
                    color: status===s.v ? '#fff' : 'var(--fg-1)' }}>
                  {s.l}
                </button>
              ))}
            </div>
          </div>

          {/* Комментарий (обязателен для статусов ожидания) */}
          <div className="field">
            <span className="field-label">
              Комментарий{needsComment ? ' *' : ''}
              {needsComment && <span style={{ fontSize:10, color:'var(--danger)', marginLeft:4 }}>обязателен для этого статуса</span>}
            </span>
            <textarea className="input" value={comment} onChange={e=>setComment(e.target.value)}
              placeholder={needsComment ? 'Укажите причину ожидания…' : 'Дополнительная информация…'}
              style={{ resize:'vertical', minHeight:60 }}/>
          </div>

          {/* Детали */}
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <b style={{ fontSize:13 }}>Детали</b>
              <button className="btn ghost" onClick={addItem}><Icon name="plus" size={13}/>Добавить</button>
            </div>
            {items.map((it,idx)=>(
              <div key={idx} style={{ display:'flex', gap:8, marginBottom:6, alignItems:'center' }}>
                <select className="select" style={{flex:1}} value={it.detailId} onChange={e=>updateItem(idx,'detailId',e.target.value)}>
                  <option value="">Выбрать деталь…</option>
                  {details.map(d=><option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
                </select>
                <input className="input" type="number" min="1" value={it.quantity}
                  onChange={e=>updateItem(idx,'quantity',e.target.value)} style={{width:64}}/>
                <button className="icon-btn" onClick={()=>removeItem(idx)}><Icon name="trash" size={13}/></button>
              </div>
            ))}
          </div>

          {err && <div style={{ color:'var(--danger)', fontSize:12 }}>{err}</div>}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Отмена</button>
          <button className="btn primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Сохранение…' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalNewDetail({ lang, onClose, onCreated }) {
  const isEn = lang === 'en';
  const [code, setCode]         = React.useState('');
  const [name, setName]         = React.useState('');
  const [material, setMaterial] = React.useState('');
  const [unit, setUnit]         = React.useState('шт');
  const [drawing, setDrawing]   = React.useState('');
  const [ops, setOps]           = React.useState([{ num:10, name:'', workCenter:'', time:0 }]);
  const [saving, setSaving]     = React.useState(false);
  const [err, setErr]           = React.useState('');

  const addOp    = () => setOps(p=>[...p,{num:(p[p.length-1]?.num||0)+10,name:'',workCenter:'',time:0}]);
  const removeOp = idx => setOps(p=>p.filter((_,i)=>i!==idx));
  const updateOp = (idx,k,v) => setOps(p=>p.map((o,i)=>i===idx?{...o,[k]:v}:o));

  async function handleSave() {
    if (!code||!name||!material) { setErr(isEn?'Fill required fields':'Заполните обязательные поля'); return; }
    setSaving(true); setErr('');
    try {
      await api.post('/details', {
        code, name, material, unit, drawing,
        operations: ops.filter(o=>o.name).map(o=>({ num:Number(o.num), name:o.name, work_center:o.workCenter, time_min:Number(o.time) })),
      });
      onCreated(); onClose();
    } catch(e) { setErr(e.message); }
    setSaving(false);
  }

  return (
    <div style={{ position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center' }}>
      <div className="card" style={{ width:640,maxHeight:'90vh',overflowY:'auto',padding:24,display:'flex',flexDirection:'column',gap:14 }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <b style={{ fontSize:16 }}>{isEn?'New Part':'Новая деталь'}</b>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={16}/></button>
        </div>
        <div className="grid-3" style={{ gap:10 }}>
          <div className="field"><span className="field-label">{isEn?'Code *':'Код *'}</span><input className="input" value={code} onChange={e=>setCode(e.target.value)} placeholder="ФЛ-100-08"/></div>
          <div className="field"><span className="field-label">{isEn?'Unit':'Ед.'}</span><input className="input" value={unit} onChange={e=>setUnit(e.target.value)}/></div>
          <div className="field"><span className="field-label">{isEn?'Drawing':'Чертёж'}</span><input className="input" value={drawing} onChange={e=>setDrawing(e.target.value)}/></div>
        </div>
        <div className="field"><span className="field-label">{isEn?'Name *':'Наименование *'}</span><input className="input" value={name} onChange={e=>setName(e.target.value)}/></div>
        <div className="field"><span className="field-label">{isEn?'Material *':'Материал *'}</span><input className="input" value={material} onChange={e=>setMaterial(e.target.value)}/></div>
        <div>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
            <b style={{ fontSize:13 }}>{isEn?'Operations':'Операции'}</b>
            <button className="btn ghost" onClick={addOp}><Icon name="plus" size={13}/>{isEn?'Add':'Добавить'}</button>
          </div>
          <table className="tbl" style={{ fontSize:12 }}>
            <thead><tr><th style={{width:48}}>№</th><th>{isEn?'Operation':'Операция'}</th><th>{isEn?'Work center':'Раб. центр'}</th><th style={{width:64}}>{isEn?'Min':'Мин'}</th><th style={{width:32}}></th></tr></thead>
            <tbody>{ops.map((op,idx)=>(
              <tr key={idx}>
                <td><input className="input" type="number" value={op.num} onChange={e=>updateOp(idx,'num',e.target.value)} style={{width:44,padding:'2px 4px'}}/></td>
                <td><input className="input" value={op.name} onChange={e=>updateOp(idx,'name',e.target.value)} placeholder={isEn?'Turning':'Токарная'} style={{width:'100%'}}/></td>
                <td><input className="input" value={op.workCenter} onChange={e=>updateOp(idx,'workCenter',e.target.value)} placeholder="ДИП-300 №3" style={{width:'100%'}}/></td>
                <td><input className="input" type="number" min="0" value={op.time} onChange={e=>updateOp(idx,'time',e.target.value)} style={{width:52,padding:'2px 4px'}}/></td>
                <td><button className="icon-btn" onClick={()=>removeOp(idx)}><Icon name="trash" size={12}/></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {err && <div style={{ color:'var(--danger)',fontSize:12 }}>{err}</div>}
        <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
          <button className="btn" onClick={onClose}>{isEn?'Cancel':'Отмена'}</button>
          <button className="btn primary" onClick={handleSave} disabled={saving}>{saving?(isEn?'Saving…':'Сохранение…'):(isEn?'Create':'Создать')}</button>
        </div>
      </div>
    </div>
  );
}

const ROLE_COLORS = {
  admin: 'var(--accent)',
  foreman: '#3b82f6',
  operator: '#10b981',
  viewer: 'var(--fg-2)',
};


function AdminPanel({ lang, onBack }) {
  const [tab, setTab]               = React.useState('users');
  const [users, setUsers]           = React.useState([]);
  const [roles, setRoles]           = React.useState([]);
  const [permissions, setPerms]     = React.useState([]);
  const [orders, setOrders]         = React.useState([]);
  const [details, setDetails]       = React.useState([]);
  const [workshops, setWorkshops]   = React.useState([]);
  const [equipment, setEquipment]   = React.useState([]);
  const [eqForm, setEqForm]         = React.useState({ workshop_id:'', code:'', name:'', type:'' });
  const [editUser, setEditUser]     = React.useState(null);
  const [editRole, setEditRole]     = React.useState(null);
  const [editOrder, setEditOrder]   = React.useState(null);
  const [editDetail, setEditDetail] = React.useState(null);
  const [loading, setLoading]       = React.useState(true);
  const [toast, setToast]           = React.useState('');
  const [confirm, setConfirm]       = React.useState(null);

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(''), 3000); }

  async function load() {
    setLoading(true);
    try {
      const [ur, rr, pr, or_, dr] = await Promise.all([
        api.get('/admin/users'), api.get('/admin/roles'), api.get('/admin/permissions'),
        api.get('/orders'), api.get('/details'),
        api.get('/workshops'), api.get('/equipment'),
      ]);
      setUsers(ur.data); setRoles(rr.data); setPerms(pr.data);
      setOrders(or_.data); setDetails(dr.data);
    } catch(e) { showToast('Ошибка: '+e.message); }
    setLoading(false);
  }
  React.useEffect(()=>{ load(); }, []);

  // ── User Editor ────────────────────────────────────────────────────
  function UserEditor({ user, roles, onSave, onClose }) {
    const isNew = !user?.id;
    const [name,     setName]     = React.useState(user?.name    || '');
    const [email,    setEmail]    = React.useState(user?.email   || '');
    const [roleId,   setRoleId]   = React.useState(user?.role_id || 3);
    const [active,   setActive]   = React.useState(user?.is_active ?? 1);
    const [password, setPassword] = React.useState('');
    const [err, setErr]           = React.useState('');
    const [saving, setSaving]     = React.useState(false);

    async function save() {
      setSaving(true); setErr('');
      try {
        const body = { name, email, role_id:Number(roleId), is_active:Number(active) };
        if (password) body.password = password;
        if (isNew) { body.password = password || 'Password1!'; await api.post('/admin/users', body); }
        else { await api.put('/admin/users/'+user.id, body); }
        onSave(); onClose();
      } catch(e) { setErr(e.message); }
      setSaving(false);
    }

    return (
      <div style={{ position:'fixed',inset:0,zIndex:2000,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center' }}>
        <div className="card" style={{ width:420,padding:24,display:'flex',flexDirection:'column',gap:14 }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
            <b style={{ fontSize:15 }}>{isNew?'Новый пользователь':'Редактировать'}</b>
            <button className="icon-btn" onClick={onClose}><Icon name="close" size={16}/></button>
          </div>
          <div className="field"><span className="field-label">Имя *</span><input className="input" value={name} onChange={e=>setName(e.target.value)}/></div>
          <div className="field"><span className="field-label">Email *</span><input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)}/></div>
          <div className="field"><span className="field-label">{isNew?'Пароль *':'Новый пароль (пусто = не менять)'}</span><input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)}/></div>
          <div className="field"><span className="field-label">Роль</span>
            <select className="select" value={roleId} onChange={e=>setRoleId(e.target.value)} style={{width:'100%'}}>
              {roles.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}
            </select></div>
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            <input type="checkbox" id="ua" checked={!!active} onChange={e=>setActive(e.target.checked?1:0)}/>
            <label htmlFor="ua" style={{ fontSize:13,cursor:'pointer' }}>Активен</label>
          </div>
          {err && <div style={{ fontSize:12,color:'var(--danger)' }}>{err}</div>}
          <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
            <button className="btn" onClick={onClose}>Отмена</button>
            <button className="btn primary" onClick={save} disabled={saving}>{saving?'Сохранение…':'Сохранить'}</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Role Editor ────────────────────────────────────────────────────
  function RoleEditor({ role, allPermissions, onSave, onClose }) {
    const grouped = allPermissions.reduce((acc,p)=>{ (acc[p.group_name]=acc[p.group_name]||[]).push(p); return acc; }, {});
    const groupLabels = { orders:'Заказы', details:'Номенклатура', scanner:'Сканер', log:'Журнал', admin:'Администрирование' };
    const [selected, setSelected] = React.useState(new Set(role.permissions));
    const [saving, setSaving] = React.useState(false);

    function toggle(name) { setSelected(prev=>{ const s=new Set(prev); s.has(name)?s.delete(name):s.add(name); return s; }); }

    async function save() {
      setSaving(true);
      try { await api.put('/admin/roles/'+role.id+'/permissions', { permissions:[...selected] }); onSave(); onClose(); }
      catch(e) { alert(e.message); }
      setSaving(false);
    }

    return (
      <div style={{ position:'fixed',inset:0,zIndex:2000,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center' }}>
        <div className="card" style={{ width:500,maxHeight:'80vh',overflowY:'auto',padding:24,display:'flex',flexDirection:'column',gap:16 }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
            <b style={{ fontSize:15 }}>Права: {role.label}</b>
            <button className="icon-btn" onClick={onClose}><Icon name="close" size={16}/></button>
          </div>
          {Object.entries(grouped).map(([grp, perms])=>(
            <div key={grp}>
              <div className="subhead" style={{ margin:'0 0 6px' }}>{groupLabels[grp]||grp}</div>
              {perms.map(p=>(
                <label key={p.name} style={{ display:'flex',alignItems:'center',gap:8,padding:'5px 0',cursor:'pointer',fontSize:13 }}>
                  <input type="checkbox" checked={selected.has(p.name)} onChange={()=>toggle(p.name)}/>
                  {p.label}
                  <span className="mono muted" style={{ fontSize:11,marginLeft:'auto' }}>{p.name}</span>
                </label>
              ))}
            </div>
          ))}
          <div style={{ display:'flex',gap:8,justifyContent:'flex-end',paddingTop:8,borderTop:'1px solid var(--line-2)' }}>
            <button className="btn" onClick={onClose}>Отмена</button>
            <button className="btn primary" onClick={save} disabled={saving}>{saving?'Сохранение…':'Сохранить'}</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Confirm Dialog ─────────────────────────────────────────────────
  function ConfirmDialog({ title, message, onConfirm, onClose }) {
    return (
      <div style={{ position:'fixed',inset:0,zIndex:3000,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center' }}>
        <div className="card" style={{ width:380,padding:24,display:'flex',flexDirection:'column',gap:16 }}>
          <b style={{ fontSize:15 }}>{title}</b>
          <p style={{ fontSize:13,color:'var(--fg-1)',margin:0 }}>{message}</p>
          <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
            <button className="btn" onClick={onClose}>Отмена</button>
            <button className="btn primary" style={{ background:'var(--danger)',borderColor:'var(--danger)' }}
              onClick={()=>{ onConfirm(); onClose(); }}>Удалить</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Tab: Orders ────────────────────────────────────────────────────
  function OrdersTab() {
    const STATUS_LABEL = { plan:'Планируется', in_work:'В работе', done:'Выполнен' };
    const PRIORITY_LABEL = { high:'Высокий', normal:'Нормальный', low:'Низкий' };
    return (
      <>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
          <b style={{ fontSize:16 }}>Заказы ({orders.length})</b>
          <button className="btn primary" onClick={()=>setModal('newOrder')}>
            <Icon name="plus" size={14}/>Новый заказ
          </button>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>
              <th>Номер</th><th>Получатель</th><th>Статус</th><th>Срок</th><th>Приоритет</th><th style={{width:100}}></th>
            </tr></thead>
            <tbody>
              {orders.map(o=>(
                <tr key={o.id} className="row-hover">
                  <td><span className="mono" style={{fontWeight:600,color:'var(--accent)'}}>{o.number}</span></td>
                  <td style={{fontSize:12}}>{o.customer}</td>
                  <td>
                    <select className="select" value={o.status} style={{fontSize:11,padding:'2px 6px'}}
                      onChange={async e=>{
                        try { await api.put('/orders/'+o.id,{...o,due_date:o.due_date||o.dueDate,status:e.target.value}); load(); }
                        catch(err){ showToast('Ошибка: '+err.message); }
                      }}>
                      <option value="plan">Планируется</option>
                      <option value="in_work">В работе</option>
                      <option value="done">Выполнен</option>
                    </select>
                  </td>
                  <td className="muted" style={{fontSize:12}}>{o.due_date||o.dueDate}</td>
                  <td>
                    <select className="select" value={o.priority||'normal'} style={{fontSize:11,padding:'2px 6px'}}
                      onChange={async e=>{
                        try { await api.put('/orders/'+o.id,{...o,due_date:o.due_date||o.dueDate,priority:e.target.value}); load(); }
                        catch(err){ showToast('Ошибка: '+err.message); }
                      }}>
                      <option value="low">Низкий</option>
                      <option value="normal">Нормальный</option>
                      <option value="high">Высокий</option>
                    </select>
                  </td>
                  <td>
                    <div style={{display:'flex',gap:4}}>
                      <button className="icon-btn" title="Редактировать"
                        onClick={()=>setEditOrder({...o,dueDate:o.due_date||o.dueDate,items:o.items||[]})}>
                        <Icon name="edit" size={14}/>
                      </button>
                      <button className="icon-btn" style={{color:'var(--danger)'}} title="Удалить"
                        onClick={()=>setConfirm({
                          title:'Удалить заказ?',
                          message:`Заказ ${o.number} и все его задания будут удалены безвозвратно.`,
                          onConfirm: async()=>{ await api.delete('/orders/'+o.id); load(); showToast('Заказ удалён'); }
                        })}>
                        <Icon name="trash" size={14}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  // ── Tab: Details ───────────────────────────────────────────────────
  function DetailsTab() {
    return (
      <>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
          <b style={{ fontSize:16 }}>Номенклатура ({details.length})</b>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>
              <th>Код</th><th>Наименование</th><th>Материал</th><th className="num-col">Операций</th><th style={{width:100}}></th>
            </tr></thead>
            <tbody>
              {details.map(d=>(
                <tr key={d.id} className="row-hover">
                  <td><span className="mono" style={{fontWeight:600,color:'var(--accent)'}}>{d.code}</span></td>
                  <td style={{fontSize:13}}>{d.name}</td>
                  <td className="muted" style={{fontSize:12}}>{d.material}</td>
                  <td className="num-col"><span className="num">{(d.operations||[]).length}</span></td>
                  <td>
                    <div style={{display:'flex',gap:4}}>
                      <button className="icon-btn" title="Редактировать"
                        onClick={()=>setEditDetail({...d, operations:(d.operations||[]).map(op=>({
                          num:Number(op.num), name:op.name,
                          workCenter:op.work_center||op.workCenter||'',
                          time:Number(op.time_min||op.time||0)
                        }))})}>
                        <Icon name="edit" size={14}/>
                      </button>
                      <button className="icon-btn" style={{color:'var(--danger)'}} title="Удалить"
                        onClick={()=>setConfirm({
                          title:'Удалить деталь?',
                          message:`Деталь "${d.name}" будет удалена безвозвратно.`,
                          onConfirm: async()=>{ await api.delete('/details/'+d.id); load(); showToast('Деталь удалена'); }
                        })}>
                        <Icon name="trash" size={14}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  const [modal, setModal] = React.useState(null);

  return (
    <div style={{ minHeight:'100vh',background:'var(--bg-0)',fontFamily:'var(--ui-font)' }}>
      <div style={{ background:'var(--bg-1)',borderBottom:'1px solid var(--line-2)',padding:'12px 24px',display:'flex',alignItems:'center',gap:16 }}>
        <button className="btn" onClick={onBack}><Icon name="close" size={14}/>Выход из панели</button>
        <b style={{ fontSize:15 }}>Панель администратора</b>
        <div style={{ display:'flex',gap:4,marginLeft:'auto' }}>
          {[['users','Пользователи'],['roles','Роли и права'],['equipment','Оборудование'],['orders','Заказы'],['details','Номенклатура']].map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)}
              className={'btn'+(tab===t?' primary':'')} style={{ fontSize:13 }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:24,maxWidth:960,margin:'0 auto' }}>
        {loading ? (
          <div style={{ textAlign:'center',padding:48,color:'var(--fg-2)' }}>Загрузка…</div>
        ) : tab === 'users' ? (
          <>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
              <b style={{ fontSize:16 }}>Пользователи ({users.length})</b>
              <button className="btn primary" onClick={()=>setEditUser({})}><Icon name="plus" size={14}/>Добавить</button>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>Имя</th><th>Email</th><th>Роль</th><th>Активен</th><th>Последний вход</th><th style={{width:80}}></th></tr></thead>
                <tbody>{users.map(u=>(
                  <tr key={u.id} className="row-hover">
                    <td><b>{u.name}</b></td>
                    <td className="muted mono" style={{fontSize:12}}>{u.email}</td>
                    <td><span style={{ fontSize:12,fontWeight:600,color:ROLE_COLORS[u.role]||'var(--fg-1)' }}>{u.role_label}</span></td>
                    <td>{u.is_active ? <span style={{color:'#10b981'}}>✓</span> : <span style={{color:'var(--danger)'}}>✗</span>}</td>
                    <td className="muted" style={{fontSize:12}}>{u.last_login?u.last_login.slice(0,16):'—'}</td>
                    <td><button className="icon-btn" onClick={()=>setEditUser(u)}><Icon name="dots" size={14}/></button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </>
        ) : tab === 'roles' ? (
          <>
            <div style={{ marginBottom:16 }}>
              <b style={{ fontSize:16 }}>Роли и права доступа</b>
              <p style={{ fontSize:13,color:'var(--fg-2)',marginTop:4 }}>Нажмите на роль чтобы редактировать её права</p>
            </div>
            <div style={{ display:'grid',gap:12 }}>
              {roles.map(role=>(
                <div key={role.id} className="card" style={{ padding:18 }}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                      <span style={{ fontSize:14,fontWeight:700,color:ROLE_COLORS[role.name]||'var(--fg-0)' }}>{role.label}</span>
                      <span className="mono muted" style={{ fontSize:11 }}>{role.name}</span>
                    </div>
                    <button className="btn" onClick={()=>setEditRole(role)}><Icon name="cog" size={14}/>Права</button>
                  </div>
                  <div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
                    {role.permissions.map(p=>(<span key={p} className="tag mono" style={{ fontSize:11 }}>{p}</span>))}
                    {!role.permissions.length && <span className="muted" style={{fontSize:12}}>Нет прав</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : tab === 'orders' ? (
          <OrdersTab />
        ) : tab === 'details' ? (
          <DetailsTab />
        ) : null}
      </div>

      {editUser   !== null && <UserEditor user={editUser} roles={roles} onSave={()=>{load();showToast('Сохранено');}} onClose={()=>setEditUser(null)}/>}
      {editRole   !== null && <RoleEditor role={editRole} allPermissions={permissions} onSave={()=>{load();showToast('Права обновлены');}} onClose={()=>setEditRole(null)}/>}
      {editOrder  !== null && <ModalEditOrder lang="ru" order={editOrder} details={details} onClose={()=>setEditOrder(null)} onSaved={()=>{load();showToast('Заказ обновлён');}}/>}
      {editDetail !== null && <ModalEditDetail lang="ru" detail={editDetail} onClose={()=>setEditDetail(null)} onSaved={()=>{load();showToast('Деталь обновлена');}}/>}
      {confirm    !== null && <ConfirmDialog title={confirm.title} message={confirm.message} onConfirm={confirm.onConfirm} onClose={()=>setConfirm(null)}/>}
      {modal === 'newOrder' && <ModalNewOrder lang="ru" details={details} workshops={[]} onClose={()=>setModal(null)} onCreated={()=>{load();showToast('Заказ создан');}}/>}
      {toast && <div style={{ position:'fixed',bottom:24,right:24,background:'var(--fg-0)',color:'var(--bg-0)',padding:'10px 18px',borderRadius:8,fontSize:13,zIndex:3000 }}>{toast}</div>}
    </div>
  );
}

// Datalist of equipment for work_center inputs
function EquipmentDatalist() {
  const [equipment, setEquipment] = React.useState([]);
  React.useEffect(() => {
    api.get('/equipment').then(r => setEquipment(r.data || [])).catch(() => {});
  }, []);
  return (
    <datalist id="equipment-list">
      {equipment.map(e => (
        <option key={e.id} value={e.name}>{e.workshop_code} — {e.type || ''}</option>
      ))}
    </datalist>
  );
}


function ModalPause({ taskId, reasons, onClose, onSaved }) {
  const [reason, setReason] = React.useState('lunch');
  const [note,   setNote]   = React.useState('');
  const [saving, setSaving] = React.useState(false);

  async function handlePause() {
    setSaving(true);
    try {
      await api.post('/tasks/'+taskId+'/pause', { reason, note });
      onSaved();
      onClose();
    } catch(e) { alert('Ошибка: '+e.message); }
    setSaving(false);
  }

  return (
    <div className="modal-back" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:400 }}>
        <div className="modal-head">
          <b>Поставить на паузу</b>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16}/></button>
        </div>
        <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div className="field">
            <span className="field-label">Причина простоя</span>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:6 }}>
              {(reasons||[]).map(r => (
                <label key={r.v} style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer',
                  padding:'8px 12px', borderRadius:8, border:'1px solid',
                  borderColor: reason===r.v ? 'var(--accent)' : 'var(--line-1)',
                  background: reason===r.v ? 'rgba(var(--accent-rgb,217 72 15),.08)' : 'var(--bg-1)',
                  fontSize:13 }}>
                  <input type="radio" value={r.v} checked={reason===r.v}
                    onChange={()=>setReason(r.v)} style={{ accentColor:'var(--accent)' }}/>
                  {r.l}
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field-label">Комментарий (необязательно)</span>
            <input className="input" value={note} onChange={e=>setNote(e.target.value)}
              placeholder="Уточнение…"/>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Отмена</button>
          <button className="btn primary" onClick={handlePause} disabled={saving}
            style={{ background:'var(--warning,#c07820)', borderColor:'var(--warning,#c07820)' }}>
            {saving ? 'Сохранение…' : '⏸ Поставить на паузу'}
          </button>
        </div>
      </div>
    </div>
  );
}


export { ModalEditDetail, ModalEditOrder, ModalNewOrder, ModalNewDetail, AdminPanel, EquipmentDatalist, ModalPause }
