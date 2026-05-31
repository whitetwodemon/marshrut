import React from 'react'

/**
 * Wiki.jsx — Справочная система Маршрут MES
 *
 * Содержит документацию по всем функциям системы.
 * Разделы: О системе, Заказы, Рабочие центры, Сканер, Нормоконтроль,
 *          Простои, Смены, Безопасность, О разработчике.
 */

function WikiPage() {
  const [section, setSection] = React.useState('overview');

  /** Разделы бокового меню */
  const sections = [
    { id: 'overview',    label: 'О системе' },
    { id: 'orders',      label: 'Заказы' },
    { id: 'workcenters', label: 'Рабочие центры' },
    { id: 'scanner',     label: 'Сканер QR' },
    { id: 'normcontrol', label: 'Нормоконтроль' },
    { id: 'pauses',      label: 'Простои' },
    { id: 'shifts',      label: 'Смены' },
    { id: 'security',    label: 'Доступ и роли' },
    { id: 'about',       label: 'О разработчике' },
  ];

  /** Хелпер: сгенерировать раздел с заголовком и параграфами */
  function makeContent(title, items) {
    return (
      <div>
        <h2 style={{ fontSize:18, fontWeight:700, marginBottom:16 }}>{title}</h2>
        {items.map(([t, txt]) => (
          <div key={t} style={{ marginBottom:14, paddingBottom:14, borderBottom:'1px solid var(--line-2)' }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:6, color:'var(--accent)' }}>{t}</div>
            <p style={{ fontSize:13, color:'var(--fg-1)', lineHeight:1.7, margin:0 }}>{txt}</p>
          </div>
        ))}
      </div>
    );
  }

  const CONTENT = {

    // ── О системе ────────────────────────────────────────────────────────
    overview: (
      <div>
        <h2 style={{ fontSize:18, fontWeight:700, marginBottom:12 }}>Маршрут MES v2.0</h2>
        <p style={{ marginBottom:16, lineHeight:1.7, fontSize:13 }}>
          <b>Маршрут</b> — производственная система управления (MES) для отслеживания
          прохождения деталей по рабочим центрам. Создавайте заказы, отслеживайте
          операции в реальном времени, сканируйте QR-коды для закрытия операций,
          контролируйте нормативное время и ведите посменный учёт.
        </p>

        {/* Карточки функционала */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:10, marginBottom:20 }}>
          {[
            ['📋', 'Заказы',          'W/D/K с автонумерацией, 9 статусов, маршрутные листы'],
            ['🏭', 'Рабочие центры',  '16 РЦ, цепочка операций, drag&drop приоритет'],
            ['📱', 'QR сканер',       'Закрытие, пауза и просмотр через камеру'],
            ['⏱',  'Нормоконтроль',   'Живой таймер факт/план, отчёт по операторам'],
            ['⏸',  'Простои',        '6 причин, учёт в посменном отчёте'],
            ['🌙',  'Смены',          '12ч дневная/ночная, передача задания, отчёт'],
            ['📊',  'Отчёты',         'Excel 4 листа, история заказов, журнал'],
            ['🔐',  'Безопасность',   'JWT, RBAC 4 роли, запрет работы без смены'],
          ].map(([icon, title, desc]) => (
            <div key={title} style={{ background:'var(--bg-1)', border:'1px solid var(--line-1)',
              borderRadius:10, padding:14 }}>
              <div style={{ fontSize:24, marginBottom:6 }}>{icon}</div>
              <div style={{ fontWeight:700, fontSize:13, marginBottom:4 }}>{title}</div>
              <div style={{ fontSize:11, color:'var(--fg-2)', lineHeight:1.5 }}>{desc}</div>
            </div>
          ))}
        </div>

        {/* Технический стек */}
        <div style={{ background:'var(--bg-1)', border:'1px solid var(--line-1)', borderRadius:10, padding:16 }}>
          <div style={{ fontWeight:700, marginBottom:10 }}>Технологии</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:8, fontSize:12 }}>
            {[['⚙️','PHP 8.3','Backend API, PSR-4'],['⚛️','React 18','Frontend, Vite'],
              ['🗄️','MySQL 8','20 таблиц'],['🐳','Docker','Контейнеры'],
              ['🔐','JWT','Auth + RBAC'],['📱','PWA','Мобильная версия']
            ].map(([icon, tech, desc]) => (
              <div key={tech} style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span>{icon}</span>
                <div><div style={{ fontWeight:600 }}>{tech}</div><div style={{ color:'var(--fg-2)', fontSize:10 }}>{desc}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),

    // ── Заказы ───────────────────────────────────────────────────────────
    orders: makeContent('Работа с заказами', [
      ['Типы заказов', 'При создании выбирается тип: W — Заказ (W_26_000001), D — Доработка (D_26_000001), K — Кооперация (K_26_000001). Номер формируется автоматически, менять нельзя. Каждый тип имеет отдельный счётчик.'],
      ['Создание заказа', 'Кнопка «+ Новый заказ» → выбор типа → добавление деталей из номенклатуры с количеством → установка срока. Задания по операциям создаются автоматически при сохранении.'],
      ['Цепочка операций', 'На рабочий центр попадает только ПЕРВАЯ незавершённая операция каждой детали. После закрытия операции следующая автоматически становится активной на своём РЦ.'],
      ['Добавление операций', 'В карточке заказа → «▼ операции» → «+ Добавить» → выбрать рабочий центр и нормативное время. Операция добавляется в конец очереди. Также можно добавить в Номенклатуре.'],
      ['Маршрутный лист', 'Заказы → открыть → «Маршрутный лист» (или кнопка печати). Содержит QR-коды для каждой операции. Два QR у закрытых операций: первый — открыть задание, второй — просмотреть информацию о закрытии.'],
      ['Частичная сдача', 'Оператор может сдать 3 из 10 деталей — операция остаётся открытой, в журнал записывается партия №1. Следующая сдача — партия №2. Полное закрытие только при completed ≥ planned.'],
      ['Статусы заказа', 'draft → plan → waiting_material/equipment/approval → in_work → done. При закрытии последней операции заказ переводится в «done» автоматически.'],
    ]),

    // ── Рабочие центры ───────────────────────────────────────────────────
    workcenters: (
      <div>
        <h2 style={{ fontSize:18, fontWeight:700, marginBottom:12 }}>Рабочие центры</h2>
        <p style={{ marginBottom:14, fontSize:13, lineHeight:1.7 }}>
          На странице «Рабочие центры» — карточки всех РЦ с очередью заданий.
          Задание появляется на РЦ только когда оно текущее (первое незавершённое) для данной детали.
        </p>

        {/* Список РЦ */}
        <div style={{ background:'var(--bg-1)', border:'1px solid var(--line-1)', borderRadius:10,
          padding:14, marginBottom:16 }}>
          <div style={{ fontWeight:700, marginBottom:10 }}>16 рабочих центров:</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:6 }}>
            {[
              ['101','Заготовка'],['104','Токарный универсальный'],['120','Токарный ЧПУ Большой'],
              ['124','Сварочный цех'],['128','Термообработка'],['129','Эрозия'],['136','Прожиг'],
              ['301','Слесарные работы'],['710','Лазер'],['711','Гибка'],
              ['720','Токарный ЧПУ Маленький'],['721','Фрезерный Siemens'],['722','Фрезерный Fanuc'],
              ['731','Токарно-фрезерный'],['901','Кооперация'],['1101','ОТК'],
            ].map(([code, name]) => (
              <div key={code} style={{ display:'flex', gap:8, fontSize:12 }}>
                <span style={{ fontWeight:800, color:'var(--accent)', fontFamily:'monospace', width:40 }}>{code}</span>
                <span>{name}</span>
              </div>
            ))}
          </div>
        </div>

        {makeContent('', [
          ['Очерёдность заказов', 'Карточки заказов на РЦ можно перетаскивать. Порядок сохраняется на сервере — все мастера видят одинаковую очередь.'],
          ['Таймер', 'В карточке задания показывается: время выполнения / норматив, прогресс-бар, предупреждение о просрочке (+N мин сверх нормы).'],
          ['Кнопки действий', '▶ Начать — запустить таймер (требует открытой смены). ✓ Закрыть — завершить операцию. ⏸ Пауза — зафиксировать простой с указанием причины. ▶ Продолжить — после паузы.'],
        ])}
      </div>
    ),

    // ── Сканер ───────────────────────────────────────────────────────────
    scanner: makeContent('QR Сканер', [
      ['Закрытие операции', 'Сканируйте QR из маршрутного листа. Появится форма: количество деталей, имя оператора, комментарий. Можно указать меньше чем план — операция останется открытой (частичная сдача).'],
      ['Пауза через QR', 'В маршрутном листе у каждой активной операции — QR «пауза» (оранжевый). Оператор сканирует → выбирает причину (обед/перерыв/технолог/...). Для возобновления — сканирует снова.'],
      ['DONE: QR', 'Зелёный QR у закрытой операции. Сканирование открывает карточку: кто закрыл, когда, сколько деталей, факт/план время, нормоконтроль.'],
      ['Ручной ввод', 'Если камера недоступна — введите код вручную в поле под сканером или выберите задание из списка активных операций.'],
      ['Требования', 'Для работы камеры сайт должен быть открыт по HTTPS. На http:// камера работает только в Chrome Developer Mode.'],
    ]),

    // ── Нормоконтроль ────────────────────────────────────────────────────
    normcontrol: makeContent('Нормоконтроль', [
      ['Где смотреть', 'Табло → вкладка «📊 Нормоконтроль» — таблица всех операций с план/факт/% и итоговыми KPI. На странице «Рабочие центры» — живой таймер в каждой строке задания.'],
      ['Цвета и индикация', '🟢 Зелёный ≤100% — выполнено в норме. 🟡 Жёлтый 100–115% — незначительное превышение. 🔴 Красный >115% — значительное превышение.'],
      ['Как считается время', 'Таймер запускается при взятии в работу (started_at). При закрытии фиксируется actual_time_min = (now − started_at). Время пауз НЕ вычитается автоматически.'],
      ['Excel отчёт', 'Выгрузки Excel → «Сводный отчёт» — лист «По операторам»: выполнено операций, норм.часов, факт.часов, кол-во превышений нормы.'],
    ]),

    // ── Простои ──────────────────────────────────────────────────────────
    pauses: makeContent('Учёт простоев', [
      ['Причины', '🍽 Обед · ☕ Перерыв · 📐 Технолог/согласование · 📦 Ожидание материала · 🔧 Поломка оборудования · 📝 Прочее'],
      ['Через кнопку', 'На Табло или на странице «Рабочие центры» — кнопка ⏸ Пауза рядом с заданием «В работе».'],
      ['Через QR сканер', 'Каждая активная операция в маршрутном листе имеет QR «пауза». Оператор сканирует телефоном → выбирает причину → подтверждает. Для возобновления — сканирует тот же QR.'],
      ['В посменном отчёте', 'Суммарное время пауз каждого оператора фиксируется в передаче задания и отображается в посменном отчёте в колонке «Паузы, мин».'],
    ]),

    // ── Смены ────────────────────────────────────────────────────────────
    shifts: makeContent('Открытие и закрытие смены', [
      ['Открытие смены', 'Кнопка «▶ Открыть смену» в верхней панели → выбор типа: ☀️ Дневная (08:00–20:00) или 🌙 Ночная (20:00–08:00). При открытии новой смены предыдущая закрывается автоматически.'],
      ['Таймер смены', 'В верхней панели показывается: название смены, прошедшее время (Xч YYм), прогресс-бар на 12 часов. При >90% прогресс-бар становится красным.'],
      ['Запрет работы без смены', 'Оператор не может взять задание в работу если нет открытой смены. Кнопка «▶ Начать» вернёт ошибку: «Нет открытой смены».'],
      ['Передача задания', 'Кнопка «⇄ Передать задание» → выбрать задание (из активных) → указать: кто сдаёт, кто принимает, сколько деталей сделано, рабочее время, паузы. Задание переходит в «Ожидает» — готово для следующего оператора.'],
      ['Закрытие смены', 'Кнопка «■ Закрыть смену» → добавить примечания → подтвердить.'],
      ['Посменный отчёт', 'Раздел «Смены» → выбрать смену → отчёт: KPI (закрыто операций, передач, рабочее время, паузы), таблица по каждому оператору, все передачи с деталями, полный список закрытых операций.'],
    ]),

    // ── Безопасность и роли ──────────────────────────────────────────────
    security: (
      <div>
        <h2 style={{ fontSize:18, fontWeight:700, marginBottom:16 }}>Доступ и роли</h2>

        {/* Таблица ролей */}
        <div className="tbl-wrap" style={{ marginBottom:20 }}>
          <table className="tbl">
            <thead><tr>
              <th>Роль</th><th>Вход</th><th>Создание заказов</th>
              <th>Управление заданиями</th><th>Операторские действия</th><th>Администрирование</th>
            </tr></thead>
            <tbody>
              {[
                ['admin',   '✅', '✅', '✅', '✅', '✅'],
                ['foreman', '✅', '✅', '✅', '✅', '❌'],
                ['operator','✅', '❌', '❌', '✅', '❌'],
                ['viewer',  '✅', '❌', '❌', '❌', '❌'],
              ].map(([role, ...perms]) => (
                <tr key={role}>
                  <td><span className="mono" style={{ fontWeight:700 }}>{role}</span></td>
                  {perms.map((p, i) => <td key={i} style={{ textAlign:'center' }}>{p}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {makeContent('', [
          ['Тестовые аккаунты', 'admin@marshrut.local / Admin1234! · foreman@marshrut.local / Test1234! · operator1@marshrut.local / Test1234! · viewer@marshrut.local / Test1234!'],
          ['JWT авторизация', 'Access token: 1 час, хранится в памяти браузера. Refresh token: 30 дней, HttpOnly cookie (недоступен JavaScript). При перезагрузке страницы сессия восстанавливается автоматически.'],
          ['Rate limiting', 'Не более 5 попыток входа в час с одного IP. При превышении — блокировка без сообщения причины.'],
          ['Ограничения оператора', 'Нельзя начать работу без открытой смены. Нельзя иметь более одного задания «В работе» на одном рабочем центре.'],
        ])}
      </div>
    ),

    // ── О разработчике ───────────────────────────────────────────────────
    about: (
      <div>
        <h2 style={{ fontSize:18, fontWeight:700, marginBottom:16 }}>О разработчике</h2>
        <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
          <div style={{ background:'var(--bg-1)', border:'1px solid var(--line-1)',
            borderRadius:16, padding:28, flexShrink:0 }}>
            <div style={{ fontSize:48, marginBottom:12 }}>👨‍💻</div>
            <div style={{ fontSize:20, fontWeight:800, marginBottom:4 }}>Максимовский Илья</div>
            <div style={{ fontSize:13, color:'var(--fg-2)', marginBottom:16 }}>Fullstack разработчик</div>
            <a href="https://maximovskiy.tech" target="_blank" rel="noopener noreferrer"
              style={{ display:'flex', alignItems:'center', gap:8, color:'var(--accent)',
                fontSize:14, fontWeight:600, textDecoration:'none' }}>
              🌐 maximovskiy.tech
            </a>
          </div>
          <div style={{ flex:1, minWidth:220 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:12, color:'var(--accent)' }}>Стек</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',
              gap:8, marginBottom:20 }}>
              {[['⚙️','PHP 8.3','Backend API'],['⚛️','React 18','Frontend Vite'],
                ['🗄️','MySQL 8','База данных'],['🐳','Docker','Контейнеры'],
                ['🔐','JWT','Авторизация'],['📱','PWA','Мобильная версия']
              ].map(([icon, tech, desc]) => (
                <div key={tech} style={{ background:'var(--bg-1)', border:'1px solid var(--line-1)',
                  borderRadius:8, padding:10, fontSize:12 }}>
                  <div style={{ fontSize:18, marginBottom:4 }}>{icon}</div>
                  <div style={{ fontWeight:700 }}>{tech}</div>
                  <div style={{ color:'var(--fg-2)', fontSize:11 }}>{desc}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:13, color:'var(--fg-2)', lineHeight:1.8 }}>
              <div>Маршрут MES v2.0 · © 2026</div>
              <div>
                <a href="https://maximovskiy.tech" target="_blank" rel="noopener noreferrer"
                  style={{ color:'var(--accent)' }}>
                  maximovskiy.tech
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">📖 Справка</h1>
          <div className="page-sub">Документация по системе Маршрут MES v2.0</div>
        </div>
      </div>

      <div style={{ display:'flex', gap:16, alignItems:'flex-start', flexWrap:'wrap' }}>
        {/* Боковое меню разделов */}
        <div style={{ minWidth:155, background:'var(--bg-1)', border:'1px solid var(--line-1)',
          borderRadius:12, padding:8, flexShrink:0 }}>
          {sections.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)}
              style={{ display:'block', width:'100%', padding:'8px 12px', borderRadius:7,
                border:'none', cursor:'pointer', textAlign:'left', fontSize:13,
                fontFamily:'var(--ui-font)', fontWeight:section === s.id ? 600 : 400,
                marginBottom:2,
                background: section === s.id ? 'var(--accent)' : 'transparent',
                color:       section === s.id ? '#fff' : 'var(--fg-1)' }}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Контент выбранного раздела */}
        <div style={{ flex:1, minWidth:0, background:'var(--bg-1)',
          border:'1px solid var(--line-1)', borderRadius:12, padding:24 }}>
          {CONTENT[section]}
        </div>
      </div>
    </>
  );
}

export { WikiPage }
