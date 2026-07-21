import React from 'react'
import { Icon } from '../components/Icon.jsx'
import { NotificationBell } from '../components/NotificationBell.jsx';
import { BrunoCat } from '../components/BrunoCat.jsx';


// data.jsx — seed data, dictionaries, helpers

const RU = {
  details: [
    {
      id: 'D-001',
      code: 'ФЛ-100-08',
      name: 'Фланец воротниковый ДУ-100',
      material: 'Сталь 09Г2С, ГОСТ 33259-2015',
      unit: 'шт',
      drawing: 'ЧЛ.04.218-00',
      operations: [
        { num: 10, name: 'Заготовительная', workCenter: 'Гильотина Г-08', time: 4 },
        { num: 20, name: 'Токарная черновая', workCenter: 'ДИП-300 №3', time: 18 },
        { num: 30, name: 'Токарная чистовая', workCenter: 'ДИП-300 №3', time: 22 },
        { num: 40, name: 'Сверлильная (8 отв. ⌀18)', workCenter: '2А554 №2', time: 14 },
        { num: 50, name: 'Слесарная', workCenter: 'Верстак С-12', time: 8 },
        { num: 60, name: 'Термообработка', workCenter: 'Печь ТВЧ-40', time: 35 },
        { num: 70, name: 'Шлифовальная', workCenter: '3Б161 №1', time: 11 },
        { num: 80, name: 'Гальванопокрытие Zn', workCenter: 'Линия ГП-2', time: 28 },
        { num: 90, name: 'Маркировка', workCenter: 'Лазер Laser-08', time: 3 },
        { num: 100, name: 'Контроль ОТК', workCenter: 'ОТК пост-3', time: 6 },
      ],
    },
    {
      id: 'D-002',
      code: 'ВЛ-45-220',
      name: 'Вал шлицевой Z=8',
      material: 'Сталь 40Х, ТУ 14-1-3957-2020',
      unit: 'шт',
      drawing: 'ЧЛ.04.221-00',
      operations: [
        { num: 10, name: 'Заготовительная', workCenter: 'Ленточн. БПЛ-160', time: 6 },
        { num: 20, name: 'Токарная', workCenter: 'CKF-650', time: 32 },
        { num: 30, name: 'Фрезерная (шлицы)', workCenter: '6Р82Ш №2', time: 26 },
        { num: 40, name: 'Сверлильная (центр. отв.)', workCenter: '2С132 №1', time: 8 },
        { num: 50, name: 'Термообработка ТВЧ', workCenter: 'Печь ТВЧ-40', time: 40 },
        { num: 60, name: 'Шлифовальная', workCenter: '3У10А №2', time: 18 },
        { num: 70, name: 'Контроль ОТК', workCenter: 'ОТК пост-3', time: 5 },
      ],
    },
  ],
  // Single order with 2 details, as user requested.
  orders: [
    {
      id: 'O-001',
      number: 'ЗП-26-0142',
      createdAt: '2026-05-14',
      dueDate: '2026-05-22',
      customer: 'Цех №4 / узел СБ-04.218',
      foreman: 'Колесников П.А.',
      status: 'in_work',
      priority: 'normal',
      items: [
        { detailId: 'D-001', quantity: 5 },
        { detailId: 'D-002', quantity: 2 },
      ],
    },
  ],
};

const EN = {
  details: [
    {
      id: 'D-001',
      code: 'FL-100-08',
      name: 'Welding-neck flange DN-100',
      material: 'Steel 09G2S, ASTM A350',
      unit: 'pc',
      drawing: 'WO.04.218-00',
      operations: [
        { num: 10, name: 'Blanking', workCenter: 'Shear G-08', time: 4 },
        { num: 20, name: 'Rough turning', workCenter: 'Lathe DIP-300 №3', time: 18 },
        { num: 30, name: 'Finish turning', workCenter: 'Lathe DIP-300 №3', time: 22 },
        { num: 40, name: 'Drilling (8× ⌀18)', workCenter: 'Drill 2A554 №2', time: 14 },
        { num: 50, name: 'Bench work', workCenter: 'Bench S-12', time: 8 },
        { num: 60, name: 'Heat treatment', workCenter: 'Furnace TVCH-40', time: 35 },
        { num: 70, name: 'Grinding', workCenter: 'Grinder 3B161 №1', time: 11 },
        { num: 80, name: 'Zn plating', workCenter: 'Line GP-2', time: 28 },
        { num: 90, name: 'Marking', workCenter: 'Laser-08', time: 3 },
        { num: 100, name: 'QC inspection', workCenter: 'QC station-3', time: 6 },
      ],
    },
    {
      id: 'D-002',
      code: 'SH-45-220',
      name: 'Splined shaft Z=8',
      material: 'Steel 40Cr, TU 14-1-3957-2020',
      unit: 'pc',
      drawing: 'WO.04.221-00',
      operations: [
        { num: 10, name: 'Blanking', workCenter: 'Bandsaw BPL-160', time: 6 },
        { num: 20, name: 'Turning', workCenter: 'CKF-650', time: 32 },
        { num: 30, name: 'Spline milling', workCenter: '6R82Sh №2', time: 26 },
        { num: 40, name: 'Center drilling', workCenter: '2S132 №1', time: 8 },
        { num: 50, name: 'TVCH treatment', workCenter: 'Furnace TVCH-40', time: 40 },
        { num: 60, name: 'Grinding', workCenter: '3U10A №2', time: 18 },
        { num: 70, name: 'QC inspection', workCenter: 'QC station-3', time: 5 },
      ],
    },
  ],
  orders: [
    {
      id: 'O-001',
      number: 'WO-26-0142',
      createdAt: '2026-05-14',
      dueDate: '2026-05-22',
      customer: 'Shop №4 / assy SB-04.218',
      foreman: 'P. Kolesnikov',
      status: 'in_work',
      priority: 'normal',
      items: [
        { detailId: 'D-001', quantity: 5 },
        { detailId: 'D-002', quantity: 2 },
      ],
    },
  ],
};

const STATUS_LABEL_RU = { waiting: 'Ожидает', in_progress: 'В работе', done: 'Выполнена', paused: 'Пауза', rejected: 'Брак', rework: 'Переделка' };
const STATUS_LABEL_EN = { waiting: 'Waiting', in_progress: 'In progress', done: 'Done', paused: 'Paused', rejected: 'Rejected', rework: 'Rework' };
const ORDER_STATUS_RU = {
  draft: 'Черновик',
  problem: '⚠ Проблема',
  plan: 'Планируется',
  waiting_material: 'Ждём материал',
  waiting_equipment: 'Ждём оборудование',
  waiting_approval: 'Ждём согласование',
  in_work: 'В работе',
  paused: 'Приостановлен',
  done: 'Выполнен',
  shipped: '📦 Отгружен',
  archived: '🗄 Архив',
  cancelled: 'Отменён',
};
const ORDER_STATUS_EN = { draft:'Draft', problem:'⚠ Problem', plan:'Plan', waiting_material:'Waiting material', waiting_equipment:'Waiting equipment', waiting_approval:'Waiting approval', in_work:'In progress', paused:'Paused', done:'Done', shipped:'📦 Shipped', archived:'🗄 Archive', cancelled:'Cancelled' };

// Build operation_tasks from orders × items × operations.
// Pre-seeds plausible progress so the dashboard isn't empty.
function buildTasks(orders, details) {
  const tasks = [];
  for (const order of orders) {
    for (const item of order.items) {
      const det = details.find(d => d.id === item.detailId);
      if (!det) continue;
      det.operations.forEach((op, idx) => {
        // Demo seeding logic: first few ops done, then progress, then waiting
        let completed = 0;
        let status = 'waiting';
        let updatedAt = null;
        let operator = null;
        const ratio = idx / (det.operations||[]).length;
        if (ratio < 0.3) {
          completed = item.quantity;
          status = 'done';
          updatedAt = `2026-05-${15 + Math.min(idx, 4)} ${10 + idx}:${idx < 5 ? '04' : '32'}`;
          operator = pickOperator(det.id, idx);
        } else if (ratio < 0.45) {
          completed = Math.max(1, Math.floor(item.quantity * 0.6));
          status = 'in_progress';
          updatedAt = `2026-05-19 14:${20 + idx}`;
          operator = pickOperator(det.id, idx);
        }
        tasks.push({
          id: `OT-${order.id.slice(2)}-${det.id.slice(2)}-${op.num}`,
          orderId: order.id,
          detailId: det.id,
          opNum: op.num,
          opName: op.name,
          workCenter: op.workCenter,
          time: op.time,
          planned: item.quantity,
          completed,
          status,
          qrText: `OTASK:${order.id.slice(2)}-${det.id.slice(2)}-${op.num}`,
          updatedAt,
          operator,
        });
      });
    }
  }
  return tasks;
}

const OPERATORS_RU = ['Семёнов И.Н.', 'Гаврилов А.Б.', 'Маркина Е.В.', 'Орлов Д.С.', 'Петрова Н.А.', 'Юсупов Р.Ш.'];
const OPERATORS_EN = ['I. Semyonov', 'A. Gavrilov', 'E. Markina', 'D. Orlov', 'N. Petrova', 'R. Yusupov'];
function pickOperator(seed, idx) {
  const ops = window.__APP_LANG === 'en' ? OPERATORS_EN : OPERATORS_RU;
  const hash = (seed.charCodeAt(2) + idx * 7) % ops.length;
  return ops[hash];
}

// Pre-built sample scan log entries (for showing what audit looks like)
function buildScanLog(tasks) {
  const log = [];
  const doneTasks = tasks.filter(t => t.status === 'done').slice(0, 6);
  doneTasks.forEach((t, i) => {
    log.push({
      ts: t.updatedAt || `2026-05-1${5 + i} 09:${10 + i * 7}`,
      taskId: t.id,
      qr: t.qrText,
      detail: t.detailId,
      op: `${t.opNum} ${t.opName}`,
      operator: t.operator,
      result: 'closed',
      quantity: t.planned,
    });
  });
  return log.reverse();
}

window.MaršrutData = { RU, EN, STATUS_LABEL_RU, STATUS_LABEL_EN, ORDER_STATUS_RU, ORDER_STATUS_EN, buildTasks, buildScanLog };

  
  
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
  navScan: 'Сканер',
  navHistory: 'Журнал сканирований',
  navReport: 'Отчёт по заказам',
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
  navReport: 'Orders report',
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
function Sidebar({ route, setRoute, lang, counts, settings = {} }) {
  const S = useStrings(lang);
  const items = [
    { id: 'dashboard',      label: S.navDash,          icon: 'gauge',   badge: counts.inProgress },
    { id: 'orders',         label: S.navOrders,         icon: 'orders',  badge: counts.orders },
    { id: 'orders-list',    label: 'Все заказы',        icon: 'list' },
    { id: 'specifications', label: 'Спецификация',      icon: 'library' },
    { id: 'work-centers',   label: 'Рабочие центры',    icon: 'building' },
    { id: 'library',        label: S.navLibrary,        icon: 'library' },
    { id: 'scanner',        label: S.navScan,           icon: 'scan' },
    { id: 'history',        label: S.navHistory,        icon: 'history' },
    { id: 'shift-history',  label: 'История смен',       icon: 'clock' },
    { id: 'history-orders', label: 'История заказов',   icon: 'archive' },
    ...(settings.feature_analytics === '1' ? [{ id: 'analytics', label: 'Аналитика цеха', icon: 'gauge' }] : []),
    ...(settings.feature_tech_prep === '1' ? [
      { id: 'tech-prep',  label: 'Техподготовка',  icon: 'route' },
      { id: 'warehouse',  label: 'Склад ЧПУ',      icon: 'box' },
    ] : []),
    { id: 'report',         label: S.navReport,         icon: 'chart' },
    { id: 'excel',          label: 'Выгрузки Excel',     icon: 'table' },
    { id: 'integrations',   label: 'Интеграции',        icon: 'link' },
    { id: 'wiki',           label: 'Справка',             icon: 'library' },
  ];
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="brand-mark">М</div>
        <div>
          <div className="brand-name">{lang === 'en' ? 'Маршрут' : 'Маршрут'}</div>
          <div className="brand-sub" style={{ display:'flex', alignItems:'center', gap:6 }}>v 3.2 · build 0629 <BrunoCat size={16}/></div>
        </div>
      </div>

      <div className="sidebar-section">{S.navOps}</div>
      <div className="sidebar-nav">
        {items.slice(0, 7).map(it => (
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

      <div className="sidebar-section">Аналитика</div>
      <div className="sidebar-nav">
        {items.slice(7).map(it => (
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
      {/* Заголовок для мобильного (crumbs скрыты) */}
      <span className="topbar-title" style={{ display:'none' }}>
        {crumbs[crumbs.length - 1] || 'Маршрут'}
      </span>
      <div className="topbar-spacer" />
      <div className="topbar-actions" style={{ display:'flex',alignItems:'center',gap:6 }}>
        <NotificationBell />
        {actions}
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
// =======================================================
// OrderPicker — умный список заказов с поиском и фильтром
// =======================================================
function OrderPicker({ orders, activeId, onSelect, onNew, lang }) {
  const [query,     setQuery]  = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [open, setOpen]        = React.useState(false);

  const STATUS_LBL  = { plan:'Планируется', in_work:'В работе', done:'Выполнен', problem:'⚠ Проблема', shipped:'📦 Отгружен', archived:'🗄 Архив', paused:'Приостановлен', cancelled:'Отменён' };
  const STATUS_CLS  = { plan:'wait', in_work:'prog', done:'done', problem:'prob', shipped:'done', archived:'done', paused:'wait', cancelled:'wait' };
  const PRIORITY_LBL = { high:'Высокий', normal:'Нормальный', low:'Низкий' };
  const PRIORITY_COLOR = { high:'var(--danger)', normal:'var(--fg-2)', low:'var(--fg-3)' };

  const active = orders.find(o => o.id === activeId) || orders[0];

  const filtered = orders.filter(o => {
    const q = query.toLowerCase();
    const matchQ = !q ||
      o.number.toLowerCase().includes(q) ||
      (o.customer||'').toLowerCase().includes(q) ||
      (o.foreman||'').toLowerCase().includes(q);
    const matchS = statusFilter === 'all' || o.status === statusFilter;
    return matchQ && matchS;
  });

  // Закрываем при клике вне
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const inWork = orders.filter(o => o.status === 'in_work').length;
  const inPlan = orders.filter(o => o.status === 'plan').length;

  return (
    <div ref={ref} style={{ position:'relative', marginBottom:12 }}>
      {/* Кнопка-триггер */}
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <button onClick={() => setOpen(!open)}
          style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px',
            background:'var(--bg-1)', border:'1px solid var(--line-1)', borderRadius:10,
            cursor:'pointer', fontFamily:'var(--ui-font)', fontSize:13, fontWeight:500,
            color:'var(--fg-0)', transition:'all .15s', flex:1, maxWidth:400,
            boxShadow: open ? '0 0 0 2px var(--accent)' : 'none' }}>
          <Icon name="file" size={15} style={{ color:'var(--accent)', flexShrink:0 }}/>
          <span className="mono" style={{ color:'var(--accent)', fontWeight:700 }}>
            {active?.number || '—'}
          </span>
          <span style={{ color:'var(--fg-1)', fontSize:12, flex:1, textAlign:'left',
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {active?.customer}
          </span>
          {active && (
            <span className={'pill ' + STATUS_CLS[active.status]} style={{ fontSize:10, flexShrink:0 }}>
              <span className="dot"/>{STATUS_LBL[active.status]}
            </span>
          )}
          <span style={{ color:'var(--fg-2)', fontSize:11, flexShrink:0 }}>
            {orders.length} {lang === 'en' ? 'orders' : 'зак.'}
          </span>
          <Icon name="chevron-down" size={14} style={{ color:'var(--fg-2)', flexShrink:0,
            transform: open ? 'rotate(180deg)' : 'none', transition:'transform .2s' }}/>
        </button>
        <button className="btn primary" onClick={onNew} style={{ flexShrink:0 }}>
          <Icon name="plus" size={14}/>{lang === 'en' ? 'New' : 'Новый'}
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="order-picker-dropdown" style={{ position:'absolute', top:'calc(100% + 6px)', left:0, right:0, maxWidth:600,
          background:'var(--bg-1)', border:'1px solid var(--line-1)', borderRadius:12,
          boxShadow:'0 8px 32px rgba(0,0,0,.18)', zIndex:200, overflow:'hidden' }}>

          {/* Поиск + фильтры */}
          <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--line-2)',
            display:'flex', gap:8, alignItems:'center' }}>
            <div style={{ position:'relative', flex:1 }}>
              <Icon name="search" size={13} style={{ position:'absolute', left:9,
                top:'50%', transform:'translateY(-50%)', color:'var(--fg-2)' }}/>
              <input className="input" autoFocus
                placeholder={lang === 'en' ? 'Search orders…' : 'Поиск по номеру или клиенту…'}
                value={query} onChange={e => setQuery(e.target.value)}
                style={{ paddingLeft:28, fontSize:12, height:30 }}/>
            </div>
            <div style={{ display:'flex', gap:4 }}>
              {[['all','Все'], ['in_work','В работе'], ['plan','Планируется'], ['done','Выполнен']].map(([v,l]) => (
                <button key={v} onClick={() => setStatusFilter(v)}
                  style={{ padding:'4px 10px', borderRadius:6, border:'1px solid',
                    fontSize:11, cursor:'pointer', fontFamily:'var(--ui-font)',
                    background: statusFilter === v ? 'var(--accent)' : 'transparent',
                    borderColor: statusFilter === v ? 'var(--accent)' : 'var(--line-1)',
                    color: statusFilter === v ? '#fff' : 'var(--fg-1)',
                    whiteSpace:'nowrap' }}>
                  {l}
                  {v !== 'all' && (
                    <span style={{ marginLeft:4, opacity:.7 }}>
                      {v === 'in_work' ? inWork : v === 'plan' ? inPlan : orders.filter(o=>o.status===v).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Список */}
          <div style={{ maxHeight:320, overflowY:'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding:24, textAlign:'center', color:'var(--fg-2)', fontSize:13 }}>
                {lang === 'en' ? 'No orders found' : 'Заказы не найдены'}
              </div>
            ) : filtered.map(o => (
              <div key={o.id} onClick={() => { onSelect(o.id); setOpen(false); }}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
                  cursor:'pointer', borderBottom:'1px solid var(--line-2)',
                  background: o.id === activeId ? 'var(--bg-hover)' : 'transparent',
                  transition:'background .1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = o.id === activeId ? 'var(--bg-hover)' : 'transparent'}>
                {/* Цветная метка статуса */}
                <div style={{ width:3, height:36, borderRadius:2, flexShrink:0,
                  background: o.status==='done' ? 'var(--st-done-line)' :
                               o.status==='in_work' ? 'var(--st-prog-line)' : 'var(--st-wait-line)' }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span className="mono" style={{ fontWeight:700, color:'var(--accent)', fontSize:13 }}>
                      {o.number}
                    </span>
                    {o.id === activeId && (
                      <span style={{ fontSize:10, color:'var(--accent)', fontWeight:600 }}>← активный</span>
                    )}
                  </div>
                  <div style={{ fontSize:12, color:'var(--fg-1)', marginTop:1,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {o.customer}
                    {o.foreman && <span style={{ color:'var(--fg-2)' }}> · {o.foreman}</span>}
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:11, color: PRIORITY_COLOR[o.priority] || 'var(--fg-2)' }}>
                    {PRIORITY_LBL[o.priority] || ''}
                  </div>
                  <div style={{ fontSize:11, color:'var(--fg-2)', marginTop:2 }}>
                    {o.dueDate || o.due_date}
                  </div>
                </div>
                <span className={'pill ' + STATUS_CLS[o.status]} style={{ fontSize:10, flexShrink:0 }}>
                  <span className="dot"/>{STATUS_LBL[o.status]}
                </span>
              </div>
            ))}
          </div>

          {/* Футер */}
          <div style={{ padding:'8px 14px', borderTop:'1px solid var(--line-2)',
            display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--fg-2)' }}>
            <span>{filtered.length} из {orders.length} заказов</span>
            <span>{inWork} в работе · {inPlan} планируется</span>
          </div>
        </div>
      )}
    </div>
  );
}

export { RU, EN, STATUS_LABEL_RU, STATUS_LABEL_EN, ORDER_STATUS_RU, ORDER_STATUS_EN, OPERATORS_RU, OPERATORS_EN, T, STR_RU, STR_EN, buildTasks, pickOperator, buildScanLog, useStrings, Sidebar, Topbar, StatusPill, OrderPicker }
