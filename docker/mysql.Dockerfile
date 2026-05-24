FROM mysql:8.0

# Копируем SQL-файлы внутрь образа
# Timeweb запрещает volumes, поэтому схема встроена в образ
COPY mysql-init/01_schema.sql    /docker-entrypoint-initdb.d/01_schema.sql
COPY mysql-init/03_auth.sql      /docker-entrypoint-initdb.d/03_auth.sql
COPY mysql-init/02_seed.sql      /docker-entrypoint-initdb.d/02_seed.sql
COPY mysql-init/04_migration.sql /docker-entrypoint-initdb.d/04_migration.sql
COPY mysql-init/05_workshops.sql  /docker-entrypoint-initdb.d/05_workshops.sql

# Принудительно utf8mb4
CMD ["mysqld", \
     "--character-set-server=utf8mb4", \
     "--collation-server=utf8mb4_unicode_ci"]
