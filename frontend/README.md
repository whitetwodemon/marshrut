# Фронтенд Маршрут MES (React 18 + Vite)

**Исходники здесь, в `src/`.** Раньше они лежали вне репозитория и терялись при
каждом деплое — теперь они часть проекта. Не удаляй `src/`, не работай только с
собранным `dist/`. Восстановить из минифицированного bundle крайне трудно (sourcemap не публикуется).

## Структура

```
src/
  main.jsx              точка входа (рендерит <App/>)
  App.jsx               корень: роутинг, панель смены, заказы, тосты
  design-system.css     ВСЕ классы вёрстки (modal-back, card, btn, tbl, field…)
  components/  Icon.jsx · QrCode.jsx · TweaksPanel.jsx
  lib/         api.js (api.* + Auth.*) · api-helpers.jsx · data.jsx (Sidebar/Topbar/версия)
  screens/     Screens.jsx (Dashboard/Library/OrderBuilder/Wiki) · Modals.jsx
               Specifications.jsx · Scanner.jsx
```

### Важные факты (чтобы не править не тот файл)

- `App.jsx` импортирует `ModalNewDetail`/`ModalEditDetail`/`AdminPanel` из
  **`screens/Modals.jsx`** — НЕ из отдельных файлов.
- Реальный `Sidebar` и строка версии — в **`lib/data.jsx`**.
- Все CSS-классы — в `design-system.css`. Используй существующие
  (`modal-back`, `modal-head/body/foot`, `card`, `btn`/`btn.primary`, `tbl`,
  `field`/`field-label`, `empty-state`, `icon-btn`, `grid-2/3`).
  НЕ выдумывай классы (`modal-backdrop`, `screen-pad` — таких нет, вёрстка сломается).

## Сборка

```bash
cd app/frontend
npm install        # один раз
npm run build      # → dist/ (его раздаёт nginx инстанса)
```

## Деплой (ВАЖНО)

`dist/` монтируется в nginx инстанса. После изменений:

```bash
npm run build
cd ../../<инстанс>.marshrut-mes.ru && docker compose --env-file .env up -d --force-recreate nginx
```

НЕ используй `git stash && git pull` на сервере — он стирает свежие изменения.
Распаковывай архив поверх и собирай. Проверка свежести bundle в контейнере:

```bash
docker exec <инстанс>-nginx grep -c "Открыть смену" /var/www/html/assets/index-*.js   # >0 = свежий
```

## Стек
React 18 · Vite 6 · design-system.css · jsqr · qrcode-generator · xlsx
