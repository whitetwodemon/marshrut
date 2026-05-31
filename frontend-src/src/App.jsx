/**
 * App.jsx — Корневой компонент приложения
 *
 * Отвечает за:
 * - Инициализацию сессии (восстановление JWT при F5)
 * - Подключение к SSE (real-time обновления)
 * - Роутинг между экранами
 * - Рендер модальных окон
 *
 * Стейт вынесен в useAppStore (Context + useReducer).
 * SSE с exponential backoff — в useSSE.
 * Бизнес-логика заданий — в useTaskActions.
 */

import React from 'react'
import { api, Auth, setAuthExpiredHandler } from './lib/api.js'
import { apiOrderToData, apiTasksToFrontend, apiScanLogToFrontend } from './lib/api-helpers.jsx'
import { Icon } from './components/Icon.jsx'
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakSlider } from './components/TweaksPanel.jsx'
import { useStrings, Sidebar, Topbar, OrderPicker } from './lib/data.jsx'
import { AppProvider, useAppStore } from './store/useAppStore.jsx'
import { useSSE } from './hooks/useSSE.js'
import { useTaskActions } from './hooks/useTaskActions.js'

// ── Импорты экранов ───────────────────────────────────────────────────────
import { Dashboard }                              from './screens/Dashboard.jsx'
import { Library }                                from './screens/Library.jsx'
import { OrderBuilder }                           from './screens/OrderBuilder.jsx'
import { RouteSheetView }                         from './screens/RouteSheet.jsx'
import { WorkCentersView, ModalManageWorkCenters } from './screens/WorkCenter.jsx'
import { HistoryView, HistoryOrdersView }         from './screens/History.jsx'
import { OrdersListView, ReportView }             from './screens/Reports.jsx'
import { ShiftBar, ModalOpenShift, ModalCloseShift, ModalHandoff, ShiftsView } from './screens/Shifts.jsx'
import { ShiftDayReport } from './screens/ShiftDayReport.jsx'
import { ExcelExportView }                        from './screens/Excel.jsx'
import { WikiPage }                               from './screens/Wiki.jsx'
import { Scanner, CloseOpModal }                  from './screens/Scanner.jsx'
import { ModalEditDetail, ModalEditOrder, ModalNewOrder, ModalNewDetail,
         AdminPanel, EquipmentDatalist, ModalPause } from './screens/Modals.jsx'

// ── Настройки темы по умолчанию ───────────────────────────────────────────
const TWEAK_DEFAULTS = {
  theme:   'dark',
  density: 'compact',
  lang:    'ru',
  qrSize:  70,
  accent:  '#d9480f',
};

// ─────────────────────────────────────────────────────────────────────────
// LoginScreen — экран входа в систему
// ─────────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [tab,     setTab]     = React.useState('login');
  const [name,    setName]    = React.useState('');
  const [email,   setEmail]   = React.useState('');
  const [pass,    setPass]    = React.useState('');
  const [err,     setErr]     = React.useState('');
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit() {
    setErr(''); setLoading(true);
    try {
      const endpoint = tab === 'login' ? '/auth/login' : '/auth/register';
      const payload  = tab === 'login'
        ? { email, password: pass }
        : { name, email, password: pass };

      const data = await api.post(endpoint, payload);

      // Сохраняем токены и данные пользователя
      Auth.setToken(data.access_token);
      Auth.setRefresh(data.refresh_token);
      Auth.setUser(data.user);
      onLogin(data.user);
    } catch (e) {
      setErr(e.message);
    }
    setLoading(false);
  }

  return (
    <div style={{ minHeight:'100svh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'var(--bg-0)', fontFamily:'var(--ui-font)', padding:16 }}>
      <div style={{ width:'100%', maxWidth:400, padding:'0 16px' }}>
        {/* Логотип */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:22, fontWeight:700, color:'var(--fg-0)', letterSpacing:'-0.5px' }}>
            МАРШРУТ
          </div>
          <div style={{ fontSize:12, color:'var(--fg-2)', marginTop:4 }}>Производственная система</div>
        </div>

        <div className="card" style={{ padding:28 }}>
          {/* Переключатель вход/регистрация */}
          <div style={{ display:'flex', gap:4, marginBottom:24, background:'var(--bg-1)',
            borderRadius:8, padding:4 }}>
            {['login', 'register'].map(t => (
              <button key={t} onClick={() => { setTab(t); setErr(''); }}
                style={{ flex:1, padding:'6px 0', fontSize:13, fontWeight:500, border:'none',
                  cursor:'pointer', borderRadius:6, transition:'all .15s',
                  background: tab === t ? 'var(--bg-2)' : 'transparent',
                  color:      tab === t ? 'var(--fg-0)' : 'var(--fg-2)',
                  boxShadow:  tab === t ? '0 1px 3px rgba(0,0,0,.12)' : 'none' }}>
                {t === 'login' ? 'Вход' : 'Регистрация'}
              </button>
            ))}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {tab === 'register' && (
              <div className="field">
                <span className="field-label">Имя</span>
                <input className="input" value={name} onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  placeholder="Иван Иванов" autoFocus />
              </div>
            )}
            <div className="field">
              <span className="field-label">Email</span>
              <input className="input" type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="admin@marshrut.local"
                autoFocus={tab === 'login'} />
            </div>
            <div className="field">
              <span className="field-label">Пароль</span>
              <input className="input" type="password" value={pass}
                onChange={e => setPass(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="••••••" />
            </div>

            {err && (
              <div style={{ fontSize:12, color:'var(--danger)', padding:'8px 10px',
                background:'rgba(220,38,38,.08)', borderRadius:6 }}>
                {err}
              </div>
            )}

            <button className="btn primary" onClick={handleSubmit} disabled={loading}
              style={{ width:'100%', justifyContent:'center', marginTop:4,
                padding:'10px 0', fontSize:14 }}>
              {loading ? 'Загрузка…' : (tab === 'login' ? 'Войти' : 'Создать аккаунт')}
            </button>
          </div>
        </div>

        <div style={{ textAlign:'center', marginTop:16, fontSize:11, color:'var(--fg-3)' }}>
          Тестовый вход: admin@marshrut.local / Admin1234!
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// AppInner — основное приложение (после авторизации)
// Использует useAppStore для доступа к стейту
// ─────────────────────────────────────────────────────────────────────────
function AppInner({ authUser, onLogout, tweaks, setTweak }) {
  const { state, dispatch, pushToast, loadAll } = useAppStore();
  const { data, tasks, scanLog, workshops, workCenters, activeShift,
          route, activeOrderId, modal, appUsers,
          editingDetail, editingOrder, confirmDlg, toasts } = state;

  const S = useStrings(tweaks.lang);

  // ── Хелперы навигации ──────────────────────────────────────────────────
  const setRoute        = r  => dispatch({ type: 'SET_ROUTE',         payload: r });
  const setActiveOrder  = id => dispatch({ type: 'SET_ACTIVE_ORDER',  payload: id });
  const setModal        = m  => dispatch({ type: m ? 'OPEN_MODAL' : 'CLOSE_MODAL', payload: m });
  const setConfirmDlg   = d  => dispatch({ type: 'SET_CONFIRM_DLG',   payload: d });
  const setEditingDetail = d => dispatch({ type: 'SET_EDITING_DETAIL', payload: d });
  const setEditingOrder  = o => dispatch({ type: 'SET_EDITING_ORDER',  payload: o });

  // ── Бизнес-логика заданий (вынесена из компонента) ─────────────────────
  const refreshScanLog = () => {
    api.get('/scan-log?limit=50')
       .then(r => dispatch({ type: 'SET_SCAN_LOG', payload: apiScanLogToFrontend(r.data) }))
       .catch(() => {});
  };
  const { closeTask, pauseTask, resumeTask } = useTaskActions(
    pushToast, dispatch, tasks, authUser, refreshScanLog
  );

  // ── SSE: real-time обновления с exponential backoff ────────────────────
  useSSE({
    /** Задание изменило статус — обновляем только его (без полного loadAll) */
    onTaskUpdated: (d) => dispatch({ type: 'UPDATE_TASK', payload: {
      id:        d.id,
      status:    d.status,
      operator:  d.operator,
      completed: d.completed,
    }}),

    /** Журнал сканирований изменился */
    onScanLogged: refreshScanLog,

    /** Заказ создан/изменён — перезагружаем список заказов */
    onOrderUpdated: () => {
      api.get('/orders').then(r => {
        dispatch({ type: 'SET_DATA', payload: {
          ...data,
          orders: apiOrderToData(r.data, data?.details || []).orders,
        }});
      }).catch(() => {});
    },
  }, !!authUser);

  // ── Инициализация данных при входе ─────────────────────────────────────
  React.useEffect(() => {
    if (!authUser) return;
    loadAll();
    // Загружаем список пользователей для админки
    if (Auth.can('users.view')) {
      api.get('/admin/users').then(r => {
        dispatch({ type: 'SET_APP_USERS', payload: r.data || [] });
      }).catch(() => {});
    }
  }, [authUser]); // eslint-disable-line

  // Применяем тему и плотность к <html>
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme',   tweaks.theme);
    document.documentElement.setAttribute('data-density', tweaks.density);
  }, [tweaks.theme, tweaks.density]);

  if (!data) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      height:'100vh', color:'var(--fg-2)', fontSize:14 }}>
      Загрузка данных…
    </div>
  );

  // ── Вычисляемые данные ─────────────────────────────────────────────────
  const activeOrder = activeOrderId
    ? data.orders.find(o => o.id === activeOrderId) || data.orders[0]
    : data.orders[0];
  const activeData  = { ...data, orders: activeOrder ? [activeOrder] : [] };
  const counts      = {
    orders:     data.orders.length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
  };

  // Хлебные крошки для Topbar
  const crumbs = ({
    dashboard:      ['Маршрут', 'Производственное табло'],
    orders:         ['Маршрут', 'Заказы', activeOrder?.number || '—'],
    library:        ['Маршрут', 'Номенклатура'],
    scanner:        ['Маршрут', 'Сканер ОТК'],
    history:        ['Маршрут', 'Журнал сканирований'],
    routesheet:     ['Маршрут', 'Заказы', activeOrder?.number || '—', 'Маршрутный лист'],
    report:         ['Маршрут', 'Отчёт по заказам'],
    'orders-list':  ['Маршрут', 'Все заказы'],
    'work-centers': ['Маршрут', 'Рабочие центры'],
    shifts:         ['Маршрут', 'Смены'],
    excel:          ['Маршрут', 'Выгрузки Excel'],
    wiki:           ['Маршрут', 'Справка'],
  })[route] || [];

  // ── Обработчики пауз (вынесены для переиспользования) ──────────────────
  const PAUSE_REASONS = [
    { v:'lunch',     l:'🍽 Обед' },
    { v:'break',     l:'☕ Перерыв' },
    { v:'tech',      l:'📐 Технолог / согласование' },
    { v:'material',  l:'📦 Ожидание материала' },
    { v:'equipment', l:'🔧 Поломка оборудования' },
    { v:'other',     l:'📝 Прочее' },
  ];

  function openPauseModal(taskId) {
    setModal({ type: 'pause', taskId, reasons: PAUSE_REASONS });
  }

  // ── Обработчики действий на рабочем центре ─────────────────────────────
  async function handleWCAction(action, task) {
    try {
      if (action === 'start') {
        await closeTask(task.id, task.qrText, task.planned,
          authUser?.name || task.operator || 'Оператор', 'start');
      } else if (action === 'close') {
        setModal({ type: 'close-wc', task });
      } else if (action === 'pause') {
        openPauseModal(task.id);
      } else if (action === 'resume') {
        await resumeTask(task.id);
      }
      await loadAll();
    } catch (e) {
      pushToast('Ошибка: ' + e.message);
    }
  }

  return (
    <div className="app">
      <Sidebar route={route === 'routesheet' ? 'orders' : route}
               setRoute={setRoute} lang={tweaks.lang} counts={counts}
               userRole={authUser?.role} />

      <div className="main">
        {/* Верхняя панель с навигационными крошками и действиями */}
        <Topbar crumbs={crumbs} lang={tweaks.lang} actions={(
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {/* Аватар пользователя */}
            <div style={{ fontSize:12, color:'var(--fg-2)', display:'flex',
              alignItems:'center', gap:6 }}>
              <div style={{ width:24, height:24, borderRadius:'50%', background:'var(--accent)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:11, fontWeight:700, color:'#fff' }}>
                {authUser.name?.[0]?.toUpperCase()}
              </div>
              <span style={{ fontWeight:500 }}>{authUser.name}</span>
            </div>
            <button className="btn ghost" onClick={() => setRoute('report')}>
              <Icon name="chart" size={14}/>{S.navReport || 'Отчёт'}
            </button>
            {Auth.isAdmin() && (
              <button className="btn" onClick={() => dispatch({ type: 'SET_ROUTE', payload: '__admin' })}>
                <Icon name="cog" size={14}/>Админ
              </button>
            )}
            <button className="btn" onClick={() => setRoute('scanner')}>
              <Icon name="scan" size={14}/>Скан
            </button>
            <button className="btn" onClick={onLogout} title="Выйти">
              <Icon name="close" size={14}/>
            </button>
          </div>
        )}/>

        {/* Панель текущей смены */}
        <ShiftBar shift={activeShift}
          onOpen={()   => setModal('openShift')}
          onClose={()  => setModal('closeShift')}
          onHandoff={() => setModal('handoff')}
          tasks={tasks}
          authUser={authUser} />

        {/* ── Основная область контента ────────────────────────────────── */}
        <div className="scroller">

          {/* Производственное табло */}
          {route === 'dashboard' && (
            <Dashboard data={data} tasks={tasks} scanLog={scanLog} lang={tweaks.lang}
              onScan={() => setRoute('scanner')}
              onCloseTask={id => closeTask(id)}
              onPauseTask={openPauseModal}
              onResumeTask={resumeTask}
              onNewOrder={() => setModal('newOrder')} />
          )}

          {/* Редактор заказа */}
          {route === 'orders' && (
            <div style={{ display:'flex', flexDirection:'column', gap:0, height:'100%' }}>
              {/* Пикер заказов */}
              <div style={{ padding:'12px 24px 0' }}>
                <OrderPicker orders={data.orders} activeId={activeOrderId}
                  onSelect={setActiveOrder}
                  onNew={() => setModal('newOrder')}
                  lang={tweaks.lang} />
              </div>

              <OrderBuilder key={activeOrderId} data={activeData} tasks={tasks}
                lang={tweaks.lang}
                onRefresh={loadAll}
                onPrint={() => setRoute('routesheet')}
                onSave={async (updatedData) => {
                  if (!updatedData || !activeOrderId) {
                    pushToast('Заказ сохранён'); await loadAll(); return;
                  }
                  try {
                    const order = data.orders.find(o => o.id === activeOrderId);
                    if (!order) return;
                    await api.put('/orders/' + activeOrderId, {
                      number:   updatedData.number   || order.number,
                      customer: updatedData.customer || order.customer,
                      foreman:  updatedData.foreman  || order.foreman,
                      due_date: updatedData.dueDate  || order.dueDate,
                      status:   updatedData.status   || order.status,
                      priority: updatedData.priority || order.priority,
                      items: (updatedData.items || [])
                        .filter(i => i.detailId)
                        .map(i => ({ detail_id: i.detailId, quantity: Number(i.quantity) })),
                    });
                    await loadAll();
                    pushToast('Заказ сохранён');
                  } catch (e) { pushToast('Ошибка: ' + e.message); }
                }}
                onDeleteOrder={o => {
                  setConfirmDlg({
                    title:   'Удалить заказ?',
                    message: `Заказ ${o.number} и все его задания будут удалены безвозвратно.`,
                    action:  'Удалить',
                    onConfirm: async () => {
                      try {
                        await api.delete('/orders/' + o.id);
                        setActiveOrder(null);
                        await loadAll();
                        pushToast('Заказ ' + o.number + ' удалён');
                        if (data.orders.length <= 1) setRoute('dashboard');
                      } catch (e) { pushToast('Ошибка: ' + e.message); }
                    },
                  });
                }}
                onSelectOrder={async o => {
                  try {
                    const fresh = await api.get('/orders/' + o.id);
                    setEditingOrder({
                      ...fresh,
                      dueDate: fresh.due_date,
                      items: (fresh.items || []).map(i => ({
                        detailId: i.detail_id, quantity: Number(i.quantity),
                      })),
                    });
                  } catch (e) { pushToast('Ошибка: ' + e.message); }
                }} />
            </div>
          )}

          {/* Маршрутный лист */}
          {route === 'routesheet' && (
            <RouteSheetView data={activeData} tasks={tasks} scanLog={scanLog}
              lang={tweaks.lang} qrSize={tweaks.qrSize}
              onClose={() => setRoute('orders')}
              onScanQR={() => setRoute('scanner')} />
          )}

          {/* Номенклатура деталей */}
          {route === 'library' && (
            <Library data={data} tasks={tasks} lang={tweaks.lang}
              workCenters={workCenters}
              onNewDetail={() => setModal('newDetail')}
              onEditDetail={d => setEditingDetail(d)}
              onDeleteDetail={d => setConfirmDlg({
                title:   'Удалить деталь?',
                message: `Деталь "${d.name}" будет удалена безвозвратно.`,
                action:  'Удалить',
                onConfirm: async () => {
                  try {
                    await api.delete('/details/' + d.id);
                    await loadAll();
                    pushToast('Деталь ' + d.name + ' удалена');
                  } catch (e) { pushToast('Ошибка: ' + e.message); }
                },
              })} />
          )}

          {/* QR Сканер */}
          {route === 'scanner' && (
            <Scanner data={data} tasks={tasks} scanLog={scanLog}
              lang={tweaks.lang} qrSize={tweaks.qrSize} users={appUsers}
              onScanResult={(id, qr, qty, op, action, comment, closeStatus) =>
                closeTask(id, qr, qty, op, action, comment, closeStatus)
              } />
          )}

          {/* Рабочие центры */}
          {route === 'work-centers' && (
            <WorkCentersView workCenters={workCenters} tasks={tasks} data={data}
              lang={tweaks.lang}
              onManage={() => setModal('manageWorkCenters')}
              onAction={handleWCAction} />
          )}
          {modal === 'manageWorkCenters' && (
            <ModalManageWorkCenters workCenters={workCenters}
              onClose={() => setModal(null)}
              onSaved={wcs => {
                dispatch({ type: 'SET_WORK_CENTERS', payload: wcs });
                setModal(null);
              }} />
          )}

          {/* Смены */}
          {route === 'shifts' && <ShiftsView authUser={authUser} />}

          {/* Посменный учёт (только мастер/админ) */}
          {route === 'shift-report' && (Auth.isAdmin() || authUser?.role === 'foreman') && (
            <ShiftDayReport />
          )}

          {/* Excel выгрузки */}
          {route === 'excel' && <ExcelExportView data={data} tasks={tasks} scanLog={scanLog} />}

          {/* Справка */}
          {route === 'wiki' && <WikiPage />}

          {/* История заказов */}
          {route === 'history-orders' && (
            <HistoryOrdersView data={data} tasks={tasks} lang={tweaks.lang}
              onOpenOrder={id => { setActiveOrder(id); setRoute('dashboard'); }} />
          )}

          {/* Журнал сканирований */}
          {route === 'history' && (
            <HistoryView data={data} tasks={tasks} scanLog={scanLog} lang={tweaks.lang} />
          )}

          {/* Отчёт по заказам */}
          {route === 'report' && (
            <ReportView data={data} tasks={tasks} scanLog={scanLog} lang={tweaks.lang}
              onOpenDashboard={id => { setActiveOrder(id); setRoute('dashboard'); }} />
          )}

          {/* Список всех заказов */}
          {route === 'orders-list' && (
            <OrdersListView data={data} tasks={tasks} lang={tweaks.lang}
              onOpenOrder={id => {
                if (id === 'new') { setModal('newOrder'); return; }
                setActiveOrder(id);
                setRoute('orders');
              }} />
          )}

        </div>{/* .scroller */}
      </div>{/* .main */}

      {/* ── Тост-уведомления ─────────────────────────────────────────── */}
      <div id="ptr-ind" className="ptr-indicator" style={{ opacity:0 }}>↓ Обновление…</div>
      <div className="toast-stack">
        {toasts.map(toast => (
          <div className="toast" key={toast.id}>{toast.msg}</div>
        ))}
      </div>

      {/* ── Модальные окна: смены ────────────────────────────────────── */}
      {modal === 'openShift' && (
        <ModalOpenShift
          onClose={() => setModal(null)}
          onOpened={s => {
            dispatch({ type: 'SET_ACTIVE_SHIFT', payload: s });
            pushToast('Смена открыта: ' + s.name);
          }} />
      )}
      {modal === 'closeShift' && activeShift && (
        <ModalCloseShift shift={activeShift}
          onClose={() => setModal(null)}
          onClosed={() => {
            dispatch({ type: 'SET_ACTIVE_SHIFT', payload: null });
            pushToast('Смена закрыта');
          }} />
      )}
      {modal === 'handoff' && activeShift && (
        <ModalHandoff shift={activeShift} tasks={tasks} data={data}
          onClose={() => setModal(null)}
          onHandedOff={() => { loadAll(); pushToast('Задание передано'); }} />
      )}

      {/* ── Модальные окна: задания ──────────────────────────────────── */}
      {modal?.type === 'close-wc' && modal.task && (
        <CloseOpModal task={modal.task} lang={tweaks.lang} users={[]}
          onClose={()  => setModal(null)}
          onCancel={() => setModal(null)}
          onConfirm={async (qty, operator, action, comment, closeStatus) => {
            try {
              await closeTask(modal.task.id, modal.task.qrText,
                qty, operator, action, comment || '', closeStatus || 'done');
              setModal(null);
              await loadAll(); // Полное обновление после закрытия операции
            } catch (e) { pushToast('Ошибка: ' + e.message); }
          }} />
      )}
      {modal?.type === 'pause' && (
        <ModalPause taskId={modal.taskId} reasons={modal.reasons}
          onClose={() => setModal(null)}
          onSaved={async () => {
            await loadAll();
            pushToast('Задание на паузе');
          }} />
      )}

      {/* ── Модальные окна: заказы и детали ─────────────────────────── */}
      {modal === 'newOrder' && (
        <ModalNewOrder lang={tweaks.lang} details={data.details} workshops={workCenters}
          onClose={() => setModal(null)}
          onCreated={() => { loadAll(); pushToast('Заказ создан'); }} />
      )}
      {modal === 'newDetail' && (
        <ModalNewDetail lang={tweaks.lang}
          onClose={() => setModal(null)}
          onCreated={() => { loadAll(); pushToast('Деталь добавлена'); }} />
      )}
      {editingDetail && (
        <ModalEditDetail lang={tweaks.lang} detail={editingDetail}
          onClose={() => setEditingDetail(null)}
          onSaved={() => { loadAll(); pushToast('Деталь сохранена'); setEditingDetail(null); }} />
      )}
      {editingOrder && (
        <ModalEditOrder lang={tweaks.lang} order={editingOrder}
          details={data.details} workshops={workCenters}
          onClose={() => setEditingOrder(null)}
          onSaved={() => { loadAll(); pushToast('Заказ сохранён'); setEditingOrder(null); }} />
      )}

      {/* ── Диалог подтверждения (удаление) ─────────────────────────── */}
      {confirmDlg && (
        <div style={{ position:'fixed', inset:0, zIndex:2000,
          background:'rgba(0,0,0,.55)', display:'flex',
          alignItems:'center', justifyContent:'center' }}>
          <div className="card" style={{ width:380, padding:24,
            display:'flex', flexDirection:'column', gap:16 }}>
            <b style={{ fontSize:15 }}>{confirmDlg.title}</b>
            <p style={{ fontSize:13, color:'var(--fg-1)', margin:0 }}>{confirmDlg.message}</p>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn" onClick={() => setConfirmDlg(null)}>Отмена</button>
              <button className="btn primary"
                style={{ background:'var(--danger)', borderColor:'var(--danger)' }}
                onClick={() => { confirmDlg.onConfirm(); setConfirmDlg(null); }}>
                {confirmDlg.action || 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Мобильная навигация (нижняя панель) ─────────────────────── */}
      <button className="fab-scan"
        onClick={() => setRoute('scanner')}
        style={{ display: route === 'scanner' ? 'none' : undefined }}>
        <Icon name="scan" size={22} />
      </button>
      <nav className="mobile-nav">
        {[
          ['dashboard',    'gauge',    'Табло',  counts.inProgress],
          ['orders',       'orders',   'Заказы', counts.orders],
          ['orders-list',  'grid',     'Список', 0],
          ['scanner',      'scan',     'Сканер', 0],
          ['work-centers', 'building', 'РЦ',     0],
          ['history',      'history',  'Журнал', 0],
          ['wiki',         'library',  'Справка',0],
        ].map(([r, icon, label, badge]) => (
          <button key={r}
            className={'mobile-nav-item' + (
              route === r || (route === 'routesheet' && r === 'orders') ? ' active' : ''
            )}
            onClick={() => setRoute(r)}
            style={{ position:'relative' }}>
            <Icon name={icon} size={20} />
            <span>{label}</span>
            {badge > 0 && <span className="badge">{badge}</span>}
          </button>
        ))}
      </nav>

      {/* ── Вспомогательные компоненты ──────────────────────────────── */}
      <EquipmentDatalist />

      {/* Панель настроек темы */}
      <TweaksPanel>
        <TweakSection label="Тема">
          <TweakRadio label="Режим" value={tweaks.theme}
            options={[
              { value:'light',      label:'Светлая' },
              { value:'dark',       label:'Тёмная' },
              { value:'industrial', label:'Цех' },
            ]}
            onChange={v => setTweak('theme', v)} />
        </TweakSection>
        <TweakSection label="Плотность">
          <TweakRadio label="Раскладка" value={tweaks.density}
            options={[
              { value:'compact', label:'Плотно' },
              { value:'airy',    label:'Воздух' },
            ]}
            onChange={v => setTweak('density', v)} />
        </TweakSection>
        <TweakSection label="Маршрутный лист">
          <TweakSlider label="Размер QR" value={tweaks.qrSize}
            min={48} max={120} step={2} unit="px"
            onChange={v => setTweak('qrSize', v)} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// App — точка входа: проверка сессии, роутинг login/admin/main
// ─────────────────────────────────────────────────────────────────────────
function App() {
  const [tweaks, setTweakRaw] = useTweaks(TWEAK_DEFAULTS);
  const setTweak = (k, v) => setTweakRaw(k, v);

  const [authUser,  setAuthUser]  = React.useState(null);
  const [appReady,  setAppReady]  = React.useState(false);
  const [showAdmin, setShowAdmin] = React.useState(false);

  // ── Восстановление сессии при загрузке страницы ─────────────────────
  React.useEffect(() => {
    // При истечении токена сбрасываем авторизацию
    setAuthExpiredHandler(() => {
      Auth.clear();
      setAuthUser(null);
    });

    const savedUser = Auth.getUser(); // восстанавливаем из localStorage
    if (savedUser) {
      // Пробуем обновить access token через HttpOnly cookie
      Auth.refresh()
        .then(() => setAuthUser(savedUser))
        .catch(() => { Auth.clear(); setAuthUser(null); })
        .finally(() => setAppReady(true));
    } else {
      setAppReady(true);
    }
  }, []);

  function handleLogin(user) {
    setAuthUser(user);
    Auth.setUser(user);
  }

  function handleLogout() {
    const rt = Auth.getRefresh();
    if (rt) api.post('/auth/logout', { refresh_token: rt }).catch(() => {});
    Auth.clear();
    setAuthUser(null);
  }

  // ── Рендер ───────────────────────────────────────────────────────────
  if (!appReady) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      height:'100vh', color:'var(--fg-2)', fontSize:14 }}>
      Загрузка…
    </div>
  );

  if (!authUser)  return <LoginScreen onLogin={handleLogin} />;
  if (showAdmin)  return <AdminPanel lang={tweaks.lang} onBack={() => setShowAdmin(false)} />;

  // Оборачиваем в провайдер стейта
  return (
    <AppProvider>
      <AppInner
        authUser={authUser}
        onLogout={handleLogout}
        tweaks={tweaks}
        setTweak={setTweak} />
    </AppProvider>
  );
}

export default App
