import React from 'react'
import { api, Auth, API_BASE, setAuthExpiredHandler } from './lib/api.js'
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
  OrdersListView, ReportView
} from './screens/Screens.jsx'
import { Scanner, CloseOpModal } from './screens/Scanner.jsx'
import { ModalEditDetail, ModalEditOrder, ModalNewOrder, ModalNewDetail, AdminPanel, EquipmentDatalist } from './screens/Modals.jsx'


// app.jsx — root component, routing, state, tweaks

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "dark",
  "density": "compact",
  "lang": "ru",
  "qrSize": 70,
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
        <div style={{ textAlign:'center',marginTop:16,fontSize:11,color:'var(--fg-3)' }}>
          Тестовый вход: admin@marshrut.local / Admin1234!
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
  const [route, setRoute]             = React.useState('dashboard');
  const [toasts, setToasts]           = React.useState([]);
  const [modal, setModal]             = React.useState(null);
  const [appUsers, setAppUsers]       = React.useState([]);
  const [editingDetail, setEditingDetail] = React.useState(null);
  const [editingOrder,  setEditingOrder]  = React.useState(null);
  const [confirmDlg, setConfirmDlg]       = React.useState(null);
  const [activeOrderId, setActiveOrderId] = React.useState(null);

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
      api.get('/admin/users').then(r=>setAppUsers(r.data||[])).catch(()=>{});
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
        api.get('/scan-log?limit=50').then(r => setScanLog(apiScanLogToFrontend(r.data))).catch(()=>{});
      });
      es.addEventListener('order_updated', () => {
        api.get('/orders').then(r => {
          setData(prev => prev ? { ...prev, orders: apiOrderToData(r.data, prev.details || []).orders } : prev);
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
      ]);
      const d = apiOrderToData(or.data, dr.data);
      setData(d);
      setTasks(apiTasksToFrontend(tr.data));
      setScanLog(apiScanLogToFrontend(lr.data));
      setWorkshops(wr.data || []);
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
        setScanLog(apiScanLogToFrontend(lr.data));
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
    scanner:    ['Маршрут','Сканер ОТК'],
    history:    ['Маршрут','Журнал сканирований'],
    routesheet: ['Маршрут','Заказы',activeOrder?.number||'—','Маршрутный лист'],
    report:       ['Маршрут','Отчёт по заказам'],
    'orders-list': ['Маршрут','Все заказы'],
  }[route] || [];

  return (
    <div className="app">
      <Sidebar route={route==='routesheet'?'orders':route} setRoute={setRoute} lang={t.lang} counts={counts}/>
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
        <div className="scroller">
          {route === 'dashboard' && (
            <Dashboard data={data} tasks={tasks} scanLog={scanLog} lang={t.lang}
              onScan={()=>setRoute('scanner')} onCloseTask={id=>closeTask(id)}
              onNewOrder={()=>setModal('newOrder')}/>
          )}
          {route === 'orders' && (
            <div style={{ display:'flex',flexDirection:'column',gap:0,height:'100%' }}>
              {/* Умный пикер заказов */}
              <div style={{ padding:'12px 24px 0' }}>
                <OrderPicker orders={data.orders} activeId={activeOrderId}
                  onSelect={setActiveOrderId} onNew={()=>setModal('newOrder')} lang={t.lang}/>
              </div>
              <OrderBuilder key={activeOrderId} data={activeData} tasks={tasks} lang={t.lang}
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
          {route === 'routesheet' && <RouteSheetView data={activeData} tasks={tasks} lang={t.lang} qrSize={t.qrSize} onClose={()=>setRoute('orders')} onScanQR={()=>setRoute('scanner')}/>}
          {route === 'library' && (
            <Library data={data} tasks={tasks} lang={t.lang}
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
          {route === 'scanner' && <Scanner data={data} tasks={tasks} scanLog={scanLog} lang={t.lang} qrSize={t.qrSize} users={appUsers} onScanResult={(id,qr,qty,op,action,comment,closeStatus)=>closeTask(id,qr,qty,op,action,comment,closeStatus)}/>}
          {route === 'orders-list' && <OrdersListView data={data} tasks={tasks} lang={t.lang}
            onOpenOrder={id => {
              if (id === 'new') { setModal('newOrder'); return; }
              setActiveOrderId(id);
              setRoute('orders');
            }}/>}
          {route === 'workshop' && <WorkshopView workshops={workshops} tasks={tasks} lang={t.lang}
            onManage={()=>setModal('manageWorkshops')}/>}
          {route === 'history' && <HistoryView data={data} tasks={tasks} scanLog={scanLog} lang={t.lang}/>}
          {route === 'report'  && <ReportView  data={data} tasks={tasks} scanLog={scanLog} lang={t.lang}
            onOpenDashboard={id => { setActiveOrderId(id); setRoute('dashboard'); }}/>}
        </div>
      </div>

      <div id="ptr-ind" className="ptr-indicator" style={{opacity:0}}>↓ Обновление…</div>
      <div className="toast-stack">{toasts.map(toast=>(<div className="toast" key={toast.id}>{toast.msg}</div>))}</div>

      <EquipmentDatalist/>
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
          ['orders-list','grid',   'Список',    0],
          ['scanner',   'scan',    'Сканер',    0],
          ['library',   'library', 'Детали',    0],
          ['workshop',  'building','Цеха',      0],
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

      {modal==='newOrder'  && <ModalNewOrder  lang={t.lang} details={data.details} workshops={workshops} onClose={()=>setModal(null)} onCreated={()=>{loadAll();pushToast('Заказ создан');}}/>}
      {modal==='manageWorkshops' && <ModalManageWorkshops workshops={workshops}
          onClose={()=>setModal(null)}
          onSaved={ws=>{ setWorkshops(ws); setModal(null); }}/>}
      {modal==='newDetail' && <ModalNewDetail lang={t.lang} onClose={()=>setModal(null)} onCreated={()=>{loadAll();pushToast('Деталь добавлена');}}/>}
      {editingDetail && <ModalEditDetail lang={t.lang} detail={editingDetail} onClose={()=>setEditingDetail(null)} onSaved={()=>{loadAll();pushToast('Деталь сохранена');setEditingDetail(null);}}/>}
      {editingOrder  && <ModalEditOrder  lang={t.lang} order={editingOrder}  details={data.details} workshops={workshops} onClose={()=>setEditingOrder(null)}  onSaved={()=>{loadAll();pushToast('Заказ сохранён');setEditingOrder(null);}}/>}

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
          <TweakSlider label="Размер QR" value={t.qrSize} min={48} max={120} step={2} unit="px"
            onChange={v=>setTweak('qrSize',v)}/>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

export default App
