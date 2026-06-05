import React from 'react'
import { Icon } from '../components/Icon.jsx'
import { QrCode, generateQrSvg } from '../components/QrCode.jsx'
import { useStrings, StatusPill, OrderPicker } from '../lib/data.jsx'
import { api } from '../lib/api.js'

function WorkCenterPreview({ items, data, lang }) {
  const wcMap = {};
  items.forEach(it => {
    const det = (data?.details||[]).find(d => d.id === it.detailId);
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

function RouteSheetView({ data, tasks, scanLog, lang, qrSize, onClose, onScanQR }) {
  const S = useStrings(lang);
  const order = (data?.orders||[])[0];

  if (!order) return (
    <div style={{ padding:48, textAlign:'center', color:'var(--fg-2)' }}>
      <p>Нет заказа для печати</p>
      <button className="btn" onClick={onClose} style={{ marginTop:16 }}>← Назад</button>
    </div>
  );

  const items = order.items.map(it => ({
    ...it,
    det: (data?.details||[]).find(d => d.id === it.detailId),
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

        // QR для закрытой операции — ссылка на информацию о закрытии
        const doneQrText  = t.status === 'done' ? `DONE:${t.qrText}` : null;
        const doneQrSVG   = doneQrText ? (generateQrSvg(doneQrText, 40) || '') : '';
        // QR для паузы — сканируется оператором
        const pauseQrText = (t.status === 'in_progress' || t.status === 'paused') ? `PAUSE:${t.qrText}` : null;
        const pauseQrSVG  = pauseQrText ? (generateQrSvg(pauseQrText, 36) || '') : '';

        const rowBg = t.status === 'done' ? '#f0faf0' : t.status === 'in_progress' ? '#fff8f0' : '#fff';
        const isDone = t.status === 'done' || t.completed >= t.planned;

        // Нормоконтроль для выполненных
        const normStr = isDone && t.actualTime
          ? `<div style="font-size:7pt;font-family:monospace;margin-top:2px;color:${t.actualTime > t.time * 1.15 ? '#c00' : '#2d7a2d'}">
               факт: ${t.actualTime}′ / пл: ${t.time}′
             </div>`
          : '';

        // Дата закрытия из scan_log если есть
        const scanEntry = (scanLog||[]).find(s => s.qrText === t.qrText || s.taskId === t.id);
        const closedAt  = scanEntry?.ts || '';
        const closedBy  = scanEntry?.operator || t.operator || '';

        return `<tr style="background:${rowBg};${isDone ? 'border-left:3px solid #2d7a2d' : ''}">
          <td style="padding:3px 6px;border-bottom:1px solid #e8e0d0;font-family:monospace;font-weight:700;font-size:9pt;width:30px;text-align:center">${String(t.opNum).padStart(3,'0')}</td>
          <td style="padding:3px 6px;border-bottom:1px solid #e8e0d0;font-size:9pt">
            <b>${t.opName}</b>
            ${isDone ? `<div style="font-size:8pt;color:#fff;background:#2d7a2d;padding:1px 4px;border-radius:3px;margin-top:3px;display:inline-block;font-weight:700">✓ ЗАКРЫТА</div>` : ''}
            ${normStr}
          </td>
          <td style="padding:3px 6px;border-bottom:1px solid #e8e0d0;font-size:8pt;font-family:monospace;color:#444;width:90px">${t.workCenter}</td>
          <td style="padding:3px 6px;border-bottom:1px solid #e8e0d0;font-size:9pt;text-align:center;width:30px;font-family:monospace;font-weight:700">${t.planned}</td>
          <td style="padding:3px 6px;border-bottom:1px solid #e8e0d0;font-size:7pt;font-family:monospace;color:#666;text-align:center;width:35px">${t.time}′</td>
          <td style="padding:2px 4px;border-bottom:1px solid #e8e0d0;text-align:center;width:120px">
            ${isDone ? `
              <div style="display:flex;gap:4px;align-items:flex-start;justify-content:center">
                <div style="text-align:center">${qrSVG}<div style="font-size:4pt;font-family:monospace;color:#2d7a2d">открыть</div></div>
                ${doneQrSVG ? `<div style="text-align:center">${doneQrSVG}<div style="font-size:4pt;font-family:monospace;color:#555">инфо</div></div>` : ''}
              </div>
            ` : `
              <div style="display:flex;gap:4px;align-items:center;justify-content:center">
                <div style="text-align:center">${qrSVG}<div style="font-size:4pt;font-family:monospace;color:#999">закрыть</div></div>
                ${pauseQrSVG ? `<div style="text-align:center">${pauseQrSVG}<div style="font-size:4pt;font-family:monospace;color:#c07820">пауза</div></div>` : ''}
              </div>
            `}
          </td>
          <td style="border-bottom:1px solid #e8e0d0;padding:3px 5px;min-width:100px">
            ${isDone ? `
              <div style="font-size:7pt;background:#e6f4ea;color:#2d7a2d;padding:1px 4px;border-radius:3px;font-weight:700;display:inline-block;margin-bottom:2px">✓ ЗАКРЫТА</div>
              <div style="font-size:8pt;color:#2d7a2d;font-weight:600;margin-top:1px">${closedBy || t.operator||'—'}</div>
              ${closedAt ? `<div style="font-size:7pt;font-family:monospace;color:#444">${closedAt}</div>` : ''}
              ${t.actualTime ? `<div style="font-size:7pt;font-family:monospace;margin-top:1px;color:${t.actualTime > t.time * 1.15 ? '#c00' : '#2d7a2d'};font-weight:${t.actualTime > t.time*1.15?'700':'400'}">факт: ${t.actualTime}′ / план: ${t.time}′</div>` : ''}
            ` : `<div style="font-size:7pt;color:#999;margin-bottom:2px">исполнитель:</div><div style="font-size:8pt;color:#444;min-height:18px;border-bottom:1px solid #ccc">&nbsp;</div>`}
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
            <th style="padding:3px 6px;text-align:center;font-size:7pt;border-bottom:2px solid #c07820;width:110px">QR</th>
            <th style="padding:3px 6px;text-align:left;font-size:7pt;border-bottom:2px solid #c07820;min-width:90px">ИСПОЛНИТЕЛЬ / ДАТА</th>
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
    ${(() => {
      const pausedTasks = items.flatMap(it=>it.tasks).filter(t=>t.status==='paused');
      if (!pausedTasks.length) return '';
      return `<div style="margin-top:8px;padding:6px 8px;background:#fffbf0;border:1px solid #e0c060;border-radius:4px;font-size:8pt">
        <b style="color:#7a5000">⏸ Задания на паузе:</b>
        ${pausedTasks.map(t=>`<span style="margin-left:8px;font-family:monospace">${String(t.opNum).padStart(3,'0')} ${t.opName}</span>`).join('')}
      </div>`;
    })()}
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

export { RouteSheetView, WorkCenterPreview }
