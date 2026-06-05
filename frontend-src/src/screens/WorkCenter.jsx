import { elapsedMinutes } from '../lib/dates.js'
import React from 'react'
import { Icon } from '../components/Icon.jsx'
import { QrCode, generateQrSvg } from '../components/QrCode.jsx'
import { useStrings, StatusPill, OrderPicker } from '../lib/data.jsx'
import { api } from '../lib/api.js'

function ModalManageWorkCenters({ workCenters, onClose, onSaved }) {
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
    <div className="modal-back" onClick={e=>e.target===e.currentTarget&&onClose()}>
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

function WorkCentersView({ tasks, data, workCenters, lang, onManage, onAction }) {
  const [selId,    setSelId]    = React.useState(null);
  const [priority, setPriority] = React.useState({}); // {wcId: [orderId,...]} — загружается с сервера
  const [saving,   setSaving]   = React.useState(false);
  const [dragOver, setDragOver] = React.useState(null);
  const [tick,     setTick]     = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 15000);
    return () => clearInterval(id);
  }, []);

  // Загружаем приоритет при выборе РЦ
  React.useEffect(() => {
    if (!selId) return;
    api.get('/work-centers/' + selId + '/order-priority')
      .then(r => {
        if (r.data && r.data.length > 0) {
          setPriority(prev => ({ ...prev, [selId]: r.data.map(d => d.order_id) }));
        }
      })
      .catch(() => {});
  }, [selId]);

  // Сохраняем приоритет на сервер
  async function savePriority(wcId, ids) {
    setSaving(true);
    try {
      await api.post('/work-centers/' + wcId + '/order-priority', { order_ids: ids });
    } catch(e) { console.error('Priority save failed:', e); }
    setSaving(false);
  }

  function getElapsed(startedAt) {
    return elapsedMinutes(startedAt);
  }

  // Только первая незавершённая операция каждой детали
  const currentTasks = React.useMemo(() => {
    const groups = {};
    tasks.forEach(t => {
      const key = t.orderId + '::' + t.detailId;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    const current = [];
    Object.values(groups).forEach(grp => {
      const sorted = [...grp].sort((a, b) => a.opNum - b.opNum);
      const first = sorted.find(t => !['done', 'rejected', 'cancelled'].includes(t.status));
      if (first) current.push(first);
    });
    return current;
  }, [tasks]);

  function getTasksForWC(wc) {
    return currentTasks.filter(t =>
      t.workCenter === wc.code || (t.workCenterId && String(t.workCenterId) === String(wc.id))
    );
  }

  const wcWithTasks = workCenters.filter(w => w.is_active).map(wc => {
    const active = getTasksForWC(wc);
    return { ...wc, active, prog: active.filter(t => t.status === 'in_progress'), paused: active.filter(t => t.status === 'paused') };
  });

  const selected = selId ? wcWithTasks.find(w => w.id === selId) : null;

  // Группировка по заказам с учётом ручной сортировки
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
    const list = Object.values(groups);

    // Применить ручную сортировку если есть
    const manualOrder = priority[selId] || [];
    if (manualOrder.length > 0) {
      list.sort((a, b) => {
        const ai = manualOrder.indexOf(a.order?.id);
        const bi = manualOrder.indexOf(b.order?.id);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      });
    } else {
      list.sort((a, b) => {
        const ap = a.tasks.some(t => t.status === 'in_progress') ? 0 : a.tasks.some(t => t.status === 'paused') ? 1 : 2;
        const bp = b.tasks.some(t => t.status === 'in_progress') ? 0 : b.tasks.some(t => t.status === 'paused') ? 1 : 2;
        return ap - bp;
      });
    }
    return list;
  }, [selected, data, priority]);

  // Drag-and-drop сортировка заказов с сохранением на сервер
  function moveOrder(fromIdx, toIdx) {
    if (!selId || fromIdx === toIdx) return;
    const ids = orderGroups.map(g => g.order?.id);
    const [removed] = ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, removed);
    setPriority(prev => ({ ...prev, [selId]: ids }));
    savePriority(selId, ids);
  }

  const STATUS_CLS = { waiting: 'wait', in_progress: 'prog', done: 'done', paused: 'wait' };
  const STATUS_LBL = { waiting: 'Ожидает', in_progress: 'В работе', paused: 'Пауза', rework: 'Переделка' };

  if (workCenters.length === 0) return (
    <div style={{ padding: 48, textAlign: 'center', color: 'var(--fg-2)' }}>
      <p style={{ marginBottom: 16 }}>Нет рабочих центров.</p>
      <button className="btn primary" onClick={onManage}><Icon name="plus" size={14} />Добавить</button>
    </div>
  );

  // Inline timer
  function TaskTimer({ t }) {
    const planMin     = t.time * t.planned;               // полный норматив
    const accMin      = t.accumulatedTime || 0;           // накопленное время предыдущих операторов
    const sessionMin  = t.status === 'in_progress' && t.startedAt
      ? getElapsed(t.startedAt) + (tick * 0) : 0;        // время текущей сессии
    const totalMin    = accMin + sessionMin;

    // Оставшееся время = норматив на оставшиеся детали (с учётом уже сделанных)
    const remaining   = Math.max(0, t.planned - (t.completed || 0)); // осталось деталей
    const normPerPart = t.planned > 0 ? t.time : 0;                  // норматив на 1 деталь
    const remainMin   = Math.max(0, remaining * normPerPart - accMin); // норматив минус накоп.
    const over        = totalMin > planMin && totalMin > 0;
    const pct         = planMin > 0 ? Math.min(100, Math.round(totalMin / planMin * 100)) : 0;
    const color       = over ? 'var(--danger)' : pct > 85 ? 'var(--warning,#c07820)' : 'var(--accent)';

    if (t.status === 'waiting') return (
      <div style={{ fontSize:12, color:'var(--fg-2)' }}>
        {accMin > 0
          ? <><b style={{color:'var(--warning,#c07820)'}}>{remainMin} мин</b> осталось</>
          : <>план: <b>{planMin} мин</b></>}
      </div>
    );
    if (t.status === 'done') return (
      <div style={{ fontSize:12 }}>
        <span style={{ color:'var(--st-done-line)', fontWeight:700 }}>{t.actualTime||0} мин</span>
        <span style={{ color:'var(--fg-2)', marginLeft:4 }}>/ {planMin} мин</span>
      </div>
    );
    if (t.status === 'paused') return (
      <div style={{ fontSize:12, color:'var(--warning,#c07820)' }}>
        ⏸ пауза · сессия {sessionMin} мин
        {accMin > 0 && <div style={{fontSize:10}}>итого {totalMin} / {planMin} мин</div>}
      </div>
    );
    // in_progress — показываем таймер текущей сессии + остаток от норматива
    return (
      <div style={{ minWidth:140 }}>
        <div style={{ display:'flex', gap:6, alignItems:'baseline' }}>
          {/* Текущая сессия (с 0) */}
          <span style={{ fontSize:13, fontWeight:700, color, fontFamily:'var(--mono-font)' }}>
            {sessionMin} мин
          </span>
          {/* Осталось по нормативу */}
          <span style={{ fontSize:11, color:'var(--fg-2)' }}>
            / {remainMin} мин ост.
          </span>
        </div>
        {/* Прогресс-бар: от начала задания до норматива */}
        <div style={{ height:4, background:'var(--bg-3)', borderRadius:2, marginTop:4, overflow:'hidden' }}>
          <div style={{ height:'100%', width:pct+'%', background:color, borderRadius:2, transition:'width 2s' }}/>
        </div>
        {over
          ? <div style={{fontSize:10,color:'var(--danger)',fontWeight:700,marginTop:2}}>
              ⚠ +{totalMin-planMin} мин сверх нормы (итого {totalMin})
            </div>
          : accMin > 0
            ? <div style={{fontSize:10,color:'var(--fg-2)',marginTop:2}}>
                итого {totalMin} / {planMin} мин ({pct}%)
              </div>
            : <div style={{fontSize:10,color:'var(--fg-2)',marginTop:2}}>{pct}% от нормы</div>
        }
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Рабочие центры</h1>
          <div className="page-sub">
            {wcWithTasks.filter(w => w.prog.length > 0).length} активных · {wcWithTasks.reduce((s, w) => s + w.active.length, 0)} заданий
          </div>
        </div>
        <div className="row">
          <button className="btn" onClick={onManage}><Icon name="cog" size={14} />Управление</button>
        </div>
      </div>

      {/* Карточки РЦ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8, marginBottom: 20 }}>
        {wcWithTasks.map(wc => (
          <div key={wc.id} onClick={() => setSelId(selId === wc.id ? null : wc.id)}
            style={{
              background: 'var(--bg-1)', border: '1px solid', borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
              borderColor: wc.prog.length > 0 ? 'var(--accent)' : selId === wc.id ? 'var(--accent)' : 'var(--line-1)',
              boxShadow: selId === wc.id ? '0 0 0 2px var(--accent)' : 'none',
              opacity: wc.active.length === 0 ? .5 : 1,
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{wc.code}</div>
                <div style={{ fontSize: 12, color: 'var(--fg-1)', marginTop: 3, fontWeight: 500 }}>{wc.name}</div>
              </div>
              {wc.prog.length > 0 && (
                <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 99, fontSize: 11, fontWeight: 700, padding: '2px 8px' }}>▶{wc.prog.length}</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 11, color: 'var(--fg-2)' }}>
              <span><b style={{ color: 'var(--fg-0)' }}>{wc.active.length}</b> заданий</span>
              {wc.paused.length > 0 && <span style={{ color: 'var(--warning,#c07820)' }}>⏸{wc.paused.length}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Детальный вид */}
      {selected && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <span className="mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{selected.code}</span>
              <span style={{ fontSize: 16, fontWeight: 600, marginLeft: 10 }}>{selected.name}</span>
              <span style={{ fontSize: 12, color: 'var(--fg-2)', marginLeft: 10 }}>{orderGroups.length} заказов</span>
              {saving && <span style={{ fontSize:11, color:'var(--fg-2)', marginLeft:8 }}>⏳ сохранение…</span>}
            </div>
            <button className="icon-btn" onClick={() => setSelId(null)}><Icon name="x" size={16} /></button>
          </div>

          {orderGroups.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg-2)', fontSize: 13 }}>Нет активных заданий</div>
          ) : (
            <div>
              <div style={{ fontSize: 11, color: 'var(--fg-2)', marginBottom: 8 }}>
                Перетащите карточки заказов для изменения очерёдности
              </div>
              {orderGroups.map(({ order, tasks: grpTasks }, idx) => (
                <div key={order?.id || idx}
                  draggable
                  onDragStart={e => { e.dataTransfer.setData('idx', String(idx)); }}
                  onDragOver={e => { e.preventDefault(); setDragOver(idx); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={e => {
                    e.preventDefault();
                    const from = Number(e.dataTransfer.getData('idx'));
                    moveOrder(from, idx);
                    setDragOver(null);
                  }}
                  className="card"
                  style={{
                    padding: 0, overflow: 'hidden', marginBottom: 10, cursor: 'grab',
                    borderColor: dragOver === idx ? 'var(--accent)' : undefined,
                    boxShadow: dragOver === idx ? '0 0 0 2px var(--accent)' : undefined,
                    transition: 'box-shadow .15s',
                  }}>

                  {/* Заголовок заказа с QR */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-2)', borderBottom: '1px solid var(--line-2)' }}>
                    {/* Иконка drag */}
                    <span style={{ fontSize: 16, color: 'var(--fg-3)', cursor: 'grab', userSelect: 'none' }}>⠿</span>
                    {/* Порядок */}
                    <span style={{ fontSize: 11, color: 'var(--fg-2)', fontWeight: 700, minWidth: 20 }}>#{idx + 1}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="mono" style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 14 }}>{order?.number || order?.id}</span>
                        {order?.foreman && <span style={{ fontSize: 12, color: 'var(--fg-2)' }}>{order.foreman}</span>}
                        {order?.dueDate && <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--fg-2)' }}>до {order.dueDate}</span>}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--fg-2)' }}>{grpTasks.length} оп.</span>

                  </div>

                  {/* Задания */}
                  {grpTasks.sort((a, b) => a.opNum - b.opNum).map(t => (
                    <div key={t.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                      borderBottom: '1px solid var(--line-2)', flexWrap: 'wrap',
                      background: t.status === 'in_progress' ? 'rgba(217,72,15,.05)' : t.status === 'paused' ? 'rgba(192,120,32,.05)' : 'transparent',
                    }}>
                      {/* Номер + название */}
                      <div style={{ flex: 2, minWidth: 140 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="mono" style={{ fontWeight: 800, color: 'var(--accent)', fontSize: 13 }}>{String(t.opNum).padStart(3, '0')}</span>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{t.opName}</span>
                        </div>
                        {t.operator && <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 2 }}>👤 {t.operator}</div>}
                      </div>

                      {/* Таймер */}
                      <div style={{ minWidth: 70 }}><TaskTimer t={t} /></div>

                      {/* Кол-во */}
                      <div style={{ fontSize: 12, textAlign: 'center', minWidth: 50 }}>
                        <div style={{ fontWeight: 700, color: t.completed > 0 ? 'var(--st-done-line)' : 'var(--fg-0)' }}>
                          {t.completed}<span style={{color:'var(--fg-2)'}}>/{t.planned}</span>
                        </div>
                        <div style={{ fontSize: 9, color:'var(--fg-2)' }}>шт</div>
                        {t.completed > 0 && t.completed < t.planned && (
                          <div style={{fontSize:9,color:'var(--accent)'}}>ост.{t.planned-t.completed}</div>
                        )}
                      </div>

                      {/* Кнопки */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
                        {t.status === 'waiting' && (
                          <div style={{display:'flex',flexDirection:'column',gap:4}}>
                            <button className="btn primary" style={{ fontSize: 11, padding: '5px 10px' }}
                              onClick={() => onAction && onAction('start', t)}>▶ Начать</button>
                            {t.operator && (
                              <button className="btn ghost" style={{ fontSize: 11, padding: '3px 10px' }}
                                onClick={() => onAction && onAction('transfer', t)}>→ Передать</button>
                            )}
                          </div>
                        )}
                        {t.status === 'in_progress' && (<>
                          <button className="btn primary" style={{ fontSize: 11, padding: '5px 10px', background: 'var(--st-done-line)', borderColor: 'var(--st-done-line)' }}
                            onClick={() => onAction && onAction('close', t)}>✓ Закрыть</button>
                          <button className="btn" style={{ fontSize: 11, padding: '4px 10px', color: 'var(--warning,#c07820)', borderColor: 'var(--warning,#c07820)' }}
                            onClick={() => onAction && onAction('pause', t)}>⏸ Пауза</button>
                          <button className="btn ghost" style={{ fontSize: 11, padding: '4px 10px' }}
                            onClick={() => onAction && onAction('transfer', t)}>→ Передать</button>
                        </>)}
                        {t.status === 'paused' && (
                          <button className="btn primary" style={{ fontSize: 11, padding: '5px 10px' }}
                            onClick={() => onAction && onAction('resume', t)}>▶ Продолжить</button>
                        )}
                        <span className={'pill ' + (STATUS_CLS[t.status] || 'wait')} style={{ justifyContent: 'center', fontSize: 10 }}>
                          <span className="dot" />{STATUS_LBL[t.status] || t.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// =======================================================
// ExcelExportView — выгрузки в Excel
// =======================================================

// ── ModalTransferTask — простая передача задания оператору ───────────────
function ModalTransferTask({ task, data, onClose, onTransferred }) {
  const order   = (data?.orders||[]).find(o => o.id === task.orderId);
  const [toOp,   setToOp]   = React.useState('');
  const [comment,setComment]= React.useState('');
  const [saving, setSaving] = React.useState(false);

  const COMMON_OPS = [
    'Гаврилов А.Б.', 'Семёнов И.Н.', 'Орлов Д.С.',
    'Маркина Е.В.', 'Колесников П.А.',
  ];

  async function handleTransfer() {
    if (!toOp.trim()) return;
    setSaving(true);
    try {
      await api.patch('/tasks/' + task.id + '/status', {
        status:   task.status === 'paused' ? 'paused' : 'waiting',
        operator: toOp.trim(),
      });
      // Логируем передачу в историю
      if (comment.trim()) {
        await api.post('/tasks/' + task.id + '/comment', {
          comment: `Передано → ${toOp.trim()}: ${comment.trim()}`,
          operator: task.operator || '',
        }).catch(() => {});
      }
      onTransferred();
      onClose();
    } catch(e) { console.error('Error:', e.message); }
    setSaving(false);
  }

  return (
    <div className="modal-back" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:400 }}>
        <div className="modal-head">
          <b>Передать задание</b>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16}/></button>
        </div>
        <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {/* Инфо о задании */}
          <div style={{ background:'var(--bg-2)', borderRadius:8, padding:12, fontSize:12 }}>
            <div style={{ fontWeight:700, marginBottom:4 }}>
              <span className="mono" style={{color:'var(--accent)',marginRight:8}}>
                {String(task.opNum).padStart(3,'0')}
              </span>
              {task.opName}
            </div>
            <div style={{ color:'var(--fg-2)', display:'flex', gap:12 }}>
              <span>РЦ: {task.workCenter}</span>
              {order && <span>Заказ: {order.number}</span>}
              <span>Сделано: {task.completed}/{task.planned} шт</span>
            </div>
            {task.operator && (
              <div style={{ color:'var(--fg-2)', marginTop:4 }}>
                Текущий: <b style={{color:'var(--fg-1)'}}>{task.operator}</b>
              </div>
            )}
          </div>

          {/* Выбор нового оператора */}
          <div className="field">
            <span className="field-label">Новый оператор</span>
            <input className="input" value={toOp}
              onChange={e => setToOp(e.target.value)}
              placeholder="Введите имя…"
              autoFocus />
          </div>

          {/* Быстрый выбор */}
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {COMMON_OPS.filter(op => op !== task.operator).map(op => (
              <button key={op} className="btn ghost"
                style={{ fontSize:11, padding:'4px 10px',
                  background: toOp === op ? 'var(--accent)' : undefined,
                  color: toOp === op ? '#fff' : undefined }}
                onClick={() => setToOp(op)}>
                {op}
              </button>
            ))}
          </div>
          {/* Комментарий к передаче */}
          <div className="field">
            <span className="field-label">Комментарий (необязательно)</span>
            <textarea className="input" value={comment} onChange={e=>setComment(e.target.value)}
              placeholder="Что сделано, что осталось, особые указания…"
              rows={2} style={{ resize:'vertical', fontFamily:'var(--ui-font)', fontSize:12 }}/>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Отмена</button>
          <button className="btn primary" onClick={handleTransfer}
            disabled={saving || !toOp.trim()}>
            {saving ? 'Передача…' : '→ Передать'}
          </button>
        </div>
      </div>
    </div>
  );
}

export { WorkCentersView, ModalManageWorkCenters, ModalTransferTask }
