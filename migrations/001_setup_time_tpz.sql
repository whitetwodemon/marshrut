-- 001: ТПЗ — подготовительно-заключительное время (наладка перед работой)
-- Добавляется к операциям номенклатуры и к заданиям

ALTER TABLE operations
    ADD COLUMN setup_time_min INT NOT NULL DEFAULT 0
    COMMENT 'ТПЗ — время наладки перед работой (мин)';

ALTER TABLE tasks
    ADD COLUMN setup_time_min INT NOT NULL DEFAULT 0
    COMMENT 'ТПЗ — норматив наладки (мин)';

ALTER TABLE tasks
    ADD COLUMN setup_started_at TIMESTAMP NULL
    COMMENT 'Когда оператор начал наладку';

ALTER TABLE tasks
    ADD COLUMN setup_actual_min INT NULL
    COMMENT 'Фактическое время наладки (мин)';

ALTER TABLE tasks
    ADD COLUMN setup_done TINYINT NOT NULL DEFAULT 0
    COMMENT 'Наладка завершена (1) — можно начинать работу';
