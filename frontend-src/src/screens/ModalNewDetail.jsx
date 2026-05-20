import React from 'react';
import { api } from '../lib/api.js';
import { Icon } from '../components/Icon.jsx';

function ModalNewDetail({ lang, onClose, onCreated }) {
  const isEn = lang === 'en';
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [material, setMaterial] = React.useState('');
  const [unit, setUnit] = React.useState('шт');
  const [drawing, setDrawing] = React.useState('');
  const [ops, setOps] = React.useState([{ num: 10, name: '', workCenter: '', time: 0 }]);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState('');

  const addOp = () => setOps(p => [...p, { num: (p[p.length-1]?.num || 0) + 10, name: '', workCenter: '', time: 0 }]);
  const removeOp = idx => setOps(p => p.filter((_, i) => i !== idx));
  const updateOp = (idx, key, val) => setOps(p => p.map((op, i) => i === idx ? { ...op, [key]: val } : op));

  async function handleSave() {
    if (!code || !name || !material) { setErr(isEn ? 'Fill required fields' : 'Заполните обязательные поля'); return; }
    setSaving(true); setErr('');
    try {
      const id = 'D-' + Date.now().toString(36).toUpperCase().slice(-4);
      await api.post('/details', {
        id, code, name, material, unit, drawing,
        operations: ops.filter(o => o.name).map(o => ({
          num: Number(o.num), name: o.name, work_center: o.workCenter, time_min: Number(o.time),
        })),
      });
      onCreated();
      onClose();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  }

  return (
    <div style={{ position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center' }}>
      <div className="card" style={{ width:640,maxHeight:'90vh',overflowY:'auto',padding:24,display:'flex',flexDirection:'column',gap:16 }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <b style={{ fontSize:16 }}>{isEn ? 'New Part' : 'Новая деталь'}</b>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>
        <div className="grid-3" style={{ gap:10 }}>
          <div className="field">
            <span className="field-label">{isEn ? 'Code *' : 'Код *'}</span>
            <input className="input" value={code} onChange={e=>setCode(e.target.value)} placeholder="ФЛ-100-08" />
          </div>
          <div className="field">
            <span className="field-label">{isEn ? 'Unit' : 'Ед.'}</span>
            <input className="input" value={unit} onChange={e=>setUnit(e.target.value)} />
          </div>
          <div className="field">
            <span className="field-label">{isEn ? 'Drawing' : 'Чертёж'}</span>
            <input className="input" value={drawing} onChange={e=>setDrawing(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <span className="field-label">{isEn ? 'Name *' : 'Наименование *'}</span>
          <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder={isEn ? 'Welding-neck flange DN-100' : 'Фланец воротниковый ДУ-100'} />
        </div>
        <div className="field">
          <span className="field-label">{isEn ? 'Material *' : 'Материал *'}</span>
          <input className="input" value={material} onChange={e=>setMaterial(e.target.value)} placeholder="Сталь 09Г2С, ГОСТ 33259-2015" />
        </div>
        <div>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
            <b style={{ fontSize:13 }}>{isEn ? 'Operations' : 'Операции'}</b>
            <button className="btn ghost" onClick={addOp}><Icon name="plus" size={13} />{isEn ? 'Add' : 'Добавить'}</button>
          </div>
          <table className="tbl" style={{ fontSize:12 }}>
            <thead><tr>
              <th style={{ width:48 }}>№</th>
              <th>{isEn ? 'Operation' : 'Операция'}</th>
              <th>{isEn ? 'Work center' : 'Раб. центр'}</th>
              <th style={{ width:64 }}>{isEn ? 'Min' : 'Мин'}</th>
              <th style={{ width:32 }}></th>
            </tr></thead>
            <tbody>
              {ops.map((op, idx) => (
                <tr key={idx}>
                  <td><input className="input" type="number" value={op.num} onChange={e=>updateOp(idx,'num',e.target.value)} style={{ width:44,padding:'2px 4px' }} /></td>
                  <td><input className="input" value={op.name} onChange={e=>updateOp(idx,'name',e.target.value)} placeholder={isEn ? 'Turning' : 'Токарная'} style={{ width:'100%' }} /></td>
                  <td><input className="input" value={op.workCenter} onChange={e=>updateOp(idx,'workCenter',e.target.value)} placeholder="ДИП-300 №3" style={{ width:'100%' }} /></td>
                  <td><input className="input" type="number" min="0" value={op.time} onChange={e=>updateOp(idx,'time',e.target.value)} style={{ width:52,padding:'2px 4px' }} /></td>
                  <td><button className="icon-btn" onClick={()=>removeOp(idx)}><Icon name="trash" size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {err && <div style={{ color:'var(--danger)',fontSize:12 }}>{err}</div>}
        <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
          <button className="btn" onClick={onClose}>{isEn ? 'Cancel' : 'Отмена'}</button>
          <button className="btn primary" onClick={handleSave} disabled={saving}>
            {saving ? (isEn ? 'Saving…' : 'Сохранение…') : (isEn ? 'Create' : 'Создать')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModalNewDetail;
