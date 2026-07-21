import React from 'react'
import { api, Auth, API_BASE, parseServerDate, unwrap } from '../lib/api.js'
import { Icon } from '../components/Icon.jsx'
import { QrCode, generateQrSvg } from '../components/QrCode.jsx'
import { useStrings, StatusPill, OrderPicker, ORDER_STATUS_RU, STATUS_LABEL_RU } from '../lib/data.jsx'

export function Dashboard({ data, tasks, scanLog, lang, onScan, onCloseTask, onNewOrder, onPauseTask, onResumeTask }) {
  const S = useStrings(lang);
  const [tab, setTab] = React.useState('board'); // 'board' | 'norm'

  // Производственное табло: только активные заказы (выполненные/отгруженные → в Историю)
  const boardOrders = React.useMemo(
    () => data.orders.filter(o => !['done','shipped','archived','cancelled'].includes(o.status)),
    [data.orders]
  );
  const [activeId, setActiveId] = React.useState(boardOrders[0]?.id);

  // Re-sync если заказы обновились
  React.useEffect(() => {
    if (!boardOrders.find(o => o.id === activeId) && boardOrders.length) {
      setActiveId(boardOrders[0].id);
    }
  }, [boardOrders]);

  const order = boardOrders.find(o => o.id === activeId) || boardOrders[0];
  if (!order) return (
    <div style={{ padding:24, textAlign:'center', color:'var(--fg-2)' }}>
      <p style={{ marginBottom:16 }}>{lang === 'en' ? 'No active orders' : 'Нет активных заказов'}</p>
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
      {/* Вкладки */}
      <div style={{ display:'flex', gap:2, padding:'0 0 12px' }}>
        {[['board','📋 Табло'],['norm','📊 Нормоконтроль']].map(([v,l]) => (
          <button key={v} onClick={() => setTab(v)}
            style={{ padding:'6px 14px', borderRadius:7, border:'1px solid', fontSize:12,
              cursor:'pointer', fontFamily:'var(--ui-font)', fontWeight: tab===v ? 600 : 400,
              background: tab===v ? 'var(--accent)' : 'transparent',
              borderColor: tab===v ? 'var(--accent)' : 'var(--line-1)',
              color: tab===v ? '#fff' : 'var(--fg-1)' }}>{l}</button>
        ))}
      </div>

      <OrderPicker orders={boardOrders} activeId={activeId}
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

      {tab === 'board' && <div className="grid-2">
        <div>
          <div className="subhead" style={{ marginTop: 0 }}>
            {lang === 'en' ? 'Production board' : 'Производственное табло'} · {order.number}
          </div>
          {items.length === 0
            ? <div className="empty-state">{lang === 'en' ? 'No parts in order' : 'Нет деталей в заказе'}</div>
            : items.map(it => (
              <DetailBoardGroup key={it.detailId} detail={it.det} tasks={it.tasks}
                done={it.done} total={it.total} qty={it.quantity} lang={lang}
                onCloseTask={onCloseTask} onPauseTask={onPauseTask} onResumeTask={onResumeTask}/>
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
      </div>}

      {tab === 'norm' && (
        <NormControlTab tasks={allTasks} order={order}/>
      )}
    </>
  );
}


function NormControlTab({ tasks, order }) {
  const planMin  = tasks.reduce((s,t) => s + t.time * t.planned, 0);
  const factMin  = tasks.filter(t => t.status==='done' && t.actualTime).reduce((s,t) => s+t.actualTime, 0);
  const doneTasks = tasks.filter(t => t.status === 'done');
  const overTasks = doneTasks.filter(t => t.actualTime && t.actualTime > t.time * t.planned * 1.15);
  const normPct   = planMin > 0 && factMin > 0 ? Math.round(factMin / planMin * 100) : null;

  return (
    <div>
      {/* Сводка */}
      <div className="kpi-scroll grid-4" style={{ marginBottom:16 }}>
        {[
          ['План', Math.round(planMin/60) + 'ч ' + (planMin%60) + '′', 'var(--fg-0)'],
          ['Факт (закрытые)', factMin ? Math.round(factMin/60)+'ч '+factMin%60+'′' : '—', factMin>planMin?'var(--danger)':'var(--st-done-line)'],
          ['Нормоконтроль', normPct ? normPct+'%' : '—', normPct>115?'var(--danger)':normPct>100?'var(--warning,#c07820)':'var(--st-done-line)'],
          ['Превышений', overTasks.length+' / '+doneTasks.length, overTasks.length>0?'var(--danger)':'var(--fg-2)'],
        ].map(([label,value,color]) => (
          <div key={label} className="kpi">
            <div className="kpi-label">{label}</div>
            <div className="kpi-value num" style={{color,fontSize:18}}>{value}</div>
          </div>
        ))}
      </div>

      {/* Таблица по операциям */}
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>№</th>
              <th>Операция</th>
              <th className="hide-mobile">РЦ</th>
              <th className="num-col">Кол.</th>
              <th className="num-col">План</th>
              <th className="num-col">Факт</th>
              <th className="num-col">%</th>
              <th className="hide-mobile">Оператор</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {tasks.sort((a,b) => a.opNum - b.opNum).map(t => {
              const plan = t.time * t.planned;
              const fact = t.actualTime || null;
              const pct  = fact && plan > 0 ? Math.round(fact/plan*100) : null;
              const over = pct && pct > 115;
              const statColor = t.status==='done'
                ? (over ? 'var(--danger)' : 'var(--st-done-line)')
                : t.status==='in_progress' ? 'var(--accent)' : 'var(--fg-2)';
              return (
                <tr key={t.id} className="row-hover" style={{ background: over ? 'rgba(220,38,38,.04)' : undefined }}>
                  <td className="mono" style={{color:'var(--accent)',fontWeight:700,fontSize:12}}>{String(t.opNum).padStart(3,'0')}</td>
                  <td style={{fontSize:12,fontWeight:500}}>{t.opName}</td>
                  <td className="mono hide-mobile" style={{fontSize:11,color:'var(--fg-2)'}}>{t.workCenter}</td>
                  <td className="num-col num">{t.completed}/{t.planned}</td>
                  <td className="num-col num mono" style={{fontSize:11}}>{plan}′</td>
                  <td className="num-col num mono" style={{fontSize:11,color:statColor,fontWeight:over?700:400}}>
                    {fact ? fact+'′' : t.status==='in_progress' ? <span style={{color:'var(--accent)'}}>⏱</span> : '—'}
                  </td>
                  <td className="num-col num" style={{fontWeight:700,
                    color: over?'var(--danger)':pct>100?'var(--warning,#c07820)':pct?'var(--st-done-line)':'var(--fg-2)'}}>
                    {pct ? pct+'%' : '—'}
                  </td>
                  <td className="hide-mobile" style={{fontSize:11,color:'var(--fg-2)'}}>{t.operator||'—'}</td>
                  <td>
                    <span className={'pill '+( t.status==='done'?'done':t.status==='in_progress'?'prog':'wait' )}>
                      <span className="dot"/>
                      {{waiting:'Ожидает',in_progress:'В работе',done:'Выполнено',paused:'Пауза'}[t.status]||t.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


function TimePill({ planMin, startedAt, status, actualTime }) {
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    if (status !== 'in_progress' || !startedAt) return;
    const calc = () => { const d = parseServerDate(startedAt); if (d) setElapsed(Math.max(0, Math.round((Date.now() - d.getTime()) / 60000))); };
    calc();
    const id = setInterval(calc, 30000);
    return () => clearInterval(id);
  }, [startedAt, status]);

  if (status === 'done' && actualTime) {
    const over  = actualTime - planMin;
    const pct   = planMin > 0 ? Math.round(actualTime / planMin * 100) : 0;
    const color = pct > 115 ? 'var(--danger)' : pct > 100 ? 'var(--warning,#c07820)' : 'var(--st-done-line)';
    return (
      <div style={{ textAlign:'center', lineHeight:1.3, minWidth:72 }}>
        <div style={{ fontSize:12, fontWeight:700, color, fontFamily:'var(--mono-font)' }}>
          {actualTime}′
        </div>
        <div style={{ fontSize:9, color:'var(--fg-2)', fontFamily:'var(--mono-font)' }}>
          пл {planMin}′
        </div>
        <div style={{ fontSize:10, fontWeight:700, color }}>
          {pct > 100 ? '+' : ''}{pct - 100}%
        </div>
      </div>
    );
  }
  if (status === 'in_progress' && startedAt) {
    const over     = elapsed - planMin;
    const pct      = planMin > 0 ? Math.min(100, Math.round(elapsed / planMin * 100)) : 0;
    const color    = elapsed > planMin ? 'var(--danger)' : elapsed > planMin * 0.85 ? 'var(--warning,#c07820)' : 'var(--accent)';
    return (
      <div style={{ textAlign:'center', lineHeight:1.3, minWidth:72 }}>
        <div style={{ fontSize:13, fontWeight:800, color, fontFamily:'var(--mono-font)' }}>
          ⏱ {elapsed}′
        </div>
        <div style={{ fontSize:10, color:'var(--fg-2)', fontFamily:'var(--mono-font)' }}>
          / {planMin}′ план
        </div>
        <div style={{ height:3, width:'100%', background:'var(--bg-3)', borderRadius:2,
          margin:'3px 0', overflow:'hidden', minWidth:60 }}>
          <div style={{ height:'100%', width:pct+'%', background:color,
            borderRadius:2, transition:'width 1s' }}/>
        </div>
        {over > 0
          ? <div style={{ fontSize:9, color:'var(--danger)', fontWeight:800 }}>+{over}′ просрочено</div>
          : <div style={{ fontSize:9, color:'var(--fg-3)' }}>{pct}%</div>}
      </div>
    );
  }
  return (
    <div style={{ textAlign:'center', fontSize:10, color:'var(--fg-2)' }}>
      <div>{planMin}′</div>
    </div>
  );
}


export function DetailBoardGroup({ detail, tasks, done, total, qty, lang, onCloseTask, onPauseTask, onResumeTask }) {
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
            <div style={{ minWidth:70 }}>
              <TimePill planMin={t.time * t.planned} startedAt={t.startedAt}
                status={t.status} actualTime={t.actualTime} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-1)' }}>{t.operator || <span className="muted">—</span>}</div>
            <div className="actions">
              <StatusPill status={t.status} lang={lang} />
              {t.status === 'in_progress' && (
                <button className="icon-btn" title="Пауза" onClick={() => onPauseTask && onPauseTask(t.id)}
                  style={{ color:'var(--warning,#c07820)' }}>
                  <Icon name="pause" size={14} />
                </button>
              )}
              {t.status === 'paused' && (
                <button className="icon-btn" title="Возобновить" onClick={() => onResumeTask && onResumeTask(t.id)}
                  style={{ color:'var(--accent)' }}>
                  <Icon name="play" size={14} />
                </button>
              )}
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
// =======================================================
// LibraryOpsEditor — редактор операций с вставкой между
// =======================================================
