import React from 'react';
import { api } from '../lib/api.js';
import { Icon } from '../components/Icon.jsx';

function ModalNewOrder({ lang, details, onClose, onCreated }) {
  const isEn = lang === 'en';
  const [number, setNumber] = React.useState('');
  const [customer, setCustomer] = React.useState('');
  const [foreman, setForeman] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [items, setItems] = React.useState([{ detailId: '', quantity: 1 }]);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState('');

  const addItem = () => setItems(p => [...p, { detailId: '', quantity: 1 }]);
  const removeItem = idx => setItems(p => p.filter((_, i) => i !== idx));
  const updateItem = (idx, key, val) => setItems(p => p.map((it, i) => i === idx ? { ...it, [key]: val } : it));

  async function handleSave() {
    if (!number || !customer || !dueDate) { setErr(isEn ? 'Fill required fields' : 'Заполните обязательные поля'); return; }
    const validItems = items.filter(i => i.detailId);
    if (!validItems.length) { setErr(isEn ? 'Add at least one part' : 'Добавьте хотя бы одну деталь'); return; }
    setSaving(true); setErr('');
    try {
      const id = 'O-' + Date.now().toString(36).toUpperCase().slice(-4);
      await api.post('/orders', {
        id, number, customer, foreman,
        due_date: dueDate,
        created_at: new Date().toISOString().slice(0, 10),
        status: 'in_work', priority: 'normal',
        items: validItems.map(i => ({ detail_id: i.detailId, quantity: Number(i.quantity) })),
      });
      onCreated();
      onClose();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  }

  return (
    <div style={{ position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center' }}>
      <div className="card" style={{ width:520,maxHeight:'90vh',overflowY:'auto',padding:24,display:'flex',flexDirection:'column',gap:16 }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between' }}>
          <b style={{ fontSize:16 }}>{isEn ? 'New Order' : 'Новый заказ'}</b>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>
        <div className="grid-3" style={{ gap:10 }}>
          <div className="field">
            <span className="field-label">{isEn ? 'Number *' : 'Номер *'}</span>
            <input className="input" value={number} onChange={e=>setNumber(e.target.value)} placeholder="ЗП-26-0200" />
          </div>
          <div className="field">
            <span className="field-label">{isEn ? 'Due date *' : 'Срок *'}</span>
            <input className="input" type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)} />
          </div>
          <div className="field">
            <span className="field-label">{isEn ? 'Foreman' : 'Ст. мастер'}</span>
            <input className="input" value={foreman} onChange={e=>setForeman(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <span className="field-label">{isEn ? 'Customer *' : 'Получатель *'}</span>
          <input className="input" value={customer} onChange={e=>setCustomer(e.target.value)} placeholder={isEn ? 'Shop №4 / assy SB-04.218' : 'Цех №4 / узел СБ-04.218'} />
        </div>
        <div>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
            <b style={{ fontSize:13 }}>{isEn ? 'Parts' : 'Детали'}</b>
            <button className="btn ghost" onClick={addItem}><Icon name="plus" size={13} />{isEn ? 'Add' : 'Добавить'}</button>
          </div>
          {items.map((it, idx) => (
            <div key={idx} style={{ display:'flex',gap:8,marginBottom:6,alignItems:'center' }}>
              <select className="select" style={{ flex:1 }} value={it.detailId} onChange={e=>updateItem(idx,'detailId',e.target.value)}>
                <option value="">{isEn ? 'Select part…' : 'Выбрать деталь…'}</option>
                {details.map(d => <option key={d.id} value={d.id}>{d.code} — {d.name}</option>)}
              </select>
              <input className="input" type="number" min="1" value={it.quantity} onChange={e=>updateItem(idx,'quantity',e.target.value)} style={{ width:64 }} />
              <button className="icon-btn" onClick={()=>removeItem(idx)}><Icon name="trash" size={13} /></button>
            </div>
          ))}
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

export default ModalNewOrder;
