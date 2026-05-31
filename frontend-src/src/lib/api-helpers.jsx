/**
 * api-helpers.jsx — Маппинг данных API → формат фронтенда
 *
 * Изолирует знание о структуре API от компонентов.
 * Если бэкенд переименует поле — правим только здесь.
 *
 * Правила маппинга:
 * - snake_case (API) → camelCase (frontend)
 * - Числовые строки → числа (Number())
 * - null/undefined → разумные дефолты
 * - Операции сортируются по номеру
 */

/**
 * Преобразовать данные заказов и деталей из API в формат фронтенда.
 *
 * @param {Array} orders  - массив заказов из GET /api/orders
 * @param {Array} details - массив деталей из GET /api/details
 * @returns {{ orders: Array, details: Array }}
 */
export function apiOrderToData(orders, details) {
  const mappedDetails = details.map(mapDetail);

  return {
    orders:  orders.map(o => mapOrder(o, mappedDetails)),
    details: mappedDetails,
  };
}

/**
 * Преобразовать один заказ из API.
 * @private
 */
function mapOrder(o, details) {
  return {
    id:         o.id,
    number:     o.number,
    orderType:  o.order_type || 'W',     // W=Заказ, D=Доработка, K=Кооперация
    createdAt:  o.created_at,
    dueDate:    o.due_date,
    customer:   o.customer,
    foreman:    o.foreman,
    status:     o.status,
    priority:   o.priority   || 'normal',
    workshopId: o.workshop_id,
    comment:    o.comment,
    updatedAt:  o.updated_at,
    // Позиции заказа с привязкой к деталям
    items: (o.items || []).map(it => ({
      detailId: it.detail_id,
      quantity: Number(it.quantity),
      det:      details.find(d => d.id === it.detail_id) || null,
    })),
  };
}

/**
 * Преобразовать одну деталь из API.
 * @private
 */
function mapDetail(d) {
  return {
    id:       d.id,
    code:     d.code,
    name:     d.name,
    material: d.material,
    unit:     d.unit || 'шт',
    drawing:  d.drawing,
    // Операции сортируем по номеру чтобы гарантировать правильный порядок
    operations: (d.operations || [])
      .sort((a, b) => Number(a.num) - Number(b.num))
      .map(op => ({
        num:        Number(op.num),
        name:       op.name,
        workCenter: op.work_center || op.workCenter,
        time:       Number(op.time_min || op.time || 0),
      })),
  };
}

/**
 * Преобразовать массив заданий из API в формат фронтенда.
 *
 * @param {Array} tasks - массив из GET /api/tasks
 * @returns {Array} задания в формате фронтенда
 */
export function apiTasksToFrontend(tasks) {
  return tasks.map(t => ({
    id:           t.id,
    orderId:      t.order_id,
    detailId:     t.detail_id,
    opNum:        Number(t.op_num),
    opName:       t.op_name,
    workCenter:   t.work_center,
    workCenterId: t.work_center_id,       // FK на work_centers.id
    time:         Number(t.time_min || t.time || 0),
    planned:      Number(t.planned   || 0),
    completed:    Number(t.completed || 0),
    status:       t.status,               // waiting|in_progress|done|paused|rejected|rework
    operator:     t.operator,
    startedAt:    t.started_at,           // ISO timestamp или null
    actualTime:      t.actual_time_min    ? Number(t.actual_time_min)    : null,
    accumulatedTime: t.accumulated_time ? Number(t.accumulated_time) : 0,
    qrText:       t.qr_text || t.qrText,  // QR код для сканирования
    updatedAt:    t.updated_at,
  }));
}

/**
 * Преобразовать журнал сканирований из API.
 *
 * @param {Array} log - массив из GET /api/scan-log
 * @returns {Array} записи журнала в формате фронтенда
 */
export function apiScanLogToFrontend(log) {
  return log.map(l => ({
    taskId:     l.task_id,
    qrText:     l.qr_text,
    detail:     l.detail_id,
    op:         l.op_info,           // строка "010 Токарная"
    operator:   l.operator,
    quantity:   l.quantity,
    batchNum:   l.batch_num ? Number(l.batch_num) : 1,  // номер партии (для частичной сдачи)
    ts:         l.scanned_at,        // ISO timestamp
    comment:    l.comment,
    actualTime: l.actual_time_min ? Number(l.actual_time_min) : null,
  }));
}
