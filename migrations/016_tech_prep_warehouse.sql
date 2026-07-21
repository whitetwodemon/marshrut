-- Модуль «Техподготовка ЧПУ» + склад инструмента и материалов

CREATE TABLE IF NOT EXISTS detail_files (
  id           VARCHAR(36) PRIMARY KEY,
  detail_id    VARCHAR(36) NOT NULL,
  op_num       INT NULL COMMENT 'NULL = файл детали (чертёж/модель), иначе привязка к операции',
  file_type    VARCHAR(20) NOT NULL COMMENT 'drawing | nc_program | setup_sheet | model',
  filename     VARCHAR(255) NOT NULL,
  stored_name  VARCHAR(64)  NOT NULL,
  size_bytes   INT NOT NULL DEFAULT 0,
  version      INT NOT NULL DEFAULT 1,
  uploaded_by  VARCHAR(36) NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_df_detail (detail_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE operations ADD COLUMN requires_cnc TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Операция требует УП для ЧПУ';

CREATE TABLE IF NOT EXISTS tools (
  id        VARCHAR(36) PRIMARY KEY,
  name      VARCHAR(200) NOT NULL COMMENT 'Фреза концевая 10мм Z4',
  tool_type VARCHAR(40)  NOT NULL DEFAULT 'other' COMMENT 'mill|drill|tap|turn_insert|bore|reamer|other',
  size_info VARCHAR(80)  NULL COMMENT 'Ø10, М8, CNMG 120408…',
  qty       INT NOT NULL DEFAULT 0,
  min_qty   INT NOT NULL DEFAULT 0,
  location  VARCHAR(80)  NULL COMMENT 'Шкаф 2, ячейка B3',
  comment   VARCHAR(300) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS materials_stock (
  id        VARCHAR(36) PRIMARY KEY,
  material  VARCHAR(120) NOT NULL COMMENT 'Сталь 45',
  assortment VARCHAR(120) NULL COMMENT 'Круг Ø60, лист 10мм…',
  qty       DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit      VARCHAR(20) NOT NULL DEFAULT 'кг',
  min_qty   DECIMAL(10,2) NOT NULL DEFAULT 0,
  location  VARCHAR(80) NULL,
  comment   VARCHAR(300) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO system_settings (key_name, value, description) VALUES
('feature_tech_prep', '0', 'Модуль «Техподготовка ЧПУ + склад» (0=выкл, включается в админке)');

-- Права для существующих БД
INSERT IGNORE INTO permissions (name, label, group_name) VALUES
('tech.manage',     'Управление техподготовкой (УП, чертежи)', 'tech'),
('warehouse.manage','Управление складом (инструмент, материалы)', 'warehouse');

INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions WHERE name IN ('tech.manage','warehouse.manage');
INSERT IGNORE INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions WHERE name IN ('tech.manage','warehouse.manage');
