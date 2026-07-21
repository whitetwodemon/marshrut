// screens/Integrations.jsx — интеграции (1С). Заблокировано, пока не включено в админке.
import React from 'react';
import { api, API_BASE, Auth } from '../lib/api.js';
import { Icon } from '../components/Icon.jsx';

export function Integrations({ settings }) {
  const enabled = settings?.feature_1c === '1';
  const [busy, setBusy] = React.useState('');

  async function download(path, filename) {
    setBusy(filename);
    try {
      const data = await api.get(path);
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert('Ошибка выгрузки: ' + e.message); }
    setBusy('');
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Интеграции</h1>
          <div className="page-sub">Обмен данными с внешними системами</div>
        </div>
      </div>

      <div className="card" style={{ padding: 20, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: 28 }}>🔗</span>
          <div>
            <b style={{ fontSize: 16 }}>Интеграция 1С:Предприятие</b>
            <div className="muted" style={{ fontSize: 13 }}>Экспорт заказов и номенклатуры в формат 1С (JSON)</div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 12, padding: '4px 10px', borderRadius: 20,
            background: enabled ? 'rgba(34,197,94,.12)' : 'var(--bg-1)',
            color: enabled ? '#22c55e' : 'var(--fg-2)', fontWeight: 700 }}>
            {enabled ? '● Активна' : '🔒 Заблокирована'}
          </span>
        </div>

        {enabled ? (
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button className="btn primary" disabled={busy} onClick={() => download('/integration/1c/export/orders', '1c-orders.json')}>
              {busy === '1c-orders.json' ? 'Выгрузка…' : '📦 Выгрузить заказы'}
            </button>
            <button className="btn" disabled={busy} onClick={() => download('/integration/1c/export/nomenclature', '1c-nomenclature.json')}>
              {busy === '1c-nomenclature.json' ? 'Выгрузка…' : '🔩 Выгрузить номенклатуру'}
            </button>
          </div>
        ) : (
          <div style={{ marginTop: 16, padding: 16, background: 'var(--bg-1)', borderRadius: 10,
            border: '1px dashed var(--line-1)', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
            <b>Функция расширенной версии</b>
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Интеграция с 1С доступна в расширенной версии.<br/>
              {Auth.isAdmin() ? 'Разблокируйте в Админ-панель → Обслуживание → Функции.' : 'Обратитесь к администратору для активации.'}
            </div>
          </div>
        )}
      </div>

      <div className="muted" style={{ fontSize: 12, marginTop: 16 }}>
        Выгрузка формирует JSON-документ, совместимый со стандартным обменом 1С (документы заказов + справочник номенклатуры).
        Формат можно адаптировать под конкретную конфигурацию (УНФ, ERP, Комплексная).
      </div>
    </div>
  );
}
