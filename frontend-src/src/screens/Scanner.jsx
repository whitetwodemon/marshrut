import React from 'react'
import { Icon } from '../components/Icon.jsx'
import { QrCode } from '../components/QrCode.jsx'
import { useStrings } from '../lib/data.jsx'
import { api } from '../lib/api.js'
import jsQR from 'jsqr'

function Scanner({ data, tasks, scanLog, lang, qrSize, onScanResult, users }) {
  const S = useStrings(lang);
  const videoRef   = React.useRef(null);
  const canvasRef  = React.useRef(null);
  const streamRef  = React.useRef(null);
  const rafRef     = React.useRef(null);
  const lastScanRef = React.useRef({ text: '', at: 0 });

  const [cameraOn,    setCameraOn]    = React.useState(false);
  const [cameraError, setCameraError] = React.useState(null);
  const [detected,    setDetected]    = React.useState(null);   // {qrText, task}
  const [pendingClose,setPendingClose]= React.useState(null);
  const [manualValue, setManualValue] = React.useState('');
  const [closing,     setClosing]     = React.useState(false);

  // Map qrText → task for fast lookup
  const tasksByQr = React.useMemo(() => {
    const m = new Map();
    tasks.forEach(t => m.set(t.qrText, t));
    return m;
  }, [tasks]);

  // Camera start/stop
  React.useEffect(() => {
    if (!cameraOn) return;
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) { video.srcObject = stream; await video.play(); tick(); }
      } catch (err) {
        if (!cancelled) { setCameraError(err.message || String(err)); setCameraOn(false); }
      }
    }

    function tick() {
      if (cancelled) return;
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState >= 2 && window.jsQR) {
        const w = video.videoWidth, h = video.videoHeight;
        if (w && h) {
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(video, 0, 0, w, h);
          const img  = ctx.getImageData(0, 0, w, h);
          const code = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
          if (code?.data && code.data !== lastScanRef.current.text) {
            const now = Date.now();
            if (now - lastScanRef.current.at > 800) {
              lastScanRef.current = { text: code.data, at: now };
              handleDetect(code.data);
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    start();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    };
  }, [cameraOn]);

  function handleDetect(text) {
    const task = tasksByQr.get(text) || null;
    setDetected({ qrText: text, task });
  }

  function resetDetected() {
    setDetected(null);
    lastScanRef.current = { text: '', at: 0 };
  }

  function handleEnableCamera() {
    setCameraError(null);
    setCameraOn(true);
  }

  // Confirm action — called from modal with qty + operator + action + comment + closeStatus
  async function confirmClose(qty, operator, action, comment, closeStatus) {
    if (!detected?.task) return;
    setClosing(true);
    try {
      await onScanResult(detected.task.id, detected.qrText, qty, operator, action, comment || '', closeStatus || 'done');
    } finally {
      setClosing(false);
      setPendingClose(null);
      resetDetected();
    }
  }

  // Manual input submit
  function handleManualSubmit() {
    const v = manualValue.trim();
    if (!v) return;
    handleDetect(v);
    setManualValue('');
  }

  const detail = detected?.task ? data.details.find(d => d.id === detected.task.detailId) : null;

  return (
    <React.Fragment>
      {/* ── Header ── */}
      <div className="page-head">
        <div>
          <h1 className="page-title">{S.navScan}</h1>
          <div className="page-sub">{lang === 'en' ? 'Scan QR codes from the route sheet to close operations' : 'Сканируйте QR-коды с маршрутного листа для закрытия операций'}</div>
        </div>
        <div className="row">
          {cameraOn
            ? <button className="btn" onClick={() => setCameraOn(false)}><Icon name="pause" size={14}/>{lang === 'en' ? 'Stop' : 'Стоп'}</button>
            : <button className="btn primary" onClick={handleEnableCamera}><Icon name="camera" size={14}/>{S.enableCam}</button>
          }
        </div>
      </div>

      <div className="scanner-stage">
        {/* ── Phone frame ── */}
        <div>
          <div className="phone-frame">
            <div className="phone-screen">
              <div className="scan-statusbar">
                <span>09:42</span>
                <div className="icons">
                  <Icon name="signal" size={14}/>
                  <Icon name="wifi" size={14}/>
                  <Icon name="battery" size={22}/>
                </div>
              </div>
              <div className="scan-titlebar">
                <button className="iconbtn"><Icon name="arrow-left" size={16}/></button>
                <span>{lang === 'en' ? 'Scan operation' : 'Сканирование'}</span>
                <button className="iconbtn"><Icon name="flash" size={16}/></button>
              </div>

              <div className="scan-camview">
                {/* Video element — always rendered so ref is stable */}
                <video ref={videoRef} playsInline muted
                  style={{ display: cameraOn ? 'block' : 'none',
                    position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover' }} />
                <canvas ref={canvasRef} style={{ display:'none' }} />

                {/* Placeholder when camera off */}
                {!cameraOn && (
                  <div className="scan-fake" style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:8,color:'var(--fg-2)' }}>
                    <Icon name="camera" size={32}/>
                    <div style={{ fontSize:12 }}>{S.cameraOff}</div>
                  </div>
                )}

                {/* Scan overlay — pointer-events:none so camera button is clickable */}
                <div className="scan-overlay" style={{ pointerEvents:'none' }}>
                  <div className="scan-mask-top"/>
                  <div className="scan-mask-mid">
                    <div className="scan-mask-side"/>
                    <div className="scan-window">
                      <div className="scan-corner tl"/><div className="scan-corner tr"/>
                      <div className="scan-corner bl"/><div className="scan-corner br"/>
                      {cameraOn && <div className="scan-line"/>}
                    </div>
                    <div className="scan-mask-side"/>
                  </div>
                  <div className="scan-mask-bottom"/>
                </div>

                {/* Bottom action area — pointer-events:auto */}
                <div style={{ position:'absolute',bottom:0,left:0,right:0,padding:'0 12px 12px',zIndex:10 }}>
                  {!cameraOn && !cameraError && !detected && (
                    <button className="scan-fab" style={{ width:'100%',justifyContent:'center' }}
                      onClick={handleEnableCamera}>
                      <Icon name="camera" size={16}/>{S.enableCam}
                    </button>
                  )}
                  {cameraError && (
                    <div style={{ background:'rgba(0,0,0,.7)',borderRadius:8,padding:'10px 12px',fontSize:12,color:'#ffb579',marginBottom:8 }}>
                      {lang === 'en' ? 'Camera error: ' : 'Ошибка камеры: '}{cameraError}
                      <button className="btn" style={{ marginTop:8,width:'100%',justifyContent:'center' }}
                        onClick={handleEnableCamera}>
                        {lang === 'en' ? 'Retry' : 'Повторить'}
                      </button>
                    </div>
                  )}
                  {detected && detected.task && (
                    <div className="scan-card">
                      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                        <span className={
                          'pill ' + (detected.task.status === 'done' ? 'done' : detected.task.status === 'in_progress' ? 'prog' : 'wait')
                        }><span className="dot"/>
                          {detected.task.status === 'done'
                            ? (lang === 'en' ? 'Done' : 'Выполнена')
                            : detected.task.status === 'in_progress'
                            ? (lang === 'en' ? 'In progress' : 'В работе')
                            : (lang === 'en' ? 'Waiting' : 'Ожидает')}
                        </span>
                        <button onClick={resetDetected}
                          style={{ background:'transparent',border:0,color:'rgba(255,255,255,.5)',cursor:'pointer',fontSize:18,lineHeight:1 }}>✕</button>
                      </div>
                      <div style={{ fontSize:14,fontWeight:600,color:'#f3eee2',margin:'6px 0 4px' }}>
                        <span className="mono" style={{ color:'var(--accent)' }}>{String(detected.task.opNum).padStart(3,'0')}</span> {detected.task.opName}
                      </div>
                      <div className="scan-card-row"><span className="k">{S.detail}:</span><span className="v">{detail?.name}</span></div>
                      <div className="scan-card-row"><span className="k">{S.workCenter}:</span><span className="v mono">{detected.task.workCenter}</span></div>
                      <div className="scan-card-row"><span className="k">{S.qtyShort}:</span><span className="v num">{detected.task.completed}/{detected.task.planned} {S.pcs}</span></div>
                      {detected.task.status === 'done' ? (
                        <div style={{ textAlign:'center',fontSize:12,color:'rgba(255,255,255,.5)',marginTop:8,padding:'6px 0' }}>
                          {lang === 'en' ? 'Operation already closed' : 'Операция уже закрыта'}
                        </div>
                      ) : (
                        <div style={{ display:'flex',flexDirection:'column',gap:6,marginTop:8 }}>
                          {detected.task.status === 'waiting' && (
                            <button className="scan-fab" style={{ width:'100%',justifyContent:'center',background:'#3b82f6' }}
                              onClick={() => setPendingClose({ ...detected, action: 'start' })}>
                              <Icon name="arrow-right" size={15}/>{lang === 'en' ? 'Start operation' : 'Взять в работу'}
                            </button>
                          )}
                          <button className="scan-fab" style={{ width:'100%',justifyContent:'center' }}
                            onClick={() => setPendingClose({ ...detected, action: 'close' })}>
                            <Icon name="check" size={15}/>{S.closeOp}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {detected && !detected.task && (
                    <div className="scan-card">
                      <span className="pill block"><span className="dot"/>{S.noTask}</span>
                      <div style={{ fontSize:11,color:'rgba(255,255,255,.5)',margin:'4px 0',wordBreak:'break-all' }}>{detected.qrText}</div>
                      <button className="btn" style={{ width:'100%',justifyContent:'center',marginTop:6 }} onClick={resetDetected}>{S.cancel}</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Side panel ── */}
        <div className="stack">
          {/* Manual input */}
          <div className="card">
            <div className="card-head">
              <h3 className="card-title" style={{ fontSize:12 }}>{S.manualEntry}</h3>
              <span className="muted" style={{ fontSize:10.5 }}>{lang === 'en' ? 'Keyboard scanner / manual' : 'Сканер-клавиатура / вручную'}</span>
            </div>
            <div className="row" style={{ gap:6 }}>
              <input className="input mono" placeholder="OTASK:001-001-10"
                value={manualValue} onChange={e => setManualValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
                style={{ flex:1, fontSize:11 }} />
              <button className="btn primary" onClick={handleManualSubmit}>
                <Icon name="arrow-right" size={14}/>
              </button>
            </div>

            {/* Demo QR codes */}
            {tasks.filter(t => t.status !== 'done').length > 0 && (
              <React.Fragment>
                <div className="subhead" style={{ marginTop:14 }}>
                  {lang === 'en' ? 'Click to simulate scan (demo)' : 'Кликните для симуляции скана'}
                </div>
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  {tasks.filter(t => t.status !== 'done').slice(0,4).map(t => (
                    <div key={t.id} onClick={() => handleDetect(t.qrText)} title={t.qrText}
                      style={{ cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',
                        gap:4,padding:6,border:'1px solid var(--line-1)',borderRadius:6,background:'var(--bg-1)' }}>
                      <QrCode text={t.qrText} size={56}/>
                      <div className="mono" style={{ fontSize:9,color:'var(--fg-2)' }}>op {String(t.opNum).padStart(3,'0')}</div>
                    </div>
                  ))}
                </div>
              </React.Fragment>
            )}
          </div>

          {/* Scan log */}
          <div className="scan-log">
            <div className="scan-log-head">
              <div>
                <div style={{ fontSize:13,fontWeight:600 }}>{S.log}</div>
                <div className="muted" style={{ fontSize:10.5 }}>{lang === 'en' ? 'Live feed of QR closures' : 'Лента закрытия операций'}</div>
              </div>
              <span className="pill prog"><span className="dot"/>{cameraOn ? (lang==='en'?'live':'эфир') : (lang==='en'?'idle':'покой')}</span>
            </div>
            <div className="scan-log-body">
              {scanLog.length === 0
                ? <div className="empty-state" style={{ borderRadius:0,border:0 }}>—</div>
                : scanLog.map((s,i) => (
                  <div key={i} className="scan-log-row">
                    <div className="ts">{String(s.ts).slice(-5)}</div>
                    <div>
                      <div className="label"><span className="mono" style={{ color:'var(--accent)' }}>{s.op?.split(' ')[0]} </span>{s.op?.split(' ').slice(1).join(' ')}</div>
                      <div className="meta">{s.detail} · {s.operator} · {s.quantity} {S.pcs}</div>
                    </div>
                    <Icon name="check" size={14} style={{ color:'var(--st-prog-line)' }}/>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      </div>

      {/* ── Close operation modal ── */}
      {pendingClose && (
        <CloseOpModal
          task={pendingClose.task}
          detail={data.details.find(d => d.id === pendingClose.task?.detailId)}
          qrText={pendingClose.qrText}
          lang={lang}
          closing={closing}
          action={pendingClose.action || 'close'}
          users={users}
          onConfirm={confirmClose}
          onCancel={() => setPendingClose(null)}
        />
      )}
    </React.Fragment>
  );
}

function CloseOpModal({ task, detail, qrText, lang, closing, action, onConfirm, onCancel, users }) {
  const S = useStrings(lang);
  const [qty, setQty]           = React.useState(task.planned - task.completed);
  const [operator, setOperator] = React.useState(task.operator || '');
  const [comment, setComment]   = React.useState('');
  const [closeStatus, setCloseStatus] = React.useState('done');
  const isStart = action === 'start';



  const title = isStart
    ? (lang === 'en' ? 'Start operation?' : 'Взять в работу?')
    : S.closeOpQ;

  const confirmLabel = isStart
    ? (lang === 'en' ? 'Start' : 'В работу')
    : S.confirm;

  const hint = isStart
    ? (lang === 'en'
        ? `Operation will be marked "In progress". Operator will be assigned.`
        : `Операция перейдёт в статус «В работе». Оператор будет назначен.`)
    : (lang === 'en'
        ? `Operation will be marked done (${qty}/${task.planned} pc) and logged.`
        : `Операция перейдёт в «Выполнена» (${qty}/${task.planned} шт.) и запишется в журнал.`);

  return (
    <div className="modal-back" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ width:480 }}>
        <div className="modal-head">
          <h3 className="modal-title">{title}</h3>
          <button className="icon-btn" onClick={onCancel}><Icon name="close" size={16}/></button>
        </div>
        <div className="modal-body">
          <div className="row" style={{ gap:16,alignItems:'flex-start' }}>
            <QrCode text={qrText} size={100}/>
            <div style={{ flex:1 }}>
              <div className="muted mono" style={{ fontSize:10.5 }}>{qrText}</div>
              <div style={{ fontSize:16,fontWeight:600,marginTop:4 }}>
                <span className="mono" style={{ color:'var(--accent)' }}>{String(task.opNum).padStart(3,'0')}</span> {task.opName}
              </div>
              <div style={{ marginTop:4,fontSize:12,color:'var(--fg-1)' }}>{detail?.name} · <span className="mono">{detail?.code}</span></div>
              <div style={{ marginTop:4,fontSize:11,color:'var(--fg-2)' }}>{task.workCenter}</div>
            </div>
          </div>
          <div style={{ marginTop:18,display:'grid',gridTemplateColumns: isStart ? '1fr' : '1fr 1fr',gap:12 }}>
            {!isStart && (
              <div className="field">
                <span className="field-label">{lang === 'en' ? 'Qty accepted' : 'Принято (шт.)'}</span>
                <input className="input num" type="number" value={qty} min={0} max={task.planned}
                  onChange={e => setQty(parseInt(e.target.value)||0)}/>
              </div>
            )}
            <div className="field">
              <span className="field-label">{lang === 'en' ? 'Operator' : 'Исполнитель'}</span>
              <datalist id="operators-list">
                {(users || []).map(u => <option key={u.id} value={u.name}/>)}
              </datalist>
              <input
                className="input"
                list="operators-list"
                value={operator}
                onChange={e => setOperator(e.target.value)}
                placeholder={lang === 'en' ? 'Enter name…' : 'Введите имя…'}
                style={{ width:'100%' }}
              />
            </div>
          </div>
          {!isStart && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:4 }}>
              <div className="field">
                <span className="field-label">{lang === 'en' ? 'Result' : 'Результат'}</span>
                <select className="select" value={closeStatus} onChange={e=>setCloseStatus(e.target.value)} style={{width:'100%'}}>
                  <option value="done">{lang === 'en' ? 'Done' : 'Выполнена'}</option>
                  <option value="rejected">{lang === 'en' ? 'Rejected (defect)' : 'Брак'}</option>
                  <option value="rework">{lang === 'en' ? 'Rework required' : 'Переделка'}</option>
                  <option value="paused">{lang === 'en' ? 'Paused (no material)' : 'Пауза (нет материала)'}</option>
                </select>
              </div>
              <div className="field">
                <span className="field-label">{lang === 'en' ? 'Comment' : 'Комментарий'}</span>
                <input className="input" value={comment} onChange={e=>setComment(e.target.value)}
                  placeholder={lang === 'en' ? 'Optional note…' : 'Замечание…'}
                  style={{ width:'100%' }}/>
              </div>
            </div>
          )}
          <div className="alert" style={{ marginTop:14 }}>
            <Icon name="check" size={14}/>
            <span>{hint}</span>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onCancel} disabled={closing}>{S.cancel}</button>
          <button className="btn primary"
            style={ isStart ? { background:'#3b82f6',borderColor:'#3b82f6' } : {} }
            onClick={() => onConfirm(qty, operator, action, comment, closeStatus)} disabled={closing}>
            <Icon name="check" size={14}/>{closing ? (lang==='en'?'Saving…':'Сохранение…') : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export { Scanner, CloseOpModal }
