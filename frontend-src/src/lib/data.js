import React from 'react';

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

const STATUS_LABEL_RU = { waiting: 'Ожидает', in_progress: 'В работе', done: 'Выполнена' };
const STATUS_LABEL_EN = { waiting: 'Waiting', in_progress: 'In progress', done: 'Done' };
const ORDER_STATUS_RU = { plan: 'План', in_work: 'В работе', done: 'Выполнен' };
const ORDER_STATUS_EN = { plan: 'Plan', in_work: 'In progress', done: 'Done' };

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
        const ratio = idx / det.operations.length;
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



export { RU, EN };
