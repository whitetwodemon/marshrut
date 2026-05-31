SET NAMES utf8mb4;

-- ── Цеха и оборудование ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workshops (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    code        VARCHAR(20)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    description VARCHAR(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    is_active   TINYINT(1)   NOT NULL DEFAULT 1
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS equipment (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    workshop_id INT          NOT NULL,
    code        VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    name        VARCHAR(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    type        VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    INDEX idx_workshop (workshop_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Базовые цеха
INSERT IGNORE INTO workshops (code, name) VALUES
    ('01', 'Механический цех'),
    ('02', 'Сварочный цех'),
    ('03', 'ОТК');
