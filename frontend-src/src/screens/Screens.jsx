import React from 'react'
import { api, Auth, API_BASE } from '../lib/api.js'
import { Icon } from '../components/Icon.jsx'
import { QrCode, generateQrSvg } from '../components/QrCode.jsx'
import { useStrings, StatusPill, OrderPicker, ORDER_STATUS_RU,
         STATUS_LABEL_RU } from '../lib/data.jsx'

function Dashboard({ data, tasks, scanLog, lang, onScan, onCloseTask, onNewOrder }) {
  const S = useStrings(lang);
  const [activeId, setActiveId] = React.useState(data.orders[0]?.id);

  // Re-sync если заказы обновились
  React.useEffect(() => {
    if (!data.orders.find(o => o.id === activeId) && data.orders.length) {
      setActiveId(data.orders[0].id);
    }
  }, [data.orders]);

  const order = data.orders.find(o => o.id === activeId) || data.orders[0];
  if (!order) return (
    <div style={{ padding:24, textAlign:'center', color:'var(--fg-2)' }}>
      <p style={{ marginBottom:16 }}>{lang === 'en' ? 'No orders yet' : 'Нет заказов'}</p>
      <button className="btn primary" onClick={onNewOrder}><Icon name="plus" size={14}/>{lang === 'en' ? 'New order' : 'Создать заказ'}</button>
    </div>
  );

  const items = order.items.map(it => {
    const det = data.details.find(d => d.id === it.detailId);
    const itemTasks = tasks.filter(t => t.orderId === order.id && t.detailId === it.detailId);
    const done = itemTasks.filter(t => t.status === 'done').length;
    return { ...it, det, tasks: itemTasks, done, total: itemTasks.length };
  });

  const allTasks = tasks.filter(t => t.orderId === order.id);
  const inProg  = allTasks.filter(t => t.status === 'in_progress').length;
  const doneCt  = allTasks.filter(t => t.status === 'done').length;
  const waitCt  = allTasks.filter(t => t.status === 'waiting').length;
  const overdue = allTasks.filter(t => t.status === 'waiting' && t.opNum <= 40).length;
  const totalTime = allTasks.reduce((s, t) => s + t.time * t.planned, 0);
  const doneTime  = allTasks.filter(t => t.status === 'done').reduce((s, t) => s + t.time * t.planned, 0);
  const pct = totalTime > 0 ? Math.round((doneTime / totalTime) * 100) : 0;

  // Нормоконтроль по заказу
  const factTime  = allTasks.filter(t=>t.status==='done').reduce((s,t) => s + (t.actualTime||0), 0);
  const overOps   = allTasks.filter(t=>t.status==='done' && t.actualTime && t.actualTime > t.time * 1.15);
  const overTotal = overOps.reduce((s,t) => s + (t.actualTime - t.time * t.completed), 0);
  const normPct   = doneTime > 0 && factTime > 0 ? Math.round(factTime / doneTime * 100) : null;

  const STATUS_CLS = { plan:'wait', in_work:'prog', done:'done' };
  const STATUS_LBL = { plan:'Планируется', in_work:'В работе', done:'Выполнен' };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{S.navDash}</h1>
          <div className="page-sub">{S.workspace} · {S.shift}</div>
        </div>
        <div className="row">
          <button className="btn" onClick={onScan}><Icon name="qr" size={14}/>{S.scanQR}</button>
          <button className="btn primary" onClick={onNewOrder}><Icon name="plus" size={14}/>{S.newOrder}</button>
        </div>
      </div>

      {/* Список заказов — умный пикер */}
      <OrderPicker orders={data.orders} activeId={activeId}
        onSelect={setActiveId} onNew={onNewOrder} lang={lang}/>

      <div className="kpi-scroll grid-4" style={{ marginBottom: 'var(--density-section-gap)' }}>
        <div className="kpi accent">
          <div className="kpi-label">{S.active}</div>
          <div className="kpi-value num mono">{order.number}</div>
          <div className="kpi-meta">{order.customer}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{S.inWork}</div>
          <div className="kpi-value num">{inProg}<span className="unit">/ {allTasks.length} {S.ops}</span></div>
          <div className="kpi-meta">
            <span className="pill prog" style={{padding:'1px 5px'}}><span className="dot"/>{doneCt}</span>
            <span className="pill wait" style={{padding:'1px 5px'}}><span className="dot"/>{waitCt}</span>
            <span>· {Math.round(doneTime/60)}{S.hr} / {Math.round(totalTime/60)}{S.hr}</span>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{S.doneToday}</div>
          <div className="kpi-value num">{doneCt}<span className="unit">{S.ops}</span></div>
          <div className="kpi-meta"><span>{pct}% {lang === 'en' ? 'complete' : 'выполнено'}</span></div>
        </div>
        <div className="kpi" style={{ borderLeft: overOps.length > 0 ? '2px solid var(--danger)' : undefined }}>
          <div className="kpi-label">Нормоконтроль</div>
          <div className="kpi-value num" style={{ color: normPct > 115 ? 'var(--danger)' : normPct > 100 ? 'var(--warning,#c07820)' : 'var(--st-done-line)' }}>
            {normPct ? normPct + '%' : '—'}
          </div>
          <div className="kpi-meta">
            {overOps.length > 0
              ? <span style={{color:'var(--danger)'}}>{overOps.length} оп. превышение +{Math.round(overTotal)}′</span>
              : <span style={{color:'var(--st-done-line)'}}>в норме</span>}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div>
          <div className="subhead" style={{ marginTop: 0 }}>
            {lang === 'en' ? 'Production board' : 'Производственное табло'} · {order.number}
          </div>
          {items.length === 0
            ? <div className="empty-state">{lang === 'en' ? 'No parts in order' : 'Нет деталей в заказе'}</div>
            : items.map(it => (
              <DetailBoardGroup key={it.detailId} detail={it.det} tasks={it.tasks}
                done={it.done} total={it.total} qty={it.quantity} lang={lang} onCloseTask={onCloseTask}/>
            ))
          }
        </div>

        <div>
          <div className="subhead" style={{ marginTop: 0 }}>{S.recentScans}</div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {scanLog.length === 0 && <div className="empty-state" style={{ borderRadius:0,border:0 }}>—</div>}
            {scanLog.slice(0, 7).map((s, i) => (
              <div key={i} className="scan-log-row">
                <div className="ts">{s.ts.slice(-5)}</div>
                <div>
                  <div className="label">
                    <span className="mono" style={{ color:'var(--accent)' }}>{('0'+(s.op?.split(' ')[0]||'')).slice(-3)} </span>
                    {s.op?.split(' ').slice(1).join(' ')}
                  </div>
                  <div className="meta">{s.detail} · {s.operator}</div>
                </div>
                <span className="pill done"><Icon name="check" size={11}/></span>
              </div>
            ))}
          </div>

          <div className="subhead">{lang === 'en' ? 'Order timing' : 'Прогресс по времени'}</div>
          <div className="card">
            <div className="row" style={{ justifyContent:'space-between', marginBottom:8 }}>
              <span className="muted" style={{ fontSize:11 }}>{S.created} {order.createdAt} · {S.dueDate} {order.dueDate}</span>
              <span className="mono num" style={{ fontSize:11, color:'var(--accent)' }}>{pct}%</span>
            </div>
            <div className="board-progress" style={{ maxWidth:'none', height:8 }}>
              <div className="board-progress-fill" style={{ width: pct + '%' }}/>
            </div>
            <div className="row" style={{ marginTop:10, justifyContent:'space-between', fontSize:11 }}>
              <span className="muted">{lang === 'en' ? 'Spent' : 'Затрачено'}: <b className="num">{Math.round(doneTime/60)}{S.hr} {doneTime%60}{S.min}</b></span>
              <span className="muted">{lang === 'en' ? 'Remaining' : 'Осталось'}: <b className="num">{Math.round((totalTime-doneTime)/60)}{S.hr}</b></span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function TimePill({ planMin, startedAt, status, actualTime }) {
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    if (status !== 'in_progress' || !startedAt) return;
    const calc = () => setElapsed(Math.round((Date.now() - new Date(startedAt).getTime()) / 60000));
    calc();
    const id = setInterval(calc, 30000);
    return () => clearInterval(id);
  }, [startedAt, status]);

  if (status === 'done' && actualTime) {
    const over = actualTime - planMin;
    const pct  = Math.round(actualTime / planMin * 100);
    const color = over > planMin * 0.15 ? 'var(--danger)' : over > 0 ? 'var(--warning,#c07820)' : 'var(--st-done-line)';
    return (
      <div style={{ textAlign:'center', fontSize:10, lineHeight:1.3 }}>
        <div className="num" style={{ color, fontWeight:600 }}>{actualTime}′</div>
        <div style={{ fontSize:9, color:'var(--fg-2)' }}>пл {planMin}′ · {pct > 100 ? '+' : ''}{pct - 100}%</div>
      </div>
    );
  }
  if (status === 'in_progress' && startedAt) {
    const over = elapsed - planMin;
    const color = elapsed > planMin ? 'var(--danger)' : 'var(--accent)';
    return (
      <div style={{ textAlign:'center', fontSize:10, lineHeight:1.3 }}>
        <div className="num" style={{ color, fontWeight:600 }}>{elapsed}′</div>
        <div style={{ fontSize:9, color:'var(--fg-2)' }}>пл {planMin}′{over > 0 ? <span style={{color:'var(--danger)'}}> +{over}′</span> : ''}</div>
      </div>
    );
  }
  return (
    <div style={{ textAlign:'center', fontSize:10, color:'var(--fg-2)' }}>
      <div>{planMin}′</div>
    </div>
  );
}

function DetailBoardGroup({ detail, tasks, done, total, qty, lang, onCloseTask }) {
  const S = useStrings(lang);
  const pct = total > 0 ? (done / total) * 100 : 0;

  // Нормоконтроль: план vs факт по детали
  const planMin   = tasks.reduce((s,t) => s + t.time * t.planned, 0);
  const factMin   = tasks.filter(t=>t.status==='done').reduce((s,t) => s + (t.actualTime||t.time*t.completed), 0);
  const overMin   = factMin - tasks.filter(t=>t.status==='done').reduce((s,t) => s + t.time*t.completed, 0);
  const hasOver   = tasks.some(t => t.status==='done' && t.actualTime && t.actualTime > t.time * 1.15);

  return (
    <div className="board-group">
      <div className="board-grp-head">
        <Icon name="box" size={16} className="muted" />
        <div style={{ flex:1 }}>
          <div className="board-grp-title">{detail.name}</div>
          <div className="row" style={{ gap: 8, marginTop: 2, flexWrap:'wrap' }}>
            <span className="board-grp-code">{detail.code}</span>
            <span className="muted" style={{ fontSize: 11 }}>{S.qtyShort}: <b className="num">{qty}</b> {S.pcs}</span>
            {detail.drawing && <span className="muted" style={{ fontSize: 11 }}>{detail.drawing}</span>}
            {factMin > 0 && (
              <span className="num" style={{ fontSize:10,
                color: hasOver ? 'var(--danger)' : 'var(--st-done-line)',
                fontWeight: hasOver ? 600 : 400 }}>
                ⏱ {Math.round(factMin)}′ / {planMin}′
                {hasOver && <span style={{color:'var(--danger)'}}> ↑</span>}
              </span>
            )}
          </div>
        </div>
        <div className="board-progress">
          <div className="board-progress-fill" style={{ width: pct + '%' }} />
        </div>
        <span className="mono num" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{done}/{total}</span>
      </div>
      <div>
        {tasks.map(t => (
          <div key={t.id} className={'task-row ' + (t.status === 'done' ? 'done' : '')
            + (t.status==='done' && t.actualTime && t.actualTime > t.time * 1.15 ? ' overdue-row' : '')}>
            <div className="op-num">{String(t.opNum).padStart(3, '0')}</div>
            <div>
              <div className="task-name">{t.opName}</div>
              <div className="task-meta mono">{t.workCenter}</div>
            </div>
            <div className="qty-bar">
              <span className="num">{t.completed}/{t.planned}</span>
              <span className="bar"><span className="fill" style={{ width: (t.completed / t.planned) * 100 + '%' }} /></span>
            </div>
            <TimePill planMin={t.time * t.planned} startedAt={t.startedAt}
              status={t.status} actualTime={t.actualTime} />
            <div style={{ fontSize: 11, color: 'var(--fg-1)' }}>{t.operator || <span className="muted">—</span>}</div>
            <div className="actions">
              <StatusPill status={t.status} lang={lang} />
              {t.status !== 'done' && (
                <button className="icon-btn" title={S.closeOp} onClick={() => onCloseTask(t.id)}>
                  <Icon name="check" size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =======================================================
// Library
// =======================================================
function Library({ data, tasks, lang, onNewDetail, onEditDetail, onDeleteDetail }) {
  const S = useStrings(lang);
  const [selectedId, setSelectedId] = React.useState(() => data.details[0]?.id || null);
  const [query, setQuery] = React.useState('');

  const filtered = data.details.filter(d =>
    d.name.toLowerCase().includes(query.toLowerCase()) ||
    d.code.toLowerCase().includes(query.toLowerCase())
  );

  // Если выбранная деталь удалена — переключаемся на первую доступную
  const detail = data.details.find(d => d.id === selectedId) || data.details[0] || null;

  React.useEffect(() => {
    if (!data.details.find(d => d.id === selectedId) && data.details.length > 0) {
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
          <div className="tbl-wrap" style={{ border: 0, borderRadius: 0, boxShadow: 'none' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 52 }}>№</th>
                  <th>{S.operation}</th>
                  <th>{S.workCenter}</th>
                  <th className="num-col">{lang === 'en' ? 'Time' : 'Время'}</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {(detail.operations||[]).map(op => (
                  <tr key={op.num} className="row-hover">
                    <td><span className="op-num">{String(op.num).padStart(3, '0')}</span></td>
                    <td><b>{op.name}</b></td>
                    <td className="mono-col muted">{op.workCenter}</td>
                    <td className="num-col"><span className="num">{op.time}</span> <span className="muted">{S.min}</span></td>
                    <td><button className="icon-btn"><Icon name="dots" size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function OrderBuilder({ data, tasks, lang, onPrint, onSave, onDeleteOrder, onSelectOrder, activeOrderId }) {
  const S = useStrings(lang);
  const order = data.orders[0];

  if (!order) return (
    <div style={{ padding:48, textAlign:'center', color:'var(--fg-2)' }}>
      <p style={{ marginBottom:16 }}>Нет активных заказов</p>
    </div>
  );

  const [items, setItems] = React.useState(() => order.items.map(it => ({ ...it })));
  const [number] = React.useState(order.number);
  const [customer, setCustomer] = React.useState(order.customer);
  const [dueDate, setDueDate] = React.useState(order.dueDate);
  const [foreman, setForeman] = React.useState(order.foreman);
  const [adding, setAdding] = React.useState(false);

  const updateQty = (idx, v) => {
    const next = [...items];
    next[idx] = { ...next[idx], quantity: Math.max(1, v) };
    setItems(next);
  };
  const removeLine = (idx) => setItems(items.filter((_, i) => i !== idx));
  const addLine = (detailId) => {
    if (items.find(i => i.detailId === detailId)) return setAdding(false);
    setItems([...items, { detailId, quantity: 1 }]);
    setAdding(false);
  };

  // Computed: total ops, total time
  const totalOps = items.reduce((s, it) => {
    const det = data.details.find(d => d.id === it.detailId);
    return s + (det ? (det.operations||[]).length : 0);
  }, 0);
  const totalTime = items.reduce((s, it) => {
    const det = data.details.find(d => d.id === it.detailId);
    if (!det) return s;
    return s + (det.operations||[]).reduce((ss, o) => ss + o.time, 0) * it.quantity;
  }, 0);
  const totalUnits = items.reduce((s, it) => s + it.quantity, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{lang === 'en' ? 'Order' : 'Заказ'} {number}</h1>
          <div className="page-sub">
            {S.created} {order.createdAt} · <span className="pill prog" style={{padding:'1px 6px'}}><span className="dot"/>{lang === 'en' ? 'In progress' : 'В работе'}</span>
          </div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => onSelectOrder && onSelectOrder(order)}><Icon name="edit" size={14} />{lang === 'en' ? 'Edit' : 'Редактировать'}</button>
          <button className="btn" style={{ color:'var(--danger)' }} onClick={() => onDeleteOrder && onDeleteOrder(order)}><Icon name="trash" size={14} />{lang === 'en' ? 'Delete' : 'Удалить'}</button>
          <button className="btn" onClick={()=>onSave({items, number, customer, foreman, dueDate, status: order.status, priority: order.priority})}><Icon name="check" size={14} />{S.saveOrder}</button>
          <button className="btn primary" onClick={onPrint}><Icon name="print" size={14} />{S.generateSheet}</button>
        </div>
      </div>

      <div className="builder">
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h3 className="card-title">{lang === 'en' ? 'Order header' : 'Параметры заказа'}</h3>
              <span className="muted" style={{ fontSize: 11 }}>{lang === 'en' ? 'Editable until generated' : 'Можно править до выпуска'}</span>
            </div>
            <div className="grid-3">
              <div className="field">
                <span className="field-label">{S.customer}</span>
                <input className="input" value={customer} onChange={e => setCustomer(e.target.value)} />
              </div>
              <div className="field">
                <span className="field-label">{S.dueDate}</span>
                <input className="input" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
              <div className="field">
                <span className="field-label">{S.foreman}</span>
                <input className="input" value={foreman} onChange={e => setForeman(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="toolbar">
              <Icon name="orders" size={14} className="muted" />
              <b style={{ fontSize: 13 }}>{S.orderComp}</b>
              <span className="tag mono">{items.length} {lang === 'en' ? 'lines' : 'строк'}</span>
              <span className="topbar-spacer" />
              <button className="btn ghost" onClick={() => setAdding(!adding)}>
                <Icon name="plus" size={14} />{S.addLine}
              </button>
            </div>

            {adding && (
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line-2)', background: 'var(--bg-1)' }}>
                <select className="select" autoFocus
                  defaultValue=""
                  onChange={e => e.target.value && addLine(e.target.value)}
                  style={{ width: '100%' }}>
                  <option value="" disabled>{lang === 'en' ? 'Pick a part…' : 'Выбрать деталь…'}</option>
                  {data.details
                    .filter(d => !items.find(i => i.detailId === d.id))
                    .map(d => (
                      <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                    ))}
                </select>
              </div>
            )}

            {items.length === 0 && (
              <div style={{ padding: 20 }}>
                <div className="empty-state">{lang === 'en' ? 'No parts added yet' : 'Детали не добавлены'}</div>
              </div>
            )}

            {items.map((it, idx) => {
              const det = data.details.find(d => d.id === it.detailId);
              if (!det) return null;
              return (
                <div key={it.detailId} className="order-line">
                  <div>
                    <div className="order-line-name">{det.name}</div>
                    <div className="order-line-meta">
                      <span className="mono" style={{ color: 'var(--accent)' }}>{det.code}</span>
                      <span className="muted" style={{ marginLeft: 10 }}>{det.material}</span>
                    </div>
                    <div className="ops-tag-list">
                      {(det.operations||[]).slice(0, 6).map(op => (
                        <span key={op.num} className="ops-tag">{String(op.num).padStart(2,'0')} {op.name.slice(0, 14)}</span>
                      ))}
                      {(det.operations||[]).length > 6 && <span className="ops-tag">+{(det.operations||[]).length - 6}</span>}
                    </div>
                  </div>
                  <div className="qty-stepper">
                    <button onClick={() => updateQty(idx, it.quantity - 1)}>−</button>
                    <input value={it.quantity} onChange={e => updateQty(idx, parseInt(e.target.value) || 1)} className="num" />
                    <button onClick={() => updateQty(idx, it.quantity + 1)}>+</button>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11 }}>
                    <div className="num"><b>{(det.operations||[]).length * it.quantity}</b> <span className="muted">{S.ops}</span></div>
                    <div className="muted num">{(det.operations||[]).reduce((s, o) => s + o.time, 0) * it.quantity}{S.min}</div>
                  </div>
                  <button className="icon-btn" onClick={() => removeLine(idx)} title={lang === 'en' ? 'Remove' : 'Удалить'}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="builder-summary stack">
          <div className="card">
            <div className="card-head">
              <h3 className="card-title">{S.summary}</h3>
              <span className="muted mono" style={{ fontSize: 11 }}>{number}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <div className="kpi-label">{S.detailsCt}</div>
                <div className="kpi-value num" style={{ fontSize: 22 }}>{items.length}</div>
              </div>
              <div>
                <div className="kpi-label">{S.partsCt}</div>
                <div className="kpi-value num" style={{ fontSize: 22 }}>{totalUnits}<span className="unit">{S.pcs}</span></div>
              </div>
              <div>
                <div className="kpi-label">{S.totalOps}</div>
                <div className="kpi-value num" style={{ fontSize: 22 }}>{items.reduce((s, it) => {
                  const det = data.details.find(d => d.id === it.detailId);
                  return s + (det ? (det.operations||[]).length * it.quantity : 0);
                }, 0)}</div>
              </div>
              <div>
                <div className="kpi-label">{S.totalTime}</div>
                <div className="kpi-value num" style={{ fontSize: 22 }}>{Math.round(totalTime / 60)}<span className="unit">{S.hr} {totalTime % 60}{S.min}</span></div>
              </div>
            </div>
            <div style={{ height: 1, background: 'var(--line-1)', margin: '14px 0' }} />
            <div style={{ fontSize: 11.5, color: 'var(--fg-1)', lineHeight: 1.5 }}>
              {lang === 'en'
                ? 'Generating the route sheet will create operation tasks for every part-operation pair and a unique QR code per task.'
                : 'При выпуске будут созданы задания на каждую пару «деталь × операция» и уникальный QR-код для каждого.'}
            </div>
            <button className="btn primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12, height: 36 }} onClick={onPrint}>
              <Icon name="print" size={14} />{S.generateSheet}
            </button>
          </div>

          <div className="card">
            <div className="card-head">
              <h3 className="card-title" style={{ fontSize: 12 }}>{lang === 'en' ? 'Workload preview' : 'Загрузка рабочих центров'}</h3>
            </div>
            <WorkCenterPreview items={items} data={data} lang={lang} />
          </div>
        </div>
      </div>
    </>
  );
}

function WorkCenterPreview({ items, data, lang }) {
  const wcMap = {};
  items.forEach(it => {
    const det = data.details.find(d => d.id === it.detailId);
    if (!det) return;
    det.operations.forEach(o => {
      const key = o.workCenter;
      wcMap[key] = (wcMap[key] || 0) + o.time * it.quantity;
    });
  });
  const entries = Object.entries(wcMap).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(e => e[1]));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
      {entries.map(([wc, mins]) => (
        <div key={wc}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 2 }}>
            <span className="mono" style={{ fontSize: 10.5 }}>{wc}</span>
            <span className="num muted">{mins}{lang === 'en' ? 'm' : 'м'}</span>
          </div>
          <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: (mins / max * 100) + '%', background: 'var(--accent)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function RouteSheetView({ data, tasks, lang, qrSize, onClose, onScanQR }) {
  const S = useStrings(lang);
  const order = data.orders[0];

  if (!order) return (
    <div style={{ padding:48, textAlign:'center', color:'var(--fg-2)' }}>
      <p>Нет заказа для печати</p>
      <button className="btn" onClick={onClose} style={{ marginTop:16 }}>← Назад</button>
    </div>
  );

  const items = order.items.map(it => ({
    ...it,
    det: data.details.find(d => d.id === it.detailId),
    tasks: tasks.filter(t => t.orderId === order.id && t.detailId === it.detailId),
  }));

  // Печать: компактный маршрутный лист на А4
  function handlePrint() {
    const printWin = window.open('', '_blank', 'width=820,height=1000');
    if (!printWin) { window.print(); return; }

    const rowsHTML = items.map((it, idx) => {
      if (!it.det) return '';
      const opsRows = it.tasks.map(t => {
        const qrSVG = generateQrSvg(t.qrText, 52) ||
          `<div style="width:52px;height:52px;border:1px solid #ccc;font-size:6pt;color:#999;display:flex;align-items:center;justify-content:center;text-align:center">${t.qrText.slice(-8)}</div>`;

        const rowBg = t.status === 'done' ? '#f0faf0' : t.status === 'in_progress' ? '#fff8f0' : '#fff';
        const statusIcon = t.status === 'done' ? '✓' : t.status === 'in_progress' ? '▶' : '';

        return `<tr style="background:${rowBg}">
          <td style="padding:3px 6px;border-bottom:1px solid #e8e0d0;font-family:monospace;font-weight:700;font-size:9pt;width:30px;text-align:center">${String(t.opNum).padStart(3,'0')}</td>
          <td style="padding:3px 6px;border-bottom:1px solid #e8e0d0;font-size:9pt"><b>${t.opName}</b></td>
          <td style="padding:3px 6px;border-bottom:1px solid #e8e0d0;font-size:8pt;font-family:monospace;color:#444;width:110px">${t.workCenter}</td>
          <td style="padding:3px 6px;border-bottom:1px solid #e8e0d0;font-size:9pt;text-align:center;width:30px;font-family:monospace;font-weight:700">${t.planned}</td>
          <td style="padding:3px 6px;border-bottom:1px solid #e8e0d0;font-size:7pt;font-family:monospace;color:#666;text-align:center;width:35px">${t.time}'</td>
          <td style="padding:2px 4px;border-bottom:1px solid #e8e0d0;text-align:center;width:56px">${qrSVG}<div style="font-size:5pt;font-family:monospace;color:#999;margin-top:1px;word-break:break-all">${t.qrText.slice(-10)}</div></td>
          <td style="padding:3px 6px;border-bottom:1px solid #e8e0d0;font-size:8pt;text-align:center;width:18px;color:${t.status==='done'?'#2d7a2d':'#888'}">${statusIcon}</td>
          <td style="border-bottom:1px solid #e8e0d0;border-left:1px dashed #ccc;width:80px;padding:2px 4px">
            <div style="font-size:7pt;color:#999">исполнитель:</div>
            <div style="font-size:8pt;color:#555">${t.operator||''}</div>
          </td>
        </tr>`;
      }).join('');

      const detDone  = it.tasks.filter(t=>t.status==='done').length;
      const detTotal = it.tasks.length;
      const detPct   = detTotal > 0 ? Math.round(detDone*100/detTotal) : 0;

      return `<div style="margin-bottom:8px;page-break-inside:avoid">
        <div style="display:flex;justify-content:space-between;align-items:center;
                    background:#f5efe0;padding:4px 8px;border-left:3px solid #c07820;margin-bottom:0">
          <div style="display:flex;align-items:center;gap:12px">
            <span style="font-size:10pt;font-weight:700">${idx+1}. ${it.det.name}</span>
            <span style="font-family:monospace;font-size:8pt;color:#666">${it.det.code}</span>
            <span style="font-size:8pt;color:#555">чертёж: <b>${it.det.drawing||'—'}</b></span>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <span style="font-size:9pt">кол-во: <b>${it.quantity} ${it.det.unit}</b></span>
            <div style="display:flex;align-items:center;gap:4px">
              <div style="width:50px;height:5px;background:#ddd;border-radius:3px;overflow:hidden">
                <div style="width:${detPct}%;height:100%;background:#2d7a2d;border-radius:3px"></div>
              </div>
              <span style="font-size:8pt;font-family:monospace">${detDone}/${detTotal}</span>
            </div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:9pt">
          <thead><tr style="background:#ede5d0">
            <th style="padding:3px 6px;text-align:center;font-size:7pt;border-bottom:2px solid #c07820;width:30px">№</th>
            <th style="padding:3px 6px;text-align:left;font-size:7pt;border-bottom:2px solid #c07820">ОПЕРАЦИЯ</th>
            <th style="padding:3px 6px;text-align:left;font-size:7pt;border-bottom:2px solid #c07820;width:110px">РАБ. ЦЕНТР</th>
            <th style="padding:3px 6px;text-align:center;font-size:7pt;border-bottom:2px solid #c07820;width:30px">КОЛ</th>
            <th style="padding:3px 6px;text-align:center;font-size:7pt;border-bottom:2px solid #c07820;width:35px">МИН</th>
            <th style="padding:3px 6px;text-align:center;font-size:7pt;border-bottom:2px solid #c07820;width:56px">QR</th>
            <th style="padding:3px 6px;text-align:center;font-size:7pt;border-bottom:2px solid #c07820;width:18px">✓</th>
            <th style="padding:3px 6px;text-align:left;font-size:7pt;border-bottom:2px solid #c07820;width:80px;border-left:1px dashed #ccc">ИСПОЛНИТЕЛЬ</th>
          </tr></thead>
          <tbody>${opsRows}</tbody>
        </table>
      </div>`;
    }).join('');

    const allT    = items.flatMap(it=>it.tasks);
    const doneAll = allT.filter(t=>t.status==='done').length;
    const pctAll  = allT.length > 0 ? Math.round(doneAll*100/allT.length) : 0;

    printWin.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>МЛ ${order.number}</title>
      <style>
        @page { size: A4 portrait; margin: 8mm 10mm; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
        html, body { margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 9pt; color: #14110b; }
        @media print { body { margin: 0; } }
      </style>
    </head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;
                border-bottom:2px solid #14110b;padding-bottom:6px;margin-bottom:8px">
      <div>
        <div style="font-size:7pt;font-weight:700;letter-spacing:.2em;color:#7a6840;text-transform:uppercase">Маршрутный лист</div>
        <div style="font-size:18pt;font-weight:700;line-height:1;margin:2px 0">№ ${order.number}</div>
        <div style="font-size:8pt;color:#7a6840">к заказу на производство</div>
      </div>
      <div style="display:flex;gap:20px;align-items:flex-start">
        <table style="font-size:8pt;border-collapse:collapse">
          <tr><td style="color:#888;padding:1px 8px 1px 0">Получатель:</td><td style="font-weight:500">${order.customer}</td></tr>
          <tr><td style="color:#888;padding:1px 8px 1px 0">Ст. мастер:</td><td>${order.foreman||'—'}</td></tr>
          <tr><td style="color:#888;padding:1px 8px 1px 0">Создан:</td><td style="font-family:monospace">${order.createdAt}</td></tr>
          <tr><td style="color:#888;padding:1px 8px 1px 0">Срок:</td><td style="font-family:monospace;font-weight:500">${order.dueDate}</td></tr>
        </table>
        <div style="text-align:center;min-width:60px">
          <div style="font-size:7pt;color:#888;margin-bottom:2px">прогресс</div>
          <div style="font-size:14pt;font-weight:700">${pctAll}%</div>
          <div style="font-size:7pt;color:#888">${doneAll}/${allT.length} оп.</div>
        </div>
      </div>
    </div>
    ${rowsHTML}
    <div style="display:flex;justify-content:space-between;border-top:1px solid #ccc;
                padding-top:4px;font-size:7pt;color:#888;margin-top:6px">
      <span>Принял: _____________________</span>
      <span>Дата: __________</span>
      <span style="font-family:monospace">${order.number} · ${new Date().toLocaleDateString('ru-RU')}</span>
    </div>
    <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script>
    </body></html>`);
    printWin.document.close();
  }

  // Excel-экспорт маршрутного листа
  function handleExcel() {
    const XLSX = window.XLSX;
    if (!XLSX) { alert('SheetJS не загружен'); return; }

    const wb = XLSX.utils.book_new();

    items.forEach((it, idx) => {
      const rows = [
        ['Маршрутный лист', order.number],
        ['Получатель', order.customer],
        ['Ст. мастер', order.foreman || '—'],
        ['Дата создания', order.createdAt],
        ['Срок', order.dueDate],
        [],
        [`${idx+1}. ${it.det.name}`],
        [`Код: ${it.det.code}  Кол-во: ${it.quantity} ${it.det.unit}  Чертёж: ${it.det.drawing||'—'}`],
        [],
        ['№ оп.', 'Операция', 'Раб. центр', 'Кол-во', 'QR-код', 'Статус', 'Исполнитель', 'Подпись'],
        ...it.tasks.map(t => [
          String(t.opNum).padStart(3,'0'),
          t.opName,
          t.workCenter,
          t.planned,
          t.qrText,
          t.status === 'done' ? 'Выполнена' : t.status === 'in_progress' ? 'В работе' : 'Ожидает',
          t.operator || '',
          '',
        ]),
        [],
      ];

      const ws = XLSX.utils.aoa_to_sheet(rows);

      // Ширина столбцов
      ws['!cols'] = [
        {wch:8},{wch:30},{wch:20},{wch:8},{wch:22},{wch:14},{wch:20},{wch:16}
      ];

      const sheetName = it.det.code.slice(0, 31).replace(/[\\/\?\*\[\]]/g,'_');
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    // Сводный лист заказа
    const summaryRows = [
      ['МАРШРУТНЫЙ ЛИСТ — СВОДНЫЙ'],
      ['Заказ', order.number],
      ['Получатель', order.customer],
      ['Ст. мастер', order.foreman || '—'],
      ['Создан', order.createdAt],
      ['Срок', order.dueDate],
      [],
      ['Деталь', 'Код', 'Кол-во', 'Операций', 'Выполнено', 'В работе', 'Ожидает'],
      ...items.map(it => {
        const doneCt  = it.tasks.filter(t=>t.status==='done').length;
        const progCt  = it.tasks.filter(t=>t.status==='in_progress').length;
        const waitCt  = it.tasks.filter(t=>t.status==='waiting').length;
        return [it.det.name, it.det.code, it.quantity, it.tasks.length, doneCt, progCt, waitCt];
      }),
    ];
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
    summaryWs['!cols'] = [{wch:35},{wch:16},{wch:8},{wch:10},{wch:10},{wch:10},{wch:10}];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Сводный');

    XLSX.writeFile(wb, `МЛ-${order.number}-${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{S.routesheet} {order.number}</h1>
          <div className="page-sub">{S.preview} · A4 · QR {qrSize}px</div>
        </div>
        <div className="row">
          <button className="btn ghost" onClick={onClose}><Icon name="arrow-left" size={14}/>{lang === 'en' ? 'Back' : 'К заказу'}</button>
          <button className="btn" onClick={handleExcel}><Icon name="table" size={14}/>Excel</button>
          <button className="btn" onClick={handlePrint}><Icon name="print" size={14}/>{S.printNow}</button>
          <button className="btn primary" onClick={onScanQR}><Icon name="scan" size={14}/>{S.scanQR}</button>
        </div>
      </div>

      {/* Превью маршрутного листа */}
      <div className="print-area" style={{ maxWidth:880, margin:'0 auto' }}>
        <div className="routesheet">
          <div className="rs-head">
            <div>
              <div className="rs-title">{S.sheetTitle}</div>
              <div className="rs-number">№ {order.number}</div>
              <div style={{ fontSize:11, color:'#5a5240', marginTop:4 }}>{S.sheetSubtitle}</div>
            </div>
            <div className="rs-meta">
              <span className="lbl">{S.customer}:</span><span>{order.customer}</span>
              <span className="lbl">{S.foreman}:</span><span>{order.foreman}</span>
              <span className="lbl">{S.created}:</span><span className="mono">{order.createdAt}</span>
              <span className="lbl">{S.dueDate}:</span><span className="mono">{order.dueDate}</span>
              <span className="lbl">{S.page}:</span><span className="mono">1 {S.of} 1</span>
            </div>
          </div>

          {items.map((it, idx) => (
            <React.Fragment key={it.detailId}>
              <div className="rs-detail-head">
                <div className="rs-detail-title">{idx+1}. {it.det.name}</div>
                <div className="rs-detail-meta">{it.det.code} · {S.qtyShort}: <b>{it.quantity}</b> {it.det.unit} · {it.det.drawing}</div>
              </div>
              <table className="rs-ops">
                <thead><tr>
                  <th style={{ width:38 }}>№</th>
                  <th>{S.operation}</th>
                  <th style={{ width:130 }}>{S.workCenter}</th>
                  <th style={{ width:50 }}>{S.qtyShort}</th>
                  <th style={{ width:qrSize+16 }}>{S.qrCode}</th>
                  <th style={{ width:100 }}>{S.signatureCol}</th>
                </tr></thead>
                <tbody>
                  {it.tasks.map(t => (
                    <tr key={t.id}>
                      <td className="mono"><b>{String(t.opNum).padStart(3,'0')}</b></td>
                      <td><b>{t.opName}</b></td>
                      <td className="mono" style={{ fontSize:10 }}>{t.workCenter}</td>
                      <td className="mono num"><b>{t.planned}</b></td>
                      <td className="qr-cell">
                        <QrCode text={t.qrText} size={qrSize}/>
                        <div className="mono" style={{ fontSize:7.5, color:'#7a715b', marginTop:2 }}>{t.qrText}</div>
                      </td>
                      <td className="sign-cell"/>
                    </tr>
                  ))}
                </tbody>
              </table>
            </React.Fragment>
          ))}

          <div className="rs-foot">
            <span>{S.signedBy} ________________________</span>
            <span>{S.date} ____________</span>
            <span className="mono">{order.number} · {new Date().toISOString().slice(0,10)}</span>
          </div>
        </div>
      </div>
    </>
  );
}

function HistoryView({ data, tasks, scanLog, lang }) {
  const S = useStrings(lang);
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{S.navHistory}</h1>
          <div className="page-sub">Аудит всех сканирований QR-кодов · {scanLog.length} записей</div>
        </div>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Время</th>
              <th>Деталь</th>
              <th>Операция</th>
              <th>Оператор</th>
              <th className="num-col">Кол.</th>
              <th className="num-col hide-mobile">Факт, мин</th>
              <th className="hide-mobile">Комментарий</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {scanLog.map((s, i) => (
              <tr key={i} className="row-hover">
                <td className="mono-col" style={{ fontSize:11 }}>{s.ts}</td>
                <td className="mono-col" style={{ color:'var(--accent)', fontSize:12 }}>{s.detail}</td>
                <td style={{ fontSize:12 }}><b>{s.op}</b></td>
                <td style={{ fontSize:12 }}>{s.operator}</td>
                <td className="num-col num">{s.quantity}</td>
                <td className="num-col num hide-mobile">
                  {s.actualTime ? <span>{s.actualTime}</span> : '—'}
                </td>
                <td className="hide-mobile" style={{ fontSize:11, color:'var(--fg-1)', maxWidth:200,
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {s.comment || <span style={{ color:'var(--fg-3)' }}>—</span>}
                </td>
                <td><span className="pill done"><Icon name="check" size={11}/>закрыто</span></td>
              </tr>
            ))}
            {scanLog.length === 0 && (
              <tr><td colSpan="8"><div className="empty-state" style={{ background:'transparent', border:0 }}>—</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

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

function OrdersListView({ data, tasks, lang, onOpenOrder }) {
  const [query,     setQuery]    = React.useState('');
  const [statusF,   setStatusF]  = React.useState('all');
  const [view,      setView]     = React.useState('cards'); // 'cards' | 'table'

  const STATUS_LBL = { draft:'Черновик', plan:'Планируется', waiting_material:'Ждём материал', waiting_equipment:'Ждём оборудование', waiting_approval:'Ждём согласование', in_work:'В работе', paused:'Приостановлен', done:'Выполнен', cancelled:'Отменён' };
  const STATUS_CLS = { draft:'wait', plan:'wait', waiting_material:'wait', waiting_equipment:'wait', waiting_approval:'wait', in_work:'prog', paused:'wait', done:'done', cancelled:'wait' };
  const PRI_LBL    = { high:'Высокий', normal:'Норм.', low:'Низкий' };
  const PRI_DOT    = { high:'var(--danger)', normal:'var(--accent)', low:'var(--fg-3)' };

  const enriched = React.useMemo(() => data.orders.map(o => {
    const ot     = tasks.filter(t => t.orderId === o.id);
    const done   = ot.filter(t => t.status === 'done').length;
    const inProg = ot.filter(t => t.status === 'in_progress').length;
    const total  = ot.length;
    const pct    = total > 0 ? Math.round(done / total * 100) : 0;
    const due    = o.dueDate || o.due_date || '';
    const overdue = due && new Date(due) < new Date() && o.status !== 'done';
    return { ...o, due, done, inProg, total, pct, overdue, detailsCt: (o.items||[]).length };
  }), [data.orders, tasks]);

  const filtered = React.useMemo(() => {
    let list = [...enriched];
    const q = query.toLowerCase();
    if (q) list = list.filter(o =>
      o.number.toLowerCase().includes(q) ||
      (o.customer||'').toLowerCase().includes(q) ||
      (o.foreman||'').toLowerCase().includes(q)
    );
    if (statusF !== 'all') list = list.filter(o => o.status === statusF);
    return list.sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
  }, [enriched, query, statusF]);

  const counts = {
    all:     enriched.length,
    in_work: enriched.filter(o=>o.status==='in_work').length,
    plan:    enriched.filter(o=>o.status==='plan').length,
    done:    enriched.filter(o=>o.status==='done').length,
    overdue: enriched.filter(o=>o.overdue).length,
  };

  // Группировка по статусу для карточного вида
  const groups = statusF === 'all'
    ? [
        { key:'in_work', label:'В работе',    items: filtered.filter(o=>o.status==='in_work') },
        { key:'plan',    label:'Планируется', items: filtered.filter(o=>o.status==='plan') },
        { key:'done',    label:'Выполнено',   items: filtered.filter(o=>o.status==='done') },
      ].filter(g => g.items.length > 0)
    : [{ key: statusF, label: STATUS_LBL[statusF], items: filtered }];

  function OrderCard({ o }) {
    return (
      <div onClick={() => onOpenOrder(o.id)}
        style={{ background:'var(--bg-1)', border:'1px solid var(--line-1)', borderRadius:12,
          padding:'14px 16px', cursor:'pointer', transition:'all .15s', display:'flex',
          flexDirection:'column', gap:10, position:'relative',
          borderLeft: o.overdue ? '3px solid var(--danger)' : undefined }}
        onMouseEnter={e=>e.currentTarget.style.borderColor='var(--accent)'}
        onMouseLeave={e=>e.currentTarget.style.borderColor=o.overdue?'var(--danger)':'var(--line-1)'}>

        {/* Заголовок карточки */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
              <span className="mono" style={{ fontWeight:700, color:'var(--accent)', fontSize:14 }}>
                {o.number}
              </span>
              {o.overdue && (
                <span style={{ fontSize:10, color:'var(--danger)', fontWeight:600 }}>⚠ просрочен</span>
              )}
            </div>
            <div style={{ fontSize:13, fontWeight:500, color:'var(--fg-0)' }}>{o.customer}</div>
            {o.foreman && (
              <div style={{ fontSize:11, color:'var(--fg-2)', marginTop:1 }}>мастер: {o.foreman}</div>
            )}
          </div>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <span className={'pill '+STATUS_CLS[o.status]} style={{ fontSize:10 }}>
              <span className="dot"/>{STATUS_LBL[o.status]}
            </span>
            {o.due && (
              <div style={{ fontSize:10, color: o.overdue ? 'var(--danger)' : 'var(--fg-2)', marginTop:4 }}>
                до {o.due}
              </div>
            )}
          </div>
        </div>

        {/* Прогресс */}
        {o.total > 0 && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4,
              fontSize:11, color:'var(--fg-2)' }}>
              <span>{o.done} из {o.total} операций</span>
              <span className="num" style={{ fontWeight:600,
                color: o.pct===100 ? 'var(--st-done-line)' : 'var(--fg-1)' }}>{o.pct}%</span>
            </div>
            <div style={{ height:4, background:'var(--bg-3)', borderRadius:2, overflow:'hidden' }}>
              <div style={{ height:'100%', width:o.pct+'%', borderRadius:2, transition:'width .3s',
                background: o.pct===100 ? 'var(--st-done-line)' :
                            o.pct > 60  ? 'var(--st-prog-line)' : 'var(--accent)' }}/>
            </div>
          </div>
        )}

        {/* Метаданные */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <span style={{ fontSize:10, padding:'2px 7px', borderRadius:4,
            background:'var(--bg-3)', color:'var(--fg-2)' }}>
            {o.detailsCt} дет.
          </span>
          {o.inProg > 0 && (
            <span style={{ fontSize:10, padding:'2px 7px', borderRadius:4,
              background:'var(--bg-3)', color:'var(--st-prog-line)' }}>
              {o.inProg} в работе
            </span>
          )}
          {o.priority && o.priority !== 'normal' && (
            <span style={{ fontSize:10, padding:'2px 7px', borderRadius:4,
              background:'var(--bg-3)', color: PRI_DOT[o.priority] }}>
              {PRI_LBL[o.priority]}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Шапка */}
      <div className="page-head">
        <div>
          <h1 className="page-title">Заказы</h1>
          <div className="page-sub">
            {counts.all} всего · {counts.in_work} в работе · {counts.plan} планируется
            {counts.overdue > 0 && <span style={{ color:'var(--danger)' }}> · {counts.overdue} просрочено</span>}
          </div>
        </div>
        <div className="row">
          <button className="btn primary" onClick={() => onOpenOrder('new')}>
            <Icon name="plus" size={14}/>Новый заказ
          </button>
        </div>
      </div>

      {/* KPI строка */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:14 }}>
        {[
          { label:'В работе',    val: counts.in_work, accent: true },
          { label:'Планируется', val: counts.plan },
          { label:'Выполнено',   val: counts.done },
        ].map(k => (
          <div key={k.label} className="kpi" style={{ padding:'10px 12px' }}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value num" style={{
              fontSize:22, color: k.accent ? 'var(--accent)' : undefined }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Поиск + фильтры + переключатель вида */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ position:'relative', flex:1, minWidth:160 }}>
          <Icon name="search" size={13} style={{ position:'absolute', left:9,
            top:'50%', transform:'translateY(-50%)', color:'var(--fg-2)' }}/>
          <input className="input" value={query} onChange={e=>setQuery(e.target.value)}
            placeholder="Поиск…" style={{ paddingLeft:30 }}/>
        </div>
        <div style={{ display:'flex', gap:4 }}>
          {[['all','Все'], ['in_work','В работе'], ['plan','План'], ['done','Готово']].map(([v,l])=>(
            <button key={v} onClick={()=>setStatusF(v)}
              style={{ padding:'6px 10px', borderRadius:7, border:'1px solid', fontSize:12,
                cursor:'pointer', fontFamily:'var(--ui-font)', whiteSpace:'nowrap',
                background: statusF===v ? 'var(--accent)' : 'var(--bg-1)',
                borderColor: statusF===v ? 'var(--accent)' : 'var(--line-1)',
                color: statusF===v ? '#fff' : 'var(--fg-1)' }}>
              {l}{v!=='all' && counts[v]>0 ? ` ${counts[v]}` : ''}
            </button>
          ))}
        </div>
        {/* Переключатель вид */}
        <div style={{ display:'flex', gap:2, background:'var(--bg-1)',
          border:'1px solid var(--line-1)', borderRadius:8, padding:2, marginLeft:'auto' }}>
          {[['cards','grid'], ['table','list']].map(([v, icon])=>(
            <button key={v} onClick={()=>setView(v)}
              style={{ padding:'5px 8px', borderRadius:6, border:'none', cursor:'pointer',
                background: view===v ? 'var(--bg-3)' : 'transparent',
                color: view===v ? 'var(--fg-0)' : 'var(--fg-2)' }}>
              <Icon name={icon} size={14}/>
            </button>
          ))}
        </div>
      </div>

      {/* КАРТОЧНЫЙ ВИД */}
      {view === 'cards' && (
        <div>
          {filtered.length === 0 && (
            <div className="empty-state">Заказы не найдены</div>
          )}
          {groups.map(g => (
            <div key={g.key} style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:600, letterSpacing:'.06em',
                textTransform:'uppercase', color:'var(--fg-2)', marginBottom:8 }}>
                {g.label} · {g.items.length}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:10 }}>
                {g.items.map(o => <OrderCard key={o.id} o={o}/>)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ТАБЛИЧНЫЙ ВИД */}
      {view === 'table' && (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Номер</th>
                <th>Клиент</th>
                <th>Статус</th>
                <th className="hide-mobile">Срок</th>
                <th className="hide-mobile">Прогресс</th>
                <th style={{width:40}}/>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan="6">
                  <div className="empty-state" style={{border:0}}>Заказы не найдены</div>
                </td></tr>
              )}
              {filtered.map(o => (
                <tr key={o.id} className="row-hover" onClick={()=>onOpenOrder(o.id)}
                  style={{ cursor:'pointer', opacity: o.status==='done'?.75:1 }}>
                  <td>
                    <span className="mono" style={{ fontWeight:700, color:'var(--accent)', fontSize:13 }}>
                      {o.number}
                    </span>
                    {o.overdue && <span style={{ marginLeft:6, fontSize:10, color:'var(--danger)' }}>⚠</span>}
                  </td>
                  <td>
                    <div style={{ fontSize:13 }}>{o.customer}</div>
                    {o.foreman && <div style={{ fontSize:11, color:'var(--fg-2)' }}>{o.foreman}</div>}
                  </td>
                  <td>
                    <span className={'pill '+STATUS_CLS[o.status]} style={{ fontSize:11 }}>
                      <span className="dot"/>{STATUS_LBL[o.status]}
                    </span>
                  </td>
                  <td className="hide-mobile mono" style={{ fontSize:12,
                    color: o.overdue?'var(--danger)':'var(--fg-1)' }}>
                    {o.due||'—'}
                  </td>
                  <td className="hide-mobile" style={{ width:140 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <div style={{ flex:1, height:4, background:'var(--bg-3)', borderRadius:2, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:o.pct+'%', borderRadius:2,
                          background: o.pct===100?'var(--st-done-line)':o.pct>60?'var(--st-prog-line)':'var(--accent)' }}/>
                      </div>
                      <span className="mono num" style={{ fontSize:11 }}>{o.pct}%</span>
                    </div>
                  </td>
                  <td onClick={e=>e.stopPropagation()}>
                    <button className="icon-btn" onClick={()=>onOpenOrder(o.id)}>
                      <Icon name="arrow-right" size={14}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}


// =======================================================
// Общий отчёт по заказам
// =======================================================

function ReportView({ data, tasks, scanLog, lang, onOpenDashboard }) {
  const [period,   setPeriod]   = React.useState('all');
  const [sortBy,   setSortBy]   = React.useState('number');
  const [filterSt, setFilterSt] = React.useState('all');

  const STATUS_LBL   = { plan:'Планируется', in_work:'В работе', done:'Выполнен' };
  const STATUS_CLS   = { plan:'wait', in_work:'prog', done:'done' };
  const PRIORITY_LBL = { high:'Высокий', normal:'Нормальный', low:'Низкий' };
  const PRIORITY_COL = { high:'var(--danger)', normal:'var(--fg-1)', low:'var(--fg-2)' };

  // Обогащаем заказы статистикой
  const orders = React.useMemo(() => {
    return data.orders.map(o => {
      const orderTasks = tasks.filter(t => t.orderId === o.id);
      const done     = orderTasks.filter(t => t.status === 'done').length;
      const inProg   = orderTasks.filter(t => t.status === 'in_progress').length;
      const waiting  = orderTasks.filter(t => t.status === 'waiting').length;
      const total    = orderTasks.length;
      const pct      = total > 0 ? Math.round(done / total * 100) : 0;
      const totalMin = orderTasks.reduce((s,t) => s + t.time * t.planned, 0);
      const doneMin  = orderTasks.filter(t=>t.status==='done').reduce((s,t) => s + t.time * t.planned, 0);
      const dueDate  = o.dueDate || o.due_date || '';
      const isOverdue = dueDate && new Date(dueDate) < new Date() && o.status !== 'done';
      const detailsCt = (o.items||[]).length;
      return { ...o, dueDate, done, inProg, waiting, total, pct, totalMin, doneMin, isOverdue, detailsCt };
    });
  }, [data.orders, tasks]);

  // Фильтр + сортировка
  const filtered = React.useMemo(() => {
    let list = [...orders];
    if (filterSt !== 'all') list = list.filter(o => o.status === filterSt);
    if (period === '7d')  list = list.filter(o => o.createdAt && new Date(o.createdAt) >= new Date(Date.now()-7*86400000));
    if (period === '30d') list = list.filter(o => o.createdAt && new Date(o.createdAt) >= new Date(Date.now()-30*86400000));
    list.sort((a,b) => {
      if (sortBy === 'number')   return a.number.localeCompare(b.number);
      if (sortBy === 'status')   return a.status.localeCompare(b.status);
      if (sortBy === 'progress') return b.pct - a.pct;
      if (sortBy === 'due')      return (a.dueDate||'').localeCompare(b.dueDate||'');
      if (sortBy === 'overdue')  return b.isOverdue - a.isOverdue;
      return 0;
    });
    return list;
  }, [orders, filterSt, period, sortBy]);

  // Сводные метрики
  const total    = filtered.length;
  const totalDone   = filtered.filter(o=>o.status==='done').length;
  const totalInWork = filtered.filter(o=>o.status==='in_work').length;
  const totalPlan   = filtered.filter(o=>o.status==='plan').length;
  const overdueCt   = filtered.filter(o=>o.isOverdue).length;
  const avgPct      = total > 0 ? Math.round(filtered.reduce((s,o)=>s+o.pct,0)/total) : 0;
  const totalOps    = filtered.reduce((s,o)=>s+o.total,0);
  const doneOps     = filtered.reduce((s,o)=>s+o.done,0);

  // Excel-экспорт отчёта
  function exportExcel() {
    const XLSX = window.XLSX;
    if (!XLSX) { alert('SheetJS не загружен'); return; }
    const today = new Date().toISOString().slice(0,10);

    // Лист 1: Сводка по заказам
    const summaryRows = [
      ['ОТЧЁТ ПО ЗАКАЗАМ', `Дата: ${today}`],
      [],
      ['Всего заказов', total, 'Выполнено', totalDone, 'В работе', totalInWork, 'Планируется', totalPlan],
      ['Просрочено', overdueCt, 'Средний прогресс', avgPct+'%', 'Всего операций', totalOps, 'Выполнено операций', doneOps],
      [],
      ['Номер', 'Получатель', 'Ст. мастер', 'Статус', 'Приоритет', 'Создан', 'Срок',
       'Деталей', 'Операций', 'Выполнено', 'В работе', 'Ожидает', 'Прогресс %', 'Трудоёмкость (мин)', 'Просрочен'],
      ...filtered.map(o=>[
        o.number, o.customer, o.foreman||'—',
        STATUS_LBL[o.status]||o.status,
        PRIORITY_LBL[o.priority]||o.priority,
        o.createdAt||'', o.dueDate||'',
        o.detailsCt, o.total, o.done, o.inProg, o.waiting, o.pct,
        o.totalMin, o.isOverdue ? 'Да' : 'Нет',
      ]),
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
    ws1['!cols'] = [{wch:14},{wch:28},{wch:18},{wch:14},{wch:12},{wch:12},{wch:12},
                    {wch:8},{wch:10},{wch:10},{wch:10},{wch:10},{wch:12},{wch:16},{wch:10}];

    // Лист 2: Детализация по операциям
    const opsRows = [
      ['ДЕТАЛИЗАЦИЯ ОПЕРАЦИЙ'],
      [],
      ['Заказ', 'Деталь', 'Код', 'Операция', '№ оп.', 'Раб. центр', 'Плановое кол.', 'Факт', 'Статус', 'Исполнитель', 'Время (мин)'],
      ...tasks.map(t => {
        const order  = data.orders.find(o=>o.id===t.orderId);
        const detail = data.details.find(d=>d.id===t.detailId);
        return [
          order?.number||t.orderId,
          detail?.name||t.detailId,
          detail?.code||'',
          t.opName,
          String(t.opNum).padStart(3,'0'),
          t.workCenter,
          t.planned, t.completed,
          t.status==='done'?'Выполнена':t.status==='in_progress'?'В работе':'Ожидает',
          t.operator||'',
          t.time,
        ];
      }),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(opsRows);
    ws2['!cols'] = [{wch:14},{wch:30},{wch:14},{wch:28},{wch:8},{wch:18},{wch:10},{wch:8},{wch:14},{wch:18},{wch:10}];

    // Лист 3: Журнал сканирований
    const logRows = [
      ['ЖУРНАЛ СКАНИРОВАНИЙ'],
      [],
      ['Время', 'Деталь', 'Операция', 'Оператор', 'Кол-во', 'QR-код', 'Результат'],
      ...scanLog.map(s=>[s.ts, s.detail, s.op, s.operator, s.quantity, s.qr, s.result==='closed'?'Закрыто':'Ошибка']),
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(logRows);
    ws3['!cols'] = [{wch:10},{wch:16},{wch:28},{wch:20},{wch:8},{wch:24},{wch:12}];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Заказы');
    XLSX.utils.book_append_sheet(wb, ws2, 'Операции');
    XLSX.utils.book_append_sheet(wb, ws3, 'Журнал');
    XLSX.writeFile(wb, `Отчёт-${today}.xlsx`);
  }

  function SortTh({ col, label }) {
    return (
      <th style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }}
        onClick={()=>setSortBy(col)}>
        {label}{sortBy===col ? ' ▲' : ''}
      </th>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Отчёт по заказам</h1>
          <div className="page-sub">{total} заказов · {doneOps} из {totalOps} операций выполнено</div>
        </div>
        <div className="row">
          <button className="btn primary" onClick={exportExcel}>
            <Icon name="table" size={14}/>Выгрузить Excel
          </button>
        </div>
      </div>

      {/* KPI-строка */}
      <div className="grid-4" style={{ marginBottom:16 }}>
        <div className="kpi"><div className="kpi-label">Всего заказов</div>
          <div className="kpi-value num">{total}</div>
          <div className="kpi-meta">
            <span className="pill prog" style={{padding:'1px 6px'}}><span className="dot"/>{totalInWork} в работе</span>
          </div>
        </div>
        <div className="kpi"><div className="kpi-label">Выполнено</div>
          <div className="kpi-value num">{totalDone}<span className="unit">/ {total}</span></div>
          <div className="kpi-meta"><span className="num">{total>0?Math.round(totalDone/total*100):0}%</span></div>
        </div>
        <div className="kpi"><div className="kpi-label">Операций</div>
          <div className="kpi-value num">{doneOps}<span className="unit">/ {totalOps}</span></div>
          <div className="kpi-meta">средний прогресс <b className="num">{avgPct}%</b></div>
        </div>
        <div className="kpi" style={{ borderColor: overdueCt > 0 ? 'var(--danger)' : undefined }}>
          <div className="kpi-label">Просрочено</div>
          <div className="kpi-value num" style={{ color: overdueCt > 0 ? 'var(--danger)' : undefined }}>
            {overdueCt}
          </div>
          <div className="kpi-meta">{totalPlan} планируется</div>
        </div>
      </div>

      {/* Фильтры */}
      <div style={{ display:'flex', gap:10, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ display:'flex', gap:4 }}>
          {[['all','Все'], ['in_work','В работе'], ['plan','Планируется'], ['done','Выполнен']].map(([v,l])=>(
            <button key={v} onClick={()=>setFilterSt(v)}
              style={{ padding:'5px 12px', borderRadius:7, border:'1px solid', fontSize:12,
                cursor:'pointer', fontFamily:'var(--ui-font)',
                background: filterSt===v ? 'var(--accent)' : 'var(--bg-1)',
                borderColor: filterSt===v ? 'var(--accent)' : 'var(--line-1)',
                color: filterSt===v ? '#fff' : 'var(--fg-1)' }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ width:1, height:20, background:'var(--line-1)' }}/>
        <div style={{ display:'flex', gap:4 }}>
          {[['all','Всё время'], ['30d','30 дней'], ['7d','7 дней']].map(([v,l])=>(
            <button key={v} onClick={()=>setPeriod(v)}
              style={{ padding:'5px 12px', borderRadius:7, border:'1px solid', fontSize:12,
                cursor:'pointer', fontFamily:'var(--ui-font)',
                background: period===v ? 'var(--bg-2)' : 'transparent',
                borderColor: period===v ? 'var(--line-0)' : 'var(--line-1)',
                color: 'var(--fg-1)' }}>
              {l}
            </button>
          ))}
        </div>
        <span style={{ marginLeft:'auto', fontSize:12, color:'var(--fg-2)' }}>
          {filtered.length} записей
        </span>
      </div>

      {/* Таблица заказов */}
      <div className="tbl-wrap" style={{ marginBottom:24, WebkitOverflowScrolling:"touch" }}>
        <table className="tbl">
          <thead>
            <tr>
              <SortTh col="number"   label="Номер"/>
              <th>Получатель</th>
              <SortTh col="status"   label="Статус"/>
              <SortTh col="due"      label="Срок"/>
              <SortTh col="overdue"  label="Просрочен"/>
              <th>Приоритет</th>
              <th className="num-col">Деталей</th>
              <SortTh col="progress" label="Прогресс"/>
              <th style={{width:140}}>Операции</th>
              <th className="num-col hide-mobile">Трудоёмк.</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => (
              <tr key={o.id} className="row-hover" style={{ opacity: o.status==='done' ? .7 : 1, cursor:'pointer' }}
                onClick={()=> onOpenDashboard && onOpenDashboard(o.id)}>
                <td>
                  <span className="mono" style={{ fontWeight:700, color:'var(--accent)' }}>{o.number}</span>
                  {o.foreman && <div style={{ fontSize:10, color:'var(--fg-2)' }}>{o.foreman}</div>}
                </td>
                <td style={{ fontSize:12 }}>
                  {o.customer}
                  <div style={{ fontSize:10, color:'var(--fg-2)' }}>{o.createdAt}</div>
                </td>
                <td>
                  <span className={'pill '+STATUS_CLS[o.status]} style={{ fontSize:11 }}>
                    <span className="dot"/>{STATUS_LBL[o.status]}
                  </span>
                </td>
                <td className="mono" style={{ fontSize:12, color: o.isOverdue ? 'var(--danger)' : 'var(--fg-1)' }}>
                  {o.dueDate||'—'}
                </td>
                <td>
                  {o.isOverdue
                    ? <span style={{ color:'var(--danger)', fontSize:12, fontWeight:600 }}>⚠ Просрочен</span>
                    : <span style={{ color:'var(--fg-2)', fontSize:11 }}>—</span>}
                </td>
                <td style={{ fontSize:12, color: PRIORITY_COL[o.priority] }}>
                  {PRIORITY_LBL[o.priority]||'—'}
                </td>
                <td className="num-col num">{o.detailsCt}</td>
                <td style={{ width:160 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ flex:1, height:6, background:'var(--bg-3)', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:3, width:o.pct+'%',
                        background: o.pct===100 ? 'var(--st-done-line)' : o.pct>50 ? 'var(--st-prog-line)' : 'var(--accent)',
                        transition:'width .3s' }}/>
                    </div>
                    <span className="mono num" style={{ fontSize:11, minWidth:28 }}>{o.pct}%</span>
                  </div>
                  <div style={{ fontSize:10, color:'var(--fg-2)', marginTop:2 }}>
                    {o.done}/{o.total} оп.
                    {o.inProg > 0 && <span style={{ color:'var(--st-prog-line)', marginLeft:4 }}>·{o.inProg} в раб.</span>}
                  </div>
                </td>
                <td className="num-col hide-mobile">
                  <span className="num" style={{ fontSize:12 }}>{Math.round(o.totalMin/60)}ч</span>
                  <span style={{ fontSize:10, color:'var(--fg-2)' }}> {o.totalMin%60}мин</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* График прогресса — простой горизонтальный bar chart */}
      {filtered.length > 0 && filtered.length <= 20 && (
        <div className="card" style={{ padding:'16px 18px' }}>
          <div className="subhead" style={{ marginTop:0 }}>Прогресс по заказам</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
            {filtered.map(o => (
              <div key={o.id} style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span className="mono" style={{ fontSize:11, width:100, flexShrink:0, color:'var(--accent)', fontWeight:600 }}>
                  {o.number}
                </span>
                <div style={{ flex:1, height:18, background:'var(--bg-3)', borderRadius:4, overflow:'hidden', position:'relative' }}>
                  <div style={{ height:'100%', borderRadius:4, width:o.pct+'%',
                    background: o.pct===100 ? 'var(--st-done-line)' : o.pct>50 ? 'var(--st-prog-line)' : 'var(--accent)',
                    transition:'width .5s ease', opacity:.85 }}/>
                  {o.pct > 8 && (
                    <span style={{ position:'absolute', left:8, top:0, lineHeight:'18px',
                      fontSize:10, color:'#fff', fontWeight:600, mixBlendMode:'plus-lighter' }}>
                      {o.pct}%
                    </span>
                  )}
                </div>
                <span className={'pill '+STATUS_CLS[o.status]} style={{ fontSize:10, flexShrink:0 }}>
                  <span className="dot"/>{o.done}/{o.total}
                </span>
                {o.isOverdue && <span style={{ fontSize:11, color:'var(--danger)', flexShrink:0 }}>⚠</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}



  

export { Dashboard, DetailBoardGroup, Library, OrderBuilder, WorkCenterPreview,
         RouteSheetView, HistoryView, WorkshopView, ModalManageWorkshops,
         OrdersListView, ReportView }
