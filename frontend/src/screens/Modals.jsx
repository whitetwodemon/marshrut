import React from 'react'
import { api, Auth, API_BASE , unwrap} from '../lib/api.js'
import { Icon } from '../components/Icon.jsx'
import { NomenclatureSearch } from '../components/NomenclatureSearch.jsx';
import { DetailForm } from '../components/DetailForm.jsx';

function ModalEditDetail({ lang, detail, onClose, onSaved }) {
  return (
    <DetailForm
      lang={lang}
      title={(lang === 'en' ? 'Edit Part' : 'Редактировать деталь')}
      submitLabel={(lang === 'en' ? 'Save' : 'Сохранить')}
      initial={detail}
      onClose={onClose}
      onSubmit={async (payload) => { await api.put('/details/' + detail.id, payload); onSaved(); }}
    />
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
              <div style={{flex:1}}>
                <NomenclatureSearch details={details} allowManual={false}
                  value={it._q !== undefined ? it._q : (details.find(d=>d.id===it.detailId) ? `${details.find(d=>d.id===it.detailId).code} — ${details.find(d=>d.id===it.detailId).name}` : '')}
                  detailId={it.detailId}
                  onPick={({detail_id, detail_name, detail_code})=>{ updateItem(idx,'detailId',detail_id||''); updateItem(idx,'_q', detail_id ? `${detail_code} — ${detail_name}` : detail_name); }}
                  placeholder={isEn?'Search part…':'Поиск детали по коду/названию…'} />
              </div>
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

function ModalNewOrder({ lang, details, workshops, onClose, onCreated, prefill }) {
  const isEn = lang === 'en';
  const [number,     setNumber]     = React.useState('');
  const [customer,   setCustomer]   = React.useState('');
  const [foreman,    setForeman]    = React.useState('');
  const [dueDate,    setDueDate]    = React.useState(prefill && prefill.dueDate ? String(prefill.dueDate).slice(0,10) : '');
  const [status,     setStatus]     = React.useState('plan');
  const [priority,   setPriority]   = React.useState('normal');
  const [workshopId, setWorkshopId] = React.useState('');
  const [comment,    setComment]    = React.useState('');
  const [items,      setItems]      = React.useState(() => prefill && prefill.detailId ? [{ detailId: prefill.detailId, quantity: prefill.quantity || 1 }] : [{ detailId:'', quantity:1 }]);
  const [saving,     setSaving]     = React.useState(false);
  const [err,        setErr]        = React.useState('');

  // Автонумерация при открытии
  React.useEffect(() => {
    api.post('/orders/next-number', {}).then(r => setNumber(r.number)).catch(()=>{});
  }, []);

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
      const created = await api.post('/orders', {
        number, customer, foreman,
        due_date:    dueDate,
        created_at:  new Date().toISOString().slice(0,10),
        status,
        priority,
        workshop_id: workshopId ? Number(workshopId) : null,
        comment:     comment || null,
        items: validItems.map(i=>({ detail_id:i.detailId, quantity:Number(i.quantity) })),
      });
      onCreated(created); onClose();
    } catch(e) { setErr(e.message); }
    setSaving(false);
  }

  return (
    <div className="modal-back">
      <div className="modal" style={{ maxWidth:560 }}>
        <div className="modal-head">
          <b style={{ fontSize:16 }}>Новый заказ</b>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16}/></button>
        </div>
        <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:12 }}>

          {/* Основные поля */}
          <div className="grid-3" style={{ gap:10 }}>
            <div className="field">
              <span className="field-label">Номер</span>
              <input className="input mono" value={number}
                onChange={e=>setNumber(e.target.value)}
                placeholder={number ? '' : 'Генерация…'}
                style={{ color:'var(--accent)', fontWeight:700 }}/>
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
                <div style={{flex:1}}>
                  <NomenclatureSearch details={details} allowManual={false}
                    value={it._q !== undefined ? it._q : (details.find(d=>d.id===it.detailId) ? `${details.find(d=>d.id===it.detailId).code} — ${details.find(d=>d.id===it.detailId).name}` : '')}
                    detailId={it.detailId}
                    onPick={({detail_id, detail_name, detail_code})=>{ updateItem(idx,'detailId',detail_id||''); updateItem(idx,'_q', detail_id ? `${detail_code} — ${detail_name}` : detail_name); }}
                    placeholder="Поиск детали по коду/названию…" />
                </div>
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
  return (
    <DetailForm
      lang={lang}
      title={(lang === 'en' ? 'New Part' : 'Новая деталь')}
      submitLabel={(lang === 'en' ? 'Create' : 'Создать')}
      initial={{}}
      onClose={onClose}
      onSubmit={async (payload) => { await api.post('/details', payload); onCreated(); }}
    />
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
  const [bulkOpen, setBulkOpen]     = React.useState(false);

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(''), 3000); }

  async function load() {
    setLoading(true);
    try {
      const [ur, rr, pr, or_, dr] = await Promise.all([
        api.get('/admin/users'), api.get('/admin/roles'), api.get('/admin/permissions'),
        api.get('/orders'), api.get('/details'),
        api.get('/workshops'), api.get('/equipment'),
      ]);
      setUsers(unwrap(ur)); setRoles(unwrap(rr)); setPerms(unwrap(pr));
      setOrders(unwrap(or_)); setDetails(unwrap(dr));
    } catch(e) { showToast('Ошибка: '+e.message); }
    setLoading(false);
  }
  React.useEffect(()=>{ load(); }, []);

  // ── Bulk Users (массовое создание) ─────────────────────────────────
  function BulkUsersModal({ roles, onDone, onClose }) {
    const [text, setText]     = React.useState('');
    const [defRole, setDefRole] = React.useState('operator');
    const [saving, setSaving] = React.useState(false);
    const [result, setResult] = React.useState(null);
    const [err, setErr]       = React.useState('');

    // Парсим строки: «Имя; email; пароль; роль» (роль необязательна → берётся defRole)
    function parse() {
      return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
        const parts = line.split(/[;,\t]/).map(s => s.trim());
        const [name, email, password, role] = parts;
        return { name, email, password: password || 'Password1!', role: (role || defRole).toLowerCase() };
      });
    }

    async function submit() {
      setErr(''); setResult(null);
      const users = parse().filter(u => u.name && u.email);
      if (!users.length) { setErr('Добавьте хотя бы одну строку: Имя; email; пароль'); return; }
      setSaving(true);
      try {
        const r = await api.post('/admin/users/bulk', { users });
        setResult(r);
        if (r.created > 0 && (!r.errors || !r.errors.length)) {
          onDone(`Создано пользователей: ${r.created}`);
        }
      } catch(e) { setErr(e.message); }
      setSaving(false);
    }

    const preview = parse().filter(u => u.name && u.email);

    return (
      <div style={{ position:'fixed',inset:0,zIndex:2000,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center' }}>
        <div className="card" style={{ width:560,maxHeight:'85vh',overflowY:'auto',padding:24,display:'flex',flexDirection:'column',gap:14 }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
            <b style={{ fontSize:15 }}>Массовое создание пользователей</b>
            <button className="icon-btn" onClick={onClose}><Icon name="close" size={16}/></button>
          </div>
          <div className="muted" style={{ fontSize:12,lineHeight:1.6 }}>
            Одна строка — один пользователь, поля через «;» или запятую:<br/>
            <code style={{ fontSize:11 }}>Иванов Иван; ivanov@firma.ru; Пароль123; operator</code><br/>
            Пароль и роль необязательны (по умолчанию роль ниже, пароль <code>Password1!</code>).
          </div>
          <div className="field">
            <span className="field-label">Роль по умолчанию</span>
            <select className="select" value={defRole} onChange={e=>setDefRole(e.target.value)} style={{width:'100%'}}>
              {roles.map(r=><option key={r.id} value={r.name}>{r.label} ({r.name})</option>)}
            </select>
          </div>
          <textarea className="input" rows={8} value={text} onChange={e=>setText(e.target.value)}
            placeholder={'Иванов Иван; ivanov@firma.ru; Пароль123\nПетров Пётр; petrov@firma.ru; ; master'}
            style={{ width:'100%',fontFamily:'var(--font-mono)',fontSize:12,resize:'vertical' }}/>
          {preview.length > 0 && <div className="muted" style={{fontSize:12}}>Будет создано: <b>{preview.length}</b></div>}
          {err && <div style={{ fontSize:12,color:'var(--danger)' }}>{err}</div>}
          {result && (
            <div style={{ fontSize:13,background:'var(--bg-1)',borderRadius:8,padding:12 }}>
              <div style={{color:'#10b981'}}>✓ Создано: {result.created}</div>
              {result.skipped > 0 && <div style={{color:'var(--warning,#f59e0b)'}}>⊙ Пропущено: {result.skipped}</div>}
              {Array.isArray(result.errors) && result.errors.length > 0 && (
                <ul style={{ margin:'8px 0 0',paddingLeft:18,color:'var(--danger)',fontSize:12 }}>
                  {result.errors.map((e,i)=><li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
          <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
            <button className="btn" onClick={onClose}>Закрыть</button>
            <button className="btn primary" onClick={submit} disabled={saving}>{saving?'Создание…':'Создать'}</button>
          </div>
        </div>
      </div>
    );
  }

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
                          time:Number(op.time_min||op.time||0), setup:Number(op.setup_time_min||op.setupTime||0)
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
          {[['users','Пользователи'],['roles','Роли и права'],['equipment','Оборудование'],['orders','Заказы'],['details','Номенклатура'],['maintenance','Обслуживание']].map(([t,l])=>(
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
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn" onClick={()=>setBulkOpen(true)}><Icon name="plus" size={14}/>Массово</button>
                <button className="btn primary" onClick={()=>setEditUser({})}><Icon name="plus" size={14}/>Добавить</button>
              </div>
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
                    <td style={{ display:'flex', gap:4 }}>
                      <button className="icon-btn" title="Редактировать" onClick={()=>setEditUser(u)}><Icon name="dots" size={14}/></button>
                      <button className="icon-btn" title="Удалить" style={{color:'var(--danger)'}}
                        onClick={()=>setConfirm({
                          title:'Удалить пользователя «'+u.name+'»?',
                          onConfirm: async()=>{
                            try { await api.delete('/admin/users/'+u.id); showToast('Пользователь удалён'); load(); }
                            catch(e){ showToast('Ошибка: '+e.message); }
                          }
                        })}><Icon name="trash" size={14}/></button>
                    </td>
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
        ) : tab === 'maintenance' ? (
          <div style={{ display:'flex', flexDirection:'column', gap:16, maxWidth:560 }}>
            <FeatureToggles showToast={showToast} />
            <BackupPanel showToast={showToast} />
            <SettingsEditor showToast={showToast} />
            <MaterialsEditor showToast={showToast} />
            <div className="card" style={{ padding:18 }}>
              <b style={{ fontSize:15 }}>Очистка истории</b>
              <p className="muted" style={{ fontSize:13, margin:'8px 0 14px' }}>
                Удаление данных необратимо. Используйте для очистки накопленной истории.
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <button className="btn" style={{ color:'var(--danger)', borderColor:'var(--danger)', justifyContent:'flex-start' }}
                  onClick={()=>setConfirm({
                    title:'Удалить историю всех закрытых смен? Это необратимо.',
                    onConfirm: async()=>{ try { const r=await api.post('/admin/clear-shift-history',{}); showToast('Удалено смен: '+(r.deleted||0)); } catch(e){ showToast('Ошибка: '+e.message); } }
                  })}>
                  <Icon name="trash" size={14}/> Очистить историю смен
                </button>
                <button className="btn" style={{ color:'var(--danger)', borderColor:'var(--danger)', justifyContent:'flex-start' }}
                  onClick={()=>setConfirm({
                    title:'Очистить историю изменений (журнал сканирований и событий заданий)? Это необратимо.',
                    onConfirm: async()=>{ try { const r=await api.post('/admin/clear-change-history',{}); showToast('Очищено записей: '+((r.scan_deleted||0)+(r.events_deleted||0))); } catch(e){ showToast('Ошибка: '+e.message); } }
                  })}>
                  <Icon name="trash" size={14}/> Очистить историю изменений
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {editUser   !== null && <UserEditor user={editUser} roles={roles} onSave={()=>{load();showToast('Сохранено');}} onClose={()=>setEditUser(null)}/>}
      {bulkOpen && <BulkUsersModal roles={roles} onDone={(msg)=>{load();showToast(msg);setBulkOpen(false);}} onClose={()=>setBulkOpen(false)}/>}
      {editRole   !== null && <RoleEditor role={editRole} allPermissions={permissions} onSave={()=>{load();showToast('Права обновлены');}} onClose={()=>setEditRole(null)}/>}
      {editOrder  !== null && <ModalEditOrder lang="ru" order={editOrder} details={details} onClose={()=>setEditOrder(null)} onSaved={()=>{load();showToast('Заказ обновлён');}}/>}
      {editDetail !== null && <ModalEditDetail lang="ru" detail={editDetail} onClose={()=>setEditDetail(null)} onSaved={()=>{load();showToast('Деталь обновлена');}}/>}
      {confirm    !== null && <ConfirmDialog title={confirm.title} message={confirm.message} onConfirm={confirm.onConfirm} onClose={()=>setConfirm(null)}/>}
      {modal === 'newOrder' && <ModalNewOrder lang="ru" details={details} workshops={[]} onClose={()=>setModal(null)} onCreated={()=>{load();showToast('Заказ создан');}}/>}
      {toast && <div style={{ position:'fixed',bottom:24,right:24,background:'var(--fg-0)',color:'var(--bg-0)',padding:'10px 18px',borderRadius:8,fontSize:13,zIndex:3000 }}>{toast}</div>}
    </div>
  );
}


// Datalist готовых рабочих центров для поля «Раб. центр»
function WorkCenterDatalist() {
  const [wcs, setWcs] = React.useState([]);
  React.useEffect(() => {
    api.get('/work-centers')
      .then(r => setWcs(unwrap(r)))
      .catch(() => {});
  }, []);
  return (
    <datalist id="wc-datalist">
      {wcs.map(w => (
        <option key={w.id || w.code} value={w.code}>{w.code} — {w.name}</option>
      ))}
    </datalist>
  );
}

// Datalist of equipment for work_center inputs
function EquipmentDatalist() {
  const [equipment, setEquipment] = React.useState([]);
  React.useEffect(() => {
    api.get('/equipment').then(r => setEquipment(unwrap(r))).catch(() => {});
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
    <div className="modal-back">
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

// Переключатели расширенных функций (Аналитика, 1С) + скрытие демо-логина
function FeatureToggles({ showToast }) {
  const [flags, setFlags] = React.useState(null);
  const FEATURES = [
    { key: 'feature_analytics', label: 'Аналитика цеха', desc: 'Загрузка РЦ, узкие места, нормоконтроль' },
    { key: 'feature_1c',        label: 'Интеграция 1С',  desc: 'Экспорт заказов и номенклатуры в 1С' },
  ];

  React.useEffect(() => {
    api.get('/settings/public').then(r => setFlags((r && r.data) ? r.data : {})).catch(() => setFlags({}));
  }, []);

  async function toggle(key, on) {
    setFlags(f => ({ ...f, [key]: on ? '1' : '0' }));
    try {
      await api.post('/settings', { key: key, value: on ? '1' : '0' });
      showToast && showToast(on ? 'Включено' : 'Выключено');
    } catch (e) {
      setFlags(f => ({ ...f, [key]: on ? '0' : '1' })); // откат
      showToast && showToast('Ошибка: ' + e.message);
    }
  }

  if (!flags) return null;
  return (
    <div className="card" style={{ padding: 18 }}>
      <b style={{ fontSize: 15 }}>Функции</b>
      <p className="muted" style={{ fontSize: 13, margin: '8px 0 14px' }}>
        Расширенные модули и настройки отображения.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {FEATURES.map(f => {
          const on = flags[f.key] === '1';
          return (
            <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{f.label}</div>
                <div className="muted" style={{ fontSize: 12 }}>{f.desc}</div>
              </div>
              <button onClick={() => toggle(f.key, !on)}
                style={{ width: 46, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', flexShrink: 0,
                  background: on ? 'var(--accent)' : 'var(--line-1)', position: 'relative', transition: 'background .15s' }}>
                <span style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 20, height: 20,
                  borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Редактор списка материалов (для выпадающего списка в номенклатуре)
function MaterialsEditor({ showToast }) {
  const [text, setText] = React.useState(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    api.get('/settings/public').then(r => {
      const raw = (r && r.data && r.data.materials_list) || '';
      setText(raw.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean).join('\n'));
    }).catch(() => setText(''));
  }, []);

  async function save() {
    setSaving(true);
    const value = (text || '').split(/\n+/).map(s => s.trim()).filter(Boolean).join(',');
    try {
      await api.post('/settings', { key: 'materials_list', value });
      showToast && showToast('Список материалов сохранён');
    } catch (e) { showToast && showToast('Ошибка: ' + e.message); }
    setSaving(false);
  }

  if (text === null) return null;
  const count = (text || '').split(/\n+/).filter(s => s.trim()).length;
  return (
    <div className="card" style={{ padding: 18 }}>
      <b style={{ fontSize: 15 }}>Материалы для номенклатуры</b>
      <p className="muted" style={{ fontSize: 13, margin: '8px 0 12px' }}>
        Каждый материал с новой строки. Используется как выпадающий список при создании детали. ({count})
      </p>
      <textarea className="input" rows={8} value={text} onChange={e => setText(e.target.value)}
        placeholder="Сталь 45&#10;Сталь 40Х&#10;Нержавейка 12Х18Н10Т" style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
        <button className="btn primary" onClick={save} disabled={saving}>{saving ? '…' : 'Сохранить материалы'}</button>
      </div>
    </div>
  );
}

// Редактор ключевых системных настроек
function SettingsEditor({ showToast }) {
  const [vals, setVals] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const FIELDS = [
    { key: 'company_name',    label: 'Название предприятия', type: 'text' },
    { key: 'norm_warn_pct',   label: 'Порог предупреждения нормоконтроля, %', type: 'number', hint: 'Жёлтый при превышении' },
    { key: 'norm_crit_pct',   label: 'Критический порог нормоконтроля, %', type: 'number', hint: 'Красный при превышении' },
    { key: 'shift_day_start', label: 'Начало дневной смены', type: 'time' },
    { key: 'shift_day_end',   label: 'Конец дневной смены', type: 'time' },
    { key: 'timezone_offset', label: 'Смещение времени (±ЧЧ:ММ)', type: 'text', hint: 'Например +03:00' },
    { key: 'max_login_attempts', label: 'Макс. попыток входа в час', type: 'number' },
  ];

  React.useEffect(() => {
    api.get('/settings').then(r => {
      const data = (r && r.data) || {};
      const m = {};
      for (const f of FIELDS) m[f.key] = (data[f.key] && data[f.key].value) ?? '';
      setVals(m);
    }).catch(() => setVals({}));
  }, []);

  async function saveAll() {
    setSaving(true);
    try {
      for (const f of FIELDS) {
        await api.post('/settings', { key: f.key, value: String(vals[f.key] ?? '') });
      }
      showToast && showToast('Настройки сохранены');
    } catch (e) { showToast && showToast('Ошибка: ' + e.message); }
    setSaving(false);
  }

  if (!vals) return null;
  return (
    <div className="card" style={{ padding: 18 }}>
      <b style={{ fontSize: 15 }}>Настройки предприятия</b>
      <p className="muted" style={{ fontSize: 13, margin: '8px 0 14px' }}>Основные параметры системы.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {FIELDS.map(f => (
          <div key={f.key} className="field">
            <span className="field-label">{f.label}{f.hint && <span className="muted" style={{ fontWeight: 400 }}> — {f.hint}</span>}</span>
            <input className="input" type={f.type === 'number' ? 'number' : f.type === 'time' ? 'time' : 'text'}
              value={vals[f.key] ?? ''} onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
              style={{ width: '100%' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn primary" onClick={saveAll} disabled={saving}>{saving ? '…' : 'Сохранить настройки'}</button>
      </div>
    </div>
  );
}

// Резервное копирование и восстановление БД
function BackupPanel({ showToast }) {
  const [restoring, setRestoring] = React.useState(false);
  const [confirmFile, setConfirmFile] = React.useState(null);
  const fileRef = React.useRef(null);

  async function download() {
    try {
      const res = await fetch(API_BASE + '/backup/dump', {
        headers: { Authorization: 'Bearer ' + (Auth.getToken() || '') },
      });
      if (!res.ok) { const j = await res.json().catch(()=>({})); throw new Error(j.error || 'HTTP ' + res.status); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'marshrut-dump-' + new Date().toISOString().slice(0,10) + '.sql';
      a.click();
      URL.revokeObjectURL(url);
      showToast && showToast('Дамп базы скачан');
    } catch (e) { showToast && showToast('Ошибка: ' + e.message); }
  }

  function onFile(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (f) setConfirmFile(f);
  }

  async function doRestore() {
    const f = confirmFile;
    setConfirmFile(null);
    setRestoring(true);
    try {
      const sql = await f.text();
      const res = await fetch(API_BASE + '/backup/restore-sql', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + (Auth.getToken() || ''),
          'Content-Type': 'application/sql',
          'X-Confirm': 'RESTORE',
        },
        body: sql,
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'HTTP ' + res.status);
      showToast && showToast(`Восстановлено: ${j.executed} операций` + (j.errors?.length ? `, ошибок: ${j.errors.length}` : ''));
    } catch (e) { showToast && showToast('Ошибка восстановления: ' + e.message); }
    setRestoring(false);
  }

  return (
    <div className="card" style={{ padding: 18 }}>
      <b style={{ fontSize: 15 }}>Резервное копирование</b>
      <p className="muted" style={{ fontSize: 13, margin: '8px 0 14px' }}>
        Дамп содержит всё: заказы, задания, пользователей, номенклатуру, настройки, историю.
      </p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="btn primary" onClick={download}>⬇ Скачать дамп базы (.sql)</button>
        <button className="btn" onClick={() => fileRef.current && fileRef.current.click()} disabled={restoring}
          style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
          {restoring ? 'Восстановление…' : '⬆ Восстановить из дампа'}
        </button>
        <input ref={fileRef} type="file" accept=".sql" style={{ display: 'none' }} onChange={onFile} />
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        Восстановление перезапишет данные таблиц содержимым дампа. Перед этим скачайте свежий дамп.
      </p>

      {confirmFile && (
        <div className="modal-back" style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,.55)',
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div className="card" style={{ width: 420, padding: 22 }}>
            <b style={{ fontSize: 15, color: 'var(--danger)' }}>⚠ Восстановление из дампа</b>
            <p style={{ fontSize: 13, margin: '10px 0' }}>
              Файл: <span className="mono">{confirmFile.name}</span> ({Math.round(confirmFile.size/1024)} КБ)
            </p>
            <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
              Данные в базе будут перезаписаны. Действие необратимо. Продолжить?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setConfirmFile(null)}>Отмена</button>
              <button className="btn" style={{ background: 'var(--danger)', color: '#fff', borderColor: 'var(--danger)' }}
                onClick={doRestore}>Восстановить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
