import React from 'react'
import { Icon } from '../components/Icon.jsx'
import { QrCode, generateQrSvg } from '../components/QrCode.jsx'
import { useStrings, StatusPill, OrderPicker } from '../lib/data.jsx'
import { api } from '../lib/api.js'

function LibraryOpsEditor({ detail, lang, onSaved, workCenters }) {
  const [ops, setOps]       = React.useState(() => [...(detail.operations||[])].sort((a,b)=>a.num-b.num));
  const [editIdx, setEditIdx] = React.useState(null); // index being edited
  const [editForm, setEditForm] = React.useState({});
  const [addAfter, setAddAfter] = React.useState(null); // insert after this index
  const [newForm, setNewForm]   = React.useState({ name:'', workCenter:'', time:'' });
  const [saving, setSaving]     = React.useState(false);

  // Sync when detail changes
  React.useEffect(() => {
    setOps([...(detail.operations||[])].sort((a,b)=>a.num-b.num));
    setEditIdx(null); setAddAfter(null);
  }, [detail.id]);

  // Re-number ops with step 10
  function renumber(list) {
    return list.map((op, i) => ({ ...op, num: (i + 1) * 10 }));
  }

  async function saveAll(newOps) {
    setSaving(true);
    try {
      await api.put('/details/' + detail.id, {
        ...detail,
        operations: newOps.map(op => ({
          num: op.num, name: op.name,
          work_center: op.workCenter, time_min: op.time,
        })),
      });
      setOps(newOps);
      onSaved && onSaved(detail);
    } catch(e) { alert('Ошибка сохранения: ' + e.message); }
    setSaving(false);
  }

  function startEdit(idx) {
    setEditIdx(idx);
    setEditForm({ name: ops[idx].name, workCenter: ops[idx].workCenter, time: ops[idx].time });
    setAddAfter(null);
  }

  function saveEdit() {
    const newOps = renumber(ops.map((op, i) =>
      i === editIdx ? { ...op, name: editForm.name, workCenter: editForm.workCenter, time: Number(editForm.time) } : op
    ));
    saveAll(newOps);
    setEditIdx(null);
  }

  function insertAfter(idx) {
    setAddAfter(idx);
    setNewForm({ name:'', workCenter:'', time:'' });
    setEditIdx(null);
  }

  function confirmInsert() {
    if (!newForm.name || !newForm.workCenter) return;
    const newOps = [...ops];
    newOps.splice(addAfter + 1, 0, { num: 0, name: newForm.name, workCenter: newForm.workCenter, time: Number(newForm.time||0) });
    saveAll(renumber(newOps));
    setAddAfter(null);
  }

  function deleteOp(idx) {
    if (!window.confirm('Удалить операцию?')) return;
    saveAll(renumber(ops.filter((_,i) => i !== idx)));
  }

  function moveOp(idx, dir) {
    const newOps = [...ops];
    const target = idx + dir;
    if (target < 0 || target >= newOps.length) return;
    [newOps[idx], newOps[target]] = [newOps[target], newOps[idx]];
    saveAll(renumber(newOps));
  }

  const S = useStrings(lang);

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 18px 4px' }}>
        <div className="subhead" style={{ margin:0 }}>{S.techCard}</div>
        <div style={{ display:'flex', gap:6 }}>
          <button className="btn ghost" onClick={() => insertAfter(-1)} style={{ fontSize:11 }}>
            <Icon name="plus" size={12}/>В начало
          </button>
          <button className="btn ghost" onClick={() => insertAfter(ops.length - 1)} style={{ fontSize:11 }}>
            <Icon name="plus" size={12}/>В конец
          </button>
        </div>
      </div>

      {ops.length === 0 && (
        <div style={{ padding:'16px 18px', color:'var(--fg-2)', fontSize:13 }}>
          Нет операций. Добавьте первую.
        </div>
      )}

      {ops.map((op, idx) => (
        <React.Fragment key={op.num + '_' + idx}>
          {/* Insert before first op */}
          {idx === 0 && addAfter === -1 && (
            <InsertOpRow form={newForm} setForm={setNewForm}
              onConfirm={confirmInsert} onCancel={()=>setAddAfter(null)}
              saving={saving} workCenters={workCenters}/>
          )}

          {/* Op row */}
          {editIdx === idx ? (
            <div style={{ display:'flex', gap:6, padding:'6px 12px', background:'var(--bg-1)',
              borderBottom:'1px solid var(--line-2)', alignItems:'center', flexWrap:'wrap' }}>
              <input className="input" value={editForm.name} style={{ flex:2, minWidth:120 }}
                onChange={e=>setEditForm(p=>({...p,name:e.target.value}))} placeholder="Название операции"/>
              <select className="select" value={editForm.workCenter}
                onChange={e=>setEditForm(p=>({...p,workCenter:e.target.value}))} style={{ flex:1 }}>
                <option value="">Выбрать РЦ…</option>
                {(workCenters||[]).map(w=><option key={w.id} value={w.code}>{w.code} — {w.name}</option>)}
              </select>
              <input className="input" type="number" value={editForm.time} style={{ width:64 }}
                onChange={e=>setEditForm(p=>({...p,time:e.target.value}))} placeholder="мин"/>
              <button className="btn primary" onClick={saveEdit} disabled={saving} style={{fontSize:12}}>
                {saving ? '…' : 'Сохранить'}
              </button>
              <button className="icon-btn" onClick={()=>setEditIdx(null)}><Icon name="x" size={14}/></button>
            </div>
          ) : (
            <div className="row-hover" style={{ display:'flex', alignItems:'center', gap:8,
              padding:'7px 12px', borderBottom:'1px solid var(--line-2)', fontSize:13 }}>
              <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                <button className="icon-btn" style={{padding:'0px 2px'}} onClick={()=>moveOp(idx,-1)}>
                  <Icon name="chevron-up" size={10}/>
                </button>
                <button className="icon-btn" style={{padding:'0px 2px'}} onClick={()=>moveOp(idx,1)}>
                  <Icon name="chevron-down" size={10}/>
                </button>
              </div>
              <span className="op-num mono" style={{width:32,fontWeight:700,color:'var(--accent)'}}>{String(op.num).padStart(3,'0')}</span>
              <span style={{flex:2,fontWeight:500}}>{op.name}</span>
              <span className="mono muted" style={{flex:1,fontSize:11}}>{op.workCenter}</span>
              <span className="num muted" style={{fontSize:11,width:40,textAlign:'right'}}>{op.time}′</span>
              <button className="icon-btn" title="Изменить" onClick={()=>startEdit(idx)}>
                <Icon name="edit" size={13}/>
              </button>
              <button className="icon-btn" title="Вставить операцию после" onClick={()=>insertAfter(idx)}
                style={{color:'var(--accent)'}}>
                <Icon name="plus" size={13}/>
              </button>
              <button className="icon-btn" title="Удалить" style={{color:'var(--danger)'}} onClick={()=>deleteOp(idx)}>
                <Icon name="trash" size={13}/>
              </button>
            </div>
          )}

          {/* Insert after this op */}
          {addAfter === idx && (
            <InsertOpRow form={newForm} setForm={setNewForm}
              onConfirm={confirmInsert} onCancel={()=>setAddAfter(null)}
              saving={saving} workCenters={workCenters}/>
          )}
        </React.Fragment>
      ))}

      <datalist id="wc-list">
        {[101,104,120,124,128,129,136,301,710,711,720,721,722,731,901,1101].map(c=>(
          <option key={c} value={String(c)}/>
        ))}
      </datalist>
    </div>
  );
}

function InsertOpRow({ form, setForm, onConfirm, onCancel, saving, workCenters }) {
  return (
    <div style={{ display:'flex', gap:6, padding:'8px 12px', background:'rgba(217,72,15,.06)',
      borderBottom:'1px solid var(--accent)', borderTop:'1px solid var(--accent)',
      alignItems:'center', flexWrap:'wrap' }}>
      <span style={{ fontSize:11, color:'var(--accent)', fontWeight:600, minWidth:60 }}>↳ новая</span>
      <input className="input" value={form.name} style={{ flex:2, minWidth:120 }}
        onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Название операции" autoFocus/>
      <select className="select" value={form.workCenter||''}
        onChange={e=>setForm(p=>({...p,workCenter:e.target.value}))} style={{ flex:1, minWidth:160 }}>
        <option value="">Выбрать РЦ…</option>
        {(workCenters||[]).map(w=>(
          <option key={w.id} value={w.code}>{w.code} — {w.name}</option>
        ))}
      </select>
      <input className="input" type="number" value={form.time||''} style={{ width:64 }}
        onChange={e=>setForm(p=>({...p,time:e.target.value}))} placeholder="мин"/>
      <button className="btn primary" onClick={onConfirm} disabled={saving||!form.name||!form.workCenter} style={{fontSize:12}}>
        {saving ? '…' : '+ Добавить'}
      </button>
      <button className="icon-btn" onClick={onCancel}><Icon name="x" size={14}/></button>
    </div>
  );
}

function Library({ data, tasks, lang, onNewDetail, onEditDetail, onDeleteDetail, workCenters }) {
  const S = useStrings(lang);
  const [selectedId, setSelectedId] = React.useState(() => data.details[0]?.id || null);
  const [query, setQuery] = React.useState('');

  const filtered = (data?.details||[]).filter(d =>
    d.name.toLowerCase().includes(query.toLowerCase()) ||
    d.code.toLowerCase().includes(query.toLowerCase())
  );

  // Если выбранная деталь удалена — переключаемся на первую доступную
  const detail = (data?.details||[]).find(d => d.id === selectedId) || data.details[0] || null;

  React.useEffect(() => {
    if (!(data?.details||[]).find(d => d.id === selectedId) && data.details.length > 0) {
      setSelectedId(data.details[0].id);
    }
  }, [data.details]);

  if (!detail) return (
    <div style={{ padding:48, textAlign:'center', color:'var(--fg-2)' }}>
      <p style={{ marginBottom:16 }}>Нет деталей в номенклатуре</p>
      <button className="btn primary" onClick={onNewDetail}><Icon name="plus" size={14}/>Добавить деталь</button>
    </div>
  );

  const totalTime = (detail.operations || []).reduce((s, o) => s + o.time, 0);
  const inOrders = tasks.filter(t => t.detailId === detail.id).length > 0 ? 1 : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{S.navLibrary}</h1>
          <div className="page-sub">{lang === 'en' ? 'Parts catalog and routing templates' : 'Каталог деталей и шаблоны технологических карт'}</div>
        </div>
        <div className="row">
          <button className="btn"><Icon name="filter" size={14} />{lang === 'en' ? 'Filters' : 'Фильтры'}</button>
          <button className="btn primary" onClick={onNewDetail}><Icon name="plus" size={14} />{lang === 'en' ? 'New part' : 'Новая деталь'}</button>
        </div>
      </div>

      <div className="lib-grid">
        <div className="lib-list">
          <div className="lib-search">
            <div style={{ position: 'relative' }}>
              <Icon name="search" size={14} className="muted" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                className="input"
                placeholder={S.search}
                value={query}
                onChange={e => setQuery(e.target.value)}
                style={{ width: '100%', paddingLeft: 28 }}
              />
            </div>
          </div>
          {filtered.map(d => (
            <div
              key={d.id}
              className={'lib-item ' + (d.id === selectedId ? 'active' : '')}
              onClick={() => setSelectedId(d.id)}
            >
              <div className="code mono">{d.code}</div>
              <div className="name">{d.name}</div>
              <div className="meta">
                <span><Icon name="cog" size={11} />{(d.operations||[]).length} {S.ops}</span>
                <span>·</span>
                <span><Icon name="clock" size={11} />{(d.operations||[]).reduce((s, o) => s + o.time, 0)}'</span>
              </div>
            </div>
          ))}
        </div>

        <div className="lib-detail">
          <div className="lib-detail-head">
            <div className="lib-detail-code mono">{detail.code}</div>
            <div className="lib-detail-name">{detail.name}</div>
            <div className="lib-detail-desc">{detail.material}</div>
            <div className="row" style={{ marginTop: 8, gap: 8 }}>
              <span className="tag">{S.drawing}: {detail.drawing}</span>
              <span className="tag">{S.unit}: {detail.unit}</span>
              {inOrders > 0 && <span className="pill prog"><span className="dot" />{lang === 'en' ? 'in active order' : 'в активном заказе'}</span>}
              <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
                <button className="btn" onClick={() => onEditDetail && onEditDetail(detail)}>
                  <Icon name="edit" size={13}/>{lang === 'en' ? 'Edit' : 'Редактировать'}
                </button>
                <button className="btn" style={{ color:'var(--danger)' }}
                  onClick={() => onDeleteDetail && onDeleteDetail(detail)}>
                  <Icon name="trash" size={13}/>{lang === 'en' ? 'Delete' : 'Удалить'}
                </button>
              </div>
            </div>
          </div>

          <div className="lib-stats">
            <div className="lib-stat">
              <div className="lib-stat-label">{S.opsTotal}</div>
              <div className="lib-stat-value num">{(detail.operations||[]).length}</div>
            </div>
            <div className="lib-stat">
              <div className="lib-stat-label">{S.estTime}</div>
              <div className="lib-stat-value num">{totalTime}<span className="unit">{S.noTime}</span></div>
            </div>
            <div className="lib-stat">
              <div className="lib-stat-label">{lang === 'en' ? 'Work centers' : 'Раб. центров'}</div>
              <div className="lib-stat-value num">{new Set((detail.operations||[]).map(o => o.workCenter)).size}</div>
            </div>
            <div className="lib-stat">
              <div className="lib-stat-label">{S.lastUpdate}</div>
              <div className="lib-stat-value" style={{ fontSize: 13 }}>2026-04-28</div>
            </div>
          </div>

          <div style={{ padding: '14px 18px 4px' }}>
            <div className="subhead" style={{ margin: 0 }}>{S.techCard}</div>
          </div>
          <LibraryOpsEditor detail={detail} lang={lang} onSaved={onEditDetail} workCenters={workCenters}/>
        </div>
      </div>
    </>
  );
}

// ── OrderItemOpsEditor: просмотр и добавление операций в заказе ──────────

export { Library }
