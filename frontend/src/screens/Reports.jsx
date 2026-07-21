import React from 'react'
import { api, Auth, API_BASE, parseServerDate, unwrap } from '../lib/api.js'
import { Icon } from '../components/Icon.jsx'
import { QrCode, generateQrSvg } from '../components/QrCode.jsx'
import { useStrings, StatusPill, OrderPicker, ORDER_STATUS_RU, STATUS_LABEL_RU } from '../lib/data.jsx'
import { orderMatchesQuery, makeOrderSearcher } from './_shared.jsx'

export function HistoryView({ data, tasks, scanLog, lang }) {
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


export function OrdersListView({ data, tasks, lang, onOpenOrder }) {
  const [query,     setQuery]    = React.useState('');
  const [statusF,   setStatusF]  = React.useState('all');
  const [view,      setView]     = React.useState('cards'); // 'cards' | 'table'

  const STATUS_LBL = { draft:'Черновик', problem:'⚠ Проблема', plan:'Планируется', waiting_material:'Ждём материал', waiting_equipment:'Ждём оборудование', waiting_approval:'Ждём согласование', in_work:'В работе', paused:'Приостановлен', done:'Выполнен', shipped:'📦 Отгружен', archived:'🗄 Архив', cancelled:'Отменён' };
  const STATUS_CLS = { draft:'wait', problem:'prob', plan:'wait', waiting_material:'wait', waiting_equipment:'wait', waiting_approval:'wait', in_work:'prog', paused:'wait', done:'done', shipped:'done', archived:'done', cancelled:'wait' };
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

  const searchOrder = React.useMemo(() => makeOrderSearcher(data.orders, data.details), [data.orders, data.details]);
  const filtered = React.useMemo(() => {
    let list = [...enriched];
    if (query) list = list.filter(o => searchOrder(o, query));
    if (statusF !== 'all') list = list.filter(o => o.status === statusF);
    else list = list.filter(o => !['done','shipped','archived','cancelled'].includes(o.status)); // выполненные/отгруженные → в Историю
    return list.sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
  }, [enriched, query, statusF, searchOrder]);

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
          {[['all','Все'], ['in_work','В работе'], ['plan','План'], ['problem','⚠ Проблема'], ['done','Готово'], ['shipped','📦 Отгружен'], ['archived','🗄 Архив']].map(([v,l])=>(
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


export function ReportView({ data, tasks, scanLog, lang, onOpenDashboard }) {
  const [period,   setPeriod]   = React.useState('all');
  const [sortBy,   setSortBy]   = React.useState('number');
  const [sortDir,  setSortDir]  = React.useState('asc');
  const [filterSt, setFilterSt] = React.useState('all');
  const [limit,    setLimit]    = React.useState(50);

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
      // Проблемные заказы (приостановлены) — всегда вниз
      const ap = a.status === 'problem' ? 1 : 0, bp = b.status === 'problem' ? 1 : 0;
      if (ap !== bp) return ap - bp;
      const dir = sortDir === 'desc' ? -1 : 1;
      let r = 0;
      if (sortBy === 'number')        r = a.number.localeCompare(b.number);
      else if (sortBy === 'status')   r = a.status.localeCompare(b.status);
      else if (sortBy === 'customer') r = (a.customer||'').localeCompare(b.customer||'');
      else if (sortBy === 'progress') r = a.pct - b.pct;
      else if (sortBy === 'due')      r = (a.dueDate||'').localeCompare(b.dueDate||'');
      else if (sortBy === 'plan')     r = a.totalMin - b.totalMin;
      else if (sortBy === 'overdue')  r = a.isOverdue - b.isOverdue;
      else if (sortBy === 'created')  r = (a.createdAt||'').localeCompare(b.createdAt||'');
      return r * dir;
    });
    return list;
  }, [orders, filterSt, period, sortBy, sortDir]);

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
  async function exportExcel() {
    const XLSX = await import('xlsx');
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
    const active = sortBy === col;
    return (
      <th style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }}
        onClick={()=>{ if (active) setSortDir(d=>d==='asc'?'desc':'asc'); else { setSortBy(col); setSortDir('asc'); } }}>
        {label}{active ? (sortDir==='asc' ? ' ▲' : ' ▼') : ''}
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
          {[['all','Все'], ['in_work','В работе'], ['plan','Планируется'], ['problem','⚠ Проблема'], ['done','Выполнен'], ['shipped','📦 Отгружен'], ['archived','🗄 Архив']].map(([v,l])=>(
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
        <span style={{ marginLeft:'auto', fontSize:12, color:'var(--fg-2)', display:'flex', alignItems:'center', gap:8 }}>
          <span>Показывать:</span>
          <select className="select" value={limit} onChange={e=>setLimit(e.target.value==='all'?1e9:+e.target.value)}
            style={{ padding:'4px 8px', fontSize:12, width:'auto' }}>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="all">Все</option>
          </select>
          <span>{Math.min(filtered.length, limit)} из {filtered.length}</span>
        </span>
      </div>

      {/* Таблица заказов */}
      <div className="tbl-wrap" style={{ marginBottom:24, WebkitOverflowScrolling:"touch" }}>
        <table className="tbl">
          <thead>
            <tr>
              <SortTh col="number"   label="Номер"/>
              <SortTh col="customer" label="Получатель"/>
              <SortTh col="status"   label="Статус"/>
              <SortTh col="due"      label="Срок"/>
              <SortTh col="overdue"  label="Просрочен"/>
              <th>Приоритет</th>
              <th className="num-col">Деталей</th>
              <SortTh col="progress" label="Прогресс"/>
              <th style={{width:140}}>Операции</th>
              <SortTh col="plan"     label="Трудоёмк."/>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, limit).map(o => (
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



  

// =======================================================
// HistoryOrdersView — история выполненных заказов
// =======================================================

export function HistoryOrdersView({ data, tasks, lang, onOpenOrder, onShip }) {
  const [query,   setQuery]   = React.useState('');
  const [period,  setPeriod]  = React.useState('all');
  const [view,    setView]    = React.useState('done'); // 'done' | 'archive'

  const searchOrder = React.useMemo(() => makeOrderSearcher(data.orders, data.details), [data.orders, data.details]);
  const doneOrders = React.useMemo(() => {
    const now = new Date();
    const statuses = view === 'archive' ? ['shipped','archived'] : ['done','cancelled'];
    return data.orders
      .filter(o => statuses.includes(o.status))
      .filter(o => {
        if (period === '7d') return (now - new Date(o.dueDate||o.createdAt)) < 7*86400000;
        if (period === '30d') return (now - new Date(o.dueDate||o.createdAt)) < 30*86400000;
        return true;
      })
      .filter(o => searchOrder(o, query))
      .map(o => {
        const ot = tasks.filter(t => t.orderId === o.id);
        const total = ot.length;
        const done  = ot.filter(t => t.status === 'done').length;
        const planMin = ot.reduce((s,t) => s + t.time * t.planned, 0);
        const factMin = ot.filter(t=>t.status==='done' && t.actualTime).reduce((s,t)=>s+t.actualTime, 0);
        const normPct = planMin > 0 && factMin > 0 ? Math.round(factMin/planMin*100) : null;
        return { ...o, total, done, planMin, factMin, normPct };
      })
      .sort((a,b) => (b.dueDate||'').localeCompare(a.dueDate||''));
  }, [data.orders, tasks, query, period, view, searchOrder]);

  const totalPlan = doneOrders.reduce((s,o) => s + o.planMin, 0);
  const totalFact = doneOrders.reduce((s,o) => s + o.factMin, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">История заказов</h1>
          <div className="page-sub">{doneOrders.length} {view==='archive'?'отгружено':'выполнено'} · план {Math.round(totalPlan/60)}ч · факт {Math.round(totalFact/60)}ч</div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {[['done','Завершённые'],['archive','📦 Архив']].map(([v,l]) => (
            <button key={v} className={'btn' + (view===v?' primary':'')} onClick={() => setView(v)}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        <div style={{ position:'relative', flex:1, minWidth:160 }}>
          <Icon name="search" size={13} style={{ position:'absolute', left:9,
            top:'50%', transform:'translateY(-50%)', color:'var(--fg-2)' }}/>
          <input className="input" value={query} onChange={e=>setQuery(e.target.value)}
            placeholder="Поиск по номеру / клиенту…" style={{ paddingLeft:30 }}/>
        </div>
        {[['all','Все'],['30d','30 дн'],['7d','7 дн']].map(([v,l])=>(
          <button key={v} onClick={()=>setPeriod(v)}
            style={{ padding:'6px 12px', borderRadius:7, border:'1px solid', fontSize:12,
              cursor:'pointer', fontFamily:'var(--ui-font)',
              background: period===v ? 'var(--accent)' : 'var(--bg-1)',
              borderColor: period===v ? 'var(--accent)' : 'var(--line-1)',
              color: period===v ? '#fff' : 'var(--fg-1)' }}>{l}</button>
        ))}
      </div>

      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Номер</th>
              <th>Клиент</th>
              <th className="hide-mobile">Срок</th>
              <th className="num-col">Оп.</th>
              <th className="num-col hide-mobile">План, ч</th>
              <th className="num-col hide-mobile">Факт, ч</th>
              <th className="num-col">Норм.</th>
              <th>Статус</th>
              <th style={{ width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {doneOrders.length === 0 && (
              <tr><td colSpan={9}><div className="empty-state" style={{border:0}}>{view==='archive'?'Архив пуст':'Нет завершённых заказов'}</div></td></tr>
            )}
            {doneOrders.map(o => (
              <tr key={o.id} className="row-hover">
                <td onClick={() => onOpenOrder && onOpenOrder(o.id)} style={{ cursor:'pointer' }}><span className="mono" style={{color:'var(--accent)',fontWeight:700}}>{o.number}</span></td>
                <td style={{fontSize:13}}>{o.customer}</td>
                <td className="mono hide-mobile" style={{fontSize:12}}>{o.dueDate||'—'}</td>
                <td className="num-col num">{o.done}/{o.total}</td>
                <td className="num-col num hide-mobile">{o.planMin ? Math.round(o.planMin/60) : '—'}</td>
                <td className="num-col num hide-mobile">{o.factMin ? Math.round(o.factMin/60) : '—'}</td>
                <td className="num-col num" style={{
                  color: o.normPct > 115 ? 'var(--danger)' : o.normPct > 100 ? 'var(--warning,#c07820)' : o.normPct ? 'var(--st-done-line)' : 'var(--fg-2)',
                  fontWeight: o.normPct > 115 ? 700 : 400
                }}>{o.normPct ? o.normPct+'%' : '—'}</td>
                <td><span className={'pill '+(o.status==='shipped'?'done':o.status==='done'?'done':'wait')}><span className="dot"/>
                  {o.status==='shipped'?'📦 Отгружен':o.status==='done'?'Выполнен':'Отменён'}</span></td>
                <td>
                  {view === 'done' && o.status === 'done' && (
                    <button className="btn primary small" onClick={(e) => { e.stopPropagation(); onShip && onShip(o); }}>
                      📦 Отгрузка
                    </button>
                  )}
                  {view === 'archive' && o.status === 'shipped' && (
                    <button className="btn ghost small" onClick={(e) => { e.stopPropagation(); onArchive && onArchive(o); }}>
                      🗄 В архив
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── ModalManageWorkCenters ────────────────────────────────────────────────

export function ExcelExportView({ data, tasks, scanLog }) {
  const [exporting, setExporting] = React.useState(null);

  function exportOrders() {
    setExporting('orders');
    try {
      const wb = XLSX.utils.book_new();

      // Лист 1: Заказы
      const ordersRows = [
        ['Номер', 'Статус', 'Мастер', 'Клиент/Назначение', 'Дата создания', 'Срок', 'Операций', 'Выполнено', '%'],
        ...data.orders.map(o => {
          const ot = tasks.filter(t => t.orderId === o.id);
          const done = ot.filter(t => t.status === 'done').length;
          const pct  = ot.length > 0 ? Math.round(done/ot.length*100) : 0;
          const STATUS = { draft:'Черновик', plan:'Планируется', in_work:'В работе', done:'Выполнен', cancelled:'Отменён', paused:'Приостановлен' };
          return [o.number, STATUS[o.status]||o.status, o.foreman||'', o.customer||'', o.createdAt||'', o.dueDate||'', ot.length, done, pct+'%'];
        }),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ordersRows), 'Заказы');

      // Лист 2: Операции с нормоконтролем
      const tasksRows = [
        ['Заказ', 'Деталь', 'Код детали', '№ Оп.', 'Операция', 'Рабочий центр', 'Кол.план', 'Кол.факт', 'Норм.вр (мин)', 'Факт вр (мин)', '% от нормы', 'Оператор', 'Статус'],
        ...tasks.map(t => {
          const order  = data.orders.find(o => o.id === t.orderId);
          const detail = data.details?.find(d => d.id === t.detailId);
          const planMin = t.time * t.planned;
          const pct = t.actualTime && planMin > 0 ? Math.round(t.actualTime/planMin*100) : '';
          const STATUS = { waiting:'Ожидает', in_progress:'В работе', done:'Выполнено', paused:'Пауза', rejected:'Брак' };
          return [
            order?.number||t.orderId, detail?.name||t.detailId, detail?.code||'',
            t.opNum, t.opName, t.workCenter,
            t.planned, t.completed, planMin, t.actualTime||'', pct ? pct+'%' : '',
            t.operator||'', STATUS[t.status]||t.status,
          ];
        }),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tasksRows), 'Операции');

      // Лист 3: Нормоконтроль — только выполненные
      const doneTasks = tasks.filter(t => t.status === 'done' && t.actualTime);
      const normRows = [
        ['Заказ', 'Деталь', 'Операция', 'РЦ', 'Норм. вр', 'Факт вр', '%', 'Отклонение', 'Оператор'],
        ...doneTasks.map(t => {
          const order  = data.orders.find(o => o.id === t.orderId);
          const detail = data.details?.find(d => d.id === t.detailId);
          const plan   = t.time * t.planned;
          const pct    = Math.round(t.actualTime/plan*100);
          const delta  = t.actualTime - plan;
          return [order?.number||'', detail?.name||'', t.opName, t.workCenter, plan, t.actualTime, pct+'%', (delta>0?'+':'')+delta, t.operator||''];
        }),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(normRows), 'Нормоконтроль');

      // Лист 4: Журнал сканирований
      const logRows = [
        ['Время', 'Деталь', 'Операция', 'Оператор', 'Кол-во', 'Факт вр', 'Комментарий'],
        ...scanLog.map(s => [s.ts, s.detail, s.op, s.operator, s.quantity, s.actualTime||'', s.comment||'']),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(logRows), 'Журнал сканирований');

      XLSX.writeFile(wb, `Маршрут_Заказы_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch(e) { alert('Ошибка: '+e.message); }
    setExporting(null);
  }

  function exportReport() {
    setExporting('report');
    try {
      const wb = XLSX.utils.book_new();

      // Сводный отчёт по рабочим центрам
      const wcMap = {};
      tasks.forEach(t => {
        const wc = t.workCenter || 'Не указан';
        if (!wcMap[wc]) wcMap[wc] = { total:0, done:0, inProg:0, planMin:0, factMin:0 };
        wcMap[wc].total++;
        if (t.status === 'done') { wcMap[wc].done++; wcMap[wc].factMin += t.actualTime||0; }
        if (t.status === 'in_progress') wcMap[wc].inProg++;
        wcMap[wc].planMin += t.time * t.planned;
      });

      const wcRows = [
        ['Рабочий центр', 'Всего операций', 'Выполнено', 'В работе', '% выполнения', 'Норм. часов', 'Факт. часов', 'Нормоконтроль %'],
        ...Object.entries(wcMap).sort((a,b)=>a[0].localeCompare(b[0])).map(([wc, s]) => [
          wc, s.total, s.done, s.inProg,
          s.total > 0 ? Math.round(s.done/s.total*100)+'%' : '0%',
          Math.round(s.planMin/60*10)/10,
          s.factMin > 0 ? Math.round(s.factMin/60*10)/10 : '',
          s.factMin > 0 && s.planMin > 0 ? Math.round(s.factMin/s.planMin*100)+'%' : '',
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wcRows), 'По рабочим центрам');

      // Сводка по операторам
      const opMap = {};
      tasks.filter(t => t.status === 'done' && t.operator).forEach(t => {
        const op = t.operator;
        if (!opMap[op]) opMap[op] = { done:0, planMin:0, factMin:0, overCount:0 };
        opMap[op].done++;
        opMap[op].planMin += t.time * t.planned;
        opMap[op].factMin += t.actualTime || 0;
        if (t.actualTime && t.actualTime > t.time * t.planned * 1.15) opMap[op].overCount++;
      });

      const opRows = [
        ['Оператор', 'Выполнено оп.', 'Норм. часов', 'Факт. часов', 'Превышений нормы'],
        ...Object.entries(opMap).sort((a,b)=>b[1].done-a[1].done).map(([op, s]) => [
          op, s.done, Math.round(s.planMin/60*10)/10,
          s.factMin > 0 ? Math.round(s.factMin/60*10)/10 : '',
          s.overCount,
        ]),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(opRows), 'По операторам');

      XLSX.writeFile(wb, `Маршрут_Отчёт_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch(e) { alert('Ошибка: '+e.message); }
    setExporting(null);
  }

  function exportRouteSheet(orderId) {
    const order = data.orders.find(o => o.id === orderId);
    if (!order) return;
    setExporting('route_'+orderId);
    try {
      const wb = XLSX.utils.book_new();
      const orderTasks = tasks.filter(t => t.orderId === orderId).sort((a,b) => {
        const ai = (a.detailId||'').localeCompare(b.detailId||'');
        return ai !== 0 ? ai : a.opNum - b.opNum;
      });

      const rows = [
        ['Маршрутный лист: '+order.number],
        ['Ст. мастер:', order.foreman||'', 'Срок:', order.dueDate||''],
        [],
        ['Деталь', 'Код', 'Чертёж', '№ Оп.', 'Операция', 'Рабочий центр', 'Кол.', 'Норм. вр', 'Факт вр', '% нормы', 'Оператор', 'Статус'],
        ...orderTasks.map(t => {
          const det  = data.details?.find(d => d.id === t.detailId);
          const item = order.items?.find(i => i.detailId === t.detailId);
          const plan = t.time * (item?.quantity || t.planned);
          const pct  = t.actualTime && plan > 0 ? Math.round(t.actualTime/plan*100)+'%' : '';
          const STATUS = { waiting:'Ожидает', in_progress:'В работе', done:'Выполнено', paused:'Пауза' };
          return [det?.name||t.detailId, det?.code||'', det?.drawing||'', t.opNum, t.opName, t.workCenter, t.planned, plan, t.actualTime||'', pct, t.operator||'', STATUS[t.status]||t.status];
        }),
      ];

      const ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Маршрутный лист');
      XLSX.writeFile(wb, `МЛ_${order.number}_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch(e) { alert('Ошибка: '+e.message); }
    setExporting(null);
  }

  const EXPORTS = [
    {
      id: 'orders',
      icon: '📋',
      title: 'Заказы и операции',
      desc: '4 листа: заказы, все операции, нормоконтроль, журнал сканирований',
      action: exportOrders,
    },
    {
      id: 'report',
      icon: '📊',
      title: 'Сводный отчёт',
      desc: 'По рабочим центрам и операторам: план/факт часов, нормоконтроль',
      action: exportReport,
    },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Выгрузки Excel</h1>
          <div className="page-sub">Экспорт данных в формате .xlsx</div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12, marginBottom:24 }}>
        {EXPORTS.map(ex => (
          <div key={ex.id} className="card" style={{ padding:20 }}>
            <div style={{ fontSize:32, marginBottom:10 }}>{ex.icon}</div>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:6 }}>{ex.title}</div>
            <div style={{ fontSize:12, color:'var(--fg-2)', marginBottom:16, lineHeight:1.5 }}>{ex.desc}</div>
            <button className="btn primary" style={{ width:'100%' }}
              onClick={ex.action} disabled={exporting === ex.id}>
              {exporting === ex.id ? 'Экспорт…' : '⬇ Скачать .xlsx'}
            </button>
          </div>
        ))}
      </div>

      {/* Маршрутные листы по заказам */}
      <div className="subhead">Маршрутные листы по заказам</div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr>
            <th>Номер</th><th>Мастер</th><th className="hide-mobile">Срок</th>
            <th className="num-col">Оп.</th><th className="num-col">Вып.</th><th/>
          </tr></thead>
          <tbody>
            {data.orders.map(o => {
              const ot   = tasks.filter(t => t.orderId === o.id);
              const done = ot.filter(t => t.status === 'done').length;
              return (
                <tr key={o.id} className="row-hover">
                  <td className="mono" style={{color:'var(--accent)',fontWeight:700}}>{o.number}</td>
                  <td style={{fontSize:12}}>{o.foreman||'—'}</td>
                  <td className="mono hide-mobile" style={{fontSize:11}}>{o.dueDate||'—'}</td>
                  <td className="num-col num">{ot.length}</td>
                  <td className="num-col num">{done}</td>
                  <td>
                    <button className="btn ghost" style={{fontSize:11}}
                      onClick={() => exportRouteSheet(o.id)}
                      disabled={exporting === 'route_'+o.id}>
                      {exporting === 'route_'+o.id ? '…' : '⬇ МЛ Excel'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// =======================================================
// WikiPage — справка о системе
// =======================================================

export function ShiftHistoryView({ lang }) {
  const [date, setDate]   = React.useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData]   = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr]     = React.useState('');

  async function load(d) {
    setLoading(true); setErr('');
    try { setData(await api.get('/shifts/by-date?date=' + d)); }
    catch (e) { setErr(e.message); setData(null); }
    finally { setLoading(false); }
  }
  React.useEffect(() => { load(date); }, [date]);

  const shiftLabel = s => {
    const t = s.shift_type === 'night' ? '🌙 Ночная' : '☀ Дневная';
    return `${t} · ${s.name}`;
  };
  const fmt = ts => ts ? String(ts).slice(0, 16).replace('T', ' ') : '—';

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <h1 className="page-title" style={{ margin: 0 }}>История смен</h1>
        <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} style={{ marginLeft: 'auto', width: 170 }}/>
        <button className="btn ghost small" onClick={() => setDate(new Date(Date.now() - 86400000).toISOString().slice(0,10))}>← День</button>
        <button className="btn ghost small" onClick={() => setDate(new Date().toISOString().slice(0,10))}>Сегодня</button>
      </div>

      {loading && <div className="empty-state">Загрузка…</div>}
      {err && <div className="empty-state" style={{ color: 'var(--danger)' }}>{err === 'Доступ запрещён' ? 'История смен доступна только мастеру и администратору' : err}</div>}

      {data && !loading && (
        <>
          {data.day_stats && (
            <div className="card" style={{ padding: 16, marginBottom: 16, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div><div className="kpi-label">Смен за день</div><div className="kpi-value num">{(data.shifts || []).length}</div></div>
              {data.day_stats.total_ops != null && <div><div className="kpi-label">Операций закрыто</div><div className="kpi-value num">{data.day_stats.total_ops}</div></div>}
              {data.day_stats.total_operators != null && <div><div className="kpi-label">Операторов</div><div className="kpi-value num">{data.day_stats.total_operators}</div></div>}
            </div>
          )}

          {(data.shifts || []).length === 0 ? (
            <div className="empty-state">За {date} смен не было</div>
          ) : (
            (data.shifts || []).map(s => (
              <div key={s.id} className="card" style={{ padding: 18, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{shiftLabel(s)}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{fmt(s.opened_at)} → {s.closed_at ? fmt(s.closed_at) : 'открыта'}</span>
                  {s.closed_at ? <span className="pill done" style={{ padding: '1px 8px' }}>закрыта</span>
                    : <span className="pill prog" style={{ padding: '1px 8px' }}><span className="dot"/>идёт</span>}
                </div>
                <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
                  Открыл: {s.opened_by_name || '—'}
                  {s.closed_by_name && <> · Закрыл: {s.closed_by_name}</>}
                  {s.handoff_to && <> · Передал: <b>{s.handoff_to}</b></>}
                </div>
                {s.notes && (
                  <div style={{ fontSize: 13, padding: '8px 12px', background: 'var(--bg-1)', borderRadius: 8, marginBottom: 12, borderLeft: '3px solid var(--accent)' }}>
                    {s.notes}
                  </div>
                )}

                {(s.operators || []).length === 0 ? (
                  <div className="muted" style={{ fontSize: 13 }}>Операторов на смене не зафиксировано</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(s.operators || []).map((op, i) => (
                      <div key={i} style={{ border: '1px solid var(--line-2)', borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--bg-1)' }}>
                          <span style={{ fontWeight: 600 }}>{op.operator}</span>
                          <span className="muted" style={{ fontSize: 12 }}>операций: {op.ops_closed} · {op.qty_total} шт · {op.actual_min}′</span>
                          {op.pause_min > 0 && <span className="muted" style={{ fontSize: 12 }}>паузы {op.pause_min}′</span>}
                        </div>
                        {Array.isArray(op.operations) && op.operations.length > 0 && (
                          <table className="tbl" style={{ width: '100%' }}>
                            <thead><tr><th>Заказ</th><th>Деталь</th><th>Операция</th><th style={{ width: 70, textAlign: 'right' }}>Время</th><th style={{ width: 60, textAlign: 'right' }}>Кол-во</th></tr></thead>
                            <tbody>
                              {op.operations.map((o, j) => (
                                <tr key={j}>
                                  <td className="mono" style={{ color: 'var(--accent)' }}>{o.order_number}</td>
                                  <td>{o.detail_name || '—'}</td>
                                  <td>{o.op_info || '—'}</td>
                                  <td className="num" style={{ textAlign: 'right' }}>{o.time_min}′</td>
                                  <td className="num" style={{ textAlign: 'right' }}>{o.quantity}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}


