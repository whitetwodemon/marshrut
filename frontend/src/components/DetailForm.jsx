import React from 'react';
import { api } from '../lib/api.js';
import { Icon } from './Icon.jsx';
import { ComboBox } from './ComboBox.jsx';

// Единая форма детали (номенклатуры) с операциями и ТПЗ.
// Используется и для создания, и для редактирования — различие только в
// начальных значениях и в onSubmit (POST vs PUT).
//
// props:
//   lang, title, submitLabel
//   initial: { code, name, material, unit, drawing, operations: [{num,name,workCenter,time,setup}] }
//   onSubmit(payload) — async; payload = { code, name, material, unit, drawing, operations:[{num,name,work_center,time_min,setup_time_min}] }
//   onClose()
const OP_TYPES = ['Токарная','Фрезерная','Сверлильная','Расточная','Шлифовальная','Слесарная',
  'Сварочная','Термообработка','Гальваническая','Контроль ОТК','Сборочная',
  'Зубофрезерная','Электроэрозионная','Лазерная резка','Гибка','Маркировка'];

export function DetailForm({ lang, title, submitLabel, initial = {}, onSubmit, onClose }) {
  const isEn = lang === 'en';
  const [code, setCode]         = React.useState(initial.code || '');
  const [name, setName]         = React.useState(initial.name || '');
  const [material, setMaterial] = React.useState(initial.material || '');
  const [unit, setUnit]         = React.useState(initial.unit || 'шт');
  const [drawing, setDrawing]   = React.useState(initial.drawing || '');
  const [ops, setOps]           = React.useState(
    (initial.operations || []).length
      ? initial.operations.map(o => ({
          num: o.num, name: o.name,
          workCenter: o.workCenter || o.work_center || '',
          time: Number(o.time ?? o.time_min ?? 0),
          setup: Number(o.setup ?? o.setupTime ?? o.setup_time_min ?? 0),
          comment: o.comment || '',
          requiresCnc: !!(o.requires_cnc ?? o.requiresCnc),
        }))
      : [{ num: 10, name: '', workCenter: '', time: 0, setup: 0, comment: '', requiresCnc: false }]
  );
  const [saving, setSaving] = React.useState(false);
  const [wcList, setWcList] = React.useState([]);
  const [materials, setMaterials] = React.useState([]);

  React.useEffect(() => {
    // Список РЦ — свой, чтобы форма не зависела от внешнего datalist
    api.get('/work-centers').then(r => {
      const arr = Array.isArray(r) ? r : (r && Array.isArray(r.data) ? r.data : []);
      setWcList(arr);
    }).catch(() => {});
    // Список материалов — управляется из админки (настройка materials_list)
    const DEFAULT_MATERIALS = ['Сталь 45','Сталь 40Х','Сталь 20','Сталь 3','Ст3сп','09Г2С',
      'Чугун СЧ20','Чугун ВЧ50','Нержавейка 12Х18Н10Т','Латунь ЛС59-1','Бронза БрАЖ9-4',
      'Алюминий Д16Т','Алюминий АК6','Титан ВТ6','Капролон','Фторопласт Ф4'];
    api.get('/settings/public').then(r => {
      const raw = (r && r.data && r.data.materials_list) || '';
      const list = raw.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
      setMaterials(list.length ? list : DEFAULT_MATERIALS);
    }).catch(() => setMaterials(DEFAULT_MATERIALS));
  }, []);
  const [err, setErr]       = React.useState('');

  const addOp    = () => setOps(p => [...p, { num: (p[p.length-1]?.num || 0) + 10, name: '', workCenter: '', time: 0, setup: 0, comment: '', requiresCnc: false }]);
  const removeOp = idx => setOps(p => p.filter((_, i) => i !== idx));
  const updateOp = (idx, k, v) => setOps(p => p.map((o, i) => i === idx ? { ...o, [k]: v } : o));

  async function handleSave() {
    if (!code || !name || !material) { setErr(isEn ? 'Fill required fields' : 'Заполните обязательные поля'); return; }
    setSaving(true); setErr('');
    try {
      // Автоназвание: Название + Код (если код ещё не в названии)
      const fullName = (code && !name.toLowerCase().includes(code.toLowerCase()))
        ? `${name.trim()} ${code.trim()}` : name.trim();
      await onSubmit({
        code, name: fullName, material, unit, drawing,
        operations: ops.filter(o => o.name).map(o => ({
          num: Number(o.num), name: o.name, work_center: o.workCenter, comment: o.comment || '', requires_cnc: o.requiresCnc ? 1 : 0,
          time_min: Number(o.time), setup_time_min: Number(o.setup || 0),
        })),
      });
      onClose();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div className="card" style={{ width:640, maxHeight:'90vh', overflowY:'auto', padding:24, display:'flex', flexDirection:'column', gap:14 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <b style={{ fontSize:16 }}>{title}</b>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={16}/></button>
        </div>
        <div className="grid-3" style={{ gap:10 }}>
          <div className="field"><span className="field-label">{isEn?'Code *':'Код *'}</span><input className="input" value={code} onChange={e=>setCode(e.target.value)} placeholder="ФЛ-100-08"/></div>
          <div className="field"><span className="field-label">{isEn?'Unit':'Ед.'}</span><input className="input" value={unit} onChange={e=>setUnit(e.target.value)}/></div>
          <div className="field"><span className="field-label">{isEn?'Drawing':'Чертёж'}</span><input className="input" value={drawing} onChange={e=>setDrawing(e.target.value)}/></div>
        </div>
        <div className="field"><span className="field-label">{isEn?'Name *':'Наименование *'}</span><input className="input" value={name} onChange={e=>setName(e.target.value)}/>
          {code && name && !name.toLowerCase().includes(code.toLowerCase()) ? <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>Итог: <b>{name.trim()} {code.trim()}</b></div> : null}</div>
        <div className="field"><span className="field-label">{isEn?'Material *':'Материал *'}</span><ComboBox value={material} onChange={setMaterial} options={materials} placeholder="Сталь 45, АК-6…"/></div>
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <b style={{ fontSize:13 }}>{isEn?'Operations':'Операции'}</b>
            <button className="btn ghost" onClick={addOp}><Icon name="plus" size={13}/>{isEn?'Add':'Добавить'}</button>
          </div>
          <table className="tbl" style={{ fontSize:12 }}>
            <thead><tr><th style={{width:48}}>№</th><th>{isEn?'Operation':'Операция'}</th><th>{isEn?'Work center':'Раб. центр'}</th><th style={{width:64}}>{isEn?'Min':'Мин'}</th><th style={{width:64}} title="Время наладки">{isEn?'Setup':'ТПЗ'}</th><th style={{width:32}}></th></tr></thead>
            <tbody>{ops.map((op,idx)=>([
              <tr key={idx}>
                <td><input className="input" type="number" value={op.num} onChange={e=>updateOp(idx,'num',e.target.value)} style={{width:44,padding:'2px 4px'}}/></td>
                <td><ComboBox value={op.name} onChange={v=>updateOp(idx,'name',v)} options={OP_TYPES} placeholder={isEn?'Turning':'Токарная'}/></td>
                <td><ComboBox value={op.workCenter} onChange={v=>updateOp(idx,'workCenter',v)} options={wcList.map(w=>w.code)} placeholder="РЦ (101, 710…)"/></td>
                <td><input className="input" type="number" min="0" value={op.time} onChange={e=>updateOp(idx,'time',e.target.value)} style={{width:52,padding:'2px 4px'}}/></td>
                <td><input className="input" type="number" min="0" value={op.setup||0} onChange={e=>updateOp(idx,'setup',e.target.value)} title="Наладка (ТПЗ)" style={{width:52,padding:'2px 4px'}}/></td>
                <td><button className="icon-btn" onClick={()=>removeOp(idx)}><Icon name="trash" size={12}/></button></td>
              </tr>,
              <tr key={idx+'-c'}>
                <td></td>
                <td colSpan={5} style={{ paddingTop:0 }}>
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input className="input" value={op.comment||''} onChange={e=>updateOp(idx,'comment',e.target.value)}
                      placeholder={isEn?'+ note for route sheet':'+ примечание к операции (печатается на МЛ)'}
                      style={{ flex:1, fontSize:11, fontStyle: op.comment?'italic':'normal', borderStyle:'dashed' }}/>
                    <label title="Операция требует управляющей программы ЧПУ" style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, whiteSpace:'nowrap', cursor:'pointer' }}>
                      <input type="checkbox" checked={!!op.requiresCnc} onChange={e=>updateOp(idx,'requiresCnc',e.target.checked)}/>
                      ЧПУ
                    </label>
                  </div>
                </td>
              </tr>
            ]).flat())}</tbody>
          </table>

        </div>
        {err && <div style={{ color:'var(--danger)', fontSize:13 }}>{err}</div>}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button className="btn ghost" onClick={onClose}>{isEn?'Cancel':'Отмена'}</button>
          <button className="btn primary" onClick={handleSave} disabled={saving}>{saving ? '…' : (submitLabel || (isEn?'Save':'Сохранить'))}</button>
        </div>
      </div>
    </div>
  );
}
