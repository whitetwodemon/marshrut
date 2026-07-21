-- 03_auth.sql — Авторизация, роли, права
SET NAMES utf8mb4;
USE marshrut;

-- -------------------------------------------------------
-- roles
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL UNIQUE,
    label       VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- permissions
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS permissions (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL UNIQUE,
    label       VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    group_name  VARCHAR(50)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'general'
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- role_permissions (many-to-many)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       INT NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id)       REFERENCES roles(id)       ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -------------------------------------------------------
-- users
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            INT          AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    email         VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL UNIQUE,
    password_hash VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    role_id       INT          NOT NULL DEFAULT 2,
    is_active     TINYINT(1)   NOT NULL DEFAULT 1,
    last_login    TIMESTAMP    NULL,
    created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id),
    INDEX idx_email (email)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- refresh_tokens
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         INT          AUTO_INCREMENT PRIMARY KEY,
    user_id    INT          NOT NULL,
    token_hash VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    expires_at TIMESTAMP    NOT NULL,
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token_hash),
    INDEX idx_user  (user_id)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- -------------------------------------------------------
-- Seed: roles
-- -------------------------------------------------------
INSERT IGNORE INTO roles (id, name, label) VALUES
(1, 'admin',    'Администратор'),
(2, 'foreman',  'Ст. мастер'),
(3, 'operator', 'Оператор'),
(4, 'viewer',   'Наблюдатель');

-- -------------------------------------------------------
-- Seed: permissions
-- -------------------------------------------------------
INSERT IGNORE INTO permissions (name, label, group_name) VALUES
-- Заказы
('orders.view',   'Просмотр заказов',   'orders'),
('orders.create', 'Создание заказов',   'orders'),
('orders.edit',   'Редактирование заказов', 'orders'),
('orders.delete', 'Удаление заказов',   'orders'),
-- Номенклатура
('details.view',   'Просмотр номенклатуры',    'details'),
('details.create', 'Создание деталей',          'details'),
('details.edit',   'Редактирование деталей',    'details'),
('details.delete', 'Удаление деталей',          'details'),
-- Сканер
('scanner.use',    'Использование сканера ОТК', 'scanner'),
('settings.manage','Управление настройками', 'admin'),
-- Журнал
('log.view',       'Просмотр журнала',          'log'),
-- Пользователи
('users.view',     'Просмотр пользователей',    'admin'),
('users.manage',   'Управление пользователями', 'admin'),
('roles.manage',   'Управление ролями',         'admin'),
-- Техподготовка ЧПУ
('tech.manage',    'Управление техподготовкой (УП, чертежи)', 'tech'),
-- Склад инструмента и материалов
('warehouse.manage','Управление складом (инструмент, материалы)', 'warehouse');

-- -------------------------------------------------------
-- Seed: role_permissions
-- -------------------------------------------------------
-- Admin: все права
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions;

-- Foreman: всё кроме управления пользователями и ролями
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions WHERE name NOT IN ('users.manage', 'roles.manage');

-- Operator: просмотр заказов + сканер + журнал
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions WHERE name IN (
    'orders.view', 'details.view', 'scanner.use', 'log.view'
);

-- Viewer: только просмотр
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 4, id FROM permissions WHERE name IN (
    'orders.view', 'details.view', 'log.view'
);

-- -------------------------------------------------------
-- Seed: admin user создаётся через init-скрипт (см. backend/scripts/create-admin.php)
-- Хэш генерируется PHP при первом запуске контейнера

-- -------------------------------------------------------
-- login_attempts (rate-limiting)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_attempts (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    ip          VARCHAR(45)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    email       VARCHAR(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
    attempted_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ip_time  (ip, attempted_at),
    INDEX idx_em_time  (email, attempted_at)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
