SET NAMES utf8mb4;

-- ── Рабочие центры ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS work_centers (
    id         INT          AUTO_INCREMENT PRIMARY KEY,
    code       VARCHAR(20)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    name       VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    is_active  TINYINT(1)   NOT NULL DEFAULT 1,
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_code (code)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 16 рабочих центров
INSERT IGNORE INTO work_centers (code, name) VALUES
    ('101',  'Заготовка'),
    ('104',  'Токарный универсальный'),
    ('120',  'Токарный ЧПУ Большой'),
    ('124',  'Сварочный цех'),
    ('128',  'Термическая обработка'),
    ('129',  'Эрозия'),
    ('136',  'Прожиг'),
    ('301',  'Слесарные работы'),
    ('710',  'Лазер'),
    ('711',  'Гибка'),
    ('720',  'Токарный ЧПУ Маленький'),
    ('721',  'Фрезерный с ЧПУ Siemens'),
    ('722',  'Фрезерный Fanuc'),
    ('731',  'Токарно-фрезерный'),
    ('901',  'Кооперация'),
    ('1101', 'ОТК');

-- ── Автонумерация заказов ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_sequences (
    year SMALLINT NOT NULL,
    seq  INT      NOT NULL DEFAULT 0,
    PRIMARY KEY (year)
) ENGINE=InnoDB;

-- ── Простои ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_pauses (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    task_id     VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    reason      ENUM('lunch','break','tech','material','equipment','other') NOT NULL DEFAULT 'other',
    reason_note VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    started_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at    TIMESTAMP    NULL,
    INDEX idx_task (task_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── Приоритет заказов на рабочих центрах ─────────────────────────────
CREATE TABLE IF NOT EXISTS wc_order_priority (
    work_center_id INT    NOT NULL,
    order_id       VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    position       INT    NOT NULL DEFAULT 0,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (work_center_id, order_id),
    INDEX idx_wc_pos (work_center_id, position)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
