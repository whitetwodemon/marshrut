#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILE="${BACKUP_DIR}/marshrut_${DATE}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[backup] Starting at $(date)..."

mysqldump \
    -h "${DB_HOST:-mysql}" \
    -u "${DB_USER:-marshrut}" \
    -p"${DB_PASSWORD:-marshrut}" \
    --single-transaction \
    --routines \
    "${DB_NAME:-marshrut}" | gzip > "$FILE"

echo "[backup] Done: $FILE ($(du -sh "$FILE" | cut -f1))"

find "$BACKUP_DIR" -name "marshrut_*.sql.gz" -mtime +30 -delete
echo "[backup] Old backups cleaned."
