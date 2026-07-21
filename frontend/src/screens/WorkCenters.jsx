import React from 'react'
import { api, Auth, API_BASE, parseServerDate, unwrap } from '../lib/api.js'
import { Icon } from '../components/Icon.jsx'
import { QrCode, generateQrSvg } from '../components/QrCode.jsx'
import { useStrings, StatusPill, OrderPicker, ORDER_STATUS_RU, STATUS_LABEL_RU } from '../lib/data.jsx'

export function WorkshopView({ workshops, tasks, lang, onManage }) {
  const [selId,    setSelId]    = React.useState(workshops[0]?.id || null);
  const [loadData, setLoadData] = React.useState(null);
  const [days,     setDays]     = React.useState(7);
  const [loading,  setLoading]  = React.useState(false);

  const selected = workshops.find(w => w.id === selId);

  React.useEffect(() => {
    if (!selId) return;
    setLoading(true);
    fetch('/api/workshops/' + selId + '/load?days=' + days, {
      headers: { Authorization: 'Bearer ' + Auth.getToken() }
    })
    .then(r => r.json())
    .then(d => { setLoadData(d); setLoading(false); })
    .catch(() => setLoading(false));
  }, [selId, days]);

  // Задания цеха из frontend state (для живого обновления)
  // Загружаем workshop_id заказов для фолбека (задания без прямого workshop_id)
  const workshopTasks = React.useMemo(() => {
    if (!selId) return [];
    const sid = String(selId);
    return tasks.filter(t => {
      // Прямой workshop_id у задания
      if (t.workshopId && String(t.workshopId) === sid) return true;
      return false;
    });
  }, [tasks, selId]);

  const wStats = React.useMemo(() => {
    const total   = workshopTasks.length;
    const done    = workshopTasks.filter(t=>t.status==='done').length;
    const prog    = workshopTasks.filter(t=>t.status==='in_progress').length;
    const pct     = total > 0 ? Math.round(done*100/total) : 0;
    const planMin = workshopTasks.reduce((s,t) => s + t.time * t.planned, 0);
    // Нормоконтроль по цеху
    const factMin = workshopTasks.filter(t=>t.status==='done' && t.actualTime).reduce((s,t)=>s+t.actualTime,0);
    const overOps = workshopTasks.filter(t=>t.status==='done' && t.actualTime && t.actualTime > t.time * 1.15);
    const normPct = planMin > 0 && factMin > 0 ? Math.round(factMin / workshopTasks.filter(t=>t.status==='done').reduce((s,t)=>s+t.time*t.completed,0) * 100) : null;
    return { total, done, prog, pct, planMin, factMin, overOps, normPct };
  }, [workshopTasks]);

  // Группировка по рабочим центрам из frontend state
  const centerGroups = React.useMemo(() => {
    const map = {};
    workshopTasks.forEach(t => {
      if (!map[t.workCenter]) map[t.workCenter] = { name: t.workCenter, tasks: [] };
      map[t.workCenter].tasks.push(t);
    });
    return Object.values(map).map(g => {
      const total = g.tasks.length;
      const done  = g.tasks.filter(t=>t.status==='done').length;
      const prog  = g.tasks.filter(t=>t.status==='in_progress').length;
      const pct   = total > 0 ? Math.round(done*100/total) : 0;
      const planMin = g.tasks.reduce((s,t) => s + t.time * t.planned, 0);
      const doneMin = g.tasks.filter(t=>t.status==='done').reduce((s,t) => s + t.time * t.completed, 0);
      return { ...g, total, done, prog, pct, planMin, doneMin };
    }).sort((a,b) => b.total - a.total);
  }, [workshopTasks]);

  if (workshops.length === 0) return (
    <div style={{ padding:48, textAlign:'center', color:'var(--fg-2)' }}>
      <p style={{ marginBottom:16 }}>Нет цехов. Добавьте первый цех.</p>
      <button className="btn primary" onClick={onManage}><Icon name="plus" size={14}/>Добавить цех</button>
    </div>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Загрузка цехов</h1>
          <div className="page-sub">{workshops.length} цехов · {wStats.prog} операций в работе</div>
        </div>
        <div className="row">
          <div style={{ display:'flex', gap:4 }}>
            {[7,14,30].map(d => (
              <button key={d} onClick={()=>setDays(d)}
                style={{ padding:'6px 10px', borderRadius:7, border:'1px solid', fontSize:12,
                  cursor:'pointer', fontFamily:'var(--ui-font)',
                  background: days===d ? 'var(--accent)' : 'var(--bg-1)',
                  borderColor: days===d ? 'var(--accent)' : 'var(--line-1)',
                  color: days===d ? '#fff' : 'var(--fg-1)' }}>
                {d} дн.
              </button>
            ))}
          </div>
          <button className="btn" onClick={onManage}><Icon name="cog" size={14}/>Управление</button>
        </div>
      </div>

      {/* Список цехов */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {workshops.map(w => (
          <button key={w.id} onClick={() => setSelId(w.id)}
            style={{ padding:'8px 14px', borderRadius:10, border:'1px solid', cursor:'pointer',
              fontFamily:'var(--ui-font)', fontSize:13,
              background: selId===w.id ? 'var(--accent)' : 'var(--bg-1)',
              borderColor: selId===w.id ? 'var(--accent)' : 'var(--line-1)',
              color: selId===w.id ? '#fff' : 'var(--fg-0)',
              opacity: w.is_active ? 1 : .5 }}>
            <span style={{ fontWeight:600 }}>{w.code}</span>
            <span style={{ marginLeft:6, fontSize:11, opacity:.8 }}>{w.name.split('—')[0].trim()}</span>
          </button>
        ))}
      </div>

      {selected && (
        <>
          {/* KPI цеха */}
          <div className="grid-4" style={{ marginBottom:16 }}>
            <div className="kpi">
              <div className="kpi-label">Всего операций</div>
              <div className="kpi-value num">{wStats.total}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">В работе</div>
              <div className="kpi-value num" style={{ color:'var(--accent)' }}>{wStats.prog}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Выполнено</div>
              <div className="kpi-value num">{wStats.done}<span className="unit">/{wStats.total}</span></div>
              <div className="kpi-meta">{wStats.pct}%</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Трудоёмкость</div>
              <div className="kpi-value num">{Math.round(wStats.planMin/60)}<span className="unit">ч</span></div>
              <div className="kpi-meta">{wStats.planMin % 60} мин</div>
            </div>
            {wStats.normPct && (
              <div className="kpi" style={{ borderLeft: wStats.overOps.length > 0 ? '2px solid var(--danger)' : undefined }}>
                <div className="kpi-label">Нормоконтроль</div>
                <div className="kpi-value num" style={{ color: wStats.normPct > 115 ? 'var(--danger)' : wStats.normPct > 100 ? 'var(--warning,#c07820)' : 'var(--st-done-line)' }}>
                  {wStats.normPct}%
                </div>
                <div className="kpi-meta" style={{ color: wStats.overOps.length > 0 ? 'var(--danger)' : 'var(--fg-2)' }}>
                  {wStats.overOps.length > 0 ? `${wStats.overOps.length} превышений` : 'в норме'}
                </div>
              </div>
            )}
          </div>

          {/* Загрузка рабочих центров */}
          <div className="card" style={{ padding:'16px 18px', marginBottom:14 }}>
            <div className="subhead" style={{ marginTop:0 }}>Рабочие центры — {selected.name.split('—')[1]?.trim() || selected.name}</div>
            {centerGroups.length === 0 ? (
              <div style={{ padding:'24px 0', textAlign:'center', color:'var(--fg-2)', fontSize:13 }}>
                Нет заданий в этом цехе
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:12 }}>
                {centerGroups.map(g => (
                  <div key={g.name}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                      <span style={{ fontSize:13, fontWeight:500, color:'var(--fg-0)', minWidth:120 }}>
                        {g.name}
                      </span>
                      <div style={{ flex:1, height:16, background:'var(--bg-3)', borderRadius:4, overflow:'hidden', position:'relative' }}>
                        {/* Выполнено */}
                        <div style={{ position:'absolute', left:0, top:0, height:'100%', width:g.pct+'%',
                          background:'var(--st-done-line)', opacity:.85, borderRadius:4 }}/>
                        {/* В работе */}
                        <div style={{ position:'absolute', left:g.pct+'%', top:0, height:'100%',
                          width: (g.total > 0 ? Math.round(g.prog*100/g.total) : 0)+'%',
                          background:'var(--accent)', opacity:.6 }}/>
                        {g.pct > 8 && (
                          <span style={{ position:'absolute', left:6, top:0, lineHeight:'16px',
                            fontSize:10, color:'#fff', fontWeight:600 }}>{g.pct}%</span>
                        )}
                      </div>
                      <div style={{ display:'flex', gap:10, fontSize:11, color:'var(--fg-2)', minWidth:160, justifyContent:'flex-end' }}>
                        <span><b style={{ color:'var(--fg-0)' }}>{g.done}</b>/{g.total}</span>
                        {g.prog > 0 && <span style={{ color:'var(--accent)' }}>{g.prog} в раб.</span>}
                        <span className="num">{Math.round(g.planMin/60)}ч</span>
                      </div>
                    </div>
                    {/* Нормо-часы план/факт */}
                    {g.doneMin > 0 && (
                      <div style={{ display:'flex', gap:16, fontSize:10, color:'var(--fg-2)', marginLeft:130, marginTop:2 }}>
                        <span>план: <b className="num">{Math.round(g.planMin/60)}ч {g.planMin%60}м</b></span>
                        <span>факт: <b className="num" style={{ color: g.doneMin > g.planMin ? 'var(--danger)' : 'var(--st-done-line)' }}>
                          {Math.round(g.doneMin/60)}ч {g.doneMin%60}м
                        </b></span>
                        {g.planMin > 0 && (
                          <span>откл: <b className="num" style={{ color: g.doneMin > g.planMin ? 'var(--danger)' : 'var(--st-done-line)' }}>
                            {g.doneMin > g.planMin ? '+' : ''}{Math.round((g.doneMin - g.planMin)/60*10)/10}ч
                          </b></span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}


export function ModalManageWorkshops({ workshops, onClose, onSaved }) {
  const [list,     setList]    = React.useState(workshops);
  const [tab,      setTab]     = React.useState('workshops'); // 'workshops' | 'equipment'
  const [selWid,   setSelWid]  = React.useState(workshops[0]?.id || null);
  const [equipment, setEquip]  = React.useState([]);
  const [loadingEq, setLoadEq] = React.useState(false);
  const [editing,  setEditing] = React.useState(null);
  const [form,     setForm]    = React.useState({ code:'', name:'', description:'', is_active:1 });
  const [eqForm,   setEqForm]  = React.useState({ code:'', name:'', type:'' });
  const [saving,   setSaving]  = React.useState(false);


  // Загружаем оборудование при выборе цеха
  React.useEffect(() => {
    if (!selWid || tab !== 'equipment') return;
    setLoadEq(true);
    api.get('/workshops/' + selWid + '/equipment')
    .then(d=>{ setEquip(unwrap(d)); setLoadEq(false); })
    .catch(()=>setLoadEq(false));
  }, [selWid, tab]);

  async function saveWorkshop() {
    if (!form.code || !form.name) return;
    setSaving(true);
    try {
      const res = editing?.id
        ? await api.put('/workshops/'+editing.id, form)
        : await api.post('/workshops', form);
      const newList = editing?.id
        ? list.map(w => w.id===editing.id ? res : w)
        : [...list, res];
      setList(newList);
      onSaved(newList);
      setEditing(null);
      setForm({ code:'', name:'', description:'', is_active:1 });
    } catch(e) { alert('Ошибка: '+e.message); }
    setSaving(false);
  }

  async function deleteWorkshop(id) {
    if (!confirm('Удалить цех?')) return;
    await api.delete('/workshops/'+id);
    const newList = list.filter(w=>w.id!==id);
    setList(newList);
    onSaved(newList);
    if (selWid===id) setSelWid(newList[0]?.id||null);
  }

  async function addEquipment() {
    if (!eqForm.code || !eqForm.name) return;
    setSaving(true);
    try {
      const res = await api.post('/workshops/'+selWid+'/equipment', eqForm);
      setEquip(prev=>[...prev, res]);
      setEqForm({ code:'', name:'', type:'' });
    } catch(e) { alert('Ошибка: '+e.message); }
    setSaving(false);
  }

  async function deleteEquipment(id) {
    await api.delete('/equipment/'+id);
    setEquip(prev=>prev.filter(e=>e.id!==id));
  }

  const EQ_TYPES = ['Токарный','Фрезерный','Шлифовальный','Сверлильный','Заготовительный','Сборочный','Термический','Прочее'];

  return (
    <div className="modal-back">
      <div className="modal" style={{ maxWidth:600 }}>
        <div className="modal-head">
          <b>Управление цехами и оборудованием</b>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16}/></button>
        </div>

        {/* Табы */}
        <div style={{ display:'flex', gap:4, padding:'0 16px', borderBottom:'1px solid var(--line-2)' }}>
          {[['workshops','Цеха'],['equipment','Оборудование']].map(([v,l])=>(
            <button key={v} onClick={()=>setTab(v)}
              style={{ padding:'8px 14px', border:'none', background:'transparent', cursor:'pointer',
                fontFamily:'var(--ui-font)', fontSize:13, color: tab===v ? 'var(--accent)' : 'var(--fg-2)',
                borderBottom: tab===v ? '2px solid var(--accent)' : '2px solid transparent',
                fontWeight: tab===v ? 600 : 400 }}>
              {l}
            </button>
          ))}
        </div>

        <div className="modal-body" style={{ minHeight:320 }}>

          {/* ── ВКЛ: ЦЕХА ── */}
          {tab === 'workshops' && (
            <div>
              <div style={{ marginBottom:12 }}>
                {list.map(w => (
                  <div key={w.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0',
                    borderBottom:'1px solid var(--line-2)', opacity: w.is_active ? 1 : .5 }}>
                    <span className="mono" style={{ fontSize:12, color:'var(--accent)', width:55 }}>{w.code}</span>
                    <span style={{ flex:1, fontSize:13 }}>{w.name}</span>
                    <button className="icon-btn" onClick={()=>{ setEditing(w); setForm({code:w.code,name:w.name,description:w.description||'',is_active:w.is_active}); }}>
                      <Icon name="edit" size={14}/>
                    </button>
                    <button className="icon-btn" style={{ color:'var(--danger)' }} onClick={()=>deleteWorkshop(w.id)}>
                      <Icon name="trash" size={14}/>
                    </button>
                  </div>
                ))}
                {list.length===0 && <div style={{color:'var(--fg-2)',fontSize:13,padding:'8px 0'}}>Нет цехов</div>}
              </div>
              <div className="subhead">{editing ? 'Редактировать' : 'Добавить цех'}</div>
              <div style={{ display:'grid', gridTemplateColumns:'90px 1fr', gap:8, marginTop:8 }}>
                <div className="field">
                  <span className="field-label">Код</span>
                  <input className="input" value={form.code} onChange={e=>setForm(p=>({...p,code:e.target.value}))} placeholder="ЦЕХ1"/>
                </div>
                <div className="field">
                  <span className="field-label">Название</span>
                  <input className="input" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Цех №1 — Механообработка"/>
                </div>
              </div>
              <div className="field" style={{ marginTop:6 }}>
                <span className="field-label">Описание</span>
                <input className="input" value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}/>
              </div>
              <div style={{ display:'flex', gap:6, marginTop:10, justifyContent:'flex-end' }}>
                {editing && <button className="btn" onClick={()=>{setEditing(null);setForm({code:'',name:'',description:'',is_active:1});}}>Отмена</button>}
                <button className="btn primary" onClick={saveWorkshop} disabled={saving}>
                  {saving ? 'Сохранение…' : (editing ? 'Сохранить' : '+ Добавить')}
                </button>
              </div>
            </div>
          )}

          {/* ── ВКЛ: ОБОРУДОВАНИЕ ── */}
          {tab === 'equipment' && (
            <div>
              {/* Выбор цеха */}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
                {list.map(w=>(
                  <button key={w.id} onClick={()=>setSelWid(w.id)}
                    style={{ padding:'4px 10px', borderRadius:7, border:'1px solid', fontSize:12,
                      cursor:'pointer', fontFamily:'var(--ui-font)',
                      background: selWid===w.id ? 'var(--accent)' : 'var(--bg-1)',
                      borderColor: selWid===w.id ? 'var(--accent)' : 'var(--line-1)',
                      color: selWid===w.id ? '#fff' : 'var(--fg-1)' }}>
                    {w.code}
                  </button>
                ))}
              </div>

              {/* Список оборудования */}
              {loadingEq ? (
                <div style={{ color:'var(--fg-2)', fontSize:13, padding:12 }}>Загрузка…</div>
              ) : (
                <div style={{ marginBottom:12 }}>
                  {equipment.map(e=>(
                    <div key={e.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 0',
                      borderBottom:'1px solid var(--line-2)' }}>
                      <span className="mono" style={{ fontSize:12, color:'var(--accent)', width:80 }}>{e.code}</span>
                      <span style={{ flex:1, fontSize:13 }}>{e.name}</span>
                      {e.type && <span style={{ fontSize:11, color:'var(--fg-2)', background:'var(--bg-3)', padding:'1px 7px', borderRadius:4 }}>{e.type}</span>}
                      <button className="icon-btn" style={{ color:'var(--danger)' }} onClick={()=>deleteEquipment(e.id)}>
                        <Icon name="trash" size={13}/>
                      </button>
                    </div>
                  ))}
                  {equipment.length===0 && <div style={{color:'var(--fg-2)',fontSize:13,padding:'8px 0'}}>Нет оборудования</div>}
                </div>
              )}

              {/* Форма добавления */}
              <div className="subhead">Добавить оборудование</div>
              <div style={{ display:'grid', gridTemplateColumns:'100px 1fr', gap:8, marginTop:8 }}>
                <div className="field">
                  <span className="field-label">Код/Марка</span>
                  <input className="input" value={eqForm.code} onChange={e=>setEqForm(p=>({...p,code:e.target.value}))} placeholder="ДИП-300"/>
                </div>
                <div className="field">
                  <span className="field-label">Название</span>
                  <input className="input" value={eqForm.name} onChange={e=>setEqForm(p=>({...p,name:e.target.value}))} placeholder="Токарный ДИП-300"/>
                </div>
              </div>
              <div className="field" style={{ marginTop:6 }}>
                <span className="field-label">Тип</span>
                <select className="select" value={eqForm.type} onChange={e=>setEqForm(p=>({...p,type:e.target.value}))}>
                  <option value="">Выбрать тип…</option>
                  {EQ_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ display:'flex', justifyContent:'flex-end', marginTop:10 }}>
                <button className="btn primary" onClick={addEquipment} disabled={saving||!selWid}>
                  {saving ? 'Добавление…' : '+ Добавить'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


export function ModalManageWorkCenters({ workCenters, onClose, onSaved }) {
  const [list,   setList]   = React.useState(workCenters);
  const [form,   setForm]   = React.useState({ code:'', name:'' });
  const [saving, setSaving] = React.useState(false);

  async function add() {
    if (!form.code || !form.name) return;
    setSaving(true);
    try {
      const res = await api.post('/work-centers', form);
      const nl = [...list, res];
      setList(nl); onSaved(nl);
      setForm({ code:'', name:'' });
    } catch(e) { alert('Ошибка: '+e.message); }
    setSaving(false);
  }

  async function del(id) {
    if (!confirm('Удалить рабочий центр?')) return;
    await api.delete('/work-centers/'+id);
    const nl = list.filter(w => w.id !== id);
    setList(nl); onSaved(nl);
  }

  return (
    <div className="modal-back">
      <div className="modal" style={{ maxWidth:520 }}>
        <div className="modal-head">
          <b>Управление рабочими центрами</b>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16}/></button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom:12 }}>
            {list.map(w => (
              <div key={w.id} style={{ display:'flex', alignItems:'center', gap:8,
                padding:'7px 0', borderBottom:'1px solid var(--line-2)' }}>
                <span className="mono" style={{ fontSize:13, color:'var(--accent)', width:50, fontWeight:700 }}>{w.code}</span>
                <span style={{ flex:1, fontSize:13 }}>{w.name}</span>
                <button className="icon-btn" style={{color:'var(--danger)'}} onClick={()=>del(w.id)}>
                  <Icon name="trash" size={13}/>
                </button>
              </div>
            ))}
          </div>
          <div className="subhead">Добавить рабочий центр</div>
          <div style={{ display:'grid', gridTemplateColumns:'80px 1fr', gap:8, marginTop:8 }}>
            <div className="field">
              <span className="field-label">Код</span>
              <input className="input" value={form.code} onChange={e=>setForm(p=>({...p,code:e.target.value}))} placeholder="101"/>
            </div>
            <div className="field">
              <span className="field-label">Название</span>
              <input className="input" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Заготовка"/>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn primary" onClick={add} disabled={saving}>{saving?'…':'+ Добавить'}</button>
        </div>
      </div>
    </div>
  );
}




// =======================================================
// WorkCentersView — рабочие центры с очередью заданий
// =======================================================

export function WorkCentersView({ tasks, data, workCenters, lang, onManage, onAction }) {
  const [selId, setSelId] = React.useState(null);
  const [tick, setTick] = React.useState(0); // forces re-render every 30s for timers
  const [dragId, setDragId] = React.useState(null);
  const [groupOrder, setGroupOrder] = React.useState({}); // { wcKey: [orderId,...] }
  const canReorder = Auth.can('orders.edit') || Auth.isAdmin();

  // Перетащили заказ — сохраняем приоритет (queue_pos на заданиях)
  async function reorderGroups(wcKey, orderedGroups) {
    setGroupOrder(prev => ({ ...prev, [wcKey]: orderedGroups.map(g => g.order?.id) }));
    const taskIds = orderedGroups.flatMap(g => g.tasks.map(t => t.id));
    try { await api.post('/tasks/reorder', { task_ids: taskIds }); } catch (e) {}
  }
  React.useEffect(() => {
    const id = setInterval(() => setTick(t => t+1), 30000);
    return () => clearInterval(id);
  }, []);

  function getElapsed(startedAt) {
    if (!startedAt) return 0;
    const _d = parseServerDate(startedAt); return _d ? Math.max(0, Math.round((Date.now() - _d.getTime()) / 60000)) : 0;
  }

  // Группируем задания по рабочему центру
  // Матчинг: task.work_center (строка-код "101") или task.workCenterId (int FK)
  // Для каждой детали в каждом заказе — только ТЕКУЩАЯ (первая незавершённая) операция
  function getCurrentTasks() {
    // В производственном табло — ТОЛЬКО заказы в статусе «В работе».
    const activeOrders = new Set(
      (data.orders || []).filter(o => o.status === 'in_work').map(o => o.id)
    );
    // Группируем все задания по (orderId, detailId)
    const groups = {};
    tasks.forEach(t => {
      if (!activeOrders.has(t.orderId)) return;
      const key = t.orderId + '::' + t.detailId;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    // Из каждой группы берём только первую незавершённую (по opNum)
    const current = [];
    Object.values(groups).forEach(grp => {
      const sorted = [...grp].sort((a,b) => a.opNum - b.opNum);
      // Найти первую операцию которая не done/rejected/cancelled
      const first = sorted.find(t => !['done','rejected','cancelled'].includes(t.status));
      if (first) current.push(first);
    });
    return current;
  }

  const currentTasks = React.useMemo(() => getCurrentTasks(), [tasks, data.orders]);

  function getTasksForWC(wc) {
    return currentTasks.filter(t =>
      t.workCenter === wc.code ||
      (t.workCenterId && String(t.workCenterId) === String(wc.id))
    );
  }

  const wcWithTasks = workCenters.filter(w => w.is_active).map(wc => {
    const active  = getTasksForWC(wc);
    const prog    = active.filter(t => t.status === 'in_progress');
    const paused  = active.filter(t => t.status === 'paused');
    return { ...wc, all: active, active, prog, paused };
  });

  const selected = selId ? wcWithTasks.find(w => w.id === selId) : null;

  // Группировка по заказам для выбранного РЦ
  const orderGroups = React.useMemo(() => {
    if (!selected) return [];
    const groups = {};
    selected.active.forEach(t => {
      if (!groups[t.orderId]) {
        const order = data?.orders?.find(o => o.id === t.orderId);
        groups[t.orderId] = { order, tasks: [] };
      }
      groups[t.orderId].tasks.push(t);
    });
    const wcKey = selected.code || selected.id;
    const ov = groupOrder[wcKey];
    const minPos = g => Math.min(...g.tasks.map(t => t.queuePos || 0).concat([0]));
    return Object.values(groups).sort((a,b) => {
      if (ov) {
        const ia = ov.indexOf(a.order?.id), ib = ov.indexOf(b.order?.id);
        if (ia !== -1 || ib !== -1) {
          if (ia === -1) return 1; if (ib === -1) return -1;
          return ia - ib;
        }
      }
      const ap = a.tasks.some(t=>t.status==='in_progress') ? 0 : 1;
      const bp = b.tasks.some(t=>t.status==='in_progress') ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return minPos(a) - minPos(b);
    });
  }, [selected, data, groupOrder]);

  const STATUS_CLS = { waiting:'wait', in_progress:'prog', done:'done', paused:'wait' };
  const STATUS_LBL = { waiting:'Ожидает', in_progress:'В работе', paused:'Пауза', rework:'Переделка' };

  if (workCenters.length === 0) return (
    <div style={{ padding:48, textAlign:'center', color:'var(--fg-2)' }}>
      <p style={{ marginBottom:16 }}>Нет рабочих центров.</p>
      <button className="btn primary" onClick={onManage}><Icon name="plus" size={14}/>Добавить</button>
    </div>
  );


  // Inline LiveTimer component
  function LiveTimer({ task: t, planMin }) {
    const [elapsed, setElapsed] = React.useState(0);
    React.useEffect(() => {
      if (t.status !== 'in_progress' || !t.startedAt) { setElapsed(0); return; }
      const calc = () => { const _d = parseServerDate(t.startedAt); if (_d) setElapsed(Math.max(0, Math.round((Date.now() - _d.getTime()) / 60000))); };
      calc();
      const id = setInterval(calc, 15000);
      return () => clearInterval(id);
    }, [t.startedAt, t.status]);
    if (t.status === 'waiting') return React.createElement('span', {style:{fontSize:11,color:'var(--fg-2)'}}, planMin + '′ план');
    if (t.status === 'done') {
      const a = t.actualTime || 0;
      return React.createElement('div', {style:{fontSize:11,lineHeight:1.3}},
        React.createElement('div', {className:'num',style:{color:a>planMin?'var(--danger)':'var(--st-done-line)',fontWeight:600}}, a + '′ факт'),
        React.createElement('div', {style:{fontSize:9,color:'var(--fg-2)'}}, 'пл: ' + planMin + '′')
      );
    }
    if (t.status === 'paused') return React.createElement('span', {style:{fontSize:11,color:'var(--warning,#c07820)'}}, '⏸ ' + elapsed + '′');
    const over = elapsed > planMin;
    const pct  = planMin > 0 ? Math.min(100, Math.round(elapsed/planMin*100)) : 0;
    const color = over ? 'var(--danger)' : elapsed > planMin*0.85 ? 'var(--warning,#c07820)' : 'var(--accent)';
    return (
      <div style={{fontSize:11,lineHeight:1.3}}>
        <div className="num" style={{color,fontWeight:700}}>⏱ {elapsed}′ / {planMin}′</div>
        <div style={{height:2,width:48,background:'var(--bg-3)',borderRadius:1,margin:'2px 0',overflow:'hidden'}}>
          <div style={{height:'100%',width:pct+'%',background:color,borderRadius:1}}/>
        </div>
        {over && <div style={{fontSize:8,color:'var(--danger)',fontWeight:700}}>+{elapsed-planMin}′</div>}
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Рабочие центры</h1>
          <div className="page-sub">
            {wcWithTasks.filter(w=>w.prog.length>0).length} активных ·{' '}
            {wcWithTasks.reduce((s,w)=>s+w.active.length,0)} заданий в очереди
          </div>
        </div>
        <div className="row">
          <button className="btn" onClick={onManage}><Icon name="cog" size={14}/>Управление</button>
        </div>
      </div>

      {/* ── Карточки рабочих центров ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:10, marginBottom:20 }}>
        {wcWithTasks.map(wc => (
          <div key={wc.id}
            onClick={() => setSelId(selId === wc.id ? null : wc.id)}
            style={{
              background:'var(--bg-1)', border:'1px solid',
              borderColor: wc.prog.length>0 ? 'var(--accent)' : selId===wc.id ? 'var(--accent)' : 'var(--line-1)',
              borderRadius:12, padding:'12px 14px', cursor:'pointer',
              boxShadow: selId===wc.id ? '0 0 0 2px var(--accent)' : 'none',
              opacity: wc.active.length===0 ? .55 : 1,
              transition:'all .15s',
            }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div className="mono" style={{ fontSize:18, fontWeight:800, color:'var(--accent)', lineHeight:1 }}>{wc.code}</div>
                <div style={{ fontSize:12, color:'var(--fg-1)', marginTop:3, fontWeight:500 }}>{wc.name}</div>
              </div>
              {wc.prog.length > 0 && (
                <span style={{ background:'var(--accent)', color:'#fff', borderRadius:99,
                  fontSize:11, fontWeight:700, padding:'2px 8px' }}>
                  ▶ {wc.prog.length}
                </span>
              )}
            </div>
            <div style={{ display:'flex', gap:10, marginTop:10, fontSize:11, color:'var(--fg-2)' }}>
              <span><b style={{color:'var(--fg-0)'}}>{wc.active.length}</b> в очереди</span>
              {wc.paused.length > 0 && <span style={{color:'var(--warning,#c07820)'}}>⏸ {wc.paused.length}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* ── Детальный вид выбранного РЦ ── */}
      {selected && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div>
              <span className="mono" style={{ fontSize:20, fontWeight:800, color:'var(--accent)' }}>{selected.code}</span>
              <span style={{ fontSize:16, fontWeight:600, marginLeft:10 }}>{selected.name}</span>
            </div>
            <button className="icon-btn" onClick={()=>setSelId(null)}><Icon name="x" size={16}/></button>
          </div>

          {orderGroups.length === 0 ? (
            <div style={{ padding:32, textAlign:'center', color:'var(--fg-2)', fontSize:13 }}>
              Нет активных заданий на этом рабочем центре
            </div>
          ) : (
            orderGroups.map(({order, tasks: grpTasks}, gi) => (
              <div key={order?.id || 'unknown'} className="card"
                draggable={canReorder}
                onDragStart={canReorder ? (e)=>{ setDragId(order?.id); e.dataTransfer.effectAllowed='move'; } : undefined}
                onDragOver={canReorder ? (e)=>{ e.preventDefault(); } : undefined}
                onDrop={canReorder ? (e)=>{
                  e.preventDefault();
                  if (!dragId || dragId === order?.id) { setDragId(null); return; }
                  const fromIdx = orderGroups.findIndex(g => g.order?.id === dragId);
                  if (fromIdx === -1) { setDragId(null); return; }
                  const next = [...orderGroups];
                  const [moved] = next.splice(fromIdx, 1);
                  next.splice(gi, 0, moved);
                  reorderGroups(selected.code || selected.id, next);
                  setDragId(null);
                } : undefined}
                style={{ padding:0, overflow:'hidden', marginBottom:10,
                  cursor: canReorder ? 'grab' : 'default',
                  opacity: dragId === order?.id ? 0.4 : 1 }}>
                {/* Заголовок заказа */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                  padding:'10px 14px', background:'var(--bg-2)', borderBottom:'1px solid var(--line-2)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    {canReorder && <span title="Перетащите заказ для приоритета" style={{ color:'var(--fg-2)', fontSize:14, cursor:'grab' }}>⠿</span>}
                    <span className="mono" style={{ fontWeight:700, color:'var(--accent)', fontSize:14 }}>
                      {order?.number || order?.id}
                    </span>
                    {order?.foreman && <span style={{ fontSize:12, color:'var(--fg-2)' }}>{order.foreman}</span>}
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    {order?.dueDate && (
                      <span style={{ fontSize:11, fontFamily:'monospace', color:'var(--fg-2)' }}>
                        до {order.dueDate}
                      </span>
                    )}
                    <span style={{ fontSize:11, color:'var(--fg-2)' }}>{grpTasks.length} оп.</span>
                  </div>
                </div>

                {/* Задания */}
                {grpTasks.sort((a,b)=>a.opNum-b.opNum).map(t => {
                  const planMin = t.time * t.planned;
                  const elapsed = t.status === 'in_progress' && t.startedAt
                    ? getElapsed(t.startedAt) + (tick * 0) : 0;
                  const over  = elapsed > planMin && elapsed > 0;
                  const color = over ? 'var(--danger)' : elapsed > planMin*0.85 ? 'var(--warning,#c07820)' : 'var(--accent)';
                  const qrSvg = QrCode ? null : null; // использовать QrCode компонент
                  return (
                    <div key={t.id} style={{
                      display:'flex', alignItems:'center', gap:10, padding:'12px 14px',
                      borderBottom:'1px solid var(--line-2)', flexWrap:'wrap',
                      background: t.status==='in_progress' ? 'rgba(217,72,15,.05)' :
                                  t.status==='paused' ? 'rgba(192,120,32,.05)' : 'transparent',
                    }}>
                      {/* Номер + название */}
                      <div style={{ minWidth:180, flex:2 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span className="mono" style={{ fontWeight:800, color:'var(--accent)', fontSize:14 }}>
                            {String(t.opNum).padStart(3,'0')}
                          </span>
                          <span style={{ fontSize:13, fontWeight:600 }}>{t.opName}</span>
                        </div>
                        {t.operator && (
                          <div style={{ fontSize:11, color:'var(--fg-2)', marginTop:2 }}>
                            👤 {t.operator}
                          </div>
                        )}
                      </div>

                      {/* Таймер */}
                      <div style={{ minWidth:90, textAlign:'center' }}>
                        {t.status === 'waiting' && (
                          <div style={{ fontSize:11, color:'var(--fg-2)' }}>{planMin}′ план</div>
                        )}
                        {t.status === 'in_progress' && (
                          <div>
                            <div style={{ fontSize:14, fontWeight:800, color, fontFamily:'monospace' }}>
                              ⏱ {elapsed}′
                            </div>
                            <div style={{ fontSize:10, color:'var(--fg-2)' }}>/ {planMin}′ план</div>
                            <div style={{ height:3, width:72, background:'var(--bg-3)', borderRadius:2, margin:'4px auto', overflow:'hidden' }}>
                              <div style={{ height:'100%', width:Math.min(100,Math.round(elapsed/planMin*100))+'%',
                                background:color, borderRadius:2, transition:'width 1s' }}/>
                            </div>
                            {over && <div style={{ fontSize:9, color:'var(--danger)', fontWeight:700 }}>+{elapsed-planMin}′ просрочено</div>}
                          </div>
                        )}
                        {t.status === 'paused' && (
                          <div style={{ fontSize:11, color:'var(--warning,#c07820)' }}>⏸ пауза · {elapsed}′</div>
                        )}
                        {t.status === 'done' && (
                          <div style={{ fontSize:11, color:'var(--st-done-line)' }}>
                            ✓ {t.actualTime ? t.actualTime + '′ факт' : 'выполнено'}
                          </div>
                        )}
                      </div>

                      {/* Кол-во */}
                      <div style={{ fontSize:12, color:'var(--fg-2)', minWidth:55, textAlign:'center' }}>
                        <div style={{ fontWeight:700, color:'var(--fg-0)' }}>{t.completed}/{t.planned}</div>
                        <div style={{ fontSize:10 }}>шт</div>
                      </div>

                      {/* Кнопки действий */}
                      <div style={{ display:'flex', flexDirection:'column', gap:4, minWidth:90 }}>
                        {t.status === 'waiting' && t.setupTime > 0 && !t.setupDone && (
                          !t.setupStartedAt ? (
                            <button className="btn" style={{ fontSize:11, padding:'5px 10px', color:'var(--warning,#c07820)', borderColor:'var(--warning,#c07820)' }}
                              onClick={() => onAction && onAction('setup-start', t)} title={'Наладка (ТПЗ): '+t.setupTime+' мин'}>
                              🔧 Наладка
                            </button>
                          ) : (
                            <>
                              {(() => {
                                const se = getElapsed(t.setupStartedAt); void tick;
                                const sover = se > t.setupTime && t.setupTime > 0;
                                const scolor = sover ? 'var(--danger)' : se > t.setupTime*0.85 ? 'var(--warning,#c07820)' : 'var(--accent)';
                                return (
                                  <div style={{ textAlign:'center', lineHeight:1.1, marginBottom:2 }}>
                                    <div className="num" style={{ color:scolor, fontWeight:700, fontSize:12 }}>🔧 {se}′ / {t.setupTime}′</div>
                                    {sover && <div style={{ fontSize:8, color:'var(--danger)', fontWeight:700 }}>+{se-t.setupTime}′</div>}
                                  </div>
                                );
                              })()}
                              <button className="btn primary" style={{ fontSize:11, padding:'5px 10px', background:'var(--st-done-line)', borderColor:'var(--st-done-line)' }}
                                onClick={() => onAction && onAction('setup-finish', t)}>
                                ✓ Наладка готова
                              </button>
                            </>
                          )
                        )}
                        {t.status === 'waiting' && (t.setupTime === 0 || t.setupDone) && (
                          <button className="btn primary" style={{ fontSize:11, padding:'5px 10px' }}
                            onClick={() => onAction && onAction('start', t)}>
                            ▶ Начать
                          </button>
                        )}
                        {t.status === 'in_progress' && (<>
                          <button className="btn primary" style={{ fontSize:11, padding:'5px 10px', background:'var(--st-done-line)', borderColor:'var(--st-done-line)' }}
                            onClick={() => onAction && onAction('close', t)}>
                            ✓ Закрыть
                          </button>
                          <button className="btn" style={{ fontSize:11, padding:'4px 10px', color:'var(--warning,#c07820)', borderColor:'var(--warning,#c07820)' }}
                            onClick={() => onAction && onAction('pause', t)}>
                            ⏸ Пауза
                          </button>
                        </>)}
                        {t.status === 'paused' && (
                          <button className="btn primary" style={{ fontSize:11, padding:'5px 10px' }}
                            onClick={() => onAction && onAction('resume', t)}>
                            ▶ Продолжить
                          </button>
                        )}
                        <span className={'pill '+(STATUS_CLS[t.status]||'wait')} style={{ justifyContent:'center' }}>
                          <span className="dot"/>{STATUS_LBL[t.status]||t.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
}


// =======================================================
// ExcelExportView — выгрузки в Excel
// =======================================================
