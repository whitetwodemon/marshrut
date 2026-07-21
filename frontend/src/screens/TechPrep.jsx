// screens/TechPrep.jsx — Техподготовка ЧПУ: очередь готовности УП + файлы деталей
import React from 'react';
import { Icon } from '../components/Icon.jsx';
import { api, Auth } from '../lib/api.js';

const FILE_TYPE_LABEL = { drawing: 'Чертёж', nc_program: 'УП (ЧПУ)', setup_sheet: 'Карта наладки', model: '3D-модель' };
const ALLOWED_EXT = '.pdf,.dxf,.dwg,.step,.stp,.nc,.mpf,.tap,.h,.xlsx,.xls';

export function TechPrep({ lang }) {
  const canManage = Auth.can('tech.manage') || Auth.isAdmin();
  const [queue, setQueue] = React.useState(null);
  const [error, setError] = React.useState('');
  const [openDetail, setOpenDetail] = React.useState(null); // { detail_id, detail_name, detail_code }
  const [toast, setToast] = React.useState('');

  function load() {
    api.get('/tech-prep/queue')
      .then(r => setQueue(r.data || []))
      .catch(e => setError(e.message || 'Не удалось загрузить очередь'));
  }
  React.useEffect(load, []);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2500); }

  if (error) return (
    <div className="page">
      <div className="page-head"><h1>Техподготовка</h1></div>
      <div className="empty-state">{error}</div>
    </div>
  );
  if (queue === null) return <div className="page"><div className="empty-state">Загрузка…</div></div>;

  const totalPending = queue.reduce((s, o) => s + o.pending, 0);

  return (
    <div className="page">
      <div className="page-head">
        <h1>Техподготовка ЧПУ</h1>
        <div className="page-sub">
          {totalPending > 0
            ? `Не хватает УП: ${totalPending} операций в ${queue.length} заказах`
            : 'Все ЧПУ-операции активных заказов обеспечены управляющими программами'}
        </div>
      </div>

      {queue.length === 0 && (
        <div className="empty-state" style={{ color: 'var(--green, #22c55e)' }}>
          ✓ Готово — недостающих УП нет
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {queue.map(order => (
          <div key={order.order_id} className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <b className="mono">{order.order_number}</b>
              <span className="muted" style={{ fontSize: 12 }}>
                срок {order.due_date || '—'} · не хватает {order.pending} из {order.total}
              </span>
            </div>
            {order.details.map(d => (
              <div key={d.detail_id} style={{ padding: '8px 0', borderTop: '1px solid var(--line-2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <b>{d.detail_name}</b>{' '}
                    <span className="muted mono" style={{ fontSize: 12 }}>{d.detail_code}</span>
                  </div>
                  {canManage && (
                    <button className="btn" onClick={() => setOpenDetail(d)}>
                      <Icon name="route" size={13} /> Файлы
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                  {d.operations.map(op => (
                    <span key={op.op_num} className={'pill' + (op.has_nc ? ' prog' : '')}
                      style={{ background: op.has_nc ? undefined : 'rgba(220,38,38,.12)',
                        color: op.has_nc ? undefined : '#dc2626', border: op.has_nc ? undefined : '1px solid rgba(220,38,38,.3)' }}>
                      {op.has_nc ? '✓' : '✕'} {String(op.op_num).padStart(3, '0')} {op.op_name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {openDetail && (
        <DetailFilesModal detail={openDetail} onClose={() => { setOpenDetail(null); load(); }} showToast={showToast} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// Модалка файлов детали — используется и из очереди, и из карточки номенклатуры
export function DetailFilesModal({ detail, onClose, showToast }) {
  const [files, setFiles] = React.useState(null);
  const [uploadType, setUploadType] = React.useState('drawing');
  const [uploadOp, setUploadOp] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef(null);

  function load() {
    api.get(`/details/${detail.detail_id || detail.id}/files`)
      .then(r => setFiles(r.data || []))
      .catch(() => setFiles([]));
  }
  React.useEffect(load, [detail]);

  async function onPick(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      fd.append('file_type', uploadType);
      if (uploadOp) fd.append('op_num', uploadOp);
      await api.postForm(`/details/${detail.detail_id || detail.id}/files`, fd);
      showToast && showToast('Файл загружен');
      load();
    } catch (err) { showToast && showToast('Ошибка: ' + err.message); }
    setBusy(false);
  }

  async function onDelete(id) {
    if (!confirm('Удалить файл?')) return;
    try { await api.delete(`/files/${id}`); load(); } catch (err) { showToast && showToast('Ошибка: ' + err.message); }
  }

  function download(f) {
    api.downloadFile(`/files/${f.id}/download`, f.filename);
  }

  return (
    <div className="modal-back" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="card" style={{ width: 520, maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto', padding: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <b style={{ fontSize: 16 }}>{detail.detail_name || detail.name}</b>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>
        <div className="muted mono" style={{ fontSize: 12, marginBottom: 16 }}>{detail.detail_code || detail.code}</div>

        <div className="card" style={{ padding: 12, marginBottom: 16, background: 'var(--bg-1)' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="input" value={uploadType} onChange={e => setUploadType(e.target.value)} style={{ flex: 1, minWidth: 140 }}>
              <option value="drawing">Чертёж</option>
              <option value="nc_program">УП (ЧПУ)</option>
              <option value="setup_sheet">Карта наладки</option>
              <option value="model">3D-модель</option>
            </select>
            <input className="input" type="number" min="0" placeholder="№ операции (опц.)"
              value={uploadOp} onChange={e => setUploadOp(e.target.value)} style={{ width: 150 }} />
            <button className="btn primary" onClick={() => fileRef.current && fileRef.current.click()} disabled={busy}>
              {busy ? '…' : 'Загрузить'}
            </button>
            <input ref={fileRef} type="file" accept={ALLOWED_EXT} style={{ display: 'none' }} onChange={onPick} />
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>PDF, DXF, DWG, STEP, NC/MPF/TAP, XLSX · до 25 МБ</p>
        </div>

        {files === null ? <div className="muted">Загрузка…</div> : files.length === 0 ? (
          <div className="empty-state" style={{ padding: 20 }}>Файлов пока нет</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {files.map(f => (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 10px', background: 'var(--bg-1)', borderRadius: 8, fontSize: 13 }}>
                <div>
                  <span className="pill" style={{ marginRight: 8 }}>{FILE_TYPE_LABEL[f.file_type] || f.file_type}</span>
                  {f.op_num != null && <span className="mono muted" style={{ marginRight: 8 }}>оп. {f.op_num}</span>}
                  {f.filename} <span className="muted">v{f.version} · {Math.round(f.size_bytes / 1024)} КБ</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="icon-btn" title="Скачать" onClick={() => download(f)}><Icon name="arrow-right" size={13} /></button>
                  <button className="icon-btn" title="Удалить" onClick={() => onDelete(f.id)}><Icon name="trash" size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
