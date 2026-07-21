-- Индекс под аналитику: GROUP BY work_center (текстовое поле)
ALTER TABLE tasks ADD INDEX idx_wc_text (work_center);
