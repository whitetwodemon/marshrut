-- Migration 003: performance_indexes
-- Created: 2026-05-28
-- Description: Индексы для ускорения выборок

ALTER TABLE scan_log
    ADD INDEX idx_operator (operator),
    ADD INDEX idx_detail   (detail_id);

ALTER TABLE tasks
    ADD INDEX idx_order_detail (order_id, detail_id),
    ADD INDEX idx_operator     (operator);
