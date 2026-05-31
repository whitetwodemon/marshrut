-- Migration 008: performance_indexes
-- Uses CREATE INDEX IF NOT EXISTS (MySQL 8.0+)
CREATE INDEX IF NOT EXISTS idx_tasks_operator     ON tasks (operator);
CREATE INDEX IF NOT EXISTS idx_tasks_order_detail ON tasks (order_id, detail_id, op_num);
CREATE INDEX IF NOT EXISTS idx_tasks_wc_status    ON tasks (work_center_id, status);
CREATE INDEX IF NOT EXISTS idx_scanlog_operator   ON scan_log (operator);
CREATE INDEX IF NOT EXISTS idx_scanlog_op_time    ON scan_log (operator, scanned_at);
CREATE INDEX IF NOT EXISTS idx_orders_status_date ON orders (status, updated_at);
