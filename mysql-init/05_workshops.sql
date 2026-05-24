-- Migration v5: workshops, order statuses, workshop_id
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

CREATE TABLE IF NOT EXISTS workshops (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    code        VARCHAR(20)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    name        VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    description VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_code (code)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Расширяем статусы заказов
ALTER TABLE orders MODIFY COLUMN status
    ENUM('draft','plan','waiting_material','waiting_equipment','waiting_approval',
         'in_work','paused','done','cancelled')
    NOT NULL DEFAULT 'draft';

-- workshop_id и comment в orders
SET @x = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'workshop_id');
SET @s = IF(@x = 0, 'ALTER TABLE orders ADD COLUMN workshop_id INT NULL AFTER foreman', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @x = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'comment');
SET @s = IF(@x = 0, 'ALTER TABLE orders ADD COLUMN comment TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL AFTER workshop_id', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- workshop_id в tasks
SET @x = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'workshop_id');
SET @s = IF(@x = 0, 'ALTER TABLE tasks ADD COLUMN workshop_id INT NULL AFTER work_center', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- Индексы
SET @x = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_workshop');
SET @s = IF(@x = 0, 'ALTER TABLE orders ADD INDEX idx_workshop (workshop_id)', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @x = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND INDEX_NAME = 'idx_task_workshop');
SET @s = IF(@x = 0, 'ALTER TABLE tasks ADD INDEX idx_task_workshop (workshop_id)', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- Базовые цеха
INSERT IGNORE INTO workshops (code, name, description) VALUES
    ('CEX1', 'Цех №1 — Механообработка',  'Токарные, фрезерные, шлифовальные операции'),
    ('CEX2', 'Цех №2 — Заготовительный',  'Резка, гибка, штамповка'),
    ('CEX3', 'Цех №3 — Сборочный',         'Сборка, испытания, ОТК'),
    ('CEX4', 'Цех №4 — Термический',       'Термообработка, покрытия'),
    ('CEX5', 'Цех №5 — Вспомогательный',   'Инструментальный, ремонтный');

-- Оборудование (станки) в цехах
CREATE TABLE IF NOT EXISTS equipment (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    workshop_id INT          NOT NULL,
    code        VARCHAR(30)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    name        VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    type        VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workshop_id) REFERENCES workshops(id) ON DELETE CASCADE,
    INDEX idx_workshop (workshop_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Базовое оборудование
INSERT IGNORE INTO equipment (workshop_id, code, name, type) VALUES
    (1, 'ДИП-300',    'Токарный ДИП-300',        'Токарный'),
    (1, 'ДИП-200',    'Токарный ДИП-200',        'Токарный'),
    (1, 'ФС-132',     'Фрезерный ФС-132',        'Фрезерный'),
    (1, 'ШЛ-371',     'Шлифовальный ШЛ-371',     'Шлифовальный'),
    (2, 'Г-08',       'Гильотина Г-08',           'Заготовительный'),
    (2, 'ПГ-125',     'Пресс гибочный ПГ-125',    'Заготовительный'),
    (3, 'СБ-01',      'Сборочный стол СБ-01',     'Сборочный'),
    (4, 'ПЭЧ-50',     'Печь ПЭЧ-50',             'Термический');
