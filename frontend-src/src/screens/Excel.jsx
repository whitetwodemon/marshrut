import React from 'react'
import { Icon } from '../components/Icon.jsx'
import { QrCode, generateQrSvg } from '../components/QrCode.jsx'
import { useStrings, StatusPill, OrderPicker } from '../lib/data.jsx'
import { api } from '../lib/api.js'
import * as XLSX from 'xlsx'

function ExcelExportView({ data, tasks, scanLog }) {
  const [exporting, setExporting] = React.useState(null);

  function exportOrders() {
    setExporting('orders');
    try {
      const wb = XLSX.utils.book_new();
      const STATUS = { draft:'Черновик', plan:'Планируется', in_work:'В работе', done:'Выполнен', cancelled:'Отменён', paused:'Приостановлен' };

      // Лист 1: Заказы
      const ordersRows = [
        ['Номер', 'Статус', 'Мастер', 'Назначение', 'Дата создания', 'Срок', 'Операций', 'Выполнено', '%'],
        ...(data?.orders||[]).map(o => {
          const ot   = tasks.filter(t => t.orderId === o.id);
          const done = ot.filter(t => t.status === 'done').length;
          return [o.number, STATUS[o.status]||o.status, o.foreman||'', o.customer||'', o.createdAt||'', o.dueDate||'', ot.length, done, ot.length>0?Math.round(done/ot.length*100)+'%':'0%'];
        }),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ordersRows), 'Заказы');

      // Лист 2: Операции
      const tasksRows = [
        ['Заказ', 'Деталь', 'Код', '№ Оп.', 'Операция', 'РЦ', 'Кол.план', 'Кол.факт', 'Норм.вр', 'Факт вр', '% нормы', 'Оператор', 'Статус'],
        ...tasks.map(t => {
          const order  = (data?.orders||[]).find(o => o.id === t.orderId);
          const detail = data.details?.find(d => d.id === t.detailId);
          const plan   = t.time * t.planned;
          const pct    = t.actualTime && plan > 0 ? Math.round(t.actualTime/plan*100)+'%' : '';
          const S2     = { waiting:'Ожидает', in_progress:'В работе', done:'Выполнено', paused:'Пауза', rejected:'Брак' };
          return [order?.number||'', detail?.name||'', detail?.code||'', t.opNum, t.opName, t.workCenter, t.planned, t.completed, plan, t.actualTime||'', pct, t.operator||'', S2[t.status]||t.status];
        }),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tasksRows), 'Операции');

      // Лист 3: Нормоконтроль
      const normRows = [
        ['Заказ', 'Деталь', 'Операция', 'РЦ', 'Норм. вр', 'Факт вр', '%', 'Откл.', 'Оператор'],
        ...tasks.filter(t => t.status==='done' && t.actualTime).map(t => {
          const order  = (data?.orders||[]).find(o => o.id === t.orderId);
          const detail = data.details?.find(d => d.id === t.detailId);
          const plan   = t.time * t.planned;
          const delta  = t.actualTime - plan;
          return [order?.number||'', detail?.name||'', t.opName, t.workCenter, plan, t.actualTime, Math.round(t.actualTime/plan*100)+'%', (delta>0?'+':'')+delta, t.operator||''];
        }),
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(normRows), 'Нормоконтроль');

      // Лист 4: Журнал
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['Время', 'Деталь', 'Операция', 'Оператор', 'Кол-во', 'Факт вр', 'Комментарий'],
        ...scanLog.map(s => [s.ts, s.detail, s.op, s.operator, s.quantity, s.actualTime||'', s.comment||'']),
      ]), 'Журнал');

      XLSX.writeFile(wb, `Маршрут_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch(e) { alert('Ошибка: '+e.message); }
    setExporting(null);
  }

  function exportReport() {
    setExporting('report');
    try {
      const wb = XLSX.utils.book_new();
      // По РЦ
      const wcMap = {};
      tasks.forEach(t => {
        const wc = t.workCenter || '—';
        if (!wcMap[wc]) wcMap[wc] = { total:0, done:0, planMin:0, factMin:0, overCount:0 };
        wcMap[wc].total++;
        if (t.status==='done') { wcMap[wc].done++; wcMap[wc].factMin += t.actualTime||0; }
        wcMap[wc].planMin += t.time * t.planned;
        if (t.actualTime && t.actualTime > t.time*t.planned*1.15) wcMap[wc].overCount++;
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['РЦ', 'Всего', 'Выполнено', '%', 'Норм.ч', 'Факт.ч', 'Норм.%', 'Превышений'],
        ...Object.entries(wcMap).sort().map(([wc,s]) => [
          wc, s.total, s.done, s.total>0?Math.round(s.done/s.total*100)+'%':'0%',
          Math.round(s.planMin/60*10)/10, s.factMin>0?Math.round(s.factMin/60*10)/10:'',
          s.factMin>0&&s.planMin>0?Math.round(s.factMin/s.planMin*100)+'%':'', s.overCount,
        ]),
      ]), 'По рабочим центрам');
      // По операторам
      const opMap = {};
      tasks.filter(t=>t.status==='done'&&t.operator).forEach(t => {
        if (!opMap[t.operator]) opMap[t.operator] = { done:0, planMin:0, factMin:0, over:0 };
        opMap[t.operator].done++;
        opMap[t.operator].planMin += t.time*t.planned;
        opMap[t.operator].factMin += t.actualTime||0;
        if (t.actualTime && t.actualTime > t.time*t.planned*1.15) opMap[t.operator].over++;
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['Оператор', 'Выполнено', 'Норм.ч', 'Факт.ч', 'Превышений'],
        ...Object.entries(opMap).sort((a,b)=>b[1].done-a[1].done).map(([op,s]) => [
          op, s.done, Math.round(s.planMin/60*10)/10,
          s.factMin>0?Math.round(s.factMin/60*10)/10:'', s.over,
        ]),
      ]), 'По операторам');
      XLSX.writeFile(wb, `Маршрут_Отчёт_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch(e) { alert('Ошибка: '+e.message); }
    setExporting(null);
  }

  function exportRouteSheet(orderId) {
    const order = (data?.orders||[]).find(o => o.id === orderId);
    if (!order) return;
    setExporting('route_'+orderId);
    try {
      const wb  = XLSX.utils.book_new();
      const ot  = tasks.filter(t => t.orderId === orderId).sort((a,b) => a.detailId.localeCompare(b.detailId)||a.opNum-b.opNum);
      const S3  = { waiting:'Ожидает', in_progress:'В работе', done:'Выполнено', paused:'Пауза' };
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['Маршрутный лист: '+order.number],
        ['Мастер:', order.foreman||'', 'Срок:', order.dueDate||''],
        [],
        ['Деталь', 'Код', 'Чертёж', '№', 'Операция', 'РЦ', 'Кол.', 'Норм.', 'Факт', '%', 'Оператор', 'Статус'],
        ...ot.map(t => {
          const det  = data.details?.find(d => d.id === t.detailId);
          const plan = t.time * t.planned;
          const pct  = t.actualTime && plan>0 ? Math.round(t.actualTime/plan*100)+'%' : '';
          return [det?.name||'', det?.code||'', det?.drawing||'', t.opNum, t.opName, t.workCenter, t.planned, plan, t.actualTime||'', pct, t.operator||'', S3[t.status]||t.status];
        }),
      ]), 'Маршрутный лист');
      XLSX.writeFile(wb, `МЛ_${order.number}.xlsx`);
    } catch(e) { alert('Ошибка: '+e.message); }
    setExporting(null);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Выгрузки Excel</h1>
          <div className="page-sub">Экспорт данных в .xlsx</div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12, marginBottom:24 }}>
        {[
          { id:'orders', icon:'📋', title:'Заказы и операции', desc:'4 листа: заказы, операции, нормоконтроль, журнал', fn: exportOrders },
          { id:'report', icon:'📊', title:'Сводный отчёт',      desc:'По рабочим центрам и операторам',                fn: exportReport },
        ].map(ex => (
          <div key={ex.id} className="card" style={{ padding:20 }}>
            <div style={{ fontSize:32, marginBottom:8 }}>{ex.icon}</div>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:6 }}>{ex.title}</div>
            <div style={{ fontSize:12, color:'var(--fg-2)', marginBottom:14, lineHeight:1.5 }}>{ex.desc}</div>
            <button className="btn primary" style={{ width:'100%' }} onClick={ex.fn} disabled={exporting===ex.id}>
              {exporting===ex.id ? 'Экспорт…' : '⬇ Скачать .xlsx'}
            </button>
          </div>
        ))}
      </div>

      <div className="subhead">Маршрутные листы по заказам</div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>Номер</th><th>Мастер</th><th className="hide-mobile">Срок</th><th className="num-col">Оп.</th><th className="num-col">Вып.</th><th/></tr></thead>
          <tbody>
            {(data?.orders||[]).map(o => {
              const ot = tasks.filter(t=>t.orderId===o.id);
              return (
                <tr key={o.id} className="row-hover">
                  <td className="mono" style={{color:'var(--accent)',fontWeight:700}}>{o.number}</td>
                  <td style={{fontSize:12}}>{o.foreman||'—'}</td>
                  <td className="mono hide-mobile" style={{fontSize:11}}>{o.dueDate||'—'}</td>
                  <td className="num-col num">{ot.length}</td>
                  <td className="num-col num">{ot.filter(t=>t.status==='done').length}</td>
                  <td>
                    <button className="btn ghost" style={{fontSize:11}} disabled={exporting==='route_'+o.id}
                      onClick={()=>exportRouteSheet(o.id)}>
                      {exporting==='route_'+o.id ? '…' : '⬇ МЛ Excel'}
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

export { ExcelExportView }
