-- Migration 009: add_shipped_status
-- Добавляет статус 'shipped' (Отгружено) к заказам
ALTER TABLE orders MODIFY COLUMN status
    ENUM('draft','plan','waiting_material','waiting_equipment','waiting_approval',
         'in_work','paused','done','cancelled','shipped') DEFAULT 'plan';
