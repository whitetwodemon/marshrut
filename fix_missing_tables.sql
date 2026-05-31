-- Создать таблицы смен на работающей БД
CREATE TABLE IF NOT EXISTS shifts (
    id           INT          AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    opened_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at    TIMESTAMP    NULL,
    opened_by    INT          NOT NULL,
    closed_by    INT          NULL,
    notes        TEXT         CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    INDEX idx_open (closed_at)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shift_handoffs (
    id              INT          AUTO_INCREMENT PRIMARY KEY,
    shift_id        INT          NOT NULL,
    task_id         VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    from_operator   VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    to_operator     VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    completed_count INT          NOT NULL DEFAULT 0,
    work_min        INT          NOT NULL DEFAULT 0,
    pause_min       INT          NOT NULL DEFAULT 0,
    notes           TEXT         CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    handed_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_shift (shift_id),
    INDEX idx_task  (task_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shift_operator_log (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    shift_id    INT          NOT NULL,
    operator    VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    task_id     VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    event       ENUM('start','close','pause_start','pause_end') NOT NULL,
    work_center VARCHAR(20)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    qty         INT          DEFAULT 0,
    note        VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_shift_op (shift_id, operator),
    INDEX idx_task     (task_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE scan_log
    ADD COLUMN IF NOT EXISTS batch_num INT NOT NULL DEFAULT 1;

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS order_type CHAR(1) NOT NULL DEFAULT 'W';
