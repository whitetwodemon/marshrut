import React from 'react'
import { Icon } from '../components/Icon.jsx'
import { QrCode, generateQrSvg } from '../components/QrCode.jsx'
import { useStrings, StatusPill, OrderPicker } from '../lib/data.jsx'
import { api } from '../lib/api.js'

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

function HistoryOrdersView({ data, tasks, lang, onOpenOrder }) {
  const [query,      setQuery]     = React.useState('');
  const [period,     setPeriod]    = React.useState('all');
  const [allOrders,  setAllOrders] = React.useState([]);

  React.useEffect(() => {
    // Load ALL orders including done/cancelled (main data only has active)
    api.get('/orders?status=all&limit=200').then(r => {
      setAllOrders(r.data || []);
    }).catch(() => setAllOrders(data.orders || []));
  }, []);

  const doneOrders = React.useMemo(() => {
    const source = allOrders.length > 0 ? allOrders : data.orders;
    const now = new Date();
    return source
      .filter(o => o.status === 'done' || o.status === 'cancelled')
      .filter(o => {
        if (period === '7d') return (now - new Date(o.dueDate||o.createdAt)) < 7*86400000;
        if (period === '30d') return (now - new Date(o.dueDate||o.createdAt)) < 30*86400000;
        return true;
      })
      .filter(o => !query ||
        o.number.toLowerCase().includes(query.toLowerCase()) ||
        (o.customer||'').toLowerCase().includes(query.toLowerCase()))
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
  }, [data.orders, tasks, query, period]);

  const totalPlan = doneOrders.reduce((s,o) => s + o.planMin, 0);
  const totalFact = doneOrders.reduce((s,o) => s + o.factMin, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">История заказов</h1>
          <div className="page-sub">{doneOrders.length} выполнено · план {Math.round(totalPlan/60)}ч · факт {Math.round(totalFact/60)}ч</div>
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
            </tr>
          </thead>
          <tbody>
            {doneOrders.length === 0 && (
              <tr><td colSpan={8}><div className="empty-state" style={{border:0}}>Нет завершённых заказов</div></td></tr>
            )}
            {doneOrders.map(o => (
              <tr key={o.id} className="row-hover" style={{ cursor:'pointer' }}
                onClick={() => onOpenOrder && onOpenOrder(o.id)}>
                <td><span className="mono" style={{color:'var(--accent)',fontWeight:700}}>{o.number}</span></td>
                <td style={{fontSize:13}}>{o.customer}</td>
                <td className="mono hide-mobile" style={{fontSize:12}}>{o.dueDate||'—'}</td>
                <td className="num-col num">{o.done}/{o.total}</td>
                <td className="num-col num hide-mobile">{o.planMin ? Math.round(o.planMin/60) : '—'}</td>
                <td className="num-col num hide-mobile">{o.factMin ? Math.round(o.factMin/60) : '—'}</td>
                <td className="num-col num" style={{
                  color: o.normPct > 115 ? 'var(--danger)' : o.normPct > 100 ? 'var(--warning,#c07820)' : o.normPct ? 'var(--st-done-line)' : 'var(--fg-2)',
                  fontWeight: o.normPct > 115 ? 700 : 400
                }}>{o.normPct ? o.normPct+'%' : '—'}</td>
                <td><span className={'pill '+(o.status==='done'?'done':'wait')}><span className="dot"/>
                  {o.status==='done'?'Выполнен':'Отменён'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── ModalManageWorkCenters ────────────────────────────────────────────────

export { HistoryView, HistoryOrdersView }
