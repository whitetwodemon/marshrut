-- Migration v4: indexes only (columns already in 01_schema.sql)

SET @x = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND INDEX_NAME = 'idx_updated_at');
SET @s = IF(@x = 0, 'ALTER TABLE tasks ADD INDEX idx_updated_at (updated_at)', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @x = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_status_created');
SET @s = IF(@x = 0, 'ALTER TABLE orders ADD INDEX idx_status_created (status, created_at)', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @x = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'scan_log' AND INDEX_NAME = 'idx_detail_id');
SET @s = IF(@x = 0, 'ALTER TABLE scan_log ADD INDEX idx_detail_id (detail_id)', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
