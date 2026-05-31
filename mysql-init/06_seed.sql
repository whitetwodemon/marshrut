SET NAMES utf8mb4;
SET character_set_client     = utf8mb4;
SET character_set_connection = utf8mb4;
SET character_set_results    = utf8mb4;
SET collation_connection     = utf8mb4_unicode_ci;

USE marshrut;

-- ── Детали ──────────────────────────────────────────────────────────────
INSERT INTO details (id, code, name, material, unit, drawing) VALUES
('D-001', 'ФЛ-100-08', 'Фланец воротниковый ДУ-100',  'Сталь 09Г2С, ГОСТ 33259-2015',   'шт', 'ЧЛ.04.218-00'),
('D-002', 'ВЛ-45-220', 'Вал шлицевой Z=8',             'Сталь 40Х, ТУ 14-1-3957-2020',   'шт', 'ЧЛ.04.221-00'),
('D-003', 'КР-120-04', 'Корпус редуктора РЦД-120',     'Чугун СЧ-20, ГОСТ 1412-85',      'шт', 'ЧЛ.06.312-00'),
('D-004', 'КВ-80-01',  'Крышка ведущего вала',          'Алюминий Д16Т, ГОСТ 4784-2019',  'шт', 'ЧЛ.06.314-00');

-- Операции D-001 (используем коды РЦ из work_centers)
INSERT INTO operations (detail_id, num, name, work_center, time_min) VALUES
('D-001', 10,  'Заготовительная',           '101',  4),
('D-001', 20,  'Токарная черновая',          '104', 18),
('D-001', 30,  'Токарная чистовая',          '104', 22),
('D-001', 40,  'Сверлильная (8 отв. ⌀18)',   '720', 14),
('D-001', 50,  'Слесарная',                  '301',  8),
('D-001', 60,  'Термообработка',             '128', 35),
('D-001', 70,  'Шлифовальная',               '720', 11),
('D-001', 80,  'Маркировка',                 '710',  3),
('D-001', 90,  'Контроль ОТК',              '1101',  6);

-- Операции D-002
INSERT INTO operations (detail_id, num, name, work_center, time_min) VALUES
('D-002', 10, 'Заготовительная',             '101',  6),
('D-002', 20, 'Токарная черновая',            '104', 32),
('D-002', 30, 'Токарная чистовая',            '120', 26),
('D-002', 40, 'Фрезерная (шлицы)',            '721', 20),
('D-002', 50, 'Термообработка ТВЧ',           '128', 40),
('D-002', 60, 'Шлифовальная',                '720', 18),
('D-002', 70, 'Контроль ОТК',               '1101',  5);

-- Операции D-003
INSERT INTO operations (detail_id, num, name, work_center, time_min) VALUES
('D-003', 10, 'Заготовительная (литьё)',      '101', 15),
('D-003', 20, 'Токарная',                     '104', 45),
('D-003', 30, 'Фрезерная',                    '721', 60),
('D-003', 40, 'Сверлильная',                  '720', 25),
('D-003', 50, 'Слесарная',                    '301', 15),
('D-003', 60, 'Контроль ОТК',               '1101', 10);

-- Операции D-004
INSERT INTO operations (detail_id, num, name, work_center, time_min) VALUES
('D-004', 10, 'Заготовительная',              '101',  3),
('D-004', 20, 'Токарная',                     '104', 12),
('D-004', 30, 'Сверлильная',                  '720',  8),
('D-004', 40, 'Слесарная',                    '301',  4),
('D-004', 50, 'Контроль ОТК',               '1101',  3);

-- ── Заказы ──────────────────────────────────────────────────────────────
INSERT INTO order_sequences (year, seq) VALUES (26, 2);

INSERT INTO orders (id, number, foreman, status, priority, due_date, created_at) VALUES
('O-001', 'W_26_000001', 'Колесников П.А.', 'in_work', 'high',   '2026-06-15', '2026-05-14'),
('O-002', 'W_26_000002', 'Петров В.С.',     'in_work', 'normal', '2026-06-30', '2026-05-20');

INSERT INTO order_items (order_id, detail_id, quantity) VALUES
('O-001', 'D-001', 5),
('O-001', 'D-002', 2),
('O-002', 'D-003', 3),
('O-002', 'D-004', 8);

-- ── Задания (все в начальном состоянии) ─────────────────────────────────

-- Заказ W_26_000001, деталь D-001 (5 шт) - Фланец воротниковый
INSERT INTO tasks (id, order_id, detail_id, op_num, op_name, work_center, time_min, planned, completed, status, actual_time_min, qr_text, operator, started_at, updated_at) VALUES
('OT-001-001-10','O-001','D-001',10,'Заготовительная',         '101', 4, 5,5,'done',   20, 'OTASK:001-001-10','Семёнов И.Н.',  NULL, '2026-05-15 08:22:00'),
('OT-001-001-20','O-001','D-001',20,'Токарная черновая',        '104',18, 5,5,'done',   96, 'OTASK:001-001-20','Гаврилов А.Б.',NULL, '2026-05-16 10:36:00'),
('OT-001-001-30','O-001','D-001',30,'Токарная чистовая',        '104',22, 5,3,'waiting',NULL,'OTASK:001-001-30',NULL,           NULL, NULL),
('OT-001-001-40','O-001','D-001',40,'Сверлильная (8 отв. ⌀18)','720',14, 5,0,'waiting',NULL,'OTASK:001-001-40',NULL,           NULL, NULL),
('OT-001-001-50','O-001','D-001',50,'Слесарная',               '301', 8, 5,0,'waiting',NULL,'OTASK:001-001-50',NULL,           NULL, NULL),
('OT-001-001-60','O-001','D-001',60,'Термообработка',          '128',35, 5,0,'waiting',NULL,'OTASK:001-001-60',NULL,           NULL, NULL),
('OT-001-001-70','O-001','D-001',70,'Шлифовальная',            '720',11, 5,0,'waiting',NULL,'OTASK:001-001-70',NULL,           NULL, NULL),
('OT-001-001-80','O-001','D-001',80,'Маркировка',              '710', 3, 5,0,'waiting',NULL,'OTASK:001-001-80',NULL,           NULL, NULL),
('OT-001-001-90','O-001','D-001',90,'Контроль ОТК',           '1101', 6, 5,0,'waiting',NULL,'OTASK:001-001-90',NULL,           NULL, NULL);

-- Заказ W_26_000001, деталь D-002 (2 шт) - Вал шлицевой
INSERT INTO tasks (id, order_id, detail_id, op_num, op_name, work_center, time_min, planned, completed, status, actual_time_min, qr_text, operator, started_at, updated_at) VALUES
('OT-001-002-10','O-001','D-002',10,'Заготовительная',         '101', 6, 2,2,'done',   13,'OTASK:001-002-10','Орлов Д.С.',   NULL, '2026-05-15 08:13:00'),
('OT-001-002-20','O-001','D-002',20,'Токарная черновая',        '104',32, 2,2,'done',   68,'OTASK:001-002-20','Маркина Е.В.',NULL, '2026-05-16 10:08:00'),
('OT-001-002-30','O-001','D-002',30,'Токарная чистовая',        '120',26, 2,0,'waiting',NULL,'OTASK:001-002-30',NULL,         NULL, NULL),
('OT-001-002-40','O-001','D-002',40,'Фрезерная (шлицы)',        '721',20, 2,0,'waiting',NULL,'OTASK:001-002-40',NULL,         NULL, NULL),
('OT-001-002-50','O-001','D-002',50,'Термообработка ТВЧ',       '128',40, 2,0,'waiting',NULL,'OTASK:001-002-50',NULL,         NULL, NULL),
('OT-001-002-60','O-001','D-002',60,'Шлифовальная',             '720',18, 2,0,'waiting',NULL,'OTASK:001-002-60',NULL,         NULL, NULL),
('OT-001-002-70','O-001','D-002',70,'Контроль ОТК',            '1101', 5, 2,0,'waiting',NULL,'OTASK:001-002-70',NULL,         NULL, NULL);

-- Заказ W_26_000002, деталь D-003 (3 шт) - Корпус редуктора
INSERT INTO tasks (id, order_id, detail_id, op_num, op_name, work_center, time_min, planned, completed, status, actual_time_min, qr_text, operator, started_at, updated_at) VALUES
('OT-002-003-10','O-002','D-003',10,'Заготовительная (литьё)',  '101',15, 3,3,'done',   47,'OTASK:002-003-10','Орлов Д.С.',  NULL, '2026-05-22 10:00:00'),
('OT-002-003-20','O-002','D-003',20,'Токарная',                 '104',45, 3,0,'waiting',NULL,'OTASK:002-003-20',NULL,         NULL, NULL),
('OT-002-003-30','O-002','D-003',30,'Фрезерная',                '721',60, 3,0,'waiting',NULL,'OTASK:002-003-30',NULL,         NULL, NULL),
('OT-002-003-40','O-002','D-003',40,'Сверлильная',              '720',25, 3,0,'waiting',NULL,'OTASK:002-003-40',NULL,         NULL, NULL),
('OT-002-003-50','O-002','D-003',50,'Слесарная',                '301',15, 3,0,'waiting',NULL,'OTASK:002-003-50',NULL,         NULL, NULL),
('OT-002-003-60','O-002','D-003',60,'Контроль ОТК',            '1101',10, 3,0,'waiting',NULL,'OTASK:002-003-60',NULL,         NULL, NULL);

-- Заказ W_26_000002, деталь D-004 (8 шт) - Крышка ведущего вала
INSERT INTO tasks (id, order_id, detail_id, op_num, op_name, work_center, time_min, planned, completed, status, actual_time_min, qr_text, operator, started_at, updated_at) VALUES
('OT-002-004-10','O-002','D-004',10,'Заготовительная',          '101', 3, 8,8,'done',   25,'OTASK:002-004-10','Семёнов И.Н.',NULL, '2026-05-21 09:00:00'),
('OT-002-004-20','O-002','D-004',20,'Токарная',                 '104',12, 8,8,'done',   98,'OTASK:002-004-20','Гаврилов А.Б.',NULL,'2026-05-22 11:00:00'),
('OT-002-004-30','O-002','D-004',30,'Сверлильная',              '720', 8, 8,0,'waiting',NULL,'OTASK:002-004-30',NULL,         NULL, NULL),
('OT-002-004-40','O-002','D-004',40,'Слесарная',                '301', 4, 8,0,'waiting',NULL,'OTASK:002-004-40',NULL,         NULL, NULL),
('OT-002-004-50','O-002','D-004',50,'Контроль ОТК',            '1101', 3, 8,0,'waiting',NULL,'OTASK:002-004-50',NULL,         NULL, NULL);


-- ── Журнал сканирований ──────────────────────────────────────────────────
INSERT INTO scan_log (task_id, qr_text, detail_id, op_info, operator, result, quantity, actual_time_min, scanned_at) VALUES
('OT-001-001-10','OTASK:001-001-10','D-001','10 Заготовительная',    'Семёнов И.Н.', 'closed',5,22,'2026-05-15 08:22:00'),
('OT-001-001-20','OTASK:001-001-20','D-001','20 Токарная черновая',   'Гаврилов А.Б.','closed',5,96,'2026-05-16 10:36:00'),
('OT-001-002-10','OTASK:001-002-10','D-002','10 Заготовительная',    'Орлов Д.С.',   'closed',2,13,'2026-05-15 08:13:00'),
('OT-001-002-20','OTASK:001-002-20','D-002','20 Токарная черновая',   'Маркина Е.В.', 'closed',2,68,'2026-05-16 10:08:00'),
('OT-002-003-10','OTASK:002-003-10','D-003','10 Заготовительная',    'Орлов Д.С.',   'closed',3,47,'2026-05-22 10:00:00'),
('OT-002-004-10','OTASK:002-004-10','D-004','10 Заготовительная',    'Семёнов И.Н.', 'closed',8,25,'2026-05-21 09:00:00'),
('OT-002-004-20','OTASK:002-004-20','D-004','20 Токарная',           'Гаврилов А.Б.','closed',8,98,'2026-05-22 11:00:00');

-- Привязываем задания к рабочим центрам по коду
UPDATE tasks t
JOIN work_centers wc ON wc.code = t.work_center
SET t.work_center_id = wc.id;

-- ── Тестовые пользователи (пароль: Test1234!) ────────────────────────────
-- Хэш для "Test1234!" (bcrypt cost 10)
INSERT IGNORE INTO users (name, email, password_hash, role_id, is_active) VALUES
('Колесников П.А.',    'foreman@marshrut.local',   '$2y$10$TKh8H1.PfwT6+LHuIHnVzuWQKXhlb4YoYEVBBNWzMsWQGkHrYV3Gy', 2, 1),
('Гаврилов А.Б.',      'operator1@marshrut.local', '$2y$10$TKh8H1.PfwT6+LHuIHnVzuWQKXhlb4YoYEVBBNWzMsWQGkHrYV3Gy', 3, 1),
('Семёнов И.Н.',       'operator2@marshrut.local', '$2y$10$TKh8H1.PfwT6+LHuIHnVzuWQKXhlb4YoYEVBBNWzMsWQGkHrYV3Gy', 3, 1),
('Орлов Д.С.',         'operator3@marshrut.local', '$2y$10$TKh8H1.PfwT6+LHuIHnVzuWQKXhlb4YoYEVBBNWzMsWQGkHrYV3Gy', 3, 1),
('Наблюдатель',        'viewer@marshrut.local',    '$2y$10$TKh8H1.PfwT6+LHuIHnVzuWQKXhlb4YoYEVBBNWzMsWQGkHrYV3Gy', 4, 1);
