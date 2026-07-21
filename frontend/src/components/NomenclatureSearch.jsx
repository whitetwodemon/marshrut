import React from 'react';

// Настоящий поиск по номенклатуре: поле + выпадающий фильтруемый список + клик = выбор.
// Заменяет ненадёжный браузерный <datalist> и неискомый <select>.
export function NomenclatureSearch({ details, value, detailId, onPick, placeholder, allowManual = true }) {
  const [open, setOpen] = React.useState(false);
  const [hi, setHi]     = React.useState(0);
  const boxRef = React.useRef(null);

  const q = (value || '').trim().toLowerCase();
  const list = React.useMemo(() => {
    const arr = Array.isArray(details) ? details : [];
    if (!q) return arr.slice(0, 80);
    const words = q.split(/\s+/).filter(Boolean);
    return arr.filter(d => {
      const hay = ((d.code || '') + ' ' + (d.name || '') + ' ' + (d.material || '')).toLowerCase();
      return words.every(w => hay.includes(w));
    }).slice(0, 80);
  }, [details, q]);

  React.useEffect(() => {
    const onDoc = e => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function choose(d) {
    onPick({ detail_id: d.id, detail_name: d.name, detail_code: d.code });
    setOpen(false);
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <input className="input" value={value || ''}
        onChange={e => { onPick({ detail_id: null, detail_name: e.target.value }); setOpen(true); setHi(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi(h => Math.min(h + 1, list.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
          else if (e.key === 'Enter' && open && list[hi]) { e.preventDefault(); choose(list[hi]); }
          else if (e.key === 'Escape') setOpen(false);
        }}
        placeholder={placeholder || 'Поиск по коду/названию…'}
        style={{ width: '100%', paddingRight: detailId ? 24 : undefined }} autoComplete="off" />
      {detailId && <span title="Найдена в номенклатуре" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: '#22c55e', fontSize: 14, pointerEvents: 'none' }}>✓</span>}

      {open && list.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0, marginTop: 2,
          maxHeight: 260, overflowY: 'auto', background: 'var(--bg-0,#fff)', border: '1px solid var(--line-1)',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.18)' }}>
          {list.map((d, idx) => (
            <div key={d.id} onMouseDown={e => { e.preventDefault(); choose(d); }}
              onMouseEnter={() => setHi(idx)}
              style={{ padding: '7px 10px', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'baseline',
                background: idx === hi ? 'var(--bg-1)' : 'transparent', borderBottom: '1px solid var(--line-2)' }}>
              <span className="mono" style={{ color: 'var(--accent)', fontSize: 12, flexShrink: 0 }}>{d.code || '—'}</span>
              <span style={{ fontSize: 13 }}>{d.name}</span>
              {d.material && <span className="muted" style={{ fontSize: 11, marginLeft: 'auto' }}>{d.material}</span>}
            </div>
          ))}
        </div>
      )}
      {open && q && list.length === 0 && allowManual && (
        <div style={{ position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0, marginTop: 2,
          padding: '8px 10px', background: 'var(--bg-0,#fff)', border: '1px solid var(--line-1)', borderRadius: 8,
          fontSize: 12, color: 'var(--fg-2)' }}>
          Не найдено — будет создано вручную: «{value}»
        </div>
      )}
      {open && q && list.length === 0 && !allowManual && (
        <div style={{ position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0, marginTop: 2,
          padding: '8px 10px', background: 'var(--bg-0,#fff)', border: '1px solid var(--line-1)', borderRadius: 8,
          fontSize: 12, color: 'var(--fg-2)' }}>
          Ничего не найдено в номенклатуре
        </div>
      )}
    </div>
  );
}
