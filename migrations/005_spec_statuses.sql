ALTER TABLE specifications MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'development';
UPDATE specifications SET status = 'development' WHERE status = 'draft';
