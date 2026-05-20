import React from 'react';
import { api } from '../lib/api.js';
import { Icon } from '../components/Icon.jsx';

// Admin Panel
// =======================================================
function AdminPanel({ lang, onBack }) {
  const [tab, setTab]             = React.useState('users');
  const [users, setUsers]         = React.useState([]);
  const [roles, setRoles]         = React.useState([]);
  const [permissions, setPerms]   = React.useState([]);
  const [editUser, setEditUser]   = React.useState(null);
  const [editRole, setEditRole]   = React.useState(null);
  const [loading, setLoading]     = React.useState(true);
  const [toast, setToast]         = React.useState('');

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(''), 3000); }

  async function load() {
    setLoading(true);
    const [ur, rr, pr] = await Promise.all([
      api.get('/admin/users'),
      api.get('/admin/roles'),
      api.get('/admin/permissions'),
    ]);
    setUsers(ur.data); setRoles(rr.data); setPerms(pr.data);
    setLoading(false);
  }

  React.useEffect(() => { load(); }, []);

  // ── User Editor Modal ────────────────────────────────
  function UserEditor({ user, roles, onSave, onClose }) {
    const isNew = !user?.id;
    const [name,     setName]     = React.useState(user?.name    || '');
    const [email,    setEmail]    = React.useState(user?.email   || '');
    const [roleId,   setRoleId]   = React.useState(user?.role_id || 3);
    const [active,   setActive]   = React.useState(user?.is_active ?? 1);
    const [password, setPassword] = React.useState('');
    const [err, setErr]           = React.useState('');
    const [saving, setSaving]     = React.useState(false);

    async function save() {
      setSaving(true); setErr('');
      try {
        const body = { name, email, role_id: Number(roleId), is_active: Number(active) };
        if (password) body.password = password;
        if (isNew) {
          body.password = password || 'Password1!';
          await api.post('/admin/users', body);
        } else {
          await api.put('/admin/users/' + user.id, body);
        }
        onSave();
        onClose();
      } catch(e) { setErr(e.message); }
      setSaving(false);
    }

    return (
      <div style={{ position:'fixed',inset:0,zIndex:2000,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center' }}>
        <div className="card" style={{ width:420,padding:24,display:'flex',flexDirection:'column',gap:14 }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
            <b style={{ fontSize:15 }}>{isNew ? 'Новый пользователь' : 'Редактировать'}</b>
            <button className="icon-btn" onClick={onClose}><Icon name="close" size={16}/></button>
          </div>
          <div className="field"><span className="field-label">Имя *</span>
            <input className="input" value={name} onChange={e=>setName(e.target.value)} /></div>
          <div className="field"><span className="field-label">Email *</span>
            <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} /></div>
          <div className="field"><span className="field-label">{isNew ? 'Пароль *' : 'Новый пароль (оставьте пустым)'}</span>
            <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder={isNew ? 'Минимум 6 символов' : '—'} /></div>
          <div className="field"><span className="field-label">Роль</span>
            <select className="select" value={roleId} onChange={e=>setRoleId(e.target.value)} style={{width:'100%'}}>
              {roles.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          <div className="field" style={{ flexDirection:'row',alignItems:'center',gap:8 }}>
            <input type="checkbox" id="ua" checked={!!active} onChange={e=>setActive(e.target.checked?1:0)} />
            <label htmlFor="ua" style={{ fontSize:13,cursor:'pointer' }}>Активен</label>
          </div>
          {err && <div style={{ fontSize:12,color:'var(--danger)' }}>{err}</div>}
          <div style={{ display:'flex',gap:8,justifyContent:'flex-end' }}>
            <button className="btn" onClick={onClose}>Отмена</button>
            <button className="btn primary" onClick={save} disabled={saving}>{saving?'Сохранение…':'Сохранить'}</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Role Permissions Editor ──────────────────────────
  function RoleEditor({ role, allPermissions, onSave, onClose }) {
    const grouped = allPermissions.reduce((acc, p) => {
      (acc[p.group_name] = acc[p.group_name]||[]).push(p); return acc;
    }, {});
    const groupLabels = { orders:'Заказы', details:'Номенклатура', scanner:'Сканер', log:'Журнал', admin:'Администрирование' };

    const [selected, setSelected] = React.useState(new Set(role.permissions));
    const [saving, setSaving] = React.useState(false);

    function toggle(name) {
      setSelected(prev => { const s=new Set(prev); s.has(name)?s.delete(name):s.add(name); return s; });
    }

    async function save() {
      setSaving(true);
      try {
        await api.put('/admin/roles/' + role.id + '/permissions', { permissions: [...selected] });
        onSave(); onClose();
      } catch(e) { alert(e.message); }
      setSaving(false);
    }

    return (
      <div style={{ position:'fixed',inset:0,zIndex:2000,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center' }}>
        <div className="card" style={{ width:500,maxHeight:'80vh',overflowY:'auto',padding:24,display:'flex',flexDirection:'column',gap:16 }}>
          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center' }}>
            <b style={{ fontSize:15 }}>Права: {role.label}</b>
            <button className="icon-btn" onClick={onClose}><Icon name="close" size={16}/></button>
          </div>
          {Object.entries(grouped).map(([grp, perms]) => (
            <div key={grp}>
              <div className="subhead" style={{ margin:'0 0 6px' }}>{groupLabels[grp]||grp}</div>
              {perms.map(p => (
                <label key={p.name} style={{ display:'flex',alignItems:'center',gap:8,padding:'5px 0',cursor:'pointer',fontSize:13 }}>
                  <input type="checkbox" checked={selected.has(p.name)} onChange={()=>toggle(p.name)} />
                  {p.label}
                  <span className="mono muted" style={{ fontSize:11,marginLeft:'auto' }}>{p.name}</span>
                </label>
              ))}
            </div>
          ))}
          <div style={{ display:'flex',gap:8,justifyContent:'flex-end',paddingTop:8,borderTop:'1px solid var(--line-2)' }}>
            <button className="btn" onClick={onClose}>Отмена</button>
            <button className="btn primary" onClick={save} disabled={saving}>{saving?'Сохранение…':'Сохранить'}</button>
          </div>
        </div>
      </div>
    );
  }

  const ROLE_COLORS = { admin:'var(--accent)', foreman:'#3b82f6', operator:'#10b981', viewer:'var(--fg-2)' };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-0)', fontFamily:'var(--ui-font)' }}>
      {/* Header */}
      <div style={{ background:'var(--bg-1)', borderBottom:'1px solid var(--line-2)', padding:'12px 24px',
        display:'flex', alignItems:'center', gap:16 }}>
        <button className="btn" onClick={onBack}><Icon name="close" size={14}/>Выход из панели</button>
        <b style={{ fontSize:15 }}>Панель администратора</b>
        <div style={{ display:'flex',gap:4,marginLeft:'auto' }}>
          {['users','roles'].map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              className={'btn' + (tab===t?' primary':'')} style={{ fontSize:13 }}>
              {t==='users' ? 'Пользователи' : 'Роли и права'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:24, maxWidth:960, margin:'0 auto' }}>
        {loading ? (
          <div style={{ textAlign:'center',padding:48,color:'var(--fg-2)' }}>Загрузка…</div>
        ) : tab === 'users' ? (
          <>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
              <b style={{ fontSize:16 }}>Пользователи ({users.length})</b>
              <button className="btn primary" onClick={()=>setEditUser({})}>
                <Icon name="plus" size={14}/>Добавить
              </button>
            </div>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr>
                  <th>Имя</th><th>Email</th><th>Роль</th><th>Активен</th><th>Последний вход</th><th style={{width:80}}></th>
                </tr></thead>
                <tbody>
                  {users.map(u=>(
                    <tr key={u.id} className="row-hover">
                      <td><b>{u.name}</b></td>
                      <td className="muted mono" style={{fontSize:12}}>{u.email}</td>
                      <td><span style={{ fontSize:12,fontWeight:600,color:ROLE_COLORS[u.role]||'var(--fg-1)' }}>{u.role_label}</span></td>
                      <td>{u.is_active ? <span style={{color:'#10b981'}}>✓</span> : <span style={{color:'var(--danger)'}}>✗</span>}</td>
                      <td className="muted" style={{fontSize:12}}>{u.last_login ? u.last_login.slice(0,16) : '—'}</td>
                      <td>
                        <button className="icon-btn" onClick={()=>setEditUser(u)} title="Редактировать">
                          <Icon name="dots" size={14}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom:16 }}>
              <b style={{ fontSize:16 }}>Роли и права доступа</b>
              <p style={{ fontSize:13,color:'var(--fg-2)',marginTop:4 }}>Нажмите на роль чтобы редактировать её права</p>
            </div>
            <div style={{ display:'grid',gap:12 }}>
              {roles.map(role=>(
                <div key={role.id} className="card" style={{ padding:18 }}>
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                      <span style={{ fontSize:14,fontWeight:700,color:ROLE_COLORS[role.name]||'var(--fg-0)' }}>{role.label}</span>
                      <span className="mono muted" style={{ fontSize:11 }}>{role.name}</span>
                    </div>
                    <button className="btn" onClick={()=>setEditRole(role)}>
                      <Icon name="cog" size={14}/>Права
                    </button>
                  </div>
                  <div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
                    {role.permissions.map(p=>(
                      <span key={p} className="tag mono" style={{ fontSize:11 }}>{p}</span>
                    ))}
                    {!role.permissions.length && <span className="muted" style={{fontSize:12}}>Нет прав</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {editUser !== null && (
        <UserEditor user={editUser} roles={roles}
          onSave={()=>{ load(); showToast('Сохранено'); }}
          onClose={()=>setEditUser(null)} />
      )}
      {editRole !== null && (
        <RoleEditor role={editRole} allPermissions={permissions}
          onSave={()=>{ load(); showToast('Права обновлены'); }}
          onClose={()=>setEditRole(null)} />
      )}
      {toast && (
        <div style={{ position:'fixed',bottom:24,right:24,background:'var(--fg-0)',color:'var(--bg-0)',
          padding:'10px 18px',borderRadius:8,fontSize:13,zIndex:3000 }}>{toast}</div>
      )}
    </div>
  );
}

export default AdminPanel;
