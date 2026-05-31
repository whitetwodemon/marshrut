FROM mysql:8.0

# Файлы выполняются в алфавитном порядке Docker initdb
COPY mysql-init/01_schema.sql    /docker-entrypoint-initdb.d/01_schema.sql
COPY mysql-init/02_auth.sql      /docker-entrypoint-initdb.d/02_auth.sql
COPY mysql-init/03_workshops.sql /docker-entrypoint-initdb.d/03_workshops.sql
COPY mysql-init/04_workcenters.sql /docker-entrypoint-initdb.d/04_workcenters.sql
COPY mysql-init/05_migration.sql /docker-entrypoint-initdb.d/05_migration.sql
COPY mysql-init/06_seed.sql      /docker-entrypoint-initdb.d/06_seed.sql
COPY mysql-init/07_shifts.sql    /docker-entrypoint-initdb.d/07_shifts.sql
# Индексы добавляются через миграции после старта

CMD ["mysqld", \
     "--character-set-server=utf8mb4", \
     "--collation-server=utf8mb4_unicode_ci"]
