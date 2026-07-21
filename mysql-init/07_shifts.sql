SET NAMES utf8mb4;

-- ── Смены ─────────────────────────────────────────────────────────────────
-- Каждая смена — 12 часов (дневная или ночная).
-- Одновременно открыта только одна смена.
CREATE TABLE IF NOT EXISTS shifts (
    id         INT          AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    opened_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at  TIMESTAMP    NULL,
    opened_by  INT          NOT NULL,
    closed_by  INT          NULL,
    notes      TEXT         CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    shift_type VARCHAR(10)  NOT NULL DEFAULT 'day',
    handoff_to VARCHAR(100) NULL,
    INDEX idx_open (closed_at)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── Передача задания при смене ─────────────────────────────────────────────
-- Оператор сдаёт незавершённое задание следующей смене.
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

-- ── Журнал событий операторов в смене ─────────────────────────────────────
-- Автоматически заполняется при старте/закрытии/паузе задания.
CREATE TABLE IF NOT EXISTS shift_operator_log (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    shift_id    INT          NOT NULL,
    operator    VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    task_id     VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    event       VARCHAR(30)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    work_center VARCHAR(20)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    qty         INT          DEFAULT 0,
    note        VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_shift_op (shift_id, operator),
    INDEX idx_task     (task_id),
    INDEX idx_created  (created_at)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── Системные настройки (ключ-значение) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS system_settings (
    key_name    VARCHAR(80)  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    value       TEXT         CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    description VARCHAR(300) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
    updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (key_name)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Настройки по умолчанию
INSERT IGNORE INTO system_settings (key_name, value, description) VALUES
('timezone',        'Europe/Moscow',   'Часовой пояс производства'),
('timezone_offset', '+03:00',          'UTC смещение (+03:00 для МСК)'),
('company_name',    'Маршрут МЭС',     'Название предприятия'),
('shift_day_start', '07:00',           'Начало дневной смены'),
('shift_day_end',   '19:00',           'Конец дневной смены (начало ночной)'),
('shift_duration',  '720',             'Длительность смены в минутах (720=12ч)'),
('norm_warn_pct',   '100',             'Порог предупреждения нормоконтроля (%)'),
('norm_crit_pct',   '115',             'Критический порог нормоконтроля (%)'),
('order_prefix_W',  'W',               'Префикс для обычных заказов'),
('order_prefix_D',  'D',               'Префикс для доработок'),
('order_prefix_K',  'K',               'Префикс для кооперации'),
('max_login_attempts', '5',            'Максимум попыток входа в час'),
('feature_analytics', '0',              'Расширенная аналитика (0=выкл, разблокируется в админке)'),
('feature_1c',        '0',              'Интеграция с 1С (0=выкл, разблокируется в админке)'),
('feature_tech_prep','0','Модуль «Техподготовка ЧПУ + склад» (0=выкл)'),
('materials_list',    'Сталь 45,Сталь 40Х,Сталь 20,Сталь 3,Ст3сп,09Г2С,Чугун СЧ20,Чугун ВЧ50,Нержавейка 12Х18Н10Т,Латунь ЛС59-1,Бронза БрАЖ9-4,Алюминий Д16Т,Алюминий АК6,Титан ВТ6,Капролон,Фторопласт Ф4', 'Список материалов для номенклатуры (через запятую, управляется в админке)');
