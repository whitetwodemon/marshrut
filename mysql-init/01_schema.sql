SET NAMES utf8mb4;

-- Migration 001: Initial schema
-- Применяется один раз при первом деплое

CREATE TABLE IF NOT EXISTS details (
    id          VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    code        VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    name        VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    material    VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    unit        VARCHAR(20)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'шт',
    drawing     VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS operations (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    detail_id   VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    num         INT          NOT NULL,
    name        VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    work_center VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    work_center_id INT       NULL,
    time_min    INT          DEFAULT 0,
    UNIQUE KEY uq_detail_num (detail_id, num),
    INDEX idx_detail (detail_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_sequences (
    year    SMALLINT NOT NULL,
    seq     INT      NOT NULL DEFAULT 0,
    PRIMARY KEY (year)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
    id          VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    number      VARCHAR(30)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    order_type  CHAR(1)      NOT NULL DEFAULT 'W' COMMENT 'W=Заказ D=Доработка K=Кооперация',
    customer    VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    foreman     VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    status      ENUM('draft','plan','waiting_material','waiting_equipment','waiting_approval','in_work','paused','done','cancelled','shipped') DEFAULT 'plan',
    priority    ENUM('low','normal','high','urgent') DEFAULT 'normal',
    due_date    DATE         NULL,
    workshop_id INT          NULL,
    comment     TEXT         CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_number (number),
    INDEX idx_status (status, updated_at)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    order_id    VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    detail_id   VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    quantity    INT          NOT NULL DEFAULT 1,
    UNIQUE KEY uq_order_detail (order_id, detail_id),
    INDEX idx_order (order_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tasks (
    id              VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    order_id        VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    detail_id       VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    op_num          INT          NOT NULL DEFAULT 0,
    op_name         VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    work_center     VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    work_center_id  INT          NULL,
    time_min        INT          NOT NULL DEFAULT 0,
    planned         INT          NOT NULL DEFAULT 1,
    completed       INT          NOT NULL DEFAULT 0,
    status          ENUM('waiting','in_progress','done','paused','rejected','rework') DEFAULT 'waiting',
    operator        VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    started_at      TIMESTAMP    NULL,
    actual_time_min  INT         NULL,
    accumulated_time INT         NOT NULL DEFAULT 0 COMMENT 'Накопленное время всех операторов (мин)',
    qr_text         VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    workshop_id     INT          NULL,
    updated_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_order  (order_id),
    INDEX idx_wc     (work_center_id),
    INDEX idx_status (status)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS scan_log (
    id              INT          AUTO_INCREMENT PRIMARY KEY,
    task_id         VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    qr_text         VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    detail_id       VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    op_info         VARCHAR(300) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    operator        VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    result          VARCHAR(20)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'closed',
    quantity        INT          DEFAULT 0,
    batch_num       INT          NOT NULL DEFAULT 1,
    actual_time_min INT          NULL,
    comment         TEXT         CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    scanned_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_task (task_id),
    INDEX idx_time (scanned_at)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Auth
CREATE TABLE IF NOT EXISTS roles (
    id          INT         AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL UNIQUE,
    label        VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    display_name VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissions (
    id   INT         AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(80)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL UNIQUE,
    label      VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    group_name VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       INT NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id)       REFERENCES roles(id)       ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
    id           INT          AUTO_INCREMENT PRIMARY KEY,
    email        VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL UNIQUE,
    name         VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    password_hash VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    role_id      INT          REFERENCES roles(id),
    is_active    TINYINT(1)   NOT NULL DEFAULT 1,
    last_login   TIMESTAMP    NULL,
    created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    user_id     INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    expires_at  TIMESTAMP    NOT NULL,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_hash (token_hash),
    INDEX idx_user (user_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_attempts (
    id           INT          AUTO_INCREMENT PRIMARY KEY,
    ip           VARCHAR(45)  NOT NULL,
    email        VARCHAR(255) CHARACTER SET utf8mb4 NOT NULL,
    attempted_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ip    (ip),
    INDEX idx_email (email),
    INDEX idx_time  (attempted_at)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Workshops / Equipment
CREATE TABLE IF NOT EXISTS workshops (
    id         INT          AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    code       VARCHAR(20)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    is_active  TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS equipment (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    workshop_id INT          NOT NULL REFERENCES workshops(id),
    code        VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    name        VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    type        VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    INDEX idx_workshop (workshop_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Work centers
CREATE TABLE IF NOT EXISTS work_centers (
    id         INT          AUTO_INCREMENT PRIMARY KEY,
    code       VARCHAR(20)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    name       VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    is_active  TINYINT(1)   NOT NULL DEFAULT 1,
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_code (code)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS task_pauses (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    task_id     VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    reason      ENUM('lunch','break','tech','material','equipment','other') NOT NULL DEFAULT 'other',
    reason_note VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    started_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at    TIMESTAMP    NULL,
    INDEX idx_task (task_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wc_order_priority (
    work_center_id INT    NOT NULL,
    order_id       VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    position       INT    NOT NULL DEFAULT 0,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (work_center_id, order_id),
    INDEX idx_wc_pos (work_center_id, position)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shifts (
    id         INT          AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    opened_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at  TIMESTAMP    NULL,
    opened_by  INT          NOT NULL REFERENCES users(id),
    closed_by  INT          NULL REFERENCES users(id),
    notes      TEXT         CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    INDEX idx_open (closed_at)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shift_handoffs (
    id              INT          AUTO_INCREMENT PRIMARY KEY,
    shift_id        INT          NOT NULL REFERENCES shifts(id),
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

-- ── Системные настройки (ключ-значение) ────────────────────────────────
CREATE TABLE IF NOT EXISTS system_settings (
    key_name    VARCHAR(80)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    value       TEXT         CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    description VARCHAR(300) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (key_name)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── Журнал событий операторов ────────────────────────────────────────────
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

-- ── История операций (передачи, комментарии мастера) ────────────────────
CREATE TABLE IF NOT EXISTS task_events (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    task_id     VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    event_type  ENUM('handoff','close','comment','start','pause') NOT NULL,
    operator    VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    comment     TEXT         CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    qty_done    INT          DEFAULT 0,
    time_spent  INT          DEFAULT 0,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_task (task_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
