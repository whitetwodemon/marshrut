import React from 'react'
import { Icon } from '../components/Icon.jsx'
import { QrCode, generateQrSvg } from '../components/QrCode.jsx'
import { useStrings, StatusPill, OrderPicker } from '../lib/data.jsx'
import { api } from '../lib/api.js'

function WorkshopView({ workshops, tasks, lang, onManage }) {
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

function ModalManageWorkshops({ workshops, onClose, onSaved }) {
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
    .then(d=>{ setEquip(d.data||[]); setLoadEq(false); })
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
    <div className="modal-back" onClick={e=>e.target===e.currentTarget&&onClose()}>
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

export { WorkshopView, ModalManageWorkshops }
