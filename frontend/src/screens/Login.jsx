import React from 'react';
import { api, Auth } from '../lib/api.js';
import { Icon } from '../components/Icon.jsx';

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
      Auth.setTokens(data.access_token, data.refresh_token);
      Auth.setUser(data.user);
      onLogin(data.user);
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }

  function handleKey(e) { if (e.key === 'Enter') handleSubmit(); }

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'var(--bg-0)', fontFamily:'var(--ui-font)',
    }}>
      <div style={{ width:360 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ fontSize:22, fontWeight:700, color:'var(--fg-0)', letterSpacing:'-0.5px' }}>МАРШРУТ</div>
          <div style={{ fontSize:12, color:'var(--fg-2)', marginTop:4 }}>Производственная система</div>
        </div>

        <div className="card" style={{ padding:28 }}>
          <div style={{ display:'flex', gap:4, marginBottom:24, background:'var(--bg-1)', borderRadius:8, padding:4 }}>
            {['login','register'].map(t => (
              <button key={t} onClick={()=>{setTab(t);setErr('');}}
                style={{ flex:1, padding:'6px 0', fontSize:13, fontWeight:500, border:'none', cursor:'pointer',
                  borderRadius:6, background: tab===t ? 'var(--bg-2)' : 'transparent',
                  color: tab===t ? 'var(--fg-0)' : 'var(--fg-2)',
                  boxShadow: tab===t ? '0 1px 3px rgba(0,0,0,0.12)' : 'none', transition:'all .15s',
                }}>
                {t === 'login' ? 'Вход' : 'Регистрация'}
              </button>
            ))}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {tab === 'register' && (
              <div className="field">
                <span className="field-label">Имя</span>
                <input className="input" value={name} onChange={e=>setName(e.target.value)} onKeyDown={handleKey} placeholder="Иван Иванов" autoFocus />
              </div>
            )}
            <div className="field">
              <span className="field-label">Email</span>
              <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={handleKey}
                placeholder="admin@marshrut.local" autoFocus={tab==='login'} />
            </div>
            <div className="field">
              <span className="field-label">Пароль</span>
              <input className="input" type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={handleKey} placeholder="••••••" />
            </div>
            {err && <div style={{ fontSize:12, color:'var(--danger)', padding:'8px 10px', background:'rgba(220,38,38,.08)', borderRadius:6 }}>{err}</div>}
            <button className="btn primary" onClick={handleSubmit} disabled={loading}
              style={{ width:'100%', justifyContent:'center', marginTop:4, padding:'10px 0', fontSize:14 }}>
              {loading ? 'Загрузка…' : (tab === 'login' ? 'Войти' : 'Создать аккаунт')}
            </button>
          </div>
        </div>

        <div style={{ textAlign:'center', marginTop:16, fontSize:11, color:'var(--fg-3)' }}>
          Тестовый вход: admin@marshrut.local / Admin1234!
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;
