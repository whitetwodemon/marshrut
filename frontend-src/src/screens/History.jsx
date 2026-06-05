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
  const [detailQ,    setDetailQ]   = React.useState('');
  const [dateFrom,   setDateFrom]  = React.useState('');
  const [dateTo,     setDateTo]    = React.useState('');
  const [allOrders,  setAllOrders] = React.useState([]);
  const [loading,    setLoading]   = React.useState(true);
  const [shipping,   setShipping]  = React.useState(null);
  const [archiveTab, setArchiveTab] = React.useState('history'); // 'history' | 'archive'

  // Загружаем ВСЕ заказы включая done/cancelled/shipped
  React.useEffect(() => {
    setLoading(true);
    api.get('/orders?status=all&limit=500')
       .then(r => setAllOrders(r.data || []))
       .catch(() => setAllOrders(data?.orders || []))
       .finally(() => setLoading(false));
  }, []);

  // Отгрузить заказ
  async function handleShip(orderId, orderNum) {
    if (!window.confirm(`Отгрузить заказ ${orderNum}? Он переместится в архив.`)) return;
    setShipping(orderId);
    try {
      await api.put('/orders/' + orderId, { status: 'shipped' });
      setAllOrders(prev => prev.map(o => o.id === orderId ? { ...o, status:'shipped' } : o));
    } catch(e) { console.error('Error:', e.message); }
    setShipping(null);
  }

  // Фильтрация и сортировка
  const filtered = React.useMemo(() => {
    const src = allOrders.length > 0 ? allOrders : (data?.orders || []);
    const q    = query.toLowerCase();
    const dq   = detailQ.toLowerCase();

    return src
      .filter(o => {
        if (archiveTab === 'archive') return o.status === 'shipped';
        return ['done','cancelled'].includes(o.status);
      })
      .filter(o => {
        if (!q) return true;
        return o.number.toLowerCase().includes(q) ||
               (o.customer||'').toLowerCase().includes(q) ||
               (o.foreman||'').toLowerCase().includes(q);
      })
      .filter(o => {
        if (!dq) return true;
        // Ищем по деталям в заказе через tasks
        const orderTasks = tasks.filter(t => t.orderId === o.id);
        return orderTasks.some(t =>
          t.detailId.toLowerCase().includes(dq) ||
          (data?.details||[]).find(d => d.id === t.detailId)?.name.toLowerCase().includes(dq) ||
          (data?.details||[]).find(d => d.id === t.detailId)?.code.toLowerCase().includes(dq)
        );
      })
      .filter(o => {
        const updated = (o.updatedAt || o.createdAt || '').slice(0,10);
        if (dateFrom && updated < dateFrom) return false;
        if (dateTo   && updated > dateTo)   return false;
        return true;
      })
      .map(o => {
        const ot      = tasks.filter(t => t.orderId === o.id);
        const done    = ot.filter(t => t.status === 'done').length;
        const planMin = ot.reduce((s,t) => s + t.time * t.planned, 0);
        const factMin = ot.filter(t=>t.actualTime).reduce((s,t)=>s+(t.actualTime||0), 0);
        const normPct = planMin > 0 && factMin > 0 ? Math.round(factMin/planMin*100) : null;
        return { ...o, total:ot.length, done, planMin, factMin, normPct };
      })
      .sort((a,b) => (b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||''));
  }, [allOrders, data, tasks, query, detailQ, dateFrom, dateTo]);

  const STATUS_LABEL = {
    done:'Выполнен', cancelled:'Отменён', shipped:'Отгружен'
  };
  const STATUS_COLOR = {
    done:'var(--st-done-line)', cancelled:'var(--danger)', shipped:'#7c3aed'
  };
  const TYPE_COLOR = { W:'var(--accent)', D:'#7e3af2', K:'#0891b2' };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">История заказов</h1>
          <div className="page-sub">{filtered.length} {archiveTab==='archive'?'отгружено':'выполнено'}</div>
        </div>
      </div>

      {/* Переключатель История / Архив */}
      <div style={{ display:'flex', gap:6, marginBottom:14 }}>
        {[['history','📋 История (выполненные)'],['archive','📦 Архив (отгруженные)']].map(([id,label])=>(
          <button key={id} className={'btn' + (archiveTab===id ? ' primary' : ' ghost')}
            onClick={()=>setArchiveTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {/* Фильтры */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'flex-end' }}>
        {/* Поиск по номеру/клиенту */}
        <div style={{ position:'relative', flex:2, minWidth:160 }}>
          <Icon name="search" size={13} style={{ position:'absolute', left:9,
            top:'50%', transform:'translateY(-50%)', color:'var(--fg-2)' }}/>
          <input className="input" value={query} onChange={e=>setQuery(e.target.value)}
            placeholder="Номер заказа, клиент, мастер…" style={{ paddingLeft:30 }}/>
        </div>
        {/* Поиск по детали */}
        <div style={{ position:'relative', flex:2, minWidth:140 }}>
          <Icon name="search" size={13} style={{ position:'absolute', left:9,
            top:'50%', transform:'translateY(-50%)', color:'var(--fg-2)' }}/>
          <input className="input" value={detailQ} onChange={e=>setDetailQ(e.target.value)}
            placeholder="Деталь (код или название)…" style={{ paddingLeft:30 }}/>
        </div>
        {/* Период */}
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <input className="input" type="date" value={dateFrom}
            onChange={e=>setDateFrom(e.target.value)}
            style={{ width:140 }} title="Дата с"/>
          <span style={{ color:'var(--fg-2)', fontSize:12 }}>—</span>
          <input className="input" type="date" value={dateTo}
            onChange={e=>setDateTo(e.target.value)}
            style={{ width:140 }} title="Дата по"/>
        </div>
        {(query||detailQ||dateFrom||dateTo) && (
          <button className="btn ghost" onClick={()=>{setQuery('');setDetailQ('');setDateFrom('');setDateTo('');}}>
            ✕ Сбросить
          </button>
        )}
      </div>

      {loading && <div style={{padding:32,textAlign:'center',color:'var(--fg-2)'}}>Загрузка…</div>}

      {!loading && (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>
              <th>Номер</th>
              <th>Клиент / Назначение</th>
              <th className="hide-mobile">Мастер</th>
              <th className="hide-mobile">Срок</th>
              <th className="num-col">Оп.</th>
              <th className="hide-mobile num-col">Норм.%</th>
              <th>Статус</th>
              <th/>
            </tr></thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8}>
                  <div className="empty-state" style={{border:0}}>Заказов не найдено</div>
                </td></tr>
              )}
              {filtered.map(o => (
                <tr key={o.id} className="row-hover">
                  <td>
                    <div className="mono" style={{color:TYPE_COLOR[o.orderType]||'var(--accent)',fontWeight:700}}>
                      {o.number}
                    </div>
                    <div style={{fontSize:9,color:'var(--fg-2)'}}>
                      {TYPE_COLOR[o.orderType] ? {W:'Заказ',D:'Доработка',K:'Кооперация'}[o.orderType] : ''}
                    </div>
                  </td>
                  <td style={{fontSize:12}}>{o.customer||'—'}</td>
                  <td className="hide-mobile" style={{fontSize:12}}>{o.foreman||'—'}</td>
                  <td className="mono hide-mobile" style={{fontSize:11}}>{o.dueDate||'—'}</td>
                  <td className="num-col num">{o.done}/{o.total}</td>
                  <td className="hide-mobile num-col num" style={{
                    color: o.normPct ? (o.normPct<=100?'var(--st-done-line)':o.normPct<=115?'var(--warning,#c07820)':'var(--danger)') : 'var(--fg-2)'
                  }}>
                    {o.normPct ? o.normPct+'%' : '—'}
                  </td>
                  <td>
                    <span style={{
                      fontSize:11, fontWeight:600, padding:'2px 8px',
                      borderRadius:99, background:'rgba(0,0,0,.08)',
                      color: STATUS_COLOR[o.status]||'var(--fg-2)'
                    }}>
                      {o.status === 'shipped' ? '📦 Отгружен' : STATUS_LABEL[o.status]||o.status}
                    </span>
                  </td>
                  <td>
                    <div style={{display:'flex',gap:4}}>
                      {o.status === 'done' && (
                        <button className="btn primary" style={{fontSize:11,padding:'4px 10px',
                          background:'#7c3aed',borderColor:'#7c3aed'}}
                          onClick={()=>handleShip(o.id, o.number)}
                          disabled={shipping===o.id}>
                          {shipping===o.id ? '…' : '📦 Отгрузить'}
                        </button>
                      )}
                      <button className="btn ghost" style={{fontSize:11}}
                        onClick={()=>onOpenOrder && onOpenOrder(o.id)}>
                        Открыть
                      </button>
                    </div>
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


export { HistoryView, HistoryOrdersView }
