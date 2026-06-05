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

function ModalNewOrder({ lang, details, workshops, onClose, onCreated, appUsers }) {
  const isEn = lang === 'en';
  const [orderType,  setOrderType]  = React.useState('W');
  const [number,     setNumber]     = React.useState('');
  const [customer,   setCustomer]   = React.useState('');
  const [foreman,    setForeman]    = React.useState('');
  const [dueDate,    setDueDate]    = React.useState('');
  const [priority,   setPriority]   = React.useState('normal');
  const [comment,    setComment]    = React.useState('');
  const [items,      setItems]      = React.useState([{ detailId:'', quantity:1 }]);
  const [saving,     setSaving]     = React.useState(false);
  const [err,        setErr]        = React.useState('');

  // Список мастеров из пользователей (role foreman/admin)
  const foremanList = (appUsers||[])
    .filter(u => ['admin','foreman'].includes(u.role_name || u.role))
    .map(u => u.name);

  // Генерируем номер заказа при открытии формы и при смене типа
  React.useEffect(() => {
    setNumber('загрузка...');
    api.post('/orders/next-number', { type: orderType })
       .then(r => { if (r?.number) setNumber(r.number); })
       .catch(e => setNumber('ошибка: ' + (e.message || '?')));
  }, [orderType]);

  const addItem    = () => setItems(p=>[...p,{detailId:'',quantity:1}]);
  const removeItem = idx => setItems(p=>p.filter((_,i)=>i!==idx));
  const updateItem = (idx,k,v) => setItems(p=>p.map((it,i)=>i===idx?{...it,[k]:v}:it));

  async function handleSave() {
    if (!number||!dueDate) { setErr('Укажите срок'); return; }
    const validItems = items.filter(i=>i.detailId);
    if (!validItems.length) { setErr('Добавьте хотя бы одну деталь'); return; }
    setSaving(true); setErr('');
    try {
      await api.post('/orders', {
        number, order_type: orderType, customer, foreman,
        due_date: dueDate, status: 'plan', priority,
        comment: comment || null,
        items: validItems.map(i=>({ detail_id:i.detailId, quantity:Number(i.quantity) })),
      });
      onCreated(); onClose();
    } catch(e) { setErr(e.message); }
    setSaving(false);
  }

  return (
    <div className="modal-back" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:540 }}>
        <div className="modal-head">
          <b>Новый заказ</b>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16}/></button>
        </div>
        <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:12 }}>

          {/* Тип + номер + срок */}
          <div className="grid-3" style={{ gap:10 }}>
            <div className="field">
              <span className="field-label">Тип</span>
              <select className="select" value={orderType} onChange={e=>setOrderType(e.target.value)}>
                <option value="W">W — Заказ</option>
                <option value="D">D — Доработка</option>
                <option value="K">K — Кооперация</option>
              </select>
            </div>
            <div className="field">
              <span className="field-label">Номер (авто)</span>
              <input className="input mono" value={number} readOnly
                style={{ color:'var(--accent)', fontWeight:700, cursor:'not-allowed', opacity:.8 }}/>
            </div>
            <div className="field">
              <span className="field-label">Срок *</span>
              <input className="input" type="date" value={dueDate}
                onChange={e=>setDueDate(e.target.value)}/>
            </div>
          </div>

          {/* Мастер + Приоритет */}
          <div className="grid-2" style={{ gap:10 }}>
            <div className="field">
              <span className="field-label">Ст. мастер</span>
              {foremanList.length > 0 ? (
                <select className="select" value={foreman} onChange={e=>setForeman(e.target.value)}>
                  <option value="">Выбрать…</option>
                  {foremanList.map(f=><option key={f} value={f}>{f}</option>)}
                </select>
              ) : (
                <input className="input" value={foreman} onChange={e=>setForeman(e.target.value)}
                  placeholder="Колесников П.А."/>
              )}
            </div>
            <div className="field">
              <span className="field-label">Приоритет</span>
              <select className="select" value={priority} onChange={e=>setPriority(e.target.value)}>
                <option value="low">Низкий</option>
                <option value="normal">Нормальный</option>
                <option value="high">Высокий</option>
                <option value="urgent">Срочно</option>
              </select>
            </div>
          </div>

          {/* Назначение */}
          <div className="field">
            <span className="field-label">Назначение / клиент</span>
            <input className="input" value={customer} onChange={e=>setCustomer(e.target.value)}
              placeholder="Для кого, назначение заказа (необязательно)"/>
          </div>

          {/* Детали */}
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <b style={{ fontSize:13 }}>Детали</b>
              <button className="btn ghost" style={{fontSize:12}} onClick={addItem}>
                <Icon name="plus" size={12}/> Добавить деталь
              </button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {items.map((it,idx)=>(
                <div key={idx} style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <select className="select" value={it.detailId}
                    onChange={e=>updateItem(idx,'detailId',e.target.value)} style={{ flex:3 }}>
                    <option value="">Выбрать деталь…</option>
                    {(details||[]).map(d=>(
                      <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                    ))}
                  </select>
                  <input className="input" type="number" min="1" value={it.quantity}
                    onChange={e=>updateItem(idx,'quantity',e.target.value)}
                    style={{ width:70 }} placeholder="шт"/>
                  <button className="icon-btn" onClick={()=>removeItem(idx)}>
                    <Icon name="trash" size={13}/>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Комментарий */}
          <div className="field">
            <span className="field-label">Комментарий</span>
            <input className="input" value={comment} onChange={e=>setComment(e.target.value)}
              placeholder="Дополнительная информация (необязательно)"/>
          </div>

          {err && <div style={{ color:'var(--danger)', fontSize:12 }}>{err}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Отмена</button>
          <button className="btn primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Создание…' : '+ Создать заказ'}
          </button>
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
  const [tab, setTab]             = React.useState('users');
  const [users, setUsers]         = React.useState([]);
  const [roles, setRoles]         = React.useState([]);
  const [permissions, setPerms]   = React.useState([]);
  const [workCenters, setWCs]     = React.useState([]);
  const [settings, setSettings]   = React.useState({});
  const [editUser, setEditUser]   = React.useState(null);
  const [loading, setLoading]     = React.useState(true);
  const [toast, setToast]         = React.useState('');
  const [confirm, setConfirm]     = React.useState(null);

  function showToast(msg, err) {
    setToast({ msg, err: !!err });
    setTimeout(() => setToast(''), 3500);
  }

  async function load() {
    setLoading(true);
    try {
      const [ur, rr, pr, wr, sr] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/roles'),
        api.get('/admin/permissions'),
        api.get('/work-centers'),
        api.get('/settings'),
      ]);
      setUsers(ur.data || []);
      setRoles(rr.data || []);
      setPerms(pr.data || []);
      setWCs(wr.data || []);
      setSettings(sr.data || {});
    } catch(e) { showToast('Ошибка загрузки: ' + e.message, true); }
    setLoading(false);
  }

  React.useEffect(() => { load(); }, []);

  // ── User Editor ──────────────────────────────────────────────────────
  function UserEditor({ user, roles, onSave, onClose }) {
    const isNew = !user?.id;
    const [name,     setName]     = React.useState(user?.name    || '');
    const [email,    setEmail]    = React.useState(user?.email   || '');
    const [roleId,   setRoleId]   = React.useState(user?.role_id || 3);
    const [active,   setActive]   = React.useState(user?.is_active ?? 1);
    const [password, setPassword] = React.useState('');
    const [err,      setErr]      = React.useState('');
    const [saving,   setSaving]   = React.useState(false);

    async function save() {
      if (!name || !email) { setErr('Имя и email обязательны'); return; }
      setSaving(true); setErr('');
      try {
        const body = { name, email, role_id: Number(roleId), is_active: Number(active) };
        if (password) body.password = password;
        if (isNew) {
          body.password = password || 'Password1!';
          await api.post('/admin/users', body);
        } else {
          await api.put('/admin/users/' + user.id, body);
        }
        onSave(); onClose();
      } catch(e) { setErr(e.message); }
      setSaving(false);
    }

    const ROLE_LABELS = { admin: 'Администратор', foreman: 'Ст. мастер', operator: 'Оператор', viewer: 'Наблюдатель' };

    return (
      <div style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,0.6)',
        display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div className="card" style={{ width:420, padding:24, display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <b>{isNew ? 'Новый пользователь' : 'Редактировать'}</b>
            <button className="icon-btn" onClick={onClose}><Icon name="close" size={16}/></button>
          </div>
          <div className="field"><span className="field-label">Имя *</span>
            <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="Иванов И.И."/>
          </div>
          <div className="field"><span className="field-label">Email *</span>
            <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)}/>
          </div>
          <div className="field">
            <span className="field-label">{isNew ? 'Пароль *' : 'Новый пароль (пусто = не менять)'}</span>
            <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)}
              placeholder={isNew ? 'минимум 8 символов' : ''}/>
          </div>
          <div className="grid-2" style={{ gap:10 }}>
            <div className="field"><span className="field-label">Роль</span>
              <select className="select" value={roleId} onChange={e=>setRoleId(e.target.value)}>
                {roles.map(r => <option key={r.id} value={r.id}>{r.label || ROLE_LABELS[r.name] || r.name}</option>)}
              </select>
            </div>
            <div className="field"><span className="field-label">Статус</span>
              <select className="select" value={active} onChange={e=>setActive(e.target.value)}>
                <option value={1}>Активен</option>
                <option value={0}>Заблокирован</option>
              </select>
            </div>
          </div>
          {err && <div style={{ color:'var(--danger)', fontSize:12 }}>{err}</div>}
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button className="btn" onClick={onClose}>Отмена</button>
            <button className="btn primary" onClick={save} disabled={saving}>
              {saving ? 'Сохранение…' : (isNew ? 'Создать' : 'Сохранить')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Settings Tab ────────────────────────────────────────────────────
  function SettingsTab({ settings, onSave }) {
    const [tz,          setTz]     = React.useState(settings.timezone_offset?.value || '+03:00');
    const [company,     setCompany]= React.useState(settings.company_name?.value    || '');
    const [warnPct,     setWarnPct]= React.useState(settings.norm_warn_pct?.value   || '100');
    const [critPct,     setCritPct]= React.useState(settings.norm_crit_pct?.value   || '115');
    const [dayStart,    setDayStart]= React.useState(settings.shift_day_start?.value || '07:00');
    const [dayEnd,      setDayEnd]  = React.useState(settings.shift_day_end?.value   || '19:00');
    const [maxLogin,    setMaxLogin]= React.useState(settings.max_login_attempts?.value || '5');
    const [saving,      setSaving]  = React.useState(false);

    const TIMEZONES = [
      { v:'+02:00', l:'UTC+2 Калининград' },
      { v:'+03:00', l:'UTC+3 Москва, Санкт-Петербург' },
      { v:'+04:00', l:'UTC+4 Самара, Удмуртия' },
      { v:'+05:00', l:'UTC+5 Екатеринбург' },
      { v:'+06:00', l:'UTC+6 Омск' },
      { v:'+07:00', l:'UTC+7 Красноярск, Новосибирск' },
      { v:'+08:00', l:'UTC+8 Иркутск, Улан-Удэ' },
      { v:'+09:00', l:'UTC+9 Якутск, Чита' },
      { v:'+10:00', l:'UTC+10 Владивосток, Хабаровск' },
      { v:'+11:00', l:'UTC+11 Магадан, Сахалин' },
      { v:'+12:00', l:'UTC+12 Камчатка, Чукотка' },
    ];

    async function saveAll() {
      setSaving(true);
      try {
        const pairs = [
          ['timezone_offset',    tz],
          ['company_name',       company],
          ['norm_warn_pct',      warnPct],
          ['norm_crit_pct',      critPct],
          ['shift_day_start',    dayStart],
          ['shift_day_end',      dayEnd],
          ['max_login_attempts', maxLogin],
        ];
        for (const [key, value] of pairs) {
          await api.post('/settings', { key, value });
        }
        onSave('Настройки сохранены');
      } catch(e) { onSave('Ошибка: ' + e.message, true); }
      setSaving(false);
    }

    const Row = ({ label, desc, children }) => (
      <div style={{ display:'flex', alignItems:'flex-start', gap:16, padding:'14px 0',
        borderBottom:'1px solid var(--line-2)' }}>
        <div style={{ flex:2, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:600 }}>{label}</div>
          {desc && <div style={{ fontSize:11, color:'var(--fg-2)', marginTop:2 }}>{desc}</div>}
        </div>
        <div style={{ flex:1, minWidth:160 }}>{children}</div>
      </div>
    );

    return (
      <div>
        <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>Системные настройки</div>
        <div style={{ fontSize:12, color:'var(--fg-2)', marginBottom:20 }}>
          Изменения вступают в силу немедленно. Часовой пояс влияет на все временные метки.
        </div>

        <div style={{ background:'var(--bg-1)', border:'1px solid var(--line-1)', borderRadius:12, padding:'0 20px', marginBottom:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--fg-2)', padding:'12px 0 8px',
            borderBottom:'1px solid var(--line-2)', textTransform:'uppercase', letterSpacing:.5 }}>
            🕐 Время и регион
          </div>

          <Row label="Часовой пояс" desc="Влияет на отображение времени смен и операций">
            <select className="select" value={tz} onChange={e=>setTz(e.target.value)}>
              {TIMEZONES.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </Row>
          <Row label="Начало дневной смены" desc="Формат ЧЧ:ММ">
            <input className="input" type="time" value={dayStart} onChange={e=>setDayStart(e.target.value)}/>
          </Row>
          <Row label="Конец дневной смены" desc="Начало ночной смены">
            <input className="input" type="time" value={dayEnd} onChange={e=>setDayEnd(e.target.value)}/>
          </Row>
        </div>

        <div style={{ background:'var(--bg-1)', border:'1px solid var(--line-1)', borderRadius:12, padding:'0 20px', marginBottom:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--fg-2)', padding:'12px 0 8px',
            borderBottom:'1px solid var(--line-2)', textTransform:'uppercase', letterSpacing:.5 }}>
            🏭 Предприятие
          </div>
          <Row label="Название предприятия" desc="Отображается в заголовке и отчётах">
            <input className="input" value={company} onChange={e=>setCompany(e.target.value)} placeholder="ООО Машзавод"/>
          </Row>
        </div>

        <div style={{ background:'var(--bg-1)', border:'1px solid var(--line-1)', borderRadius:12, padding:'0 20px', marginBottom:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--fg-2)', padding:'12px 0 8px',
            borderBottom:'1px solid var(--line-2)', textTransform:'uppercase', letterSpacing:.5 }}>
            ⏱ Нормоконтроль
          </div>
          <Row label="Порог предупреждения" desc="При превышении — жёлтый индикатор">
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input className="input" type="number" min="50" max="200" value={warnPct}
                onChange={e=>setWarnPct(e.target.value)} style={{ width:80 }}/>
              <span style={{ fontSize:13 }}>% от нормы</span>
            </div>
          </Row>
          <Row label="Критический порог" desc="При превышении — красный индикатор">
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input className="input" type="number" min="50" max="300" value={critPct}
                onChange={e=>setCritPct(e.target.value)} style={{ width:80 }}/>
              <span style={{ fontSize:13 }}>% от нормы</span>
            </div>
          </Row>
        </div>

        <div style={{ background:'var(--bg-1)', border:'1px solid var(--line-1)', borderRadius:12, padding:'0 20px', marginBottom:24 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--fg-2)', padding:'12px 0 8px',
            borderBottom:'1px solid var(--line-2)', textTransform:'uppercase', letterSpacing:.5 }}>
            🔐 Безопасность
          </div>
          <Row label="Макс. попыток входа" desc="Блокировка по IP на 1 час при превышении">
            <input className="input" type="number" min="1" max="20" value={maxLogin}
              onChange={e=>setMaxLogin(e.target.value)} style={{ width:80 }}/>
          </Row>
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <button className="btn primary" onClick={saveAll} disabled={saving} style={{ minWidth:160 }}>
            {saving ? 'Сохранение…' : '💾 Сохранить настройки'}
          </button>
        </div>
      </div>
    );
  }

  // ── Roles Tab ───────────────────────────────────────────────────────
  function RolesTab({ roles, permissions }) {
    const [editRole, setEditRole] = React.useState(null);
    const [saving, setSaving]     = React.useState(false);
    const ROLE_LABELS = { admin:'Администратор', foreman:'Ст. мастер', operator:'Оператор', viewer:'Наблюдатель' };
    const ROLE_COLORS = { admin:'var(--accent)', foreman:'#3b82f6', operator:'#10b981', viewer:'#888' };

    return (
      <div>
        <div style={{ fontWeight:700, fontSize:15, marginBottom:16 }}>Роли и права доступа</div>
        {roles.map(role => (
          <div key={role.id} className="card" style={{ padding:16, marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <span style={{ fontWeight:700, color: ROLE_COLORS[role.name]||'var(--fg-0)', fontSize:14 }}>
                {ROLE_LABELS[role.name] || role.name}
              </span>
              <span style={{ fontSize:11, color:'var(--fg-2)', fontFamily:'monospace' }}>{role.name}</span>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {(role.permissions||[]).map(p => (
                <span key={p} style={{ fontSize:11, padding:'2px 8px', borderRadius:99,
                  background:'var(--bg-2)', color:'var(--fg-1)', fontFamily:'monospace' }}>
                  {p}
                </span>
              ))}
            </div>
          </div>
        ))}
        <div style={{ fontSize:12, color:'var(--fg-2)', marginTop:8 }}>
          Редактирование прав доступно через прямое изменение таблицы role_permissions в БД.
        </div>
      </div>
    );
  }

  // ── WorkCenters Tab ──────────────────────────────────────────────────
  function WorkCentersTab({ workCenters, onSaved }) {
    const [editWC, setEditWC] = React.useState(null);
    const [form,   setForm]   = React.useState({ code:'', name:'', is_active:1 });
    const [saving, setSaving] = React.useState(false);

    async function saveWC() {
      setSaving(true);
      try {
        if (editWC?.id) {
          await api.put('/work-centers/' + editWC.id, form);
        } else {
          await api.post('/work-centers', form);
        }
        onSaved('Рабочий центр сохранён');
        setEditWC(null);
      } catch(e) { onSaved('Ошибка: ' + e.message, true); }
      setSaving(false);
    }

    return (
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div style={{ fontWeight:700, fontSize:15 }}>Рабочие центры</div>
          <button className="btn primary" style={{ fontSize:12 }}
            onClick={()=>{ setForm({code:'',name:'',is_active:1}); setEditWC({}); }}>
            + Добавить РЦ
          </button>
        </div>

        {editWC !== null && (
          <div className="card" style={{ padding:16, marginBottom:16, border:'1px solid var(--accent)' }}>
            <div style={{ fontWeight:600, marginBottom:12 }}>{editWC?.id ? 'Редактировать РЦ' : 'Новый РЦ'}</div>
            <div className="grid-3" style={{ gap:10 }}>
              <div className="field"><span className="field-label">Код *</span>
                <input className="input mono" value={form.code}
                  onChange={e=>setForm(p=>({...p,code:e.target.value}))} placeholder="104"/>
              </div>
              <div className="field" style={{ gridColumn:'span 2' }}>
                <span className="field-label">Название *</span>
                <input className="input" value={form.name}
                  onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Токарный универсальный"/>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:10, justifyContent:'flex-end' }}>
              <button className="btn" onClick={()=>setEditWC(null)}>Отмена</button>
              <button className="btn primary" onClick={saveWC} disabled={saving||!form.code||!form.name}>
                {saving ? '…' : 'Сохранить'}
              </button>
            </div>
          </div>
        )}

        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Код</th><th>Название</th><th>Статус</th><th/></tr></thead>
            <tbody>
              {workCenters.map(wc => (
                <tr key={wc.id} className="row-hover">
                  <td className="mono" style={{ fontWeight:700, color:'var(--accent)' }}>{wc.code}</td>
                  <td>{wc.name}</td>
                  <td>
                    <span style={{ fontSize:11, color: wc.is_active ? 'var(--st-done-line)' : 'var(--fg-2)' }}>
                      {wc.is_active ? '● Активен' : '○ Отключён'}
                    </span>
                  </td>
                  <td>
                    <button className="btn ghost" style={{ fontSize:11 }}
                      onClick={()=>{ setForm({code:wc.code,name:wc.name,is_active:wc.is_active}); setEditWC(wc); }}>
                      Изменить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const TABS = [
    { id:'users',        label:'👥 Пользователи' },
    { id:'roles',        label:'🔑 Роли' },
    { id:'workcenters',  label:'🏭 Рабочие центры' },
    { id:'settings',     label:'⚙️ Настройки' },
  ];

  return (
    <div style={{ minHeight:'100svh', background:'var(--bg-0)', fontFamily:'var(--ui-font)' }}>
      {/* Шапка */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 20px',
        background:'var(--bg-1)', borderBottom:'1px solid var(--line-1)' }}>
        <button className="btn ghost" onClick={onBack}>← Назад</button>
        <span style={{ fontWeight:700, fontSize:16 }}>Администрирование</span>
        {toast && (
          <span style={{ marginLeft:'auto', fontSize:12, padding:'5px 12px', borderRadius:8,
            background: toast.err ? 'rgba(220,38,38,.15)' : 'rgba(34,197,94,.15)',
            color: toast.err ? 'var(--danger)' : 'var(--st-done-line)' }}>
            {toast.msg}
          </span>
        )}
      </div>

      <div style={{ display:'flex', height:'calc(100vh - 49px)' }}>
        {/* Боковое меню */}
        <div style={{ width:200, background:'var(--bg-1)', borderRight:'1px solid var(--line-1)',
          padding:8, flexShrink:0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ display:'block', width:'100%', padding:'9px 12px', borderRadius:8,
                border:'none', cursor:'pointer', textAlign:'left', fontSize:13,
                fontFamily:'var(--ui-font)', fontWeight: tab===t.id ? 700 : 400, marginBottom:2,
                background: tab===t.id ? 'var(--accent)' : 'transparent',
                color: tab===t.id ? '#fff' : 'var(--fg-1)' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Контент */}
        <div style={{ flex:1, overflow:'auto', padding:24 }}>
          {loading ? (
            <div style={{ padding:40, textAlign:'center', color:'var(--fg-2)' }}>Загрузка…</div>
          ) : tab === 'users' ? (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <div style={{ fontWeight:700, fontSize:15 }}>Пользователи ({users.length})</div>
                <button className="btn primary" style={{ fontSize:12 }}
                  onClick={() => setEditUser({})}>+ Добавить</button>
              </div>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr>
                    <th>Имя</th><th>Email</th><th>Роль</th>
                    <th className="hide-mobile">Последний вход</th>
                    <th>Статус</th><th/>
                  </tr></thead>
                  <tbody>
                    {users.map(u => {
                      const ROLE_COLORS = { admin:'var(--accent)',foreman:'#3b82f6',operator:'#10b981',viewer:'#888' };
                      const ROLE_LABELS = { admin:'Администратор',foreman:'Ст. мастер',operator:'Оператор',viewer:'Наблюдатель' };
                      return (
                        <tr key={u.id} className="row-hover">
                          <td style={{ fontWeight:600 }}>{u.name}</td>
                          <td style={{ fontSize:12, fontFamily:'monospace' }}>{u.email}</td>
                          <td>
                            <span style={{ fontSize:11, padding:'2px 8px', borderRadius:99,
                              background:'rgba(0,0,0,.06)',
                              color: ROLE_COLORS[u.role_name]||'var(--fg-1)' }}>
                              {ROLE_LABELS[u.role_name]||u.role_name}
                            </span>
                          </td>
                          <td className="hide-mobile" style={{ fontSize:11, color:'var(--fg-2)' }}>
                            {u.last_login ? u.last_login.slice(0,16).replace('T',' ') : '—'}
                          </td>
                          <td>
                            <span style={{ fontSize:11, color: u.is_active ? 'var(--st-done-line)' : 'var(--danger)' }}>
                              {u.is_active ? '● Активен' : '○ Заблокирован'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display:'flex', gap:4 }}>
                              <button className="btn ghost" style={{ fontSize:11 }}
                                onClick={() => setEditUser(u)}>Изменить</button>
                              {u.role_name !== 'admin' && (
                                <button className="btn ghost" style={{ fontSize:11, color:'var(--danger)' }}
                                  onClick={() => {
                                    if (window.confirm(`Удалить пользователя ${u.name}?`)) {
                                      api.delete('/admin/users/'+u.id)
                                         .then(() => { showToast('Пользователь удалён'); load(); })
                                         .catch(e => showToast(e.message, true));
                                    }
                                  }}>Удалить</button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : tab === 'roles' ? (
            <RolesTab roles={roles} permissions={permissions}/>
          ) : tab === 'workcenters' ? (
            <WorkCentersTab workCenters={workCenters}
              onSaved={(msg, err) => { showToast(msg, err); load(); }}/>
          ) : tab === 'settings' ? (
            <SettingsTab settings={settings}
              onSave={(msg, err) => showToast(msg, err)}/>
          ) : null}
        </div>
      </div>

      {editUser !== null && (
        <UserEditor user={editUser?.id ? editUser : null}
          roles={roles}
          onSave={() => { load(); showToast('Сохранено'); }}
          onClose={() => setEditUser(null)}/>
      )}
    </div>
  );
}


// ── ModalPause — выбор причины паузы ────────────────────────────────────
function ModalPause({ taskId, reasons, onClose, onSaved }) {
  const [saving, setSaving] = React.useState(false);
  const [note,   setNote]   = React.useState('');

  async function handlePause(reason) {
    setSaving(true);
    try {
      await api.post('/tasks/' + taskId + '/pause', { reason, note: note || undefined });
      await onSaved?.();
      onClose();
    } catch(e) { console.error('Error:', e.message); }
    setSaving(false);
  }

  return (
    <div className="modal-back" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:380 }}>
        <div className="modal-head">
          <b>⏸ Поставить на паузу</b>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16}/></button>
        </div>
        <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ fontSize:12, color:'var(--fg-2)', marginBottom:4 }}>Выберите причину:</div>
          {(reasons||[]).map(r=>(
            <button key={r.v} className="btn"
              style={{ textAlign:'left', borderLeft:'4px solid var(--accent)', paddingLeft:14 }}
              onClick={()=>handlePause(r.v)} disabled={saving}>
              {r.l}
            </button>
          ))}
          <input className="input" value={note} onChange={e=>setNote(e.target.value)}
            placeholder="Комментарий (необязательно)" style={{ marginTop:4 }}/>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>
  );
}

// ── EquipmentDatalist — datalist для поля оборудования ────────────────────
function EquipmentDatalist() {
  return null; // Заглушка — оборудование загружается через отдельный запрос
}

// ── ModalNewDetail — создание новой детали в номенклатуре ─────────────────
function ModalNewDetail({ lang, onClose, onCreated, workCenters }) {
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
        operations: ops.filter(o=>o.name).map(o=>({
          num:Number(o.num), name:o.name, work_center:o.workCenter, time_min:Number(o.time)
        })),
      });
      onCreated(); onClose();
    } catch(e) { setErr(e.message); }
    setSaving(false);
  }

  return (
    <div style={{ position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,0.55)',
      display:'flex',alignItems:'center',justifyContent:'center' }}>
      <div className="card" style={{ width:640,maxHeight:'90vh',overflowY:'auto',padding:24,
        display:'flex',flexDirection:'column',gap:14 }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <b style={{ fontSize:16 }}>{isEn?'New Part':'Новая деталь'}</b>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={16}/></button>
        </div>
        <div className="grid-3" style={{ gap:10 }}>
          <div className="field"><span className="field-label">Код *</span>
            <input className="input" value={code} onChange={e=>setCode(e.target.value)} placeholder="ФЛ-100-08"/></div>
          <div className="field"><span className="field-label">Ед.</span>
            <input className="input" value={unit} onChange={e=>setUnit(e.target.value)}/></div>
          <div className="field"><span className="field-label">Чертёж</span>
            <input className="input" value={drawing} onChange={e=>setDrawing(e.target.value)}/></div>
        </div>
        <div className="field"><span className="field-label">Наименование *</span>
          <input className="input" value={name} onChange={e=>setName(e.target.value)}/></div>
        <div className="field"><span className="field-label">Материал *</span>
          <input className="input" value={material} onChange={e=>setMaterial(e.target.value)}/></div>
        <div>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
            <b style={{ fontSize:13 }}>Операции</b>
            <button className="btn ghost" onClick={addOp}><Icon name="plus" size={13}/>Добавить</button>
          </div>
          <table className="tbl" style={{ fontSize:12 }}>
            <thead><tr>
              <th style={{width:48}}>№</th><th>Операция</th><th>Рабочий центр</th>
              <th style={{width:64}}>Мин</th><th style={{width:32}}></th>
            </tr></thead>
            <tbody>{ops.map((op,idx)=>(
              <tr key={idx}>
                <td><input className="input" type="number" value={op.num}
                  onChange={e=>updateOp(idx,'num',e.target.value)} style={{width:44,padding:'2px 4px'}}/></td>
                <td><input className="input" value={op.name}
                  onChange={e=>updateOp(idx,'name',e.target.value)}
                  placeholder="Токарная" style={{width:'100%'}}/></td>
                <td>
                  <select className="select" value={op.workCenter}
                    onChange={e=>updateOp(idx,'workCenter',e.target.value)}
                    style={{width:'100%',fontSize:12}}>
                    <option value="">Выбрать РЦ…</option>
                    {(workCenters||[]).map(w=>(
                      <option key={w.id} value={w.code}>{w.code} — {w.name}</option>
                    ))}
                  </select>
                </td>
                <td><input className="input" type="number" min="0" value={op.time}
                  onChange={e=>updateOp(idx,'time',e.target.value)} style={{width:52,padding:'2px 4px'}}/></td>
                <td><button className="icon-btn" onClick={()=>removeOp(idx)}>
                  <Icon name="trash" size={12}/></button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {err && <div style={{ color:'var(--danger)',fontSize:12 }}>{err}</div>}
        <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
          <button className="btn" onClick={onClose}>Отмена</button>
          <button className="btn primary" onClick={handleSave} disabled={saving}>
            {saving?'Сохранение…':'Создать'}
          </button>
        </div>
      </div>
    </div>
  );
}

export { ModalEditDetail, ModalEditOrder, ModalNewOrder, ModalNewDetail, AdminPanel, EquipmentDatalist, ModalPause }
