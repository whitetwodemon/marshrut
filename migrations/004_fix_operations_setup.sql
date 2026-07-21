-- 004: дозаливка operations.setup_time_min
-- В миграции 001 этот ALTER пропускался из-за бага склейки с комментарием.
-- Здесь добавляем колонку отдельно. Если уже есть — migrate.php пропустит (код 1060).
ALTER TABLE operations ADD COLUMN setup_time_min INT NOT NULL DEFAULT 0;
