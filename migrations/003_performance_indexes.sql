-- 003: Индексы для ускорения частых запросов
-- (производственное табло, фильтры заданий, история)

-- Задания: частый фильтр по статусу+оператору (OperatorMobile, табло)
CREATE INDEX idx_tasks_status_op ON tasks (status, operator);

-- Задания: фильтр по детали (история детали)
CREATE INDEX idx_tasks_detail ON tasks (detail_id);

-- scan_log: сортировка по времени (журнал сканирований)
CREATE INDEX idx_scan_time ON scan_log (scanned_at);

-- orders: фильтр по статусу + сортировка по дате
CREATE INDEX idx_orders_status_created ON orders (status, created_at);

-- order_items: джойн по detail_id (генерация заданий)
CREATE INDEX idx_items_detail ON order_items (detail_id);
