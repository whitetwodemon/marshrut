// components/ComboBox.jsx — надёжный выпадающий список с возможностью ввода.
// Кнопка ▾ раскрывает список опций; клик выбирает; можно вписать своё значение.
import React from 'react';

export function ComboBox({ value, onChange, options = [], placeholder = '', style = {}, allowCustom = true }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const boxRef = React.useRef(null);

  React.useEffect(() => {
    const onDoc = e => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = query
    ? options.filter(o => String(o).toLowerCase().includes(query.toLowerCase()))
    : options;

  function pick(opt) {
    onChange(opt);
    setQuery('');
    setOpen(false);
  }

  return (
    <div ref={boxRef} style={{ position: 'relative', ...style }}>
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <input
          className="input"
          value={value}
          onChange={e => { onChange(e.target.value); setQuery(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          style={{ width: '100%', borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
        />
        <button type="button" onClick={() => setOpen(o => !o)} tabIndex={-1}
          style={{ width: 26, flexShrink: 0, border: '1px solid var(--line-1)', borderLeft: 'none',
            borderTopRightRadius: 6, borderBottomRightRadius: 6, background: 'var(--bg-1)',
            cursor: 'pointer', color: 'var(--fg-2)', fontSize: 10, lineHeight: 1 }}>▾</button>
      </div>
      {open && filtered.length > 0 && (
        <div className='combo-list' style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 2, maxHeight: 220,
          overflowY: 'auto', background: 'var(--bg-0, #fff)', border: '1px solid var(--line-1)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,.18)', zIndex: 5000 }}>
          {filtered.map(opt => (
            <div key={opt} onMouseDown={() => pick(opt)}
              style={{ padding: '7px 12px', fontSize: 13, cursor: 'pointer',
                background: opt === value ? 'var(--bg-1)' : 'transparent' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-1)'}
              onMouseLeave={e => e.currentTarget.style.background = opt === value ? 'var(--bg-1)' : 'transparent'}>
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
