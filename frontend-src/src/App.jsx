// App.jsx — корневой компонент с SSE реального времени
import React from 'react';
import { api, Auth, Events, setAuthExpiredHandler,
         apiOrderToData, apiTasksToFrontend, apiScanLogToFrontend } from './lib/api.js';
import { useRealtime } from './hooks/useRealtime.js';
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakSlider }
  from './components/TweaksPanel.jsx';
import { Icon } from './components/Icon.jsx';
import { Sidebar, Topbar, Dashboard, Library, OrderBuilder,
         RouteSheetView, HistoryView } from './screens/index.jsx';
import { Scanner } from './screens/Scanner.jsx';
import LoginScreen from './screens/Login.jsx';
import AdminPanel   from './screens/Admin.jsx';
import ModalNewOrder  from './screens/ModalNewOrder.jsx';
import ModalNewDetail from './screens/ModalNewDetail.jsx';

const TWEAK_DEFAULTS = {
  theme: 'dark', density: 'compact', lang: 'ru', qrSize: 70, accent: '#d9480f',
};

export default function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [authUser, setAuthUser]   = React.useState(() => Auth.getUser());
  const [showAdmin, setShowAdmin] = React.useState(false);
  const [data, setData]           = React.useState(null);
  const [tasks, setTasks]         = React.useState([]);
  const [scanLog, setScanLog]     = React.useState([]);
  const [route, setRoute]         = React.useState('dashboard');
  const [toasts, setToasts]       = React.useState([]);
  const [modal, setModal]         = React.useState(null);

  // ── Session expiry handler ───────────────────────────────────────
  React.useEffect(() => {
    setAuthExpiredHandler(() => { setAuthUser(null); setData(null); });
  }, []);

  // ── Theme ────────────────────────────────────────────────────────
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', t.theme);
    document.documentElement.setAttribute('data-density', t.density);
  }, [t.theme, t.density]);

  // ── Load data from API ───────────────────────────────────────────
  async function loadAll() {
    try {
      const [ordersRes, detailsRes, tasksRes, logRes] = await Promise.all([
        api.get('/orders'), api.get('/details'),
        api.get('/tasks'),  api.get('/scan-log?limit=50'),
      ]);
      setData(apiOrderToData(ordersRes.data, detailsRes.data));
      setTasks(apiTasksToFrontend(tasksRes.data));
      setScanLog(apiScanLogToFrontend(logRes.data));
    } catch (e) { pushToast('Ошибка загрузки: ' + e.message); }
  }

  React.useEffect(() => { if (authUser) loadAll(); }, [authUser]);

  // ── SSE real-time ────────────────────────────────────────────────
  const { connected: sseConnected } = useRealtime({
    onTaskUpdated: (d) => {
      setTasks(prev => prev.map(t =>
        t.id === d.id
          ? { ...t, status: d.status, completed: d.completed, operator: d.operator }
          : t
      ));
    },
    onScanLogged: (d) => {
      setScanLog(prev => [{
        ts: d.ts_label, taskId: d.task_id, qr: d.qr_text,
        detail: d.detail, op: d.op, operator: d.operator,
        result: d.result, quantity: d.quantity,
      }, ...prev].slice(0, 50));
      pushToast(`Закрыто: ${d.op} (${d.operator})`);
    },
    onOrderUpdated: () => {
      // Reload orders on any order change from another user
      api.get('/orders').then(r => {
        api.get('/details').then(dr => {
          setData(apiOrderToData(r.data, dr.data));
        });
      }).catch(() => {});
    },
  });

  // ── Actions ──────────────────────────────────────────────────────
  function pushToast(msg) {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, msg }]);
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 3000);
  }

  async function closeTask(taskId, qrText, qty, operator, action) {
    const op = operator || authUser?.name || 'Оператор';
    try {
      if (action === 'start') {
        await api.patch('/tasks/' + taskId + '/status', { status: 'in_progress', operator: op });
      } else {
        await api.post('/tasks/' + taskId + '/close', { operator: op, qr_text: qrText, completed: qty });
      }
      // SSE will update state — but do immediate optimistic update too
      setTasks(prev => prev.map(t =>
        t.id === taskId
          ? { ...t, status: action === 'start' ? 'in_progress' : 'done',
              completed: action === 'start' ? t.completed : (qty ?? t.planned),
              operator: op }
          : t
      ));
      if (action !== 'start') {
        const logRes = await api.get('/scan-log?limit=50');
        setScanLog(apiScanLogToFrontend(logRes.data));
      }
      const name = tasks.find(t => t.id === taskId)?.opName || taskId;
      pushToast((action === 'start' ? 'В работе: ' : 'Закрыто: ') + name);
    } catch (e) { pushToast('Ошибка: ' + e.message); }
  }

  function handleLogin(user) {
    setAuthUser(user);
    Auth.setUser(user);
  }

  function handleLogout() {
    const rt = Auth.getRefresh();
    if (rt) api.post('/auth/logout', { refresh_token: rt }).catch(() => {});
    Events.disconnect();
    Auth.clear();
    setAuthUser(null);
    setData(null);
  }

  // ── Render ───────────────────────────────────────────────────────
  if (!authUser) return <LoginScreen onLogin={handleLogin} />;
  if (showAdmin) return <AdminPanel lang={t.lang} onBack={() => setShowAdmin(false)} />;
  if (!data)     return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',
      height:'100vh',color:'var(--fg-2)',fontSize:14 }}>Загрузка данных…</div>
  );

  const counts = {
    orders: data.orders.length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
  };
  const activeOrder = data.orders[0];

  const crumbs = {
    dashboard:  ['Маршрут', 'Производственное табло'],
    orders:     ['Маршрут', 'Заказы', activeOrder?.number || '—'],
    library:    ['Маршрут', 'Номенклатура'],
    scanner:    ['Маршрут', 'Сканер ОТК'],
    history:    ['Маршрут', 'Журнал сканирований'],
    routesheet: ['Маршрут', 'Заказы', activeOrder?.number || '—', 'Маршрутный лист'],
  }[route] || [];

  return (
    <div className="app">
      <Sidebar route={route === 'routesheet' ? 'orders' : route}
               setRoute={setRoute} lang={t.lang} counts={counts} />
      <div className="main">
        <Topbar crumbs={crumbs} lang={t.lang} actions={(
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            {/* SSE indicator */}
            <div title={sseConnected ? 'Реальное время: подключено' : 'Реальное время: ожидание'}
              style={{ width:7,height:7,borderRadius:'50%',flexShrink:0,
                background: sseConnected ? '#22c55e' : '#f59e0b',
                boxShadow: sseConnected ? '0 0 0 2px rgba(34,197,94,.25)' : 'none' }} />
            <div style={{ fontSize:12,color:'var(--fg-2)',display:'flex',alignItems:'center',gap:6 }}>
              <div style={{ width:24,height:24,borderRadius:'50%',background:'var(--accent)',
                display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:11,fontWeight:700,color:'#fff' }}>
                {authUser.name?.[0]?.toUpperCase()}
              </div>
              <span style={{ fontWeight:500 }}>{authUser.name}</span>
            </div>
            {Auth.isAdmin() && (
              <button className="btn" onClick={() => setShowAdmin(true)}>
                <Icon name="cog" size={14} />Админ
              </button>
            )}
            <button className="btn" onClick={() => setRoute('scanner')}>
              <Icon name="scan" size={14} />Скан
            </button>
            <button className="btn" onClick={handleLogout} title="Выйти">
              <Icon name="close" size={14} />
            </button>
          </div>
        )} />

        <div className="scroller">
          {route === 'dashboard'  && <Dashboard data={data} tasks={tasks} scanLog={scanLog}
            lang={t.lang} onScan={() => setRoute('scanner')}
            onCloseTask={id => closeTask(id)} onNewOrder={() => setModal('newOrder')} />}
          {route === 'orders'     && <OrderBuilder data={data} tasks={tasks} lang={t.lang}
            onPrint={() => setRoute('routesheet')}
            onSave={async () => { pushToast('Заказ сохранён'); await loadAll(); }} />}
          {route === 'routesheet' && <RouteSheetView data={data} tasks={tasks}
            lang={t.lang} qrSize={t.qrSize}
            onClose={() => setRoute('orders')} onScanQR={() => setRoute('scanner')} />}
          {route === 'library'    && <Library data={data} tasks={tasks} lang={t.lang}
            onNewDetail={() => setModal('newDetail')} />}
          {route === 'scanner'    && <Scanner data={data} tasks={tasks} scanLog={scanLog}
            lang={t.lang} qrSize={t.qrSize}
            onScanResult={(id, qr, qty, op, action) => closeTask(id, qr, qty, op, action)} />}
          {route === 'history'    && <HistoryView data={data} tasks={tasks}
            scanLog={scanLog} lang={t.lang} />}
        </div>
      </div>

      <div className="toast-stack">
        {toasts.map(toast => (
          <div className="toast" key={toast.id}>{toast.msg}</div>
        ))}
      </div>

      {modal === 'newOrder'  && <ModalNewOrder lang={t.lang} details={data.details}
        onClose={() => setModal(null)}
        onCreated={() => { loadAll(); pushToast('Заказ создан'); }} />}
      {modal === 'newDetail' && <ModalNewDetail lang={t.lang}
        onClose={() => setModal(null)}
        onCreated={() => { loadAll(); pushToast('Деталь добавлена'); }} />}

      <TweaksPanel>
        <TweakSection label="Тема">
          <TweakRadio label="Режим" value={t.theme}
            options={[{value:'light',label:'Светлая'},{value:'dark',label:'Тёмная'},{value:'industrial',label:'Цех'}]}
            onChange={v => setTweak('theme', v)} />
        </TweakSection>
        <TweakSection label="Плотность">
          <TweakRadio label="Раскладка" value={t.density}
            options={[{value:'compact',label:'Плотно'},{value:'airy',label:'Воздух'}]}
            onChange={v => setTweak('density', v)} />
        </TweakSection>
        <TweakSection label="Маршрутный лист">
          <TweakSlider label="Размер QR" value={t.qrSize} min={48} max={120} step={2} unit="px"
            onChange={v => setTweak('qrSize', v)} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}
