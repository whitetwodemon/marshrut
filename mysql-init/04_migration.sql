-- Migration: add missing indexes and new columns
-- Run once after initial setup

-- Индекс для SSE polling (критично для производительности)
ALTER TABLE tasks ADD INDEX IF NOT EXISTS idx_updated_at (updated_at);

-- Составной индекс для фильтрации заказов по статусу + сортировке
ALTER TABLE orders ADD INDEX IF NOT EXISTS idx_status_created (status, created_at);

-- Индекс для scan_log.detail_id (используется в JOIN)
ALTER TABLE scan_log ADD INDEX IF NOT EXISTS idx_detail_id (detail_id);

-- Новые статусы задания (добавляем к ENUM)
ALTER TABLE tasks MODIFY COLUMN status 
    ENUM('waiting','in_progress','done','paused','rejected','rework') 
    NOT NULL DEFAULT 'waiting';

-- Поле комментария к операции в scan_log
ALTER TABLE scan_log ADD COLUMN IF NOT EXISTS comment VARCHAR(500) 
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER quantity;

-- Фактическое время выполнения операции (план/факт)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMP NULL AFTER updated_at;
ALTER TABLE scan_log ADD COLUMN IF NOT EXISTS actual_time_min INT NULL AFTER comment;

-- Обновляем existing rows чтобы started_at был заполнен для in_progress задач
UPDATE tasks SET started_at = updated_at WHERE status = 'in_progress' AND started_at IS NULL;
