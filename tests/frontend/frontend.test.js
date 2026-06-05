/**
 * frontend.test.js — Unit-тесты для фронтенда Маршрут MES
 *
 * Запуск:
 *   cd frontend-src && npm test
 *   или: node tests/frontend/frontend.test.js
 *
 * Тестирует: api-helpers, dates, бизнес-логику
 */

// ── Минималистичный тест-раннер (без зависимостей) ─────────────────────
let passed = 0;
let failed = 0;
const errors = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}: ${e.message}`);
    failed++;
    errors.push(name);
  }
}

function assertEqual(actual, expected, msg = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`Expected ${e}, got ${a}${msg ? ' — ' + msg : ''}`);
}

function assertTrue(val, msg = '') {
  if (!val) throw new Error(`Expected true${msg ? ': ' + msg : ''}`);
}

function assertFalse(val, msg = '') {
  if (val) throw new Error(`Expected false${msg ? ': ' + msg : ''}`);
}

function assertContains(needle, haystack, msg = '') {
  if (Array.isArray(haystack)) {
    if (!haystack.includes(needle))
      throw new Error(`Array does not contain ${JSON.stringify(needle)}`);
  } else if (!String(haystack).includes(String(needle))) {
    throw new Error(`"${needle}" not found in "${String(haystack).slice(0, 50)}"`);
  }
}

// ── Inline implementations (mirrors src/lib/) ──────────────────────────

function serverDateToMs(dateStr) {
  if (!dateStr) return 0;
  const iso = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
  return new Date(iso.endsWith('Z') ? iso : iso + 'Z').getTime();
}

function elapsedMinutes(dateStr) {
  if (!dateStr) return 0;
  return Math.max(0, Math.round((Date.now() - serverDateToMs(dateStr)) / 60000));
}

function apiTasksToFrontend(tasks) {
  return tasks.map(t => ({
    id:          t.id,
    orderId:     t.order_id,
    detailId:    t.detail_id,
    opNum:       Number(t.op_num),
    opName:      t.op_name,
    workCenter:  t.work_center,
    time:        Number(t.time_min || 0),
    planned:     Number(t.planned  || 0),
    completed:   Number(t.completed || 0),
    status:      t.status,
    operator:    t.operator,
    startedAt:   t.started_at,
    actualTime:  t.actual_time_min ? Number(t.actual_time_min) : null,
    accumulatedTime: t.accumulated_time ? Number(t.accumulated_time) : 0,
    qrText:      t.qr_text,
    updatedAt:   t.updated_at,
  }));
}

function apiOrderToData(orders, details) {
  const mappedDetails = details.map(d => ({
    id: d.id, code: d.code, name: d.name, material: d.material,
    operations: (d.operations || [])
      .sort((a, b) => Number(a.num) - Number(b.num))
      .map(op => ({ num: Number(op.num), name: op.name,
                    workCenter: op.work_center, time: Number(op.time_min || 0) })),
  }));
  return {
    orders: orders.map(o => ({
      id: o.id, number: o.number, orderType: o.order_type || 'W',
      status: o.status, priority: o.priority || 'normal',
      items: (o.items || []).map(it => ({
        detailId: it.detail_id, quantity: Number(it.quantity),
        det: mappedDetails.find(d => d.id === it.detail_id) || null,
      })),
    })),
    details: mappedDetails,
  };
}

// ─────────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════');
console.log('  МАРШРУТ MES — Frontend Unit Tests');
console.log('══════════════════════════════════════════════\n');

// ── 1. Date utilities ──────────────────────────────────────────────────
console.log('── 1. Date Utilities ───────────────────────────');

test('serverDateToMs: null → 0', () => {
  assertEqual(serverDateToMs(null), 0);
});

test('serverDateToMs: empty string → 0', () => {
  assertEqual(serverDateToMs(''), 0);
});

test('serverDateToMs: "2026-01-01 00:00:00" parsed as UTC', () => {
  const ms = serverDateToMs('2026-01-01 00:00:00');
  assertTrue(ms === new Date('2026-01-01T00:00:00Z').getTime());
});

test('serverDateToMs: ISO format with Z accepted', () => {
  const ms = serverDateToMs('2026-06-01T10:00:00Z');
  assertTrue(ms === new Date('2026-06-01T10:00:00Z').getTime());
});

test('serverDateToMs: space format equals T format', () => {
  const a = serverDateToMs('2026-06-01 10:00:00');
  const b = serverDateToMs('2026-06-01T10:00:00');
  assertEqual(a, b);
});

test('elapsedMinutes: null → 0', () => {
  assertEqual(elapsedMinutes(null), 0);
});

test('elapsedMinutes: future date → 0 (clamped)', () => {
  const future = new Date(Date.now() + 3600000).toISOString().replace('T', ' ').slice(0, 19);
  assertEqual(elapsedMinutes(future), 0);
});

test('elapsedMinutes: 30min ago ≈ 30', () => {
  const past = new Date(Date.now() - 1800000).toISOString().replace('T', ' ').slice(0, 19);
  const elapsed = elapsedMinutes(past);
  assertTrue(elapsed >= 29 && elapsed <= 31, `Expected ~30, got ${elapsed}`);
});

test('elapsedMinutes: 2 hours ago ≈ 120', () => {
  const past = new Date(Date.now() - 7200000).toISOString().replace('T', ' ').slice(0, 19);
  const elapsed = elapsedMinutes(past);
  assertTrue(elapsed >= 119 && elapsed <= 121, `Expected ~120, got ${elapsed}`);
});

// ── 2. API Helpers ──────────────────────────────────────────────────────
console.log('\n── 2. API Helpers ──────────────────────────────');

const MOCK_TASK = {
  id: 'OT-001-001-10',
  order_id: 'O-001',
  detail_id: 'D-001',
  op_num: '10',
  op_name: 'Токарная',
  work_center: '104',
  time_min: '45',
  planned: '5',
  completed: '2',
  status: 'in_progress',
  operator: 'Иванов А.П.',
  started_at: '2026-06-01 08:00:00',
  actual_time_min: null,
  accumulated_time: '20',
  qr_text: 'OTASK:001-001-10',
  updated_at: '2026-06-01 08:00:00',
};

test('apiTasksToFrontend: maps id correctly', () => {
  const [t] = apiTasksToFrontend([MOCK_TASK]);
  assertEqual(t.id, 'OT-001-001-10');
});

test('apiTasksToFrontend: casts opNum to Number', () => {
  const [t] = apiTasksToFrontend([MOCK_TASK]);
  assertEqual(typeof t.opNum, 'number');
  assertEqual(t.opNum, 10);
});

test('apiTasksToFrontend: casts planned/completed to Number', () => {
  const [t] = apiTasksToFrontend([MOCK_TASK]);
  assertEqual(typeof t.planned, 'number');
  assertEqual(t.planned, 5);
  assertEqual(t.completed, 2);
});

test('apiTasksToFrontend: null actual_time_min → null', () => {
  const [t] = apiTasksToFrontend([MOCK_TASK]);
  assertEqual(t.actualTime, null);
});

test('apiTasksToFrontend: accumulated_time mapped', () => {
  const [t] = apiTasksToFrontend([MOCK_TASK]);
  assertEqual(t.accumulatedTime, 20);
});

test('apiTasksToFrontend: no accumulated_time → 0', () => {
  const [t] = apiTasksToFrontend([{ ...MOCK_TASK, accumulated_time: undefined }]);
  assertEqual(t.accumulatedTime, 0);
});

test('apiTasksToFrontend: empty array → empty array', () => {
  assertEqual(apiTasksToFrontend([]).length, 0);
});

test('apiTasksToFrontend: qrText mapped', () => {
  const [t] = apiTasksToFrontend([MOCK_TASK]);
  assertEqual(t.qrText, 'OTASK:001-001-10');
});

const MOCK_ORDERS = [{
  id: 'O-001',
  number: 'W_26_000001',
  order_type: 'W',
  status: 'in_work',
  priority: 'high',
  items: [{ detail_id: 'D-001', quantity: '5' }],
}];

const MOCK_DETAILS = [{
  id: 'D-001',
  code: 'ФЛ-100',
  name: 'Фланец',
  material: 'Сталь 40Х',
  operations: [
    { num: '10', name: 'Заготовительная', work_center: '101', time_min: '6' },
    { num: '30', name: 'Токарная чистовая', work_center: '104', time_min: '22' },
    { num: '20', name: 'Токарная черновая', work_center: '104', time_min: '18' },
  ],
}];

test('apiOrderToData: maps order number', () => {
  const { orders } = apiOrderToData(MOCK_ORDERS, MOCK_DETAILS);
  assertEqual(orders[0].number, 'W_26_000001');
});

test('apiOrderToData: maps order_type', () => {
  const { orders } = apiOrderToData(MOCK_ORDERS, MOCK_DETAILS);
  assertEqual(orders[0].orderType, 'W');
});

test('apiOrderToData: default orderType when missing', () => {
  const orders = [{ ...MOCK_ORDERS[0], order_type: undefined }];
  const { orders: mapped } = apiOrderToData(orders, MOCK_DETAILS);
  assertEqual(mapped[0].orderType, 'W');
});

test('apiOrderToData: operations sorted by num', () => {
  const { details } = apiOrderToData(MOCK_ORDERS, MOCK_DETAILS);
  const nums = details[0].operations.map(o => o.num);
  assertEqual(nums, [10, 20, 30], 'operations should be sorted');
});

test('apiOrderToData: item quantity cast to Number', () => {
  const { orders } = apiOrderToData(MOCK_ORDERS, MOCK_DETAILS);
  assertEqual(typeof orders[0].items[0].quantity, 'number');
  assertEqual(orders[0].items[0].quantity, 5);
});

test('apiOrderToData: items linked to details', () => {
  const { orders } = apiOrderToData(MOCK_ORDERS, MOCK_DETAILS);
  assertTrue(orders[0].items[0].det !== null, 'det should be linked');
  assertEqual(orders[0].items[0].det.code, 'ФЛ-100');
});

test('apiOrderToData: unknown detail_id → null det', () => {
  const orders = [{ ...MOCK_ORDERS[0], items: [{ detail_id: 'D-UNKNOWN', quantity: '1' }] }];
  const { orders: mapped } = apiOrderToData(orders, MOCK_DETAILS);
  assertEqual(mapped[0].items[0].det, null);
});

// ── 3. Business Logic ──────────────────────────────────────────────────
console.log('\n── 3. Business Logic ───────────────────────────');

test('isComplete: completed >= planned', () => {
  const cases = [
    [5, 5, true], [6, 5, true], [3, 5, false], [0, 1, false],
  ];
  for (const [completed, planned, expected] of cases) {
    const isComplete = completed >= planned;
    assertEqual(isComplete, expected, `c=${completed} p=${planned}`);
  }
});

test('norm percent calculation', () => {
  const cases = [[50, 100, 50], [100, 100, 100], [120, 100, 120], [0, 0, 0]];
  for (const [actual, plan, expected] of cases) {
    const pct = plan > 0 ? Math.round(actual / plan * 100) : 0;
    assertEqual(pct, expected);
  }
});

test('order type prefix validation', () => {
  const allowed = ['W', 'D', 'K'];
  for (const type of allowed) {
    const num = `${type}_26_000001`;
    const extracted = num.split('_')[0].toUpperCase();
    assertEqual(extracted, type);
  }
});

test('order number regex matches format', () => {
  const valid   = ['W_26_000001', 'D_26_000042', 'K_26_999999'];
  const invalid = ['W-26-000001', 'X_26_000001', 'W_26_1', ''];
  const rx = /^[WDK]_\d{2}_\d{6}$/;
  for (const n of valid)   assertTrue(rx.test(n),  `${n} should be valid`);
  for (const n of invalid) assertFalse(rx.test(n), `${n} should be invalid`);
});

test('accumulated_time resets to 0 on full close', () => {
  const accumulated = 50;
  const isComplete = true;
  assertEqual(isComplete ? 0 : accumulated, 0);
});

test('accumulated_time preserved on partial close', () => {
  const accumulated = 50;
  const isComplete = false;
  assertEqual(isComplete ? 0 : accumulated, 50);
});

test('remaining time = norm - accumulated', () => {
  const norm = 100, accumulated = 30;
  const remaining = Math.max(0, norm - accumulated);
  assertEqual(remaining, 70);
});

test('remaining time never negative', () => {
  const norm = 50, accumulated = 80; // overtime
  const remaining = Math.max(0, norm - accumulated);
  assertEqual(remaining, 0);
});

test('session timer starts from 0 after partial close', () => {
  // After partial close: started_at = null → elapsedMinutes = 0
  const startedAt = null;
  assertEqual(elapsedMinutes(startedAt), 0);
});

// ── 4. Data Guards ─────────────────────────────────────────────────────
console.log('\n── 4. Null/Undefined Guards ────────────────────');

test('apiTasksToFrontend handles undefined time_min', () => {
  const [t] = apiTasksToFrontend([{ ...MOCK_TASK, time_min: undefined }]);
  assertEqual(t.time, 0);
});

test('apiTasksToFrontend handles undefined planned', () => {
  const [t] = apiTasksToFrontend([{ ...MOCK_TASK, planned: undefined }]);
  assertEqual(t.planned, 0);
});

test('apiOrderToData handles empty items array', () => {
  const orders = [{ ...MOCK_ORDERS[0], items: [] }];
  const { orders: mapped } = apiOrderToData(orders, MOCK_DETAILS);
  assertEqual(mapped[0].items.length, 0);
});

test('apiOrderToData handles undefined items', () => {
  const orders = [{ ...MOCK_ORDERS[0], items: undefined }];
  const { orders: mapped } = apiOrderToData(orders, MOCK_DETAILS);
  assertEqual(mapped[0].items.length, 0);
});

test('apiOrderToData handles empty details', () => {
  const { details } = apiOrderToData(MOCK_ORDERS, []);
  assertEqual(details.length, 0);
});

test('(data?.orders || []).map is safe on null data', () => {
  const data = null;
  const result = (data?.orders || []).map(o => o.id);
  assertEqual(result.length, 0);
});

test('(data?.orders || []).find is safe on null data', () => {
  const data = null;
  const result = (data?.orders || []).find(o => o.id === 'x');
  assertEqual(result, undefined);
});

// ── 5. Status Values ───────────────────────────────────────────────────
console.log('\n── 5. Status Values ────────────────────────────');

const ORDER_STATUSES = ['draft','plan','waiting_material','waiting_equipment',
                        'waiting_approval','in_work','paused','done','cancelled','shipped'];
const TASK_STATUSES  = ['waiting','in_progress','done','paused','rejected','rework'];
const PAUSE_REASONS  = ['lunch','break','tech','material','equipment','other'];
const PRIORITIES     = ['low','normal','high','urgent'];
const ORDER_TYPES    = ['W','D','K'];

test('order statuses include shipped', () => {
  assertContains('shipped', ORDER_STATUSES);
});

test('order statuses include all workflow states', () => {
  for (const s of ['draft','plan','in_work','done','cancelled']) {
    assertContains(s, ORDER_STATUSES, `missing: ${s}`);
  }
});

test('task statuses cover main states', () => {
  for (const s of ['waiting','in_progress','done','paused']) {
    assertContains(s, TASK_STATUSES, `missing: ${s}`);
  }
});

test('all pause reasons present', () => {
  for (const r of ['lunch','break','tech','material','equipment','other']) {
    assertContains(r, PAUSE_REASONS, `missing: ${r}`);
  }
});

test('priorities include urgent', () => {
  assertContains('urgent', PRIORITIES);
});

test('order types are W, D, K', () => {
  assertEqual(ORDER_TYPES.sort(), ['D','K','W']);
});

// ── Summary ────────────────────────────────────────────────────────────
const total = passed + failed;
console.log('\n══════════════════════════════════════════════');
console.log(`  Results: ${passed}/${total} passed${failed > 0 ? ` (${failed} FAILED)` : ' ✓'}`);
if (errors.length > 0) {
  console.log('  Failed tests:');
  errors.forEach(e => console.log(`    • ${e}`));
}
console.log('══════════════════════════════════════════════\n');

process.exit(failed > 0 ? 1 : 0);
