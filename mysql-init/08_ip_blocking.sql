
-- 08_ip_blocking.sql
CREATE TABLE IF NOT EXISTS blocked_ips (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    ip         VARCHAR(45) NOT NULL UNIQUE,
    reason     VARCHAR(255) DEFAULT '',
    blocked_by INT NULL REFERENCES users(id) ON DELETE SET NULL,
    blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    INDEX idx_ip (ip)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
