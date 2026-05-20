import React from 'react';
import { Icon } from '../components/Icon.jsx';
import { QrCode } from '../components/QrCode.jsx';

// screens.jsx — Sidebar, Topbar, Dashboard, Library, OrderBuilder, RouteSheet
// Note: Icon, QrCode are declared in icons.jsx / qr.jsx as global consts.

const T = (key, lang, dicts) => dicts[lang][key] || key;

// =======================================================
// Strings
// =======================================================
const STR_RU = {
  navOps: 'Производство',
  navDash: 'Производственное табло',
  navOrders: 'Заказы',
  navLibrary: 'Номенклатура',
  navScan: 'Сканер ОТК',
  navHistory: 'Журнал сканирований',
  navOps2: 'Справочники',
  workspace: 'ЦЕХ №4 / Механосборка',
  shift: 'Смена A · ст. мастер Колесников П.А.',
  active: 'Активный заказ',
  inWork: 'Операций в работе',
  doneToday: 'Закрыто сегодня',
  overdue: 'Под угрозой срока',
  pcs: 'шт',
  ops: 'опер.',
  hr: 'ч',
  min: 'мин',
  detail: 'Деталь',
  qtyShort: 'Кол-во',
  details: 'Детали',
  operation: 'Операция',
  workCenter: 'Раб. центр',
  operator: 'Оператор',
  updated: 'Обновлено',
  scanQR: 'Сканировать QR',
  printSheet: 'Маршрутный лист',
  newOrder: '+ Новый заказ',
  saveOrder: 'Сохранить заказ',
  generateSheet: 'Сформировать маршрутный лист',
  recentScans: 'Последние сканирования',
  feed: 'Лента',
  closeOp: 'Закрыть операцию',
  reopen: 'Открыть',
  search: 'Поиск по коду или названию',
  detailsCount: 'Деталей',
  opsTotal: 'Операций',
  estTime: 'Расч. время',
  lastUpdate: 'Изменено',
  drawing: 'Чертёж',
  material: 'Материал',
  unit: 'Ед.',
  techCard: 'Технологическая карта',
  noTime: 'мин/шт',
  customer: 'Получатель',
  dueDate: 'Срок',
  created: 'Создан',
  foreman: 'Ст. мастер',
  status: 'Статус',
  orderComp: 'Состав заказа',
  addLine: '+ Добавить деталь',
  summary: 'Сводка по заказу',
  totalOps: 'Всего операций',
  totalTime: 'Расч. время',
  detailsCt: 'Деталей',
  partsCt: 'Изделий',
  routesheet: 'Маршрутный лист',
  sheetTitle: 'МАРШРУТНЫЙ ЛИСТ',
  scanInstr: 'Наведите камеру на QR-код операции с бумажного маршрутного листа',
  cameraOff: 'Камера отключена',
  enableCam: 'Включить камеру',
  scanMatch: 'Сопоставлено с операцией:',
  closeOpQ: 'Закрыть операцию?',
  confirm: 'Закрыть',
  cancel: 'Отмена',
  noTask: 'QR не сопоставлен',
  log: 'Журнал',
  signature: 'Подпись',
  qrCode: 'QR-код',
  preview: 'Предпросмотр',
  printNow: 'Печать',
  manualEntry: 'Ручной ввод',
  reset: 'Сброс',
  sheetSubtitle: 'к заказу на производство',
  page: 'Стр.',
  of: 'из',
  signedBy: 'Принял ОТК:',
  date: 'Дата:',
  operatorCol: 'Исполнитель',
  signatureCol: 'Отметка',
};

const STR_EN = {
  navOps: 'Production',
  navDash: 'Production board',
  navOrders: 'Orders',
  navLibrary: 'Parts library',
  navScan: 'QR scanner',
  navHistory: 'Scan log',
  navOps2: 'Reference',
  workspace: 'SHOP №4 / Mechanical',
  shift: 'Shift A · foreman P. Kolesnikov',
  active: 'Active order',
  inWork: 'Ops in progress',
  doneToday: 'Closed today',
  overdue: 'At risk',
  pcs: 'pc',
  ops: 'ops',
  hr: 'h',
  min: 'min',
  detail: 'Part',
  qtyShort: 'Qty',
  details: 'Parts',
  operation: 'Operation',
  workCenter: 'Work center',
  operator: 'Operator',
  updated: 'Updated',
  scanQR: 'Scan QR',
  printSheet: 'Route sheet',
  newOrder: '+ New order',
  saveOrder: 'Save order',
  generateSheet: 'Generate route sheet',
  recentScans: 'Recent scans',
  feed: 'Feed',
  closeOp: 'Close operation',
  reopen: 'Reopen',
  search: 'Search by code or name',
  detailsCount: 'Parts',
  opsTotal: 'Operations',
  estTime: 'Est. time',
  lastUpdate: 'Last change',
  drawing: 'Drawing',
  material: 'Material',
  unit: 'Unit',
  techCard: 'Tech card',
  noTime: 'min/pc',
  customer: 'Customer',
  dueDate: 'Due',
  created: 'Created',
  foreman: 'Foreman',
  status: 'Status',
  orderComp: 'Order composition',
  addLine: '+ Add part',
  summary: 'Order summary',
  totalOps: 'Total operations',
  totalTime: 'Est. time',
  detailsCt: 'Distinct parts',
  partsCt: 'Items',
  routesheet: 'Route sheet',
  sheetTitle: 'ROUTE SHEET',
  scanInstr: 'Aim camera at an operation QR code on a printed route sheet',
  cameraOff: 'Camera off',
  enableCam: 'Enable camera',
  scanMatch: 'Matched to operation:',
  closeOpQ: 'Close this operation?',
  confirm: 'Close',
  cancel: 'Cancel',
  noTask: 'QR not recognized',
  log: 'Log',
  signature: 'Signature',
  qrCode: 'QR code',
  preview: 'Preview',
  printNow: 'Print',
  manualEntry: 'Manual entry',
  reset: 'Reset',
  sheetSubtitle: 'for production order',
  page: 'Page',
  of: 'of',
  signedBy: 'QC accepted:',
  date: 'Date:',
  operatorCol: 'Operator',
  signatureCol: 'Mark',
};

function useStrings(lang) {
  return lang === 'en' ? STR_EN : STR_RU;
}

// =======================================================
// Sidebar
// =======================================================
function Sidebar({ route, setRoute, lang, counts }) {
  const S = useStrings(lang);
  const items = [
    { id: 'dashboard', label: S.navDash, icon: 'gauge', badge: counts.inProgress },
    { id: 'orders', label: S.navOrders, icon: 'orders', badge: counts.orders },
    { id: 'library', label: S.navLibrary, icon: 'library' },
    { id: 'scanner', label: S.navScan, icon: 'scan' },
    { id: 'history', label: S.navHistory, icon: 'history' },
  ];
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="brand-mark">М</div>
        <div>
          <div className="brand-name">{lang === 'en' ? 'Маршрут' : 'Маршрут'}</div>
          <div className="brand-sub">v 2.4 · build 0529</div>
        </div>
      </div>

      <div className="sidebar-section">{S.navOps}</div>
      <div className="sidebar-nav">
        {items.slice(0, 4).map(it => (
          <button
            key={it.id}
            className={'nav-item ' + (route === it.id ? 'active' : '')}
            onClick={() => setRoute(it.id)}
          >
            <Icon name={it.icon} size={15} />
            <span>{it.label}</span>
            {it.badge != null && it.badge > 0 ? <span className="badge num">{it.badge}</span> : <span />}
          </button>
        ))}
      </div>

      <div className="sidebar-section">{S.navOps2}</div>
      <div className="sidebar-nav">
        {[items[4]].map(it => (
          <button
            key={it.id}
            className={'nav-item ' + (route === it.id ? 'active' : '')}
            onClick={() => setRoute(it.id)}
          >
            <Icon name={it.icon} size={15} />
            <span>{it.label}</span>
            <span />
          </button>
        ))}
      </div>

      <div className="sidebar-foot">
        <div className="avatar">КП</div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontWeight: 500, fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {lang === 'en' ? 'P. Kolesnikov' : 'Колесников П.А.'}
          </div>
          <div className="muted" style={{ fontSize: 10 }}>
            {S.shift.split('·')[0].trim()}
          </div>
        </div>
      </div>
    </aside>
  );
}

// =======================================================
// Topbar
// =======================================================
function Topbar({ crumbs, actions, lang }) {
  return (
    <div className="topbar">
      <div className="crumbs">
        <Icon name="route" size={14} />
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="sep">/</span>}
            {i === crumbs.length - 1 ? <b>{c}</b> : <span>{c}</span>}
          </React.Fragment>
        ))}
      </div>
      <div className="topbar-spacer" />
      <div className="topbar-actions">
        {actions}
        <div className="sep-v" />
        <button className="icon-btn" title={lang === 'en' ? 'Search' : 'Поиск'}><Icon name="search" size={15} /></button>
        <button className="icon-btn" title={lang === 'en' ? 'Notifications' : 'Уведомления'}><Icon name="bell" size={15} /></button>
      </div>
    </div>
  );
}

// =======================================================
// Status pill helper
// =======================================================
function StatusPill({ status, lang }) {
  const dict = lang === 'en' ? window.MaršrutData.STATUS_LABEL_EN : window.MaršrutData.STATUS_LABEL_RU;
  const cls = status === 'done' ? 'done' : status === 'in_progress' ? 'prog' : 'wait';
  return <span className={'pill ' + cls}><span className="dot" />{dict[status]}</span>;
}

// =======================================================
// Dashboard
// =======================================================
function Dashboard({ data, tasks, scanLog, lang, onScan, onCloseTask, onNewOrder }) {
  const S = useStrings(lang);
  const order = data.orders[0];
  const items = order.items.map(it => {
    const det = data.details.find(d => d.id === it.detailId);
    const itemTasks = tasks.filter(t => t.orderId === order.id && t.detailId === it.detailId);
    const done = itemTasks.filter(t => t.status === 'done').length;
    return { ...it, det, tasks: itemTasks, done, total: itemTasks.length };
  });

  const allTasks = tasks.filter(t => t.orderId === order.id);
  const inProg = allTasks.filter(t => t.status === 'in_progress').length;
  const doneCt = allTasks.filter(t => t.status === 'done').length;
  const waitCt = allTasks.filter(t => t.status === 'waiting').length;
  const overdue = allTasks.filter(t => t.status === 'waiting' && t.opNum <= 40).length;
  const totalTime = allTasks.reduce((s, t) => s + t.time * t.planned, 0);
  const doneTime = allTasks.filter(t => t.status === 'done').reduce((s, t) => s + t.time * t.planned, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{S.navDash}</h1>
          <div className="page-sub">{S.workspace} · {S.shift}</div>
        </div>
        <div className="row">
          <button className="btn" onClick={onScan}><Icon name="qr" size={14} />{S.scanQR}</button>
          <button className="btn primary" onClick={onNewOrder}><Icon name="plus" size={14} />{S.newOrder}</button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 'var(--density-section-gap)' }}>
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
          <div className="kpi-meta">
            <span className="up">↑ +3</span>
            <span>· {lang === 'en' ? 'vs yesterday' : 'к вчера'}</span>
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{S.overdue}</div>
          <div className="kpi-value num">{overdue > 0 ? 1 : 0}<span className="unit">{lang === 'en' ? 'part' : 'дет.'}</span></div>
          <div className="kpi-meta">
            <span className="dn">{lang === 'en' ? 'check op. 60' : 'проверить оп. 60'}</span>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div>
          <div className="subhead" style={{ marginTop: 0 }}>
            {lang === 'en' ? 'Production board' : 'Производственное табло'} · {order.number}
          </div>
          {items.map(it => (
            <DetailBoardGroup
              key={it.detailId}
              detail={it.det}
              tasks={it.tasks}
              done={it.done}
              total={it.total}
              qty={it.quantity}
              lang={lang}
              onCloseTask={onCloseTask}
            />
          ))}
        </div>

        <div>
          <div className="subhead" style={{ marginTop: 0 }}>{S.recentScans}</div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {scanLog.length === 0 && <div className="empty-state" style={{ borderRadius: 0, border: 0 }}>—</div>}
            {scanLog.slice(0, 7).map((s, i) => (
              <div key={i} className="scan-log-row">
                <div className="ts">{s.ts.slice(-5)}</div>
                <div>
                  <div className="label">
                    <span className="mono" style={{ color: 'var(--accent)' }}>{('0' + (s.op?.split(' ')[0] || '')).slice(-3)} </span>
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
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="muted" style={{ fontSize: 11 }}>
                {S.created} {order.createdAt} · {S.dueDate} {order.dueDate}
              </span>
              <span className="mono num" style={{ fontSize: 11, color: 'var(--accent)' }}>
                {Math.round((doneTime / totalTime) * 100)}%
              </span>
            </div>
            <div className="board-progress" style={{ maxWidth: 'none', height: 8 }}>
              <div className="board-progress-fill" style={{ width: ((doneTime / totalTime) * 100) + '%' }} />
            </div>
            <div className="row" style={{ marginTop: 10, justifyContent: 'space-between', fontSize: 11 }}>
              <span className="muted">{lang === 'en' ? 'Spent' : 'Затрачено'}: <b className="num">{Math.round(doneTime/60)}{S.hr} {doneTime % 60}{S.min}</b></span>
              <span className="muted">{lang === 'en' ? 'Remaining' : 'Осталось'}: <b className="num">{Math.round((totalTime-doneTime)/60)}{S.hr}</b></span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function DetailBoardGroup({ detail, tasks, done, total, qty, lang, onCloseTask }) {
  const S = useStrings(lang);
  const pct = total > 0 ? (done / total) * 100 : 0;
  return (
    <div className="board-group">
      <div className="board-grp-head">
        <Icon name="box" size={16} className="muted" />
        <div>
          <div className="board-grp-title">{detail.name}</div>
          <div className="row" style={{ gap: 8, marginTop: 2 }}>
            <span className="board-grp-code">{detail.code}</span>
            <span className="muted" style={{ fontSize: 11 }}>{S.qtyShort}: <b className="num">{qty}</b> {S.pcs}</span>
            <span className="muted" style={{ fontSize: 11 }}>{detail.drawing}</span>
          </div>
        </div>
        <div className="board-progress">
          <div className="board-progress-fill" style={{ width: pct + '%' }} />
        </div>
        <span className="mono num" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{done}/{total}</span>
      </div>
      <div>
        {tasks.map(t => (
          <div key={t.id} className={'task-row ' + (t.status === 'done' ? 'done' : '')}>
            <div className="op-num">{String(t.opNum).padStart(3, '0')}</div>
            <div>
              <div className="task-name">{t.opName}</div>
              <div className="task-meta mono">{t.workCenter}</div>
            </div>
            <div className="qty-bar">
              <span className="num">{t.completed}/{t.planned}</span>
              <span className="bar"><span className="fill" style={{ width: (t.completed / t.planned) * 100 + '%' }} /></span>
            </div>
            <div style={{ textAlign: 'center', fontFamily: 'var(--mono-font)', fontSize: 11, color: 'var(--fg-2)' }}>
              {t.time}'
            </div>
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
function Library({ data, tasks, lang, onNewDetail }) {
  const S = useStrings(lang);
  const [selectedId, setSelectedId] = React.useState(data.details[0].id);
  const [query, setQuery] = React.useState('');
  const filtered = data.details.filter(d =>
    d.name.toLowerCase().includes(query.toLowerCase()) ||
    d.code.toLowerCase().includes(query.toLowerCase())
  );
  const detail = data.details.find(d => d.id === selectedId);
  const totalTime = detail.operations.reduce((s, o) => s + o.time, 0);
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
                <span><Icon name="cog" size={11} />{d.operations.length} {S.ops}</span>
                <span>·</span>
                <span><Icon name="clock" size={11} />{d.operations.reduce((s, o) => s + o.time, 0)}'</span>
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
            </div>
          </div>

          <div className="lib-stats">
            <div className="lib-stat">
              <div className="lib-stat-label">{S.opsTotal}</div>
              <div className="lib-stat-value num">{detail.operations.length}</div>
            </div>
            <div className="lib-stat">
              <div className="lib-stat-label">{S.estTime}</div>
              <div className="lib-stat-value num">{totalTime}<span className="unit">{S.noTime}</span></div>
            </div>
            <div className="lib-stat">
              <div className="lib-stat-label">{lang === 'en' ? 'Work centers' : 'Раб. центров'}</div>
              <div className="lib-stat-value num">{new Set(detail.operations.map(o => o.workCenter)).size}</div>
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
                {detail.operations.map(op => (
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

// =======================================================
// Order Builder
// =======================================================
function OrderBuilder({ data, tasks, lang, onPrint, onSave }) {
  const S = useStrings(lang);
  const order = data.orders[0];
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
    return s + (det ? det.operations.length : 0);
  }, 0);
  const totalTime = items.reduce((s, it) => {
    const det = data.details.find(d => d.id === it.detailId);
    if (!det) return s;
    return s + det.operations.reduce((ss, o) => ss + o.time, 0) * it.quantity;
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
          <button className="btn"><Icon name="trash" size={14} />{lang === 'en' ? 'Delete' : 'Удалить'}</button>
          <button className="btn" onClick={onSave}><Icon name="check" size={14} />{S.saveOrder}</button>
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
                      {det.operations.slice(0, 6).map(op => (
                        <span key={op.num} className="ops-tag">{String(op.num).padStart(2,'0')} {op.name.slice(0, 14)}</span>
                      ))}
                      {det.operations.length > 6 && <span className="ops-tag">+{det.operations.length - 6}</span>}
                    </div>
                  </div>
                  <div className="qty-stepper">
                    <button onClick={() => updateQty(idx, it.quantity - 1)}>−</button>
                    <input value={it.quantity} onChange={e => updateQty(idx, parseInt(e.target.value) || 1)} className="num" />
                    <button onClick={() => updateQty(idx, it.quantity + 1)}>+</button>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 11 }}>
                    <div className="num"><b>{det.operations.length * it.quantity}</b> <span className="muted">{S.ops}</span></div>
                    <div className="muted num">{det.operations.reduce((s, o) => s + o.time, 0) * it.quantity}{S.min}</div>
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
                  return s + (det ? det.operations.length * it.quantity : 0);
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

// =======================================================
// Route Sheet (printable preview)
// =======================================================
function RouteSheetView({ data, tasks, lang, qrSize, onClose, onScanQR }) {
  const S = useStrings(lang);
  const order = data.orders[0];
  const items = order.items.map(it => ({
    ...it,
    det: data.details.find(d => d.id === it.detailId),
    tasks: tasks.filter(t => t.orderId === order.id && t.detailId === it.detailId),
  }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{S.routesheet} {order.number}</h1>
          <div className="page-sub">{S.preview} · {lang === 'en' ? 'A4 portrait' : 'A4 книжная'} · {lang === 'en' ? 'QR module' : 'QR-модуль'} {qrSize}px</div>
        </div>
        <div className="row">
          <button className="btn ghost" onClick={onClose}><Icon name="arrow-left" size={14} />{lang === 'en' ? 'Back to order' : 'К заказу'}</button>
          <button className="btn" onClick={() => window.print()}><Icon name="print" size={14} />{S.printNow}</button>
          <button className="btn primary" onClick={onScanQR}><Icon name="scan" size={14} />{S.scanQR}</button>
        </div>
      </div>

      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <div className="routesheet">
          <div className="rs-head">
            <div>
              <div className="rs-title">{S.sheetTitle}</div>
              <div className="rs-number">№ {order.number}</div>
              <div style={{ fontSize: 11, color: '#5a5240', marginTop: 4 }}>{S.sheetSubtitle}</div>
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
                <div className="rs-detail-title">{idx + 1}. {it.det.name}</div>
                <div className="rs-detail-meta">
                  {it.det.code} · {S.qtyShort}: <b>{it.quantity}</b> {it.det.unit} · {it.det.drawing}
                </div>
              </div>
              <table className="rs-ops">
                <thead>
                  <tr>
                    <th style={{ width: 38 }}>№</th>
                    <th>{S.operation}</th>
                    <th style={{ width: 130 }}>{S.workCenter}</th>
                    <th style={{ width: 50 }}>{S.qtyShort}</th>
                    <th style={{ width: qrSize + 16 }}>{S.qrCode}</th>
                    <th style={{ width: 100 }}>{S.signatureCol}</th>
                  </tr>
                </thead>
                <tbody>
                  {it.tasks.map(t => (
                    <tr key={t.id}>
                      <td className="mono"><b>{String(t.opNum).padStart(3, '0')}</b></td>
                      <td><b>{t.opName}</b></td>
                      <td className="mono" style={{ fontSize: 10 }}>{t.workCenter}</td>
                      <td className="mono num"><b>{t.planned}</b></td>
                      <td className="qr-cell">
                        <QrCode text={t.qrText} size={qrSize} />
                        <div className="mono" style={{ fontSize: 7.5, color: '#7a715b', marginTop: 2 }}>{t.qrText}</div>
                      </td>
                      <td className="sign-cell" />
                    </tr>
                  ))}
                </tbody>
              </table>
            </React.Fragment>
          ))}

          <div className="rs-foot">
            <span>{S.signedBy} ________________________</span>
            <span>{S.date} ____________</span>
            <span className="mono">{order.number} · {new Date().toISOString().slice(0, 10)}</span>
          </div>
        </div>
      </div>
    </>
  );
}

// =======================================================
// Scan history page
// =======================================================
function HistoryView({ data, tasks, scanLog, lang }) {
  const S = useStrings(lang);
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{S.navHistory}</h1>
          <div className="page-sub">{lang === 'en' ? 'Audit trail of all QR scans' : 'Аудит всех сканирований QR-кодов'}</div>
        </div>
      </div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>{lang === 'en' ? 'Timestamp' : 'Время'}</th>
              <th>{S.qrCode}</th>
              <th>{S.detail}</th>
              <th>{S.operation}</th>
              <th>{S.operator}</th>
              <th>{S.qtyShort}</th>
              <th>{S.status}</th>
            </tr>
          </thead>
          <tbody>
            {scanLog.map((s, i) => (
              <tr key={i} className="row-hover">
                <td className="mono-col">{s.ts}</td>
                <td className="mono-col" style={{ color: 'var(--accent)' }}>{s.qr}</td>
                <td className="mono-col">{s.detail}</td>
                <td><b>{s.op}</b></td>
                <td>{s.operator}</td>
                <td className="num-col num">{s.quantity}</td>
                <td><span className="pill done"><Icon name="check" size={11} />{lang === 'en' ? 'closed' : 'закрыто'}</span></td>
              </tr>
            ))}
            {scanLog.length === 0 && (
              <tr><td colSpan="7"><div className="empty-state" style={{ background: 'transparent', border: 0 }}>—</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

Object.assign(window, {
  Sidebar, Topbar, Dashboard, Library, OrderBuilder, RouteSheetView, HistoryView,
  StatusPill, useStrings,
});

export { Sidebar, Topbar, StatusPill, Dashboard, DetailBoardGroup,
  Library, OrderBuilder, WorkCenterPreview, RouteSheetView, HistoryView };
