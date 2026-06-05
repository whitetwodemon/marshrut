import React from 'react'
import { Icon } from '../components/Icon.jsx'
import { QrCode, generateQrSvg } from '../components/QrCode.jsx'
import { useStrings, StatusPill, OrderPicker } from '../lib/data.jsx'
import { api } from '../lib/api.js'

const TYPE_COLORS = { W:'var(--accent)', D:'#7e3af2', K:'#0891b2' };
const TYPE_LABELS = { W:'Заказ', D:'Доработка', K:'Кооперация' };
function OrdersListView({ data, tasks, lang, onOpenOrder }) {
  const [query,     setQuery]    = React.useState('');
  const [statusF,   setStatusF]  = React.useState('all');
  const [view,      setView]     = React.useState('cards'); // 'cards' | 'table'

  const STATUS_LBL = { draft:'Черновик', plan:'Планируется', waiting_material:'Ждём материал', waiting_equipment:'Ждём оборудование', waiting_approval:'Ждём согласование', in_work:'В работе', paused:'Приостановлен', done:'Выполнен', cancelled:'Отменён' };
  const STATUS_CLS = { draft:'wait', plan:'wait', waiting_material:'wait', waiting_equipment:'wait', waiting_approval:'wait', in_work:'prog', paused:'wait', done:'done', cancelled:'wait' };
  const PRI_LBL    = { high:'Высокий', normal:'Норм.', low:'Низкий' };
  const PRI_DOT    = { high:'var(--danger)', normal:'var(--accent)', low:'var(--fg-3)' };

  const enriched = React.useMemo(() => (data?.orders || []).map(o => {
    const ot     = tasks.filter(t => t.orderId === o.id);
    const done   = ot.filter(t => t.status === 'done').length;
    const inProg = ot.filter(t => t.status === 'in_progress').length;
    const total  = ot.length;
    const pct    = total > 0 ? Math.round(done / total * 100) : 0;
    const due    = o.dueDate || o.due_date || '';
    const overdue = due && new Date(due) < new Date() && o.status !== 'done';
    return { ...o, due, done, inProg, total, pct, overdue, detailsCt: (o.items||[]).length };
  }), [data?.orders, tasks]);

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
    return (data?.orders || []).map(o => {
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
    if (!XLSX) { console.error('SheetJS не загружен'); return; }
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
        const order  = (data?.orders||[]).find(o=>o.id===t.orderId);
        const detail = (data?.details||[]).find(d=>d.id===t.detailId);
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



  

// =======================================================
// HistoryOrdersView — история выполненных заказов
// =======================================================

export { OrdersListView, ReportView }
