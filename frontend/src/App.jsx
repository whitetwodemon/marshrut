import React from 'react'
import { api, Auth, API_BASE, setAuthExpiredHandler, parseServerDate , unwrap} from './lib/api.js'
import { Icon } from './components/Icon.jsx'
import { QrCode } from './components/QrCode.jsx'
import { useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider,
         TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber,
         TweakColor, TweakButton } from './components/TweaksPanel.jsx'
import { useStrings, STATUS_LABEL_RU, STATUS_LABEL_EN, ORDER_STATUS_RU,
         ORDER_STATUS_EN, Sidebar, Topbar, StatusPill, OrderPicker } from './lib/data.jsx'
import { apiOrderToData, apiTasksToFrontend, apiScanLogToFrontend } from './lib/api-helpers.jsx'
import {
  Dashboard, Library, OrderBuilder, RouteSheetView,
  HistoryView, WorkshopView, ModalManageWorkshops,
  OrdersListView, ReportView, HistoryOrdersView, WorkCentersView, ModalManageWorkCenters,
  ExcelExportView, WikiPage, ShiftHistoryView, Analytics, Integrations
} from './screens/Screens.jsx'
import { Scanner, CloseOpModal } from './screens/Scanner.jsx'
import { Specifications } from './screens/Specifications.jsx'
import { TechPrep } from './screens/TechPrep.jsx'
import { Warehouse } from './screens/Warehouse.jsx'
import { ModalEditDetail, ModalEditOrder, ModalNewOrder, ModalNewDetail, AdminPanel, EquipmentDatalist, ModalPause } from './screens/Modals.jsx'


// app.jsx — root component, routing, state, tweaks

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "density": "compact",
  "lang": "ru",
  "qrSize": 110,
  "accent": "#d9480f"
}/*EDITMODE-END*/;

// ── API layer ────────────────────────────────────────────────────────





window.__api = api;


function LoginScreen({ onLogin }) {
  const [tab, setTab]     = React.useState('login');
  const [name, setName]   = React.useState('');
  const [email, setEmail] = React.useState('');
  const [pass, setPass]   = React.useState('');
  const [err, setErr]     = React.useState('');
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit() {
    setErr(''); setLoading(true);
    try {
      let data;
      if (tab === 'login') {
        data = await api.post('/auth/login', { email, password: pass });
      } else {
        data = await api.post('/auth/register', { name, email, password: pass });
      }
      Auth.setToken(data.access_token); Auth.setRefresh(data.refresh_token);
      Auth.setUser(data.user); onLogin(data.user);
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }

  return (
    <div style={{ minHeight:'100svh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg-0)',fontFamily:'var(--ui-font)',padding:'16px' }}>
      <div style={{ width:'100%', maxWidth:400, padding:'0 16px' }}>
        <div style={{ textAlign:'center',marginBottom:32 }}>
          <div style={{ fontSize:22,fontWeight:700,color:'var(--fg-0)',letterSpacing:'-0.5px' }}>МАРШРУТ</div>
          <div style={{ fontSize:12,color:'var(--fg-2)',marginTop:4 }}>Производственная система</div>
        </div>
        <div className="card" style={{ padding:28 }}>
          <div style={{ display:'flex',gap:4,marginBottom:24,background:'var(--bg-1)',borderRadius:8,padding:4 }}>
            {['login','register'].map(t => (
              <button key={t} onClick={()=>{setTab(t);setErr('');}}
                style={{ flex:1,padding:'6px 0',fontSize:13,fontWeight:500,border:'none',cursor:'pointer',
                  borderRadius:6,background:tab===t?'var(--bg-2)':'transparent',
                  color:tab===t?'var(--fg-0)':'var(--fg-2)',
                  boxShadow:tab===t?'0 1px 3px rgba(0,0,0,0.12)':'none',transition:'all .15s' }}>
                {t === 'login' ? 'Вход' : 'Регистрация'}
              </button>
            ))}
          </div>
          <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
            {tab === 'register' && (
              <div className="field"><span className="field-label">Имя</span>
                <input className="input" value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()} placeholder="Иван Иванов" autoFocus /></div>
            )}
            <div className="field"><span className="field-label">Email</span>
              <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()} placeholder="admin@marshrut.local" autoFocus={tab==='login'} /></div>
            <div className="field"><span className="field-label">Пароль</span>
              <input className="input" type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSubmit()} placeholder="••••••" /></div>
            {err && <div style={{ fontSize:12,color:'var(--danger)',padding:'8px 10px',background:'rgba(220,38,38,.08)',borderRadius:6 }}>{err}</div>}
            <button className="btn primary" onClick={handleSubmit} disabled={loading}
              style={{ width:'100%',justifyContent:'center',marginTop:4,padding:'10px 0',fontSize:14 }}>
              {loading ? 'Загрузка…' : (tab === 'login' ? 'Войти' : 'Создать аккаунт')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  window.__APP_LANG = t.lang;

  const [authUser, setAuthUser]       = React.useState(null);
  const [appReady, setAppReady]       = React.useState(false);
  const [showAdmin, setShowAdmin]     = React.useState(false);
  const [data, setData]               = React.useState(null);
  const [tasks, setTasks]             = React.useState([]);
  const [scanLog, setScanLog]         = React.useState([]);
  const [workshops, setWorkshops]     = React.useState([]);
  const [workCenters, setWorkCenters] = React.useState([]);
  const [settings, setSettings]       = React.useState({});
  const VALID_ROUTES = ['dashboard','orders','routesheet','library','scanner','specifications','shifts','shift-history','wiki','excel','history','history-orders','report','analytics','integrations'];
  const [route, _setRoute]            = React.useState(() => {
    const h = (typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '') || '';
    return VALID_ROUTES.includes(h) ? h : 'dashboard';
  });
  // Обёртка: меняем маршрут и синхронизируем с URL-хэшем
  const setRoute = React.useCallback((r) => {
    _setRoute(r);
    if (typeof window !== 'undefined' && r) {
      const target = '#' + r;
      if (window.location.hash !== target) window.location.hash = target;
    }
  }, []);
  // Навигация браузером (назад/вперёд) + ручной ввод #hash
  React.useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace(/^#/, '');
      if (VALID_ROUTES.includes(h)) _setRoute(h);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const [toasts, setToasts]           = React.useState([]);
  const [modal, setModal]             = React.useState(null);
  const [appUsers, setAppUsers]       = React.useState([]);
  const [editingDetail, setEditingDetail] = React.useState(null);
  const [editingOrder,  setEditingOrder]  = React.useState(null);
  const [confirmDlg, setConfirmDlg]       = React.useState(null);
  const [activeOrderId, setActiveOrderId] = React.useState(null);
  const [activeShift, setActiveShift]     = React.useState(null);
  const [shiftBusy, setShiftBusy]         = React.useState(false);

  async function loadShift() {
    try { const r = await api.get('/shifts/active'); setActiveShift(r?.shift || null); }
    catch { setActiveShift(null); }
  }
  React.useEffect(() => { if (appReady) loadShift(); }, [appReady]);
  React.useEffect(() => {
    // Публичные флаги — грузим сразу (нужны на экране входа + фича-гейты)
    api.get('/settings/public').then(r => {
      setSettings((r && r.data) ? r.data : {});
    }).catch(()=>{});
  }, []);

  const [shiftModal, setShiftModal]       = React.useState(null); // 'open' | 'close' | null
  const [newOrderPrefill, setNewOrderPrefill] = React.useState(null);

  async function openShift(type) {
    setShiftBusy(true);
    try { await api.post('/shifts/open', { type: type || 'day' }); await loadShift(); await loadAll(); setShiftModal(null); pushToast(type === 'night' ? 'Ночная смена открыта' : 'Дневная смена открыта'); }
    catch (e) { pushToast('Ошибка: ' + e.message); }
    finally { setShiftBusy(false); }
  }
  async function closeShift(notes, handoffTo) {
    if (!activeShift) return;
    setShiftBusy(true);
    try { await api.post('/shifts/' + activeShift.id + '/close', { notes: notes || '', handoff_to: handoffTo || '', force: true }); await loadShift(); await loadAll(); setShiftModal(null); pushToast('Смена закрыта'); }
    catch (e) { pushToast('Ошибка: ' + e.message); }
    finally { setShiftBusy(false); }
  }

  React.useEffect(() => {
    setAuthExpiredHandler(() => { Auth.clear(); setAuthUser(null); setData(null); });
    window.__api = api;

    // Восстанавливаем сессию при загрузке страницы через HttpOnly cookie
    const savedUser = Auth.getUser();
    if (savedUser) {
      // Есть данные пользователя — пробуем обновить access token через cookie
      fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).then(r => {
        if (r.ok) return r.json();
        throw new Error('refresh failed');
      }).then(d => {
        Auth.setToken(d.access_token);
        setAuthUser(savedUser);
      }).catch(() => {
        Auth.clear();
        setAuthUser(null);
      }).finally(() => setAppReady(true));
    } else {
      setAppReady(true);
    }
  }, []);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', t.theme);
    document.documentElement.setAttribute('data-density', t.density);
  }, [t.theme, t.density]);

  React.useEffect(() => {
    if (!authUser) return;
    loadAll();
    if (Auth.can('users.view')) {
      api.get('/admin/users').then(r=>setAppUsers(unwrap(r))).catch(()=>{});
    }

    // SSE — реальное время
    let es = null;
    let retryTimer = null;
    function connectSSE() {
      const token = Auth.getToken();
      if (!token) return;
      es = new EventSource('/api/events?token=' + encodeURIComponent(token) + '&since=' + Math.floor(Date.now()/1000 - 10));
      es.addEventListener('task_updated', e => {
        const d = JSON.parse(e.data);
        setTasks(prev => prev.map(t => t.id === d.id ? {
          ...t,
          status:    d.status,
          operator:  d.operator || t.operator,
          completed: d.completed,
        } : t));
      });
      es.addEventListener('scan_logged', () => {
        api.get('/scan-log?limit=50').then(r => setScanLog(apiScanLogToFrontend(unwrap(r)))).catch(()=>{});
      });
      es.addEventListener('order_updated', () => {
        api.get('/orders').then(r => {
          setData(prev => prev ? { ...prev, orders: apiOrderToData(unwrap(r), prev.details || []).orders } : prev);
        }).catch(()=>{});
      });
      es.addEventListener('reconnect', () => { es.close(); retryTimer = setTimeout(connectSSE, 1000); });
      es.onerror = () => { es.close(); retryTimer = setTimeout(connectSSE, 3000); };
    }
    connectSSE();
    return () => { if (es) es.close(); if (retryTimer) clearTimeout(retryTimer); };
  }, [authUser]);

  async function loadAll() {
    try {
      const [or, dr, tr, lr, wr] = await Promise.all([
        api.get('/orders'), api.get('/details'),
        api.get('/tasks'),  api.get('/scan-log?limit=50'),
        api.get('/workshops'),
        api.get('/work-centers'),
      ]);
      const d = apiOrderToData(unwrap(or), unwrap(dr));
      setData(d);
      setTasks(apiTasksToFrontend(unwrap(tr)));
      setScanLog(apiScanLogToFrontend(unwrap(lr)));
      setWorkshops(unwrap(wr));
      // workCenters loaded separately
      api.get('/work-centers').then(r => setWorkCenters(unwrap(r))).catch(()=>{});
      if (!activeOrderId && d.orders.length) setActiveOrderId(d.orders[0].id);
    } catch(e) { pushToast('Ошибка загрузки: '+e.message); }
  }

  function pushToast(msg) {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev=>[...prev,{id,msg}]);
    setTimeout(()=>setToasts(prev=>prev.filter(x=>x.id!==id)), 3000);
  }

  async function closeTask(taskId, qrText, qty, operator, action, comment, closeStatus) {
    const op = operator || authUser?.name || 'Оператор';
    try {
      if (action === 'start') {
        await api.patch('/tasks/'+taskId+'/status', { status:'in_progress', operator:op });
      } else if (closeStatus === 'problem') {
        // «Проблема» — это статус ЗАКАЗА, а не задания. Останавливаем весь заказ.
        const orderId = tasks.find(t=>t.id===taskId)?.orderId;
        if (!orderId) throw new Error('Не найден заказ для задания');
        if (!comment || !comment.trim()) throw new Error('Укажите причину проблемы в комментарии');
        await api.post('/orders/'+orderId+'/problem', { comment: comment.trim() });
        await loadAll();
        pushToast('Заказ остановлен: проблема');
        return;
      } else {
        if (navigator.vibrate) navigator.vibrate([100]);
        await api.post('/tasks/'+taskId+'/close', {
          operator: op,
          qr_text:  qrText,
          completed: qty,
          comment:  comment || undefined,
          // closeStatus maps to scan_log result, but task status stays 'done' for paused/rework too
        });
        // If rejected/paused/rework — update task status separately
        if (closeStatus && closeStatus !== 'done') {
          await api.patch('/tasks/'+taskId+'/status', { status: closeStatus, operator: op });
        if (navigator.vibrate) navigator.vibrate([50, 30, 80]);
        }
      }
      setTasks(prev=>prev.map(t=>t.id===taskId?{...t,status:action==='start'?'in_progress':'done',completed:action==='start'?t.completed:(qty??t.planned),operator:op}:t));
      if (action !== 'start') {
        const lr = await api.get('/scan-log?limit=50');
        setScanLog(apiScanLogToFrontend(unwrap(lr)));
      }
      const name = tasks.find(t=>t.id===taskId)?.opName || taskId;
      pushToast((action==='start'?'В работе: ':'Закрыто: ')+name);
    } catch(e) { pushToast('Ошибка: '+e.message); }
  }

  function handleLogin(user) { setAuthUser(user); Auth.setUser(user); }

  // Expose token for components that make direct fetch calls
  React.useEffect(() => { window.__authToken = Auth.getToken(); }, [authUser]);
  function handleLogout() {
    const rt = Auth.getRefresh();
    if (rt) api.post('/auth/logout',{refresh_token:rt}).catch(()=>{});
    Auth.clear(); setAuthUser(null); setData(null);
  }

  if (!appReady) return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'var(--fg-2)',fontSize:14 }}>Загрузка…</div>;
  if (!authUser) return <LoginScreen onLogin={handleLogin}/>;
  if (showAdmin) return <AdminPanel lang={t.lang} onBack={()=>setShowAdmin(false)}/>;
  if (!data)     return <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'var(--fg-2)',fontSize:14 }}>Загрузка данных…</div>;

  const activeOrder = activeOrderId ? data.orders.find(o=>o.id===activeOrderId) || data.orders[0] : data.orders[0];
  const activeData  = { ...data, orders: activeOrder ? [activeOrder] : [] };

  const counts = { orders: data.orders.length, inProgress: tasks.filter(t=>t.status==='in_progress').length };

  const crumbs = {
    dashboard:  ['Маршрут','Производственное табло'],
    orders:     ['Маршрут','Заказы', activeOrder?.number||'—'],
    library:    ['Маршрут','Номенклатура'],
    scanner:    ['Маршрут','Сканер'],
    'shift-history': ['Маршрут','История смен'],
    history:    ['Маршрут','Журнал сканирований'],
    routesheet: ['Маршрут','Заказы',activeOrder?.number||'—','Маршрутный лист'],
    report:       ['Маршрут','Отчёт по заказам'],
    'orders-list': ['Маршрут','Все заказы'],
  }[route] || [];

  return (
    <div className="app">
      <Sidebar route={route==='routesheet'?'orders':route} setRoute={setRoute} lang={t.lang} counts={counts} settings={settings}/>
      <div className="main">
        <Topbar crumbs={crumbs} lang={t.lang} actions={(
          <div style={{ display:'flex',alignItems:'center',gap:8 }}>
            <div style={{ fontSize:12,color:'var(--fg-2)',display:'flex',alignItems:'center',gap:6 }}>
              <div style={{ width:24,height:24,borderRadius:'50%',background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#fff' }}>
                {authUser.name?.[0]?.toUpperCase()}
              </div>
              <span style={{ fontWeight:500 }}>{authUser.name}</span>
            </div>
            <button className="btn ghost" onClick={() => setRoute('report')}>
              <Icon name="chart" size={14}/>{t.lang === 'en' ? 'Report' : 'Отчёт'}
            </button>
            {Auth.isAdmin() && <button className="btn" onClick={()=>setShowAdmin(true)}><Icon name="cog" size={14}/>Админ</button>}
            <button className="btn" onClick={()=>setRoute('scanner')}><Icon name="scan" size={14}/>Скан</button>
            <button className="btn" onClick={handleLogout} title="Выйти"><Icon name="close" size={14}/></button>
          </div>
        )}/>
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 24px',
          borderBottom:'1px solid var(--line-1)',
          background: activeShift ? 'rgba(34,197,94,.08)' : 'rgba(245,158,11,.08)' }}>
          <span style={{ width:9, height:9, borderRadius:'50%', flexShrink:0,
            background: activeShift ? '#22c55e' : '#f59e0b' }}/>
          {activeShift ? (
            <>
              <span style={{ fontSize:13, fontWeight:600 }}>Смена открыта</span>
              <span className="muted" style={{ fontSize:12 }}>
                {activeShift.name} · {activeShift.shift_type === 'night' ? '🌙 19:00–07:00' : '☀ 07:00–19:00'} · {activeShift.opened_by_name}
                {activeShift.opened_at && (() => { const d = parseServerDate(activeShift.opened_at); return d ? ' · с ' + d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}) : ''; })()}
              </span>
              <button className="btn ghost small" style={{ marginLeft:'auto' }} disabled={shiftBusy} onClick={() => setShiftModal('close')}>
                Закрыть смену
              </button>
            </>
          ) : (
            <>
              <span style={{ fontSize:13, fontWeight:600, color:'var(--warning,#c07820)' }}>Смена закрыта</span>
              <span className="muted" style={{ fontSize:12 }}>Без открытой смены задания нельзя брать в работу</span>
              <button className="btn primary small" style={{ marginLeft:'auto' }} disabled={shiftBusy} onClick={() => setShiftModal('open')}>
                <Icon name="play" size={13}/> Открыть смену
              </button>
            </>
          )}
        </div>
        <div className="scroller">
          {route === 'dashboard' && (
            <Dashboard data={data} tasks={tasks} scanLog={scanLog} lang={t.lang}
              onScan={()=>setRoute('scanner')} onCloseTask={id=>closeTask(id)}
              onPauseTask={async(id)=>{
                try {
                  const {data:pauses} = await api.get('/tasks/'+id+'/pauses').catch(()=>({data:[]}));
                  const reasons = [
                    {v:'lunch',l:'Обед'},{v:'break',l:'Перерыв'},{v:'tech',l:'Технолог / согласование'},
                    {v:'material',l:'Ожидание материала'},{v:'equipment',l:'Поломка оборудования'},{v:'other',l:'Прочее'},
                  ];
                  setModal({type:'pause', taskId:id, reasons});
                } catch(e){ pushToast('Ошибка: '+e.message); }
              }}
              onResumeTask={async(id)=>{
                try { await api.post('/tasks/'+id+'/resume',{}); await loadAll(); pushToast('Задание возобновлено'); }
                catch(e){ pushToast('Ошибка: '+e.message); }
              }}
              onNewOrder={()=>setModal('newOrder')}/>
          )}
          {route === 'orders' && (
            <div style={{ display:'flex',flexDirection:'column',gap:0,height:'100%' }}>
              {/* Умный пикер заказов */}
              <div style={{ padding:'12px 24px 0' }}>
                <OrderPicker orders={data.orders} activeId={activeOrderId}
                  onSelect={setActiveOrderId} onNew={()=>setModal('newOrder')} lang={t.lang}/>
              </div>
              <OrderBuilder key={activeOrderId} data={activeData} tasks={tasks} lang={t.lang} onReload={async()=>{await loadAll();}}
                onPrint={()=>setRoute('routesheet')}
                onSave={async(updatedData)=>{
                  if (!updatedData || !activeOrderId) { pushToast('Заказ сохранён'); await loadAll(); return; }
                  try {
                    const order = data.orders.find(o=>o.id===activeOrderId);
                    if (!order) return;
                    await api.put('/orders/'+activeOrderId, {
                      number:   updatedData.number   || order.number,
                      customer: updatedData.customer || order.customer,
                      foreman:  updatedData.foreman  || order.foreman,
                      due_date: updatedData.dueDate  || order.dueDate,
                      status:   updatedData.status   || order.status,
                      priority: updatedData.priority || order.priority,
                      items: (updatedData.items||[]).filter(i=>i.detailId).map(i=>({
                        detail_id: i.detailId, quantity: Number(i.quantity)
                      })),
                    });
                    await loadAll();
                    pushToast('Заказ сохранён');
                  } catch(e) { pushToast('Ошибка: '+e.message); }
                }}
                onDeleteOrder={o=>{
                  setConfirmDlg({
                    title: 'Удалить заказ?',
                    message: `Заказ ${o.number} и все его задания будут удалены безвозвратно.`,
                    action: 'Удалить',
                    onConfirm: async()=>{
                      try {
                        await api.delete('/orders/'+o.id);
                        setActiveOrderId(null);
                        await loadAll();
                        pushToast('Заказ ' + o.number + ' удалён');
                        // Если заказов больше нет — переходим на дашборд
                        if (data.orders.length <= 1) setRoute('dashboard');
                      } catch(e){ pushToast('Ошибка: '+e.message); }
                    }
                  });
                }}
                onSelectOrder={async o=>{
                  try {
                    const fresh = await api.get('/orders/'+o.id);
                    setEditingOrder({
                      ...fresh,
                      dueDate: fresh.due_date,
                      items: (fresh.items||[]).map(i=>({ detailId:i.detail_id, quantity:Number(i.quantity) }))
                    });
                  } catch(e) { pushToast('Ошибка: '+e.message); }
                }}/>
            </div>
          )}
          {route === 'routesheet' && <RouteSheetView data={activeData} tasks={tasks} scanLog={scanLog} lang={t.lang} qrSize={t.qrSize} onClose={()=>setRoute('orders')} onScanQR={()=>setRoute('scanner')}/>}
          {route === 'library' && (
            <Library data={data} tasks={tasks} lang={t.lang}
              onOpenOrder={id=>{ setActiveOrderId(id); setRoute('orders'); }}
              onNewDetail={()=>setModal('newDetail')}
              onEditDetail={d=>setEditingDetail(d)}
              onDeleteDetail={d=>{
                setConfirmDlg({
                  title: 'Удалить деталь?',
                  message: `Деталь "${d.name}" будет удалена безвозвратно.`,
                  action: 'Удалить',
                  onConfirm: async()=>{
                    try {
                      await api.delete('/details/'+d.id);
                      await loadAll();
                      pushToast('Деталь ' + d.name + ' удалена');
                    } catch(e){ pushToast('Ошибка: '+e.message); }
                  }
                });
              }}/>
          )}
          {route === 'specifications' && <Specifications onRequestNewOrder={(p)=>{ setNewOrderPrefill(p); setModal('newOrder'); }} onOpenOrder={id=>{ setActiveOrderId(id); setRoute('orders'); }} />}
          {route === 'tech-prep' && <TechPrep lang={t.lang} />}
          {route === 'warehouse' && <Warehouse lang={t.lang} />}
          {route === 'scanner' && <Scanner data={data} tasks={tasks} scanLog={scanLog} lang={t.lang} qrSize={t.qrSize} users={appUsers} onScanResult={(id,qr,qty,op,action,comment,closeStatus)=>closeTask(id,qr,qty,op,action,comment,closeStatus)}/>}
          {route === 'orders-list' && <OrdersListView data={data} tasks={tasks} lang={t.lang}
            onOpenOrder={id => {
              if (id === 'new') { setModal('newOrder'); return; }
              setActiveOrderId(id);
              setRoute('orders');
            }}/>}
          {route === 'work-centers' && <WorkCentersView workCenters={workCenters} tasks={tasks} data={data} lang={t.lang}
            onManage={()=>setModal('manageWorkCenters')}
            onAction={async(action, task) => {
              try {
                if (action === 'start') {
                  await api.patch('/tasks/'+task.id+'/status', { status:'in_progress', operator: authUser?.name || 'Оператор' });
                } else if (action === 'close') {
                  setModal({ type:'close-wc', task });
                } else if (action === 'pause') {
                  setModal({ type:'pause', taskId: task.id, reasons:[
                    {v:'lunch',l:'Обед'},{v:'break',l:'Перерыв'},{v:'tech',l:'Технолог'},
                    {v:'material',l:'Материал'},{v:'equipment',l:'Поломка'},{v:'other',l:'Прочее'},
                  ]});
                } else if (action === 'resume') {
                  await api.post('/tasks/'+task.id+'/resume', {});
                } else if (action === 'setup-start') {
                  await api.post('/tasks/'+task.id+'/setup-start', { operator: authUser?.name || 'Оператор' });
                  pushToast('Наладка начата');
                } else if (action === 'setup-finish') {
                  await api.post('/tasks/'+task.id+'/setup-finish', { operator: authUser?.name || 'Оператор' });
                  pushToast('Наладка завершена');
                }
                await loadAll();
              } catch(e) { pushToast('Ошибка: '+e.message); }
            }}/>}
          {modal==='manageWorkCenters' && <ModalManageWorkCenters workCenters={workCenters}
            onClose={()=>setModal(null)}
            onSaved={wcs=>{ setWorkCenters(wcs); setModal(null); }}/>}
          {route === 'excel'  && <ExcelExportView data={data} tasks={tasks} scanLog={scanLog}/>}
          {route === 'wiki'   && <WikiPage/>}
          {route === 'shift-history' && <ShiftHistoryView lang={t.lang}/>}
          {route === 'history-orders' && <HistoryOrdersView data={data} tasks={tasks} lang={t.lang}
            onOpenOrder={id=>{ setActiveOrderId(id); setRoute('dashboard'); }}
            onShip={async (o)=>{ try { await api.put('/orders/'+o.id, { status:'shipped' }); await loadAll(); pushToast('Заказ '+o.number+' отгружен'); } catch(e){ pushToast('Ошибка: '+e.message); } }}
            onArchive={async (o)=>{ try { await api.put('/orders/'+o.id, { status:'archived' }); await loadAll(); pushToast('Заказ '+o.number+' в архиве'); } catch(e){ pushToast('Ошибка: '+e.message); } }}/>}
          {route === 'history' && <HistoryView data={data} tasks={tasks} scanLog={scanLog} lang={t.lang}/>}
          {route === 'analytics' && settings.feature_analytics === '1' && <Analytics lang={t.lang}/>}
          {route === 'integrations' && <Integrations settings={settings}/>}
          {route === 'report'  && <ReportView  data={data} tasks={tasks} scanLog={scanLog} lang={t.lang}
            onOpenDashboard={id => { setActiveOrderId(id); setRoute('dashboard'); }}/>}
        </div>
      </div>

      <div id="ptr-ind" className="ptr-indicator" style={{opacity:0}}>↓ Обновление…</div>
      <div className="toast-stack">{toasts.map(toast=>(<div className="toast" key={toast.id}>{toast.msg}</div>))}</div>

      {shiftModal === 'open' && <ShiftOpenModal busy={shiftBusy} onOpen={openShift} onClose={()=>setShiftModal(null)}/>}
      {shiftModal === 'close' && <ShiftCloseModal busy={shiftBusy} shift={activeShift} users={appUsers} onCloseShift={closeShift} onCancel={()=>setShiftModal(null)}/>}

      <EquipmentDatalist/>
      {modal?.type === 'close-wc' && modal.task && (
        <CloseOpModal
          task={modal.task} lang={t.lang} users={[]}
          onClose={()=>setModal(null)}
          onConfirm={async(qty, operator, action, comment, closeStatus) => {
            try {
              await closeTask(modal.task.id, modal.task.qrText, qty, operator, action, comment||'', closeStatus||'done');
              setModal(null);
            } catch(e) { pushToast('Ошибка: '+e.message); }
          }}
        />
      )}
      {modal?.type === 'pause' && <ModalPause taskId={modal.taskId} reasons={modal.reasons}
        onClose={()=>setModal(null)}
        onSaved={async()=>{ await loadAll(); pushToast('Задание на паузе'); }}/>}
      {confirmDlg && (
        <div style={{ position:'fixed',inset:0,zIndex:2000,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center' }}>
          <div className="card" style={{ width:380,padding:24,display:'flex',flexDirection:'column',gap:16 }}>
            <b style={{ fontSize:15 }}>{confirmDlg.title}</b>
            <p style={{ fontSize:13,color:'var(--fg-1)',margin:0 }}>{confirmDlg.message}</p>
            <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
              <button className="btn" onClick={()=>setConfirmDlg(null)}>Отмена</button>
              <button className="btn primary" style={{ background:'var(--danger)',borderColor:'var(--danger)' }}
                onClick={()=>{ confirmDlg.onConfirm(); setConfirmDlg(null); }}>
                {confirmDlg.action || 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Мобильная нижняя навигация */}
      <button className="fab-scan" onClick={()=>setRoute('scanner')} style={{display: route==='scanner'?'none':undefined}}>
        <Icon name="scan" size={22}/>
      </button>
      <nav className="mobile-nav">
        {[
          ['dashboard', 'home',    'Табло',     counts.inProgress],
          ['orders',    'file',    'Заказы',    counts.orders],
          ['specifications','layers','Специф.', 0],
          ['scanner',   'scan',    'Сканер',    0],
          ['library',   'library', 'Детали',    0],
          ['work-centers','building','РЦ',      0],
          ...(settings.feature_analytics === '1' ? [['analytics','gauge','Аналитика',0]] : []),
          ...(settings.feature_tech_prep === '1' ? [['tech-prep','route','Техподг.',0]] : []),
          ['report',    'chart',   'Отчёты',    0],
          ['history',   'clock',   'Журнал',    0],
        ].map(([r, icon, label, badge]) => (
          <button key={r} className={'mobile-nav-item'+(route===r||route==='routesheet'&&r==='orders'?' active':'')}
            onClick={()=>setRoute(r)} style={{ position:'relative' }}>
            <Icon name={icon} size={20}/>
            <span>{label}</span>
            {badge > 0 && <span className="badge">{badge}</span>}
          </button>
        ))}
      </nav>

      {modal==='newOrder'  && <ModalNewOrder  lang={t.lang} details={data.details} workshops={workCenters} prefill={newOrderPrefill} onClose={()=>{setModal(null);setNewOrderPrefill(null);}} onCreated={async(created)=>{ if(newOrderPrefill&&newOrderPrefill.onLinked&&created&&created.id){ await newOrderPrefill.onLinked(created.id); } setNewOrderPrefill(null); await loadAll(); pushToast('Заказ создан'); }}/>}
      {modal==='manageWorkshops' && <ModalManageWorkshops workshops={workshops}
          onClose={()=>setModal(null)}
          onSaved={ws=>{ setWorkshops(ws); setModal(null); }}/>}
      {modal==='newDetail' && <ModalNewDetail lang={t.lang} onClose={()=>setModal(null)} onCreated={()=>{loadAll();pushToast('Деталь добавлена');}}/>}
      {editingDetail && <ModalEditDetail lang={t.lang} detail={editingDetail} onClose={()=>setEditingDetail(null)} onSaved={()=>{loadAll();pushToast('Деталь сохранена');setEditingDetail(null);}}/>}
      {editingOrder  && <ModalEditOrder  lang={t.lang} order={editingOrder}  details={data.details} workshops={workCenters} onClose={()=>setEditingOrder(null)}  onSaved={()=>{loadAll();pushToast('Заказ сохранён');setEditingOrder(null);}}/>}

      <TweaksPanel>
        <TweakSection label="Тема">
          <TweakRadio label="Режим" value={t.theme}
            options={[{value:'light',label:'Светлая'},{value:'dark',label:'Тёмная'},{value:'industrial',label:'Цех'}]}
            onChange={v=>setTweak('theme',v)}/>
        </TweakSection>
        <TweakSection label="Плотность">
          <TweakRadio label="Раскладка" value={t.density}
            options={[{value:'compact',label:'Плотно'},{value:'airy',label:'Воздух'}]}
            onChange={v=>setTweak('density',v)}/>
        </TweakSection>
        <TweakSection label="Маршрутный лист">
          <TweakSlider label="Размер QR" value={t.qrSize} min={48} max={240} step={4} unit="px"
            onChange={v=>setTweak('qrSize',v)}/>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

export default App

// ── Модал открытия смены: выбор день/ночь ───────────────────────────
function ShiftOpenModal({ busy, onOpen, onClose }) {
  const [type, setType] = React.useState('day');
  return (
    <div className="modal-back">
      <div className="modal" style={{ width: 'min(440px,92vw)' }}>
        <div className="modal-head">
          <h3 className="modal-title">Открыть смену</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={16}/></button>
        </div>
        <div className="modal-body">
          <div className="field-label" style={{ marginBottom: 8 }}>Тип смены</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[['day','☀ Дневная','07:00–19:00'],['night','🌙 Ночная','19:00–07:00']].map(([v,l,h]) => (
              <button key={v} onClick={() => setType(v)}
                style={{ padding: '16px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                  border: '2px solid ' + (type === v ? 'var(--accent)' : 'var(--line-1)'),
                  background: type === v ? 'rgba(217,72,15,.08)' : 'transparent' }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{l}</div>
                <div className="muted" style={{ fontSize: 12 }}>{h}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Отмена</button>
          <button className="btn primary" disabled={busy} onClick={() => onOpen(type)}>
            {busy ? 'Открытие…' : 'Открыть ' + (type === 'night' ? 'ночную' : 'дневную')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Модал закрытия смены: комментарий + кому передаёт ────────────────
function ShiftCloseModal({ busy, shift, users, onCloseShift, onCancel }) {
  const [notes, setNotes]   = React.useState('');
  const [handoff, setHandoff] = React.useState('');
  const list = Array.isArray(users) ? users : [];
  return (
    <div className="modal-back">
      <div className="modal" style={{ width: 'min(480px,92vw)' }}>
        <div className="modal-head">
          <h3 className="modal-title">Закрыть смену</h3>
          <button className="icon-btn" onClick={onCancel}><Icon name="close" size={16}/></button>
        </div>
        <div className="modal-body">
          {shift && <div className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{shift.name}</div>}
          <div className="field" style={{ marginBottom: 14 }}>
            <span className="field-label">Кому передаёт смену</span>
            <input className="input" list="handoff-users" value={handoff} onChange={e => setHandoff(e.target.value)}
              placeholder="ФИО сменщика (необязательно)" style={{ width: '100%' }}/>
            <datalist id="handoff-users">
              {list.map(u => <option key={u.id} value={u.name}/>)}
            </datalist>
          </div>
          <div className="field">
            <span className="field-label">Комментарий по смене</span>
            <textarea className="input" rows={3} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Что важного: остановки, проблемы, что передать сменщику…" style={{ width: '100%', resize: 'vertical' }}/>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onCancel}>Отмена</button>
          <button className="btn primary" disabled={busy} onClick={() => onCloseShift(notes, handoff)}>
            {busy ? 'Закрытие…' : 'Закрыть смену'}
          </button>
        </div>
      </div>
    </div>
  );
}
