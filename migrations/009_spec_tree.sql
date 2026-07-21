ALTER TABLE specification_items ADD COLUMN parent_id INT NULL;
ALTER TABLE specification_items ADD COLUMN node_type VARCHAR(20) NOT NULL DEFAULT 'detail';
