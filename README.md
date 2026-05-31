# Маршрут MES — Система управления производством

**Разработчик:** Максимовский Илья · [maximovskiy.tech](https://maximovskiy.tech)

## Стек
- **Backend:** PHP 8.3-FPM, самописный роутер, PSR-4, JWT HS256
- **Frontend:** React 18 + Vite, модульная структура
- **БД:** MySQL 8.0, utf8mb4
- **Инфра:** Docker Compose (nginx + php + mysql + backup)

## Структура проекта
```
marshrut/
├── backend/
│   ├── public/index.php          — точка входа API, все роуты
│   └── src/
│       ├── Controllers/          — 10 контроллеров
│       │   ├── AuthController    — авторизация, JWT, refresh
│       │   ├── OrdersController  — CRUD заказов, автонумерация
│       │   ├── TasksController   — управление заданиями
│       │   ├── WorkCentersController — рабочие центры + приоритет
│       │   ├── PausesController  — простои
│       │   ├── ScanLogController — журнал сканирований
│       │   ├── DetailsController — номенклатура
│       │   ├── AdminController   — управление пользователями
│       │   ├── WorkshopsController — цеха + оборудование (legacy)
│       │   └── EventsController  — SSE real-time
│       ├── Middleware/           — Auth, Cors, RateLimit
│       └── Database/Connection.php
│
├── frontend-src/                 — VITE ИСХОДНИКИ
│   └── src/
│       ├── main.jsx              — точка входа React
│       ├── App.jsx               — корневой компонент, роутинг, стейт
│       ├── design-system.css     — все стили
│       ├── components/
│       │   ├── Icon.jsx          — SVG иконки (39 шт)
│       │   ├── QrCode.jsx        — QR генерация (qrcode-generator)
│       │   └── TweaksPanel.jsx   — панель настроек темы
│       ├── lib/
│       │   ├── api.js            — Auth + HTTP клиент
│       │   ├── api-helpers.jsx   — маперы API → frontend state
│       │   └── data.jsx          — строки, статусы, Sidebar, компоненты
│       └── screens/
│           ├── App.jsx           — Login + App root
│           ├── Dashboard.jsx     — производственное табло, нормоконтроль
│           ├── Library.jsx       — номенклатура деталей
│           ├── OrderBuilder.jsx  — редактор заказа
│           ├── RouteSheet.jsx    — маршрутный лист (просмотр + печать)
│           ├── WorkCenter.jsx    — рабочие центры, drag&drop приоритет
│           ├── History.jsx       — журнал + история заказов
│           ├── Reports.jsx       — список заказов + отчёт
│           ├── Workshop.jsx      — цеха + оборудование
│           ├── Excel.jsx         — выгрузки в Excel
│           ├── Wiki.jsx          — справка о системе
│           ├── Scanner.jsx       — QR сканер
│           └── Modals.jsx        — все модальные окна
│
├── frontend/dist/                — СОБРАННЫЙ фронтенд (nginx раздаёт)
│
├── mysql-init/                   — SQL миграции (выполняются в алфавитном порядке)
│   ├── 01_schema.sql             — основные таблицы
│   ├── 02_auth.sql               — пользователи, роли
│   ├── 03_workshops.sql          — цеха, оборудование
│   ├── 04_workcenters.sql        — рабочие центры, автонумерация, простои
│   ├── 05_migration.sql          — дополнительные миграции
│   └── 06_seed.sql               — демо-данные
│
└── docker/                       — Dockerfiles, nginx-app.conf
```

## Быстрый старт
```bash
cp .env.example .env
docker compose up -d --build
# Открыть https://localhost:8443
# Логин: admin@marshrut.local / Admin1234!
```

## Рабочие центры
101 Заготовка · 104 Токарный ун. · 120 Токарный ЧПУ Б. · 124 Сварка · 128 Термо
129 Эрозия · 136 Прожиг · 301 Слесарные · 710 Лазер · 711 Гибка
720 Токарный ЧПУ М. · 721 Фрезерный S · 722 Фрезерный F · 731 Токарно-фрезерный
901 Кооперация · 1101 ОТК

## Нумерация заказов
Формат `W_ГГ_NNNNNN` — атомарный счётчик в таблице `order_sequences`.
