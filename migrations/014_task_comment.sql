-- tasks.comment — примечание к операции, переносится из operations.comment
-- и печатается на маршрутном листе. На старых базах колонки не было.
ALTER TABLE tasks ADD COLUMN comment TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL;
