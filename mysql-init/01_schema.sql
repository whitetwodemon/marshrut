-- Marshrut MES — Schema
SET NAMES utf8mb4;
SET character_set_client     = utf8mb4;
SET character_set_connection = utf8mb4;
SET character_set_results    = utf8mb4;
SET collation_connection     = utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS marshrut
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

-- На случай если база уже существовала с неправильным charset
ALTER DATABASE marshrut CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE marshrut;

-- -------------------------------------------------------
-- details (номенклатура)
-- -------------------------------------------------------
CREATE TABLE details (
    id          VARCHAR(20)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    code        VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    name        VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    material    VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    unit        VARCHAR(10)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'шт',
    drawing     VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_code (code)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- operations (технологические операции детали)
-- -------------------------------------------------------
CREATE TABLE operations (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    detail_id   VARCHAR(20)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    num         INT          NOT NULL,
    name        VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    work_center VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    time_min    INT          NOT NULL DEFAULT 0,
    FOREIGN KEY (detail_id) REFERENCES details(id) ON DELETE CASCADE,
    INDEX idx_detail_num (detail_id, num)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- orders (производственные заказы)
-- -------------------------------------------------------
CREATE TABLE orders (
    id          VARCHAR(20)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    number      VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    customer    VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    foreman     VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    status      ENUM('plan','in_work','done') NOT NULL DEFAULT 'plan',
    priority    ENUM('low','normal','high')   NOT NULL DEFAULT 'normal',
    due_date    DATE         NOT NULL,
    created_at  DATE         NOT NULL,
    updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_status (status),
    INDEX idx_number (number),
    INDEX idx_status_created (status, created_at)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- order_items (состав заказа)
-- -------------------------------------------------------
CREATE TABLE order_items (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    order_id    VARCHAR(20)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    detail_id   VARCHAR(20)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    quantity    INT          NOT NULL DEFAULT 1,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (detail_id) REFERENCES details(id),
    UNIQUE KEY uq_order_detail (order_id, detail_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- tasks (операционные задания)
-- -------------------------------------------------------
CREATE TABLE tasks (
    id          VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    order_id    VARCHAR(20)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    detail_id   VARCHAR(20)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    op_num      INT          NOT NULL,
    op_name     VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    work_center VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    time_min    INT          NOT NULL DEFAULT 0,
    planned     INT          NOT NULL DEFAULT 1,
    completed   INT          NOT NULL DEFAULT 0,
    status      ENUM('waiting','in_progress','done','paused','rejected','rework') NOT NULL DEFAULT 'waiting',
    qr_text     VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    operator    VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    started_at  TIMESTAMP    NULL,
    updated_at  TIMESTAMP    NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (order_id)  REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (detail_id) REFERENCES details(id),
    INDEX idx_status (status),
    INDEX idx_qr (qr_text),
    INDEX idx_order  (order_id),
    INDEX idx_detail (detail_id),
    INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- scan_log (журнал сканирований ОТК)
-- -------------------------------------------------------
CREATE TABLE scan_log (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    task_id     VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    qr_text     VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    detail_id   VARCHAR(20)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    op_info     VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    operator    VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    result      ENUM('closed','not_found','already_done') NOT NULL DEFAULT 'closed',
    quantity    INT,
    comment     VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    actual_time_min INT NULL,
    scanned_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_task      (task_id),
    INDEX idx_scanned   (scanned_at),
    INDEX idx_detail_id (detail_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
