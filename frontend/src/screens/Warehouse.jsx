// screens/Warehouse.jsx — Склад инструмента (фрезы, метчики, свёрла…) и материалов для ЧПУ
import React from 'react';
import { Icon } from '../components/Icon.jsx';
import { api, Auth } from '../lib/api.js';

const TOOL_TYPES = [
  { v: 'mill', l: 'Фреза' }, { v: 'drill', l: 'Свёрло' }, { v: 'tap', l: 'Метчик' },
  { v: 'turn_insert', l: 'Пластина токарная' }, { v: 'bore', l: 'Расточной инструмент' },
  { v: 'reamer', l: 'Развёртка' }, { v: 'other', l: 'Прочее' },
];
const toolLabel = v => (TOOL_TYPES.find(t => t.v === v) || {}).l || v;

export function Warehouse({ lang }) {
  const canManage = Auth.can('warehouse.manage') || Auth.isAdmin();
  const [tab, setTab] = React.useState('tools');
  const [toast, setToast] = React.useState('');
  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2200); }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Склад ЧПУ</h1>
        <div className="page-sub">Инструмент и материалы для мехобработки</div>
      </div>
      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <button className={'btn' + (tab === 'tools' ? ' primary' : '')} onClick={() => setTab('tools')}>Инструмент</button>
        <button className={'btn' + (tab === 'materials' ? ' primary' : '')} onClick={() => setTab('materials')}>Материалы</button>
      </div>
      {tab === 'tools'
        ? <ToolsPanel canManage={canManage} showToast={showToast} />
        : <MaterialsPanel canManage={canManage} showToast={showToast} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function ToolsPanel({ canManage, showToast }) {
  const [items, setItems] = React.useState(null);
  const [showNew, setShowNew] = React.useState(false);
  const [query, setQuery] = React.useState('');

  function load() { api.get('/tools').then(r => setItems(r.data || [])).catch(() => setItems([])); }
  React.useEffect(load, []);

  async function adjust(id, delta) {
    try {
      const r = await api.post(`/tools/${id}/adjust`, { delta });
      if (r.low_stock) showToast('⚠ Ниже минимального остатка');
      load();
    } catch (e) { showToast('Ошибка: ' + e.message); }
  }
  async function remove(id) {
    if (!confirm('Убрать позицию со склада?')) return;
    try { await api.delete(`/tools/${id}`); load(); } catch (e) { showToast('Ошибка: ' + e.message); }
  }

  if (items === null) return <div className="empty-state">Загрузка…</div>;
  const filtered = items.filter(t =>
    (t.name || '').toLowerCase().includes(query.toLowerCase()) ||
    (t.size_info || '').toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <input className="input" placeholder="Поиск: фреза, метчик, Ø10…" value={query} onChange={e => setQuery(e.target.value)} style={{ flex: 1 }} />
        {canManage && <button className="btn primary" onClick={() => setShowNew(true)}><Icon name="plus" size={14} /> Добавить</button>}
      </div>
      {filtered.length === 0 ? <div className="empty-state">Ничего не найдено</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(t => (
            <div key={t.id} className="card" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              borderLeft: t.qty <= t.min_qty ? '3px solid #dc2626' : undefined }}>
              <div>
                <b>{t.name}</b> <span className="pill">{toolLabel(t.tool_type)}</span>{' '}
                {t.size_info && <span className="mono muted">{t.size_info}</span>}
                {t.location && <div className="muted" style={{ fontSize: 12 }}>{t.location}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={t.qty <= t.min_qty ? 'mono' : 'mono muted'} style={{ fontSize: 15, color: t.qty <= t.min_qty ? '#dc2626' : undefined }}>
                  {t.qty} шт.{t.min_qty > 0 && <span className="muted" style={{ fontSize: 11 }}> / мин {t.min_qty}</span>}
                </span>
                {canManage && (<>
                  <button className="icon-btn" onClick={() => adjust(t.id, -1)}>−</button>
                  <button className="icon-btn" onClick={() => adjust(t.id, 1)}>+</button>
                  <button className="icon-btn" title="Удалить" onClick={() => remove(t.id)}><Icon name="trash" size={13} /></button>
                </>)}
              </div>
            </div>
          ))}
        </div>
      )}
      {showNew && <ToolFormModal onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} showToast={showToast} />}
    </>
  );
}

function ToolFormModal({ onClose, onSaved, showToast }) {
  const [name, setName] = React.useState('');
  const [toolType, setToolType] = React.useState('mill');
  const [sizeInfo, setSizeInfo] = React.useState('');
  const [qty, setQty] = React.useState(0);
  const [minQty, setMinQty] = React.useState(0);
  const [location, setLocation] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  async function save() {
    if (!name.trim()) { showToast('Укажите название'); return; }
    setSaving(true);
    try {
      await api.post('/tools', { name, tool_type: toolType, size_info: sizeInfo, qty: Number(qty), min_qty: Number(minQty), location });
      onSaved();
    } catch (e) { showToast('Ошибка: ' + e.message); setSaving(false); }
  }

  return (
    <div className="modal-back" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ width: 420, maxWidth: '100%', padding: 22 }}>
        <b style={{ fontSize: 16, marginBottom: 14, display: 'block' }}>Новый инструмент</b>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="field"><span className="field-label">Название *</span>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Фреза концевая 10мм Z4" style={{ width: '100%' }} /></div>
          <div className="field"><span className="field-label">Тип</span>
            <select className="input" value={toolType} onChange={e => setToolType(e.target.value)} style={{ width: '100%' }}>
              {TOOL_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select></div>
          <div className="field"><span className="field-label">Типоразмер</span>
            <input className="input" value={sizeInfo} onChange={e => setSizeInfo(e.target.value)} placeholder="Ø10, М8, CNMG 120408…" style={{ width: '100%' }} /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="field" style={{ flex: 1 }}><span className="field-label">Кол-во</span>
              <input className="input" type="number" min="0" value={qty} onChange={e => setQty(e.target.value)} style={{ width: '100%' }} /></div>
            <div className="field" style={{ flex: 1 }}><span className="field-label">Мин. остаток</span>
              <input className="input" type="number" min="0" value={minQty} onChange={e => setMinQty(e.target.value)} style={{ width: '100%' }} /></div>
          </div>
          <div className="field"><span className="field-label">Расположение</span>
            <input className="input" value={location} onChange={e => setLocation(e.target.value)} placeholder="Шкаф 2, ячейка B3" style={{ width: '100%' }} /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button className="btn" onClick={onClose}>Отмена</button>
          <button className="btn primary" onClick={save} disabled={saving}>{saving ? '…' : 'Сохранить'}</button>
        </div>
      </div>
    </div>
  );
}

function MaterialsPanel({ canManage, showToast }) {
  const [items, setItems] = React.useState(null);
  const [showNew, setShowNew] = React.useState(false);

  function load() { api.get('/materials-stock').then(r => setItems(r.data || [])).catch(() => setItems([])); }
  React.useEffect(load, []);

  async function adjust(id, delta) {
    try {
      const r = await api.post(`/materials-stock/${id}/adjust`, { delta });
      if (r.low_stock) showToast('⚠ Ниже минимального остатка');
      load();
    } catch (e) { showToast('Ошибка: ' + e.message); }
  }
  async function remove(id) {
    if (!confirm('Убрать позицию со склада?')) return;
    try { await api.delete(`/materials-stock/${id}`); load(); } catch (e) { showToast('Ошибка: ' + e.message); }
  }

  if (items === null) return <div className="empty-state">Загрузка…</div>;

  return (
    <>
      {canManage && (
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="btn primary" onClick={() => setShowNew(true)}><Icon name="plus" size={14} /> Добавить материал</button>
        </div>
      )}
      {items.length === 0 ? <div className="empty-state">Остатков материалов пока нет</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(m => (
            <div key={m.id} className="card" style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              borderLeft: Number(m.qty) <= Number(m.min_qty) ? '3px solid #dc2626' : undefined }}>
              <div>
                <b>{m.material}</b>{m.assortment && <span className="muted"> · {m.assortment}</span>}
                {m.location && <div className="muted" style={{ fontSize: 12 }}>{m.location}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="mono" style={{ fontSize: 15, color: Number(m.qty) <= Number(m.min_qty) ? '#dc2626' : undefined }}>
                  {m.qty} {m.unit}
                </span>
                {canManage && (<>
                  <button className="icon-btn" onClick={() => adjust(m.id, -1)}>−</button>
                  <button className="icon-btn" onClick={() => adjust(m.id, 1)}>+</button>
                  <button className="icon-btn" title="Удалить" onClick={() => remove(m.id)}><Icon name="trash" size={13} /></button>
                </>)}
              </div>
            </div>
          ))}
        </div>
      )}
      {showNew && <MaterialFormModal onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} showToast={showToast} />}
    </>
  );
}

function MaterialFormModal({ onClose, onSaved, showToast }) {
  const [material, setMaterial] = React.useState('');
  const [assortment, setAssortment] = React.useState('');
  const [qty, setQty] = React.useState(0);
  const [unit, setUnit] = React.useState('кг');
  const [minQty, setMinQty] = React.useState(0);
  const [location, setLocation] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  async function save() {
    if (!material.trim()) { showToast('Укажите материал'); return; }
    setSaving(true);
    try {
      await api.post('/materials-stock', { material, assortment, qty: Number(qty), unit, min_qty: Number(minQty), location });
      onSaved();
    } catch (e) { showToast('Ошибка: ' + e.message); setSaving(false); }
  }

  return (
    <div className="modal-back" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ width: 420, maxWidth: '100%', padding: 22 }}>
        <b style={{ fontSize: 16, marginBottom: 14, display: 'block' }}>Новый материал</b>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="field"><span className="field-label">Материал *</span>
            <input className="input" value={material} onChange={e => setMaterial(e.target.value)} placeholder="Сталь 45" style={{ width: '100%' }} /></div>
          <div className="field"><span className="field-label">Сортамент</span>
            <input className="input" value={assortment} onChange={e => setAssortment(e.target.value)} placeholder="Круг Ø60, лист 10мм…" style={{ width: '100%' }} /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="field" style={{ flex: 1 }}><span className="field-label">Кол-во</span>
              <input className="input" type="number" min="0" step="0.1" value={qty} onChange={e => setQty(e.target.value)} style={{ width: '100%' }} /></div>
            <div className="field" style={{ width: 90 }}><span className="field-label">Ед.</span>
              <select className="input" value={unit} onChange={e => setUnit(e.target.value)} style={{ width: '100%' }}>
                <option>кг</option><option>шт</option><option>м</option><option>лист</option>
              </select></div>
            <div className="field" style={{ flex: 1 }}><span className="field-label">Мин. остаток</span>
              <input className="input" type="number" min="0" step="0.1" value={minQty} onChange={e => setMinQty(e.target.value)} style={{ width: '100%' }} /></div>
          </div>
          <div className="field"><span className="field-label">Расположение</span>
            <input className="input" value={location} onChange={e => setLocation(e.target.value)} placeholder="Стеллаж 3" style={{ width: '100%' }} /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button className="btn" onClick={onClose}>Отмена</button>
          <button className="btn primary" onClick={save} disabled={saving}>{saving ? '…' : 'Сохранить'}</button>
        </div>
      </div>
    </div>
  );
}
