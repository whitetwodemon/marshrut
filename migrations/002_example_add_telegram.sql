-- Migration 002: add_telegram_notifications
-- Created: 2026-05-28
-- Description: Добавить Telegram chat_id к пользователям для уведомлений

ALTER TABLE users
    ADD COLUMN telegram_chat_id BIGINT NULL AFTER email;

-- Поле для токена уведомлений
ALTER TABLE orders
    ADD COLUMN notify_overdue TINYINT(1) NOT NULL DEFAULT 1 AFTER comment;
