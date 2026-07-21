CREATE TABLE IF NOT EXISTS specifications (
    id          VARCHAR(50)  NOT NULL PRIMARY KEY,
    number      VARCHAR(50)  NOT NULL,
    name        VARCHAR(255) NOT NULL DEFAULT '',
    customer    VARCHAR(255) DEFAULT '',
    manager     VARCHAR(100) DEFAULT '',
    due_date    DATE NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'development',
    comment     TEXT NULL,
    created_by  INT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_spec_number (number),
    INDEX idx_status (status)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS specification_items (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    spec_id     VARCHAR(50)  NOT NULL,
    detail_id   VARCHAR(50)  NULL,
    detail_name VARCHAR(255) NOT NULL,
    detail_code VARCHAR(50)  DEFAULT '',
    parent_id   INT NULL,
    node_type   VARCHAR(20) NOT NULL DEFAULT 'detail',
    quantity    INT NOT NULL DEFAULT 1,
    nomenclature_ready TINYINT NOT NULL DEFAULT 0,
    order_id    VARCHAR(50)  NULL,
    order_created TINYINT NOT NULL DEFAULT 0,
    comment     VARCHAR(500) DEFAULT '',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_spec (spec_id),
    INDEX idx_detail (detail_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
