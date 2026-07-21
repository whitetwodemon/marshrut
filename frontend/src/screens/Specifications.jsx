// screens/Specifications.jsx — вкладка «Спецификация»
// Заказ на производство от менеджера: перечень деталей к сроку.
import React from 'react';
import { api, Auth, unwrap } from '../lib/api.js';
import { Icon } from '../components/Icon.jsx';
import { NomenclatureSearch } from '../components/NomenclatureSearch.jsx';

// Изменяемые статусы
const STATUS = {
  development:   { t: 'В разработке',  c: '#f59e0b', d: 'У технолога на проработке' },
  waiting:       { t: 'В ожидании',    c: '#7a8694', d: 'Готова, ждёт запуска' },
  in_production: { t: 'В производстве', c: '#22c55e', d: 'Связана с заказами и номенклатурой' },
  done:          { t: 'Выполнена',      c: '#3b82f6', d: '' },
  cancelled:     { t: 'Отменена',       c: '#ef4444', d: '' },
};
const FLOW = ['development', 'waiting', 'in_production', 'done'];
const norm = s => (s === 'draft' ? 'development' : (s || 'development'));

function Toast({ text }) {
  if (!text) return null;
  return <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 3000,
    background: 'rgba(34,197,94,.15)', border: '1px solid rgba(34,197,94,.35)', borderRadius: 10,
    padding: '10px 18px', fontSize: 14, color: '#22c55e' }}>{text}</div>;
}

function StatusPill({ status }) {
  const st = STATUS[norm(status)] || STATUS.development;
  return <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 99,
    background: st.c + '22', color: st.c, whiteSpace: 'nowrap' }}>{st.t}</span>;
}

export function Specifications({ onRequestNewOrder, onOpenOrder }) {
  const [specs, setSpecs]     = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [sel, setSel]         = React.useState(null);
  const [showNew, setShowNew] = React.useState(false);
  const importRef = React.useRef(null);

  // Шаблон Excel для импорта спецификации
  async function downloadTemplate() {
    const XLSX = await import('xlsx');
    const rows = [
      ['Название спецификации:', 'Насосный агрегат НА-120'],
      ['Заказчик:', 'АО «Насосмаш»'],
      ['Срок (ГГГГ-ММ-ДД):', '2026-09-01'],
      [],
      ['Уровень', 'Тип', 'Название', 'Код', 'Кол-во', 'Комментарий'],
      [1, 'деталь', 'Фланец воротниковый ДУ-100', 'ФЛ-100-08', 2, ''],
      [1, 'сборка', 'Узел привода', '', 1, 'сборочная единица'],
      [2, 'деталь', 'Вал шлицевой Z=8', 'ВЛ-45-220', 1, 'входит в узел выше'],
      [2, 'деталь', 'Крышка ведущего вала', 'КВ-80-01', 2, ''],
      [1, 'деталь', 'Корпус насоса', 'КН-120-01', 1, ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{wch:9},{wch:8},{wch:34},{wch:12},{wch:7},{wch:24}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Спецификация');
    XLSX.writeFile(wb, 'шаблон-спецификации.xlsx');
  }

  // Импорт: уровни 1/2/3 → дерево children, POST /specifications
  async function importExcel(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });

      // Шапка: первые строки «Ключ: значение»
      let name = '', customer = '', due = '';
      let headerIdx = -1;
      for (let i = 0; i < rows.length; i++) {
        const a = String(rows[i][0] || '').toLowerCase();
        if (a.startsWith('название')) name = String(rows[i][1] || '').trim();
        else if (a.startsWith('заказчик')) customer = String(rows[i][1] || '').trim();
        else if (a.startsWith('срок')) due = String(rows[i][1] || '').trim().slice(0, 10);
        else if (a === 'уровень') { headerIdx = i; break; }
      }
      if (!name) { toast('В шаблоне не заполнено название спецификации'); return; }
      if (headerIdx < 0) { toast('Не найдена строка заголовков (Уровень | Тип | …)'); return; }

      // Дерево по уровням (стек родителей)
      const roots = []; const stack = []; let count = 0;
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const [lvlRaw, typeRaw, title, code, qtyRaw, comment] = rows[i];
        const title2 = String(title || '').trim();
        if (!title2) continue;
        const lvl = Math.max(1, parseInt(lvlRaw, 10) || 1);
        const node = {
          node_type: String(typeRaw || '').trim().toLowerCase().startsWith('сбор') ? 'assembly' : 'detail',
          detail_name: title2,
          detail_code: String(code || '').trim(),
          quantity: Math.max(1, parseInt(qtyRaw, 10) || 1),
          comment: String(comment || '').trim(),
          children: [],
        };
        stack.length = lvl - 1;                      // поднимаемся до нужного уровня
        if (lvl === 1 || !stack.length) roots.push(node);
        else stack[stack.length - 1].children.push(node);
        stack.push(node); count++;
      }
      if (!count) { toast('Не найдено ни одной позиции'); return; }

      await api.post('/specifications', { name, customer, due_date: due || null, items: roots });
      toast(`Импортировано: «${name}», позиций: ${count}`);
      load();
    } catch (err) { toast('Ошибка импорта: ' + err.message); }
  }
  const [msg, setMsg]         = React.useState('');
  const [confirm, setConfirm] = React.useState(null);

  const canManage = Auth.can('orders.create') || Auth.isAdmin();
  const toast = t => { setMsg(t); setTimeout(() => setMsg(''), 3000); };

  async function load() {
    setLoading(true);
    try { const d = await api.get('/specifications'); setSpecs(unwrap(d)); }
    catch (e) { setSpecs([]); toast(e.message || 'Не удалось загрузить'); }
    finally { setLoading(false); }
  }
  React.useEffect(() => { load(); }, []);

  async function remove(s) {
    try { await api.delete('/specifications/' + s.id); toast('Спецификация удалена'); load(); }
    catch (e) { toast('Ошибка: ' + e.message); }
  }

  if (sel) return <SpecDetail specId={sel} onBack={() => { setSel(null); load(); }} onToast={toast} onRequestNewOrder={onRequestNewOrder} onOpenOrder={onOpenOrder} />;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <Toast text={msg} />
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22 }}>Спецификации</h2>
        {canManage && (<>
          <button className="btn" style={{ marginLeft: 'auto' }} onClick={downloadTemplate}>
            <Icon name="download" size={14} /> Шаблон Excel
          </button>
          <button className="btn" onClick={() => importRef.current && importRef.current.click()}>
            <Icon name="upload" size={14} /> Импорт из Excel
          </button>
          <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={importExcel} />
          <button className="btn primary" onClick={() => setShowNew(true)}>
            <Icon name="plus" size={14} /> Новая спецификация
          </button>
        </>)}
      </div>

      {loading ? (
        <div className="empty-state">Загрузка…</div>
      ) : specs.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
          Спецификаций пока нет
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {specs.map(s => {
            const ordered = +s.items_ordered || 0, total = +s.items_total || 0;
            const pct = total ? Math.round(ordered / total * 100) : 0;
            return (
              <div key={s.id} className="card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <span className="mono" style={{ fontSize: 13, color: 'var(--accent)' }}>{s.number}</span>
                  <span style={{ fontWeight: 700, fontSize: 16, cursor: 'pointer' }} onClick={() => setSel(s.id)}>{s.name}</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <StatusPill status={s.status} />
                    <button className="btn ghost small" onClick={() => setSel(s.id)}>Открыть</button>
                    {canManage && (
                      <button className="icon-btn" title="Удалить" style={{ color: 'var(--danger)' }}
                        onClick={() => setConfirm({ title: 'Удалить спецификацию «' + s.name + '»?', onYes: () => remove(s) })}>
                        <Icon name="trash" size={15} />
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 13 }} className="muted">
                  {s.customer && <span>Клиент: {s.customer}</span>}
                  {s.due_date && <span>Срок: {s.due_date}</span>}
                  <span style={{ marginLeft: 'auto' }}>Заказов: {ordered}/{total}</span>
                </div>
                <div style={{ marginTop: 10, height: 4, background: 'var(--bg-3)', borderRadius: 99 }}>
                  <div style={{ height: 4, borderRadius: 99, width: pct + '%',
                    background: pct === 100 ? '#22c55e' : 'var(--accent)', transition: 'width .4s' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNew && <NewSpecModal onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} onToast={toast} />}
      {confirm && <ConfirmModal title={confirm.title} onYes={() => { confirm.onYes(); setConfirm(null); }} onClose={() => setConfirm(null)} />}
    </div>
  );
}

function ConfirmModal({ title, onYes, onClose }) {
  return (
    <div className="modal-back">
      <div className="modal" style={{ width: 'min(420px,92vw)' }}>
        <div className="modal-head"><h3 className="modal-title">Подтверждение</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={16} /></button></div>
        <div className="modal-body"><p style={{ margin: 0 }}>{title}</p></div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Отмена</button>
          <button className="btn primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={onYes}>Удалить</button>
        </div>
      </div>
    </div>
  );
}

function SpecDetail({ specId, onBack, onToast, onRequestNewOrder, onOpenOrder }) {
  const [spec, setSpec]       = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving]   = React.useState(false);
  const [addTo, setAddTo]     = React.useState(null);
  const canManage = Auth.can('orders.create') || Auth.isAdmin();
  const canTech   = Auth.can('details.create') || Auth.isAdmin();

  async function load() {
    setLoading(true);
    try { const d = await api.get('/specifications/' + specId); if (d && !Array.isArray(d.items)) d.items = []; setSpec(d); }
    catch (e) { onToast(e.message); }
    finally { setLoading(false); }
  }
  React.useEffect(() => { load(); }, [specId]);

  async function changeStatus(status) {
    setSaving(true);
    try { await api.put('/specifications/' + specId, { status }); onToast('Статус: ' + (STATUS[status]?.t || status)); load(); }
    catch (e) { onToast(e.message); }
    finally { setSaving(false); }
  }
  async function createOrder(node) {
    if (onRequestNewOrder && node && node.detail_id) {
      onRequestNewOrder({
        detailId: node.detail_id,
        quantity: node.quantity || 1,
        dueDate: spec.due_date || '',
        onLinked: async (orderId) => {
          try { await api.post(`/specifications/${specId}/items/${node.id}/link-order`, { order_id: orderId }); load(); }
          catch (e) { onToast(e.message); }
        },
      });
      return;
    }
    try { const r = await api.post(`/specifications/${specId}/items/${node.id}/create-order`, {});
      onToast(`Заказ ${r.number} создан`); load(); }
    catch (e) { onToast(e.message); }
  }
  async function addNode(node) {
    try { await api.post(`/specifications/${specId}/items`, node); onToast('Узел добавлен'); load(); }
    catch (e) { onToast(e.message); }
  }
  async function deleteNode(itemId) {
    try { await api.delete(`/specifications/${specId}/items/${itemId}`); onToast('Узел удалён'); load(); }
    catch (e) { onToast(e.message); }
  }

  if (loading || !spec) return <div style={{ padding: 24 }}><div className="empty-state">Загрузка…</div></div>;
  const status = norm(spec.status);
  const inProd = status === 'in_production';

  // Строим дерево из плоского списка
  const items = Array.isArray(spec.items) ? spec.items : [];
  const childrenOf = pid => items.filter(i => (i.parent_id || null) === (pid || null));
  const roots = childrenOf(null);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <button className="btn ghost" onClick={onBack} style={{ marginBottom: 16 }}>← К списку</button>

      <div className="card" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <span className="mono" style={{ color: 'var(--accent)' }}>{spec.number}</span>
          <h2 style={{ margin: 0, fontSize: 20 }}>{spec.name}</h2>
          <StatusPill status={spec.status} />
        </div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
          {spec.customer && <>Клиент: {spec.customer} · </>}
          {spec.due_date && <>Срок: {spec.due_date} · </>}
          {spec.manager && <>Менеджер: {spec.manager}</>}
        </div>

        {canManage && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="muted" style={{ fontSize: 13 }}>Статус:</span>
            <select className="select" value={status} disabled={saving}
              onChange={e => changeStatus(e.target.value)} style={{ minWidth: 180 }}>
              {FLOW.map(k => <option key={k} value={k}>{STATUS[k].t}</option>)}
              <option value="cancelled">{STATUS.cancelled.t}</option>
            </select>
            <span className="muted" style={{ fontSize: 12 }}>{STATUS[status]?.d}</span>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <b style={{ fontSize: 15 }}>Состав спецификации (дерево)</b>
          {canManage && (
            <button className="btn ghost small" style={{ marginLeft: 'auto' }}
              onClick={() => setAddTo({ parent_id: null, label: 'в корень' })}>
              <Icon name="plus" size={13}/> Добавить узел
            </button>
          )}
        </div>
        {roots.length === 0 ? (
          <div className="empty-state">Состав пуст — добавьте детали или сборочные единицы</div>
        ) : (
          <div>
            {roots.map(node => (
              <SpecTreeNode key={node.id} node={node} depth={0} childrenOf={childrenOf}
                specId={specId} canManage={canManage} canTech={canTech} inProd={inProd}
                onCreateOrder={createOrder} onDelete={deleteNode} onAddChild={setAddTo}
                onLink={load} onToast={onToast} onOpenOrder={onOpenOrder} />
            ))}
          </div>
        )}
      </div>

      {inProd && (
        <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          Спецификация в производстве: по готовым деталям создавайте заказы W_* — они свяжутся с номенклатурой. Сборка готова, когда готовы все её детали.
        </div>
      )}

      {addTo && <AddNodeModal label={addTo.label} parentId={addTo.parent_id}
        onAdd={(node) => { addNode(node); setAddTo(null); }} onClose={() => setAddTo(null)} />}
    </div>
  );
}

// Рекурсивный узел дерева спецификации
function SpecTreeNode({ node, depth, childrenOf, specId, canManage, canTech, inProd, onCreateOrder, onDelete, onAddChild, onLink, onToast, onOpenOrder }) {
  const [open, setOpen] = React.useState(true);
  const isAssembly = (node.node_type === 'assembly');
  const kids = childrenOf(node.id);
  const STATE_LBL = {
    done:            { t: '✓ Выполнен',     c: '#22c55e' },
    in_production:   { t: '⚙ В работе',     c: '#3b82f6' },
    ready:           { t: '◷ К запуску',    c: '#f59e0b' },
    no_nomenclature: { t: '○ Нет техкарты', c: '#9ca3af' },
  };
  const state = node.node_state || (isAssembly ? 'in_production' : 'no_nomenclature');
  const stLbl = STATE_LBL[state] || STATE_LBL.no_nomenclature;
  const ready = state === 'done';
  const ordered = +node.order_created && node.order_number;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
        paddingLeft: 10 + depth * 22, borderBottom: '1px solid var(--line-2)',
        background: isAssembly ? 'var(--bg-1)' : 'transparent' }}>
        {isAssembly ? (
          <button className="icon-btn" onClick={() => setOpen(o => !o)} style={{ flexShrink: 0 }}>
            <Icon name={open ? 'chevron-up' : 'chevron-down'} size={14}/>
          </button>
        ) : <span style={{ width: 18, flexShrink: 0, textAlign: 'center', color: 'var(--fg-2)' }}>•</span>}

        <span style={{ fontSize: 15, flexShrink: 0 }}>{isAssembly ? '🧩' : '🔩'}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <span style={{ fontWeight: isAssembly ? 700 : 600 }}>{node.detail_name}</span>
          {node.detail_code && <span className="muted mono" style={{ fontSize: 11, marginLeft: 8 }}>{node.detail_code}</span>}
          {isAssembly && <span className="muted" style={{ fontSize: 11, marginLeft: 8 }}>сборка · {kids.length} узл.</span>}
        </div>

        {canManage ? (
          <input type="number" min="1" defaultValue={node.quantity}
            title="Количество (Enter для сохранения)"
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
            onBlur={async e => {
              const q = Math.max(1, parseInt(e.target.value, 10) || 1);
              if (q === node.quantity) return;
              try { await api.patch(`/specifications/${specId}/items/${node.id}`, { quantity: q }); onLink && onLink(); }
              catch (err) { onToast && onToast(err.message); e.target.value = node.quantity; }
            }}
            style={{ width: 54, fontSize: 12, padding: '2px 4px', textAlign: 'center',
              border: '1px solid var(--line-1)', borderRadius: 4, background: 'transparent', color: 'var(--fg-1)' }}
          />
        ) : (
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{node.quantity} шт</span>
        )}
        <span style={{ fontSize: 12, width: 110, textAlign: 'center', flexShrink: 0,
          color: stLbl.c, fontWeight: ready ? 700 : 500 }}>{stLbl.t}</span>
        <span style={{ width: 110, textAlign: 'right', flexShrink: 0 }}>
          {ordered ? <button className="mono" title="Открыть заказ"
              onClick={() => onOpenOrder && onOpenOrder(node.order_id)}
              style={{ color: '#22c55e', fontSize: 12, background: 'none', border: 'none',
                cursor: 'pointer', textDecoration: 'underline', padding: 0, font: 'inherit' }}>
              ✓ {node.order_number} →</button>
            : <span className="muted" style={{ fontSize: 11 }}>—</span>}
        </span>

        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {!isAssembly && canTech && !(+node.nomenclature_ready) && (
            <LinkDetailButton specId={specId} item={node} onDone={onLink} onToast={onToast} />
          )}
          {!isAssembly && canManage && (+node.nomenclature_ready) && !ordered && inProd && (
            <button className="btn primary small" onClick={() => onCreateOrder(node)}>Заказ</button>
          )}
          {isAssembly && canManage && (
            <button className="icon-btn" title="Добавить в сборку"
              onClick={() => onAddChild({ parent_id: node.id, label: 'в «' + node.detail_name + '»' })}>
              <Icon name="plus" size={14}/>
            </button>
          )}
          {canManage && (
            <button className="icon-btn" title="Удалить узел" style={{ color: 'var(--danger)' }}
              onClick={() => { if (confirm('Удалить «' + node.detail_name + '»' + (kids.length ? ' и все вложенные узлы' : '') + '?')) onDelete(node.id); }}>
              <Icon name="trash" size={14}/>
            </button>
          )}
        </div>
      </div>

      {isAssembly && open && kids.map(child => (
        <SpecTreeNode key={child.id} node={child} depth={depth + 1} childrenOf={childrenOf}
          specId={specId} canManage={canManage} canTech={canTech} inProd={inProd}
          onCreateOrder={onCreateOrder} onDelete={onDelete} onAddChild={onAddChild}
          onLink={onLink} onToast={onToast} onOpenOrder={onOpenOrder} />
      ))}
    </div>
  );
}

// Модал добавления узла (деталь / сборка) с поиском по номенклатуре
function AddNodeModal({ label, parentId, onAdd, onClose }) {
  const [type, setType]   = React.useState('detail');
  const [name, setName]   = React.useState('');
  const [qty, setQty]     = React.useState(1);
  const [detailId, setDetailId] = React.useState(null);
  const [details, setDetails]   = React.useState([]);

  React.useEffect(() => { api.get('/details').then(d => setDetails(unwrap(d))).catch(() => {}); }, []);

  function submit() {
    if (!name.trim()) return;
    onAdd({ node_type: type, detail_name: name.trim(), quantity: qty,
      detail_id: type === 'detail' ? detailId : null, parent_id: parentId });
  }

  return (
    <div className="modal-back">
      <div className="modal" style={{ width: 'min(520px,94vw)' }}>
        <div className="modal-head"><h3 className="modal-title">Добавить узел {label}</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={16}/></button></div>
        <div className="modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[['detail','🔩 Деталь','из номенклатуры или вручную'],['assembly','🧩 Сборочная единица','содержит другие узлы']].map(([v,l,h]) => (
              <button key={v} onClick={() => { setType(v); setDetailId(null); }}
                style={{ padding: '12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  border: '2px solid ' + (type === v ? 'var(--accent)' : 'var(--line-1)'),
                  background: type === v ? 'rgba(217,72,15,.08)' : 'transparent' }}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{l}</div>
                <div className="muted" style={{ fontSize: 11 }}>{h}</div>
              </button>
            ))}
          </div>

          {type === 'detail' ? (
            <div className="field" style={{ marginBottom: 12 }}>
              <span className="field-label">Деталь (поиск по номенклатуре или ввод вручную)</span>
              <NomenclatureSearch details={details} value={name} detailId={detailId}
                onPick={({ detail_id, detail_name }) => { setName(detail_name); setDetailId(detail_id); }}
                placeholder="Поиск по коду/названию…" />
              {detailId && <span className="muted" style={{ fontSize: 11, color: '#22c55e' }}>✓ найдена в номенклатуре</span>}
            </div>
          ) : (
            <div className="field" style={{ marginBottom: 12 }}>
              <span className="field-label">Название сборочной единицы</span>
              <input className="input" value={name} onChange={e => setName(e.target.value)}
                placeholder="Например: Узел привода" style={{ width: '100%' }}/>
            </div>
          )}

          <div className="field" style={{ maxWidth: 120 }}>
            <span className="field-label">Количество</span>
            <input type="number" className="input" min="1" value={qty} onChange={e => setQty(+e.target.value)}/>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Отмена</button>
          <button className="btn primary" onClick={submit}>Добавить</button>
        </div>
      </div>
    </div>
  );
}

function LinkDetailButton({ specId, item, onDone, onToast }) {
  const [open, setOpen]       = React.useState(false);
  const [details, setDetails] = React.useState([]);
  const [q, setQ]             = React.useState('');

  async function openPicker() {
    setOpen(true);
    try { const d = await api.get('/details'); setDetails(unwrap(d)); } catch (e) { onToast(e.message); }
  }
  async function link(detailId) {
    try { await api.post(`/specifications/${specId}/items/${item.id}/link-detail`, { detail_id: detailId });
      onToast('Деталь привязана'); setOpen(false); onDone(); }
    catch (e) { onToast(e.message); }
  }

  if (!open) return <button className="btn ghost small" onClick={openPicker}>Привязать номенклатуру</button>;
  const filtered = details.filter(d => !q || ((d.name || '') + (d.code || '')).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="modal-back">
      <div className="modal" style={{ width: 'min(520px,92vw)' }}>
        <div className="modal-head"><h3 className="modal-title">Номенклатура для «{item.detail_name}»</h3>
          <button className="icon-btn" onClick={() => setOpen(false)}><Icon name="close" size={16} /></button></div>
        <div className="modal-body" style={{ maxHeight: '60vh' }}>
          <input className="input" placeholder="Поиск по коду или названию…" value={q} onChange={e => setQ(e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
          {filtered.length === 0 && <div className="empty-state">Ничего не найдено</div>}
          {filtered.map(d => (
            <div key={d.id} className="card" style={{ padding: '10px 12px', marginBottom: 6, cursor: 'pointer' }} onClick={() => link(d.id)}>
              <div style={{ fontWeight: 600 }}>{d.name}</div>
              <div className="muted mono" style={{ fontSize: 11 }}>{d.code} · {d.material}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NewSpecModal({ onClose, onSaved, onToast }) {
  const [name, setName]   = React.useState('');
  const [customer, setCust] = React.useState('');
  const [due, setDue]     = React.useState('');
  const [items, setItems] = React.useState([{ detail_name: '', quantity: 1, detail_id: null }]);
  const [details, setDetails] = React.useState([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => { api.get('/details').then(d => setDetails(unwrap(d))).catch(() => {}); }, []);
  const addRow = () => setItems(p => [...p, { detail_name: '', quantity: 1, detail_id: null }]);
  const rmRow  = i => setItems(p => p.filter((_, idx) => idx !== i));
  const upd    = (i, patch) => setItems(p => p.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  // выбор из номенклатуры
  async function save() {
    const valid = items.filter(it => it.detail_name.trim());
    if (!name.trim() || !valid.length) { onToast('Укажите название и хотя бы одну деталь'); return; }
    setSaving(true);
    try { await api.post('/specifications', { name, customer, due_date: due || null, items: valid });
      onToast('Спецификация создана'); onSaved(); }
    catch (e) { onToast(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="modal-back">
      <div className="modal" style={{ width: 'min(680px,94vw)' }}>
        <div className="modal-head">
          <h3 className="modal-title">Новая спецификация</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>
        <div className="modal-body">
          <div className="grid-2" style={{ marginBottom: 14 }}>
            <div className="field"><span className="field-label">Название *</span>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Заказ №42 для ООО Ромашка" /></div>
            <div className="field"><span className="field-label">Клиент</span>
              <input className="input" value={customer} onChange={e => setCust(e.target.value)} /></div>
            <div className="field"><span className="field-label">Срок</span>
              <input type="date" className="input" value={due} onChange={e => setDue(e.target.value)} /></div>
          </div>

          <div className="subhead" style={{ marginBottom: 8 }}>Детали к изготовлению</div>
          {details.length > 0 && (
            <div className="muted" style={{ fontSize: 11, marginBottom: 6 }}>
              В номенклатуре: {details.length}. Начни печатать код или название — подставится из списка.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 36px', gap: 8, marginBottom: 6, fontSize: 11 }} className="muted">
            <span>Деталь (поиск по номенклатуре или ввод вручную)</span><span>Кол-во</span><span></span>
          </div>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 36px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <NomenclatureSearch details={details} value={it.detail_name} detailId={it.detail_id}
                  onPick={({ detail_id, detail_name }) => upd(i, { detail_name, detail_id })}
                  placeholder="Поиск по коду/названию…" />
              </div>
              <input type="number" className="input" min="1" value={it.quantity}
                onChange={e => upd(i, { quantity: +e.target.value })} />
              {items.length > 1
                ? <button className="icon-btn" style={{ color: 'var(--danger)' }} onClick={() => rmRow(i)}><Icon name="trash" size={14} /></button>
                : <span />}
            </div>
          ))}
          <button className="btn ghost small" onClick={addRow}>+ Добавить деталь</button>
          <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>
            ✓ рядом с полем = деталь найдена в номенклатуре. Без галочки — технолог создаст техкарту позже (статус «В разработке»).
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={onClose}>Отмена</button>
          <button className="btn primary" onClick={save} disabled={saving}>{saving ? 'Сохранение…' : 'Создать'}</button>
        </div>
      </div>
    </div>
  );
}
