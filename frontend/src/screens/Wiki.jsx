import React from 'react'
import { api, Auth, API_BASE, parseServerDate, unwrap } from '../lib/api.js'
import { Icon } from '../components/Icon.jsx'
import { QrCode, generateQrSvg } from '../components/QrCode.jsx'
import { useStrings, StatusPill, OrderPicker, ORDER_STATUS_RU, STATUS_LABEL_RU } from '../lib/data.jsx'

export function WikiPage() {
  const [section, setSection] = React.useState('overview');

  const sections = [
    { id:'overview',     label:'О системе' },
    { id:'orders',       label:'Заказы' },
    { id:'statuses',     label:'Статусы заказов' },
    { id:'specifications', label:'Спецификация' },
    { id:'workcenters',  label:'Рабочие центры' },
    { id:'scanner',      label:'Сканер QR' },
    { id:'normcontrol',  label:'Нормоконтроль' },
    { id:'analytics',    label:'Аналитика' },
    { id:'shifts',       label:'Смены' },
    { id:'notifications',label:'Уведомления' },
    { id:'pauses',       label:'Простои' },
    { id:'license',      label:'Лицензия и код' },
    { id:'about',        label:'О разработчике' },
  ];

  const CONTENT = {
    overview: (
      <div>
        <h2 style={{fontSize:18,fontWeight:700,marginBottom:12}}>Маршрут MES — производственная система</h2>
        <p style={{marginBottom:12,lineHeight:1.7}}>
          <b>Маршрут</b> — система управления производством (MES) для отслеживания прохождения деталей по рабочим центрам.
          Система позволяет создавать заказы, отслеживать операции в реальном времени, сканировать QR-коды для
          отметки выполнения и контролировать нормативное время.
        </p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:10,marginBottom:20}}>
          {[
            ['📋','Заказы','Создание и управление производственными заказами'],
            ['🏭','Рабочие центры','16 центров: заготовка, токарные, фрезерные, ОТК и др.'],
            ['📱','QR сканер','Закрытие операций сканированием с любого устройства'],
            ['⏱','Нормоконтроль','Учёт план/факт времени, выявление отклонений'],
            ['⏸','Простои','Учёт причин остановки: обед, поломка, материал и др.'],
            ['📊','Отчёты','Excel выгрузки, история заказов, журнал сканирований'],
          ].map(([icon,title,desc]) => (
            <div key={title} style={{background:'var(--bg-1)',border:'1px solid var(--line-1)',borderRadius:10,padding:14}}>
              <div style={{fontSize:24,marginBottom:6}}>{icon}</div>
              <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>{title}</div>
              <div style={{fontSize:11,color:'var(--fg-2)',lineHeight:1.5}}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    orders: (
      <div>
        <h2 style={{fontSize:18,fontWeight:700,marginBottom:12}}>Работа с заказами</h2>
        {[
          ['Создание заказа', 'Нажмите «+ Новый заказ» на Табло или в разделе Заказы. Номер присваивается автоматически в формате W_ГГ_NNNNNN (например W_26_000001). Выберите детали из номенклатуры и укажите количество.'],
          ['Операции в заказе', 'Каждая деталь проходит операции согласно технологической карте из номенклатуры. Операции привязаны к рабочим центрам. Задание появляется на РЦ только когда предыдущая операция выполнена.'],
          ['Статусы заказа', 'Черновик → Планируется → В работе → Выполнен. При закрытии последней операции заказ переводится в «Выполнен» автоматически.'],
          ['Маршрутный лист', 'Документ печатается через Заказы → открыть → «Маршрутный лист». Содержит QR-коды для каждой операции. Закрытые операции выделяются зелёным с пометкой ЗАКРЫТА и данными об исполнителе.'],
          ['Статус «Проблема»', 'Если по заказу нет материала или инструмента — оператор жмёт «Проблема» и пишет причину. Заказ останавливается, все его операции блокируются (нельзя взять в работу). Причину видит мастер. Вернуть заказ в работу может только мастер кнопкой «Вернуть в работу».'],
          ['Открытие смены', 'Взять задание в работу можно только при открытой смене. Панель смены вверху: «Открыть смену» / «Закрыть смену». Без открытой смены кнопка «Начать» выдаёт ошибку.'],
          ['ТПЗ — время наладки', 'Подготовительно-заключительное время (наладка станка перед работой) задаётся для каждой операции в номенклатуре отдельным полем рядом со временем операции. Оператор запускает наладку отдельно: кнопка «🔧 Наладка» → «✓ Наладка готова». Фактическое время наладки фиксируется автоматически и учитывается отдельно от времени операции. Кнопка «▶ Начать» работу появляется только после завершения наладки (если ТПЗ задан).'],
        ].map(([title,text]) => (
          <div key={title} style={{marginBottom:16,paddingBottom:16,borderBottom:'1px solid var(--line-2)'}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:6,color:'var(--accent)'}}>{title}</div>
            <p style={{fontSize:13,color:'var(--fg-1)',lineHeight:1.7}}>{text}</p>
          </div>
        ))}
      </div>
    ),
    specifications: (
      <div>
        <h2 style={{fontSize:18,fontWeight:700,marginBottom:12}}>Спецификация</h2>
        {[
          ['Что это', 'Спецификация — заказ на производство от менеджера: перечень деталей к определённому сроку. Количество спецификаций не ограничено. Детали выбираются из номенклатуры или вводятся по названию.'],
          ['Создание', 'Менеджер жмёт «Новая спецификация»: название, клиент, срок и список деталей. Каждую деталь можно выбрать из выпадающего списка номенклатуры или вписать вручную, если техкарты ещё нет.'],
          ['Статусы (изменяемые)', 'В разработке — деталь на проработке у технолога (создаёт техкарту). В ожидании — техкарты готовы, ждёт запуска. В производстве — по позициям создаются заказы W_* и они связываются с номенклатурой. Статус меняется вручную в карточке спецификации.'],
          ['Готовность номенклатуры', 'Технолог по позициям без техкарты жмёт «Привязать номенклатуру» (поиск по коду/названию) — позиция помечается «✓ Готова».'],
          ['Создание заказов', 'Когда спецификация переведена в статус «В производстве», по готовым позициям доступна кнопка «Создать заказ»: автоматически создаётся заказ W_* и задания на операции, позиция связывается с номером заказа.'],
          ['Удаление', 'Спецификацию можно удалить из списка (корзина у строки) — вместе с её позициями. Уже созданные заказы при этом не удаляются.'],
        ].map(([title,text]) => (
          <div key={title} style={{marginBottom:16,paddingBottom:16,borderBottom:'1px solid var(--line-2)'}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:6,color:'var(--accent)'}}>{title}</div>
            <p style={{fontSize:13,color:'var(--fg-1)',lineHeight:1.7}}>{text}</p>
          </div>
        ))}
      </div>
    ),
    workcenters: (
      <div>
        <h2 style={{fontSize:18,fontWeight:700,marginBottom:12}}>Рабочие центры</h2>
        <p style={{marginBottom:16,fontSize:13,lineHeight:1.7}}>
          Список рабочих центров и операции которые на них висят прямо сейчас.
          Задание попадает на РЦ только когда это текущая (первая незавершённая) операция детали.
        </p>
        <div style={{background:'var(--bg-1)',border:'1px solid var(--line-1)',borderRadius:10,padding:14,marginBottom:16}}>
          <div style={{fontWeight:700,marginBottom:8}}>Список центров:</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:6}}>
            {[
              ['101','Заготовка'],['104','Токарный универсальный'],['120','Токарный ЧПУ Большой'],
              ['124','Сварочный цех'],['128','Термообработка'],['129','Эрозия'],
              ['136','Прожиг'],['301','Слесарные работы'],['710','Лазер'],
              ['711','Гибка'],['720','Токарный ЧПУ Маленький'],['721','Фрезерный Siemens'],
              ['722','Фрезерный Fanuc'],['731','Токарно-фрезерный'],['901','Кооперация'],['1101','ОТК'],
            ].map(([code,name]) => (
              <div key={code} style={{display:'flex',gap:6,alignItems:'center',fontSize:12}}>
                <span style={{fontWeight:800,color:'var(--accent)',fontFamily:'monospace',width:36}}>{code}</span>
                <span style={{color:'var(--fg-1)'}}>{name}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{fontWeight:700,fontSize:14,marginBottom:8,color:'var(--accent)'}}>Действия на РЦ</div>
        <p style={{fontSize:13,lineHeight:1.7}}>
          На странице «Рабочие центры» → выберите центр → видны все активные задания.
          Кнопка <b>▶ Начать</b> переводит задание в статус «В работе» и запускает таймер.
          <b> ✓ Закрыть</b> — завершить операцию (открывается диалог с количеством).
          <b> ⏸ Пауза</b> — зафиксировать простой с указанием причины.
          QR код в строке задания можно отсканировать мобильным для тех же действий.
        </p>
      </div>
    ),
    scanner: (
      <div>
        <h2 style={{fontSize:18,fontWeight:700,marginBottom:12}}>QR Сканер</h2>
        {[
          ['Сканирование операций', 'Раздел «Сканер» → включить камеру → навести на QR код из маршрутного листа. Система автоматически определяет задание и предлагает закрыть его с указанием количества и исполнителя.'],
          ['QR коды в маршрутном листе', 'Каждая операция имеет уникальный QR код вида OTASK:XXX-YYY-ZZ. Закрытые операции имеют второй QR код DONE:OTASK:... — его сканирование открывает информацию о выполнении.'],
          ['Ручной ввод', 'Если камера недоступна, введите код вручную в поле под сканером или выберите задание из списка активных операций.'],
          ['Требования', 'Для работы камеры сайт должен быть открыт по HTTPS. На localhost или IP без SSL камера работает только в Chrome с флагом --allow-insecure.'],
        ].map(([title,text]) => (
          <div key={title} style={{marginBottom:16,paddingBottom:16,borderBottom:'1px solid var(--line-2)'}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:6,color:'var(--accent)'}}>{title}</div>
            <p style={{fontSize:13,color:'var(--fg-1)',lineHeight:1.7}}>{text}</p>
          </div>
        ))}
      </div>
    ),
    normcontrol: (
      <div>
        <h2 style={{fontSize:18,fontWeight:700,marginBottom:12}}>Нормоконтроль</h2>
        <p style={{marginBottom:16,fontSize:13,lineHeight:1.7}}>
          Система сравнивает плановое время операций с фактическим затраченным временем.
        </p>
        {[
          ['Где смотреть', 'Табло → вкладка «📊 Нормоконтроль» — таблица всех операций заказа с план/факт/% и итоговыми KPI. Рабочие центры → карточка задания показывает живой таймер с прогресс-баром. Маршрутный лист → столбец «Факт вр» для закрытых операций.'],
          ['Цветовая индикация', '🟢 Зелёный — в норме (≤100% от плана). 🟡 Жёлтый — незначительное превышение (100–115%). 🔴 Красный — превышение более 15% от нормы.'],
          ['Как считается', 'Время запускается при переводе задания в «В работе» (поле started_at). При закрытии фиксируется actual_time_min. Время простоев НЕ вычитается автоматически — учитывайте это при анализе.'],
          ['Excel отчёт', 'В разделе «Выгрузки Excel» → «Сводный отчёт» есть лист с нормоконтролем по операторам и рабочим центрам.'],
        ].map(([title,text]) => (
          <div key={title} style={{marginBottom:16,paddingBottom:16,borderBottom:'1px solid var(--line-2)'}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:6,color:'var(--accent)'}}>{title}</div>
            <p style={{fontSize:13,color:'var(--fg-1)',lineHeight:1.7}}>{text}</p>
          </div>
        ))}
      </div>
    ),
    statuses: (
      <div>
        <h2 style={{fontSize:18,fontWeight:700,marginBottom:12}}>Статусы заказов</h2>
        <p style={{marginBottom:12,lineHeight:1.7}}>Заказ проходит через статусы от планирования до архива:</p>
        <ul style={{lineHeight:1.9,paddingLeft:20,marginBottom:12}}>
          <li><b>Планируется / В работе</b> — заказ в производстве, задания видны на постах.</li>
          <li><b>⚠ Проблема</b> — оператор сообщил о проблеме (нет материала/инструмента); заказ приостановлен, уходит вниз списка, старшие мастера получают уведомление.</li>
          <li><b>Выполнен</b> — все операции закрыты.</li>
          <li><b>📦 Отгружен</b> — кнопка «Отгрузка» в истории заказов переводит выполненный заказ сюда.</li>
          <li><b>🗄 Архив</b> — отгруженный заказ можно окончательно убрать в архив.</li>
        </ul>
        <p style={{lineHeight:1.7}}>Только заказы «В работе» показываются в производственном табло. Фильтр и поиск по статусам доступны в списке заказов и отчётах.</p>
      </div>
    ),
    analytics: (
      <div>
        <h2 style={{fontSize:18,fontWeight:700,marginBottom:12}}>Аналитика производства</h2>
        <p style={{marginBottom:12,lineHeight:1.7}}>
          Раздел <b>«Аналитика цеха»</b> (расширенная функция — включается в Админ-панель → Обслуживание → Функции) показывает:
        </p>
        <ul style={{lineHeight:1.9,paddingLeft:20,marginBottom:12}}>
          <li><b>Загрузка РЦ</b> — задания по статусам (выполнено / в работе / в очереди) и план/факт в часах.</li>
          <li><b>Узкие места</b> — рабочие центры с наибольшей очередью ожидающих заданий.</li>
          <li><b>Нормоконтроль</b> — процент факт/план по выполненным операциям.</li>
          <li><b>Динамика</b> — закрытых операций за 14 дней.</li>
          <li><b>🗺 Роадмап</b> — таймлайн заказов по срокам (Gantt): прогресс, просрочки, план производства вперёд.</li>
        </ul>
      </div>
    ),
    shifts: (
      <div>
        <h2 style={{fontSize:18,fontWeight:700,marginBottom:12}}>Смены</h2>
        <p style={{marginBottom:12,lineHeight:1.7}}>При открытии смены выбирается тип:</p>
        <ul style={{lineHeight:1.9,paddingLeft:20,marginBottom:12}}>
          <li><b>☀ Дневная</b> — с 07:00 до 19:00.</li>
          <li><b>🌙 Ночная</b> — с 19:00 до 07:00.</li>
        </ul>
        <p style={{lineHeight:1.7}}>При закрытии смены можно оставить комментарий и передать смену следующему мастеру. Вся история смен доступна в разделе «История смен», её можно очистить в админ-панели.</p>
      </div>
    ),
    notifications: (
      <div>
        <h2 style={{fontSize:18,fontWeight:700,marginBottom:12}}>Уведомления</h2>
        <p style={{marginBottom:12,lineHeight:1.7}}>Колокольчик 🔔 в верхней панели показывает уведомления для вашей роли:</p>
        <ul style={{lineHeight:1.9,paddingLeft:20,marginBottom:12}}>
          <li><b>Старшие мастера</b> — ⚠ проблемы по заказам, ✓ выполнение заказов.</li>
          <li><b>Операторы</b> — 🔧 новые заказы, поступившие в работу.</li>
        </ul>
        <p style={{lineHeight:1.7}}>Счётчик показывает непрочитанные; при открытии панели они отмечаются прочитанными. Обновление — раз в минуту.</p>
      </div>
    ),
    pauses: (
      <div>
        <h2 style={{fontSize:18,fontWeight:700,marginBottom:12}}>Учёт простоев</h2>
        <p style={{marginBottom:16,fontSize:13,lineHeight:1.7}}>
          Простой фиксируется когда оператор временно прекращает работу над операцией.
        </p>
        <div style={{marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:8,color:'var(--accent)'}}>Причины простоя</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:8}}>
            {[
              ['🍽','Обед','Регламентный перерыв'],
              ['☕','Перерыв','Кратковременный отдых'],
              ['📐','Технолог','Ожидание согласования'],
              ['📦','Материал','Ожидание заготовки'],
              ['🔧','Поломка','Неисправность оборудования'],
              ['📝','Прочее','Другие причины'],
            ].map(([icon,title,desc]) => (
              <div key={title} style={{background:'var(--bg-1)',border:'1px solid var(--line-1)',borderRadius:8,padding:10}}>
                <div style={{fontSize:20,marginBottom:4}}>{icon}</div>
                <div style={{fontWeight:600,fontSize:13}}>{title}</div>
                <div style={{fontSize:11,color:'var(--fg-2)'}}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
        <p style={{fontSize:13,lineHeight:1.7}}>
          Кнопка <b>⏸ Пауза</b> на рабочем центре или на табло переводит задание в статус «Пауза».
          Кнопка <b>▶ Продолжить</b> возобновляет работу. Время простоя записывается в таблицу task_pauses.
        </p>
      </div>
    ),
    // Пасхалка: Бруно (2024–2026)
    license: (
      <div>
        <h2 style={{fontSize:18,fontWeight:700,marginBottom:12}}>Лицензия и открытый код</h2>
        <p style={{marginBottom:12,lineHeight:1.7}}>
          Ядро «Маршрут MES» — открытое программное обеспечение по лицензии <b>AGPL-3.0</b>.
          Вы можете изучать исходный код, разворачивать систему на своём сервере и предлагать доработки.
        </p>
        <ul style={{lineHeight:1.9,paddingLeft:20,marginBottom:12}}>
          <li><b>Открыто:</b> ядро системы — заказы, задания, сканер, смены, отчёты, печать.</li>
          <li><b>По подписке:</b> модуль 1С-обмена и расширенная аналитика (включаются в админ-панели после активации).</li>
          <li><b>Услуги автора:</b> внедрение под ключ, обучение, интеграции, доработки и поддержка (SLA).</li>
        </ul>
        <p style={{lineHeight:1.7}}>
          Вопросы лицензирования и заказ внедрения: <a href="https://t.me/White2demon" target="_blank" rel="noreferrer" style={{color:'var(--accent)'}}>t.me/White2demon</a> · <a href="https://marshrut-mes.ru" target="_blank" rel="noreferrer" style={{color:'var(--accent)'}}>marshrut-mes.ru</a>
        </p>
        <p className="muted" style={{fontSize:12, marginTop:20, borderTop:'1px solid var(--line-2)', paddingTop:12}}>
          🐾 В коде этой системы живёт пиксельный кот Бруно (2024–2026) — оранжево-белый, без хвоста,
          вдохновитель проектов автора. Если найдёте его — погладьте (кликните).
        </p>
      </div>
    ),
    about: (
      <div>
        <h2 style={{fontSize:18,fontWeight:700,marginBottom:16}}>О разработчике</h2>
        <div style={{display:'flex',gap:20,alignItems:'flex-start',flexWrap:'wrap'}}>
          <div style={{background:'var(--bg-1)',border:'1px solid var(--line-1)',borderRadius:16,padding:28,flex:1,minWidth:240}}>
            <div style={{fontSize:48,marginBottom:12}}>👨‍💻</div>
            <div style={{fontSize:20,fontWeight:800,marginBottom:4}}>Максимовский Илья</div>
            <div style={{fontSize:13,color:'var(--fg-2)',marginBottom:16}}>Fullstack разработчик</div>
            <a href="https://maximovskiy.tech" target="_blank" rel="noopener noreferrer"
              style={{display:'flex',alignItems:'center',gap:8,color:'var(--accent)',fontSize:14,fontWeight:600,textDecoration:'none'}}>
              🌐 maximovskiy.tech
            </a>
          </div>
          <div style={{flex:2,minWidth:240}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:12,color:'var(--accent)'}}>Технологический стек</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:8,marginBottom:20}}>
              {[
                ['⚙️','PHP 8.3','Backend API, PSR-4'],
                ['⚛️','React 18','Frontend, Vite build'],
                ['🗄️','MySQL 8','База данных'],
                ['🐳','Docker','Контейнеризация'],
                ['🔐','JWT','Авторизация'],
                ['📱','PWA','Мобильная версия'],
              ].map(([icon,tech,desc]) => (
                <div key={tech} style={{background:'var(--bg-1)',border:'1px solid var(--line-1)',borderRadius:8,padding:10,fontSize:12}}>
                  <div style={{fontSize:18,marginBottom:4}}>{icon}</div>
                  <div style={{fontWeight:700}}>{tech}</div>
                  <div style={{color:'var(--fg-2)',fontSize:11}}>{desc}</div>
                </div>
              ))}
            </div>
            <div style={{fontWeight:700,fontSize:14,marginBottom:8,color:'var(--accent)'}}>Версия системы</div>
            <div style={{fontSize:13,color:'var(--fg-2)',lineHeight:1.8}}>
              <div>Маршрут MES v2.0</div>
              <div>© 2026 Максимовский Илья</div>
              <div><a href="https://maximovskiy.tech" target="_blank" rel="noopener noreferrer"
                style={{color:'var(--accent)'}}>maximovskiy.tech</a></div>
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
          <div className="page-sub">Документация по системе Маршрут MES</div>
        </div>
      </div>

      <div style={{ display:'flex', gap:16, alignItems:'flex-start', flexWrap:'wrap' }}>
        {/* Боковое меню */}
        <div style={{ minWidth:160, background:'var(--bg-1)', border:'1px solid var(--line-1)',
          borderRadius:12, padding:8, flexShrink:0 }}>
          {sections.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)}
              style={{ display:'block', width:'100%', padding:'8px 12px', borderRadius:7,
                border:'none', cursor:'pointer', textAlign:'left', fontSize:13,
                fontFamily:'var(--ui-font)', fontWeight: section===s.id ? 600 : 400,
                background: section===s.id ? 'var(--accent)' : 'transparent',
                color: section===s.id ? '#fff' : 'var(--fg-1)',
                marginBottom:2 }}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Контент */}
        <div style={{ flex:1, minWidth:0, background:'var(--bg-1)',
          border:'1px solid var(--line-1)', borderRadius:12, padding:24 }}>
          {CONTENT[section]}
        </div>
      </div>
    </>
  );
}


// ── История смен (#3): смены за дату с операторами, заказами, операциями ──
