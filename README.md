# Маршрут — MES Backend

PHP 8.3 + MySQL 8 + Nginx + React (Babel inline) + Docker Compose

---

## Быстрый старт

```bash
# 1. Сертификат (один раз — для QR-сканера через камеру)
./generate-cert.sh

# 2. Настройки (опционально)
cp .env.example .env

# 3. Запуск
docker compose up -d --build

# 4. Открыть
https://localhost:8443
```

Логин: **admin@marshrut.local** / **Admin1234!**

---

## Требования

- Docker Desktop
- Порты 8080 и 8443 должны быть свободны

---

## Переменные окружения (.env)

| Переменная | По умолчанию | Описание |
|---|---|---|
| `APP_PORT` | `8080` | HTTP порт (редирект на HTTPS) |
| `APP_HTTPS_PORT` | `8443` | HTTPS порт |
| `DB_NAME` | `marshrut` | Имя базы данных |
| `DB_USER` | `marshrut` | Пользователь MySQL |
| `DB_PASSWORD` | `marshrut` | Пароль MySQL |
| `MYSQL_ROOT_PASSWORD` | `rootsecret` | Root пароль MySQL |
| `JWT_SECRET` | *(сменить!)* | Секрет для подписи JWT |
| `ADMIN_EMAIL` | `admin@marshrut.local` | Email администратора |
| `ADMIN_PASSWORD` | `Admin1234!` | Пароль администратора |

---

## API

Все эндпоинты на `/api/*`. Аутентификация через Bearer токен.

Refresh token хранится в **HttpOnly cookie** — браузер отправляет автоматически.

---

## Структура

```
marshrut/
├── backend/           — PHP 8.3 API (контроллеры, middleware, роутер)
├── frontend/          — React SPA (один HTML файл)
├── mysql-init/        — SQL схема и начальные данные
├── docker/            — Dockerfile для каждого сервиса
├── deploy/            — Конфиги для деплоя одним контейнером
├── docker-compose.yml — Локальная разработка (3 контейнера)
└── Dockerfile         — Single-container (для Railway/Render)
```

---

## Команды

```bash
# Запустить
docker compose up -d --build

# Остановить (данные сохраняются)
docker compose down

# Сбросить базу данных
docker compose down -v && docker compose up -d --build

# Посмотреть логи
docker compose logs -f php
docker compose logs -f nginx

# Зайти в контейнер PHP
docker compose exec php sh
```
