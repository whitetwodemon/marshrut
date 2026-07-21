// Общие хелперы экранов

export function orderMatchesQuery(o, rawQuery, details) {
  const q = (rawQuery || '').trim().toLowerCase();
  if (!q) return true;
  const hay = [
    o.number, o.customer, o.foreman, o.manager, o.comment, o.priority, o.problemComment,
  ].filter(Boolean).map(x => String(x).toLowerCase());
  // названия деталей из позиций заказа
  if (Array.isArray(o.items) && Array.isArray(details)) {
    for (const it of o.items) {
      const d = details.find(x => x.id === it.detailId);
      if (d) { if (d.name) hay.push(String(d.name).toLowerCase()); if (d.code) hay.push(String(d.code).toLowerCase()); }
    }
  }
  // поддержка нескольких слов: все слова должны найтись
  const words = q.split(/\s+/).filter(Boolean);
  return words.every(w => hay.some(h => h.includes(w)));
}

// Оптимизированный поиск по заказам.
// Строит индекс O(заказы + номенклатура) ОДИН раз (в useMemo при смене данных),
// после чего каждый фильтр по строке — O(заказы) без вложенного details.find.
// makeOrderSearcher(orders, details) → (order, query) => bool
export function makeOrderSearcher(orders, details) {
  // Быстрый доступ к детали по id
  const byId = new Map();
  if (Array.isArray(details)) for (const d of details) byId.set(d.id, d);

  // Предвычисляем строку поиска на заказ
  const index = new Map();
  if (Array.isArray(orders)) {
    for (const o of orders) {
      const parts = [o.number, o.customer, o.foreman, o.manager, o.comment, o.priority, o.problemComment];
      if (Array.isArray(o.items)) {
        for (const it of o.items) {
          const d = byId.get(it.detailId);
          if (d) { if (d.name) parts.push(d.name); if (d.code) parts.push(d.code); }
        }
      }
      index.set(o.id, parts.filter(Boolean).join(' ').toLowerCase());
    }
  }

  return (order, rawQuery) => {
    const q = (rawQuery || '').trim().toLowerCase();
    if (!q) return true;
    const hay = index.get(order.id) || '';
    const words = q.split(/\s+/).filter(Boolean);
    return words.every(w => hay.includes(w));
  };
}

