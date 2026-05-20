# Маршрут — MES Backend

PHP 8.3 + MySQL 8 + Nginx + React (Vite), всё в Docker Compose.

---

## ⚠️ Если данные кракозябрами — пересоздай volume

```bash
docker compose down -v
docker compose up -d --build
```

---

## Быстрый старт

```bash
# 1. Сертификат для камеры (один раз)
New-Item -ItemType Directory -Force -Path certs
mkcert -key-file certs/localhost.key -cert-file certs/localhost.crt localhost 127.0.0.1

# 2. Настройки
cp .env.example .env

# 3. Сборка фронтенда (если меняли frontend-src/)
docker compose --profile build up frontend-build

# 4. Запуск
docker compose up -d --build

# 5. Открыть
open https://localhost:8443
```

Логин: **admin@marshrut.local** / **Admin1234!**

---

## Камера (QR-сканер)

`getUserMedia` требует HTTPS. На localhost работает через сертификат (см. шаг 1).

На сервере — добавь reverse-proxy с SSL (Caddy, Traefik).

---

## Разработка фронтенда (hot reload)

```bash
cd frontend-src
npm install
npm run dev
# открыть http://localhost:5173
```

Vite проксирует `/api` на `https://localhost:8443` — бэкенд должен быть запущен.

Структура модулей:
```
frontend-src/src/
├── lib/
│   ├── api.js         # HTTP клиент + SSE Events + Auth
│   └── data.js        # Типы данных, seed
├── hooks/
│   └── useRealtime.js # SSE hook для real-time обновлений
├── components/
│   ├── Icon.jsx       # Иконки
│   ├── QrCode.jsx     # QR генерация
│   ├── TweaksPanel.jsx
│   ├── Sidebar.jsx
│   └── Topbar.jsx
├── screens/
│   ├── Login.jsx
│   ├── Admin.jsx
│   ├── Dashboard.jsx  (через screens/index.jsx)
│   ├── Scanner.jsx
│   ├── ModalNewOrder.jsx
│   └── ModalNewDetail.jsx
└── App.jsx            # Корень: роутинг, state, SSE
```

После изменений — пересобери:
```bash
docker compose --profile build up frontend-build
```

---

## API Reference

### Real-time (SSE)
```
GET /api/events?token=<access_token>&since=<unix_ts>
```
События: `task_updated`, `scan_logged`, `order_updated`, `connected`

### Auth
| Method | Endpoint | Описание |
|--------|----------|----------|
| POST | `/api/auth/login`    | Вход (rate-limit: 10/15мин по email, 20/15мин по IP) |
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/refresh`  | Обновить токены |
| POST | `/api/auth/logout`   | Выход |
| GET  | `/api/auth/me`       | Текущий пользователь |

### Ресурсы (все требуют Bearer токен)
- `GET/POST /api/orders` — заказы
- `GET/PUT/DELETE /api/orders/{id}`
- `GET/POST /api/details` — номенклатура
- `GET/PUT/DELETE /api/details/{id}`
- `GET /api/tasks` — задания
- `GET /api/tasks/scan/{qr}` — поиск по QR ← статичный маршрут выше `{id}`
- `GET /api/tasks/{id}`
- `PATCH /api/tasks/{id}/status` — изменить статус
- `POST /api/tasks/{id}/close` — закрыть (пишет в scan_log)
- `GET/POST /api/scan-log`
- `GET /api/dashboard`

### Admin
- `GET/POST /api/admin/users`
- `GET/PUT/DELETE /api/admin/users/{id}`
- `GET /api/admin/roles`
- `PUT /api/admin/roles/{id}/permissions`

---

## Переменные окружения

| Переменная | По умолчанию | Описание |
|------------|-------------|----------|
| `APP_PORT` | `8080` | HTTP порт |
| `APP_HTTPS_PORT` | `8443` | HTTPS порт |
| `DB_NAME` | `marshrut` | База данных |
| `DB_USER` | `marshrut` | Пользователь MySQL |
| `DB_PASSWORD` | `marshrut` | Пароль MySQL |
| `MYSQL_ROOT_PASSWORD` | `rootsecret` | Root пароль |
| `JWT_SECRET` | `change-me-...` | Секрет для JWT |
| `ADMIN_EMAIL` | `admin@marshrut.local` | Email администратора |
| `ADMIN_PASSWORD` | `Admin1234!` | Пароль администратора |
