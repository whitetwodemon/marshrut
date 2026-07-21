// API data mappers

export function apiOrderToData(orders, details) {
  return {
    orders: orders.map(o => ({
      id: o.id, number: o.number, createdAt: o.created_at,
      dueDate: o.due_date, customer: o.customer, foreman: o.foreman,
      status: o.status, priority: o.priority, problemComment: o.problem_comment || null,
      items: (o.items || []).map(i => ({ detailId: i.detail_id, quantity: Number(i.quantity) })),
    })),
    details: details.map(d => ({
      id: d.id, code: d.code, name: d.name, material: d.material,
      unit: d.unit, drawing: d.drawing,
      operations: (d.operations || []).map(op => ({
        num: Number(op.num), name: op.name,
        workCenter: op.work_center || op.workCenter, time: Number(op.time_min || op.time),
        setupTime: Number(op.setup_time_min || 0),
      })),
    })),
  };
}

export function apiTasksToFrontend(tasks) {
  return tasks.map(t => ({
    id: t.id, orderId: t.order_id, detailId: t.detail_id,
    opNum: Number(t.op_num), opName: t.op_name, workCenter: t.work_center,
    time: Number(t.time_min), planned: Number(t.planned), completed: Number(t.completed),
    status: t.status, qrText: t.qr_text, operator: t.operator, updatedAt: t.updated_at,
    startedAt:   t.started_at,
    actualTime:   Number(t.actual_time_min || 0),
    queuePos:     Number(t.queue_pos || 0),
    note:         t.comment || "",
    setupTime:    Number(t.setup_time_min || 0),
    setupDone:    Number(t.setup_done || 0),
    setupStartedAt: t.setup_started_at,
    workshopId:   t.workshop_id,
    workCenterId: t.work_center_id,
  }));
}

export function apiScanLogToFrontend(logs) {
  return logs.map(l => ({
    ts: l.scanned_at ? l.scanned_at.slice(11, 16) : '',
    taskId: l.task_id, qr: l.qr_text, detail: l.detail_id,
    op: l.op_info, operator: l.operator, result: l.result, quantity: l.quantity,
    comment: l.comment, actualTime: l.actual_time_min,
  }));
}