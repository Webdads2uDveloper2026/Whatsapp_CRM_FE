import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSuperAdminStore } from '../../store/superAdminStore'
import image1 from '../../assets/zylo-logo-white.png'

const s = {
  page: { minHeight:'100vh', background:'#0d1117', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', fontFamily:"'Inter',system-ui,sans-serif" },
  card: { width:'100%', maxWidth:'400px' },
  logo: { display:'flex', alignItems:'center', gap:'10px', justifyContent:'center', marginBottom:'36px' },
  box:  { background:'#161b22', border:'1px solid #21262d', borderRadius:'16px', padding:'36px', boxShadow:'0 24px 64px rgba(0,0,0,.5)' },
  badge:{ display:'inline-flex', alignItems:'center', gap:'6px', fontSize:'11px', fontWeight:'700', padding:'4px 10px', borderRadius:'99px', background:'rgba(248,81,73,.12)', color:'#f85149', border:'1px solid rgba(248,81,73,.25)', marginBottom:'16px', letterSpacing:'.04em' },
  h1:   { fontSize:'22px', fontWeight:'700', color:'#e6edf3', marginBottom:'6px' },
  sub:  { fontSize:'14px', color:'#8b949e', marginBottom:'28px' },
  err:  { background:'rgba(248,81,73,.08)', border:'1px solid rgba(248,81,73,.25)', borderRadius:'10px', padding:'11px 14px', fontSize:'13px', color:'#f85149', marginBottom:'18px', display:'flex', alignItems:'center', gap:'8px' },
  lbl:  { display:'block', fontSize:'12px', fontWeight:'500', color:'#7d8590', marginBottom:'6px' },
  inp:  { width:'100%', background:'#0d1117', border:'1px solid #30363d', borderRadius:'10px', padding:'11px 14px', fontSize:'14px', color:'#e6edf3', outline:'none', fontFamily:'inherit', transition:'border-color .15s, box-shadow .15s', boxSizing:'border-box' },
  btn:  { width:'100%', background:'#f85149', color:'#fff', border:'none', borderRadius:'10px', padding:'12px', fontSize:'14px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit', transition:'background .15s', marginTop:'4px' },
  note: { textAlign:'center', fontSize:'12px', color:'#484f58', marginTop:'16px' },
}

const onFocus = e => { e.target.style.borderColor='#f85149'; e.target.style.boxShadow='0 0 0 3px rgba(248,81,73,.12)' }
const onBlur  = e => { e.target.style.borderColor='#30363d'; e.target.style.boxShadow='none' }

export default function SuperAdminLogin() {
  const [form, setForm]       = useState({ email:'', password:'' })
  const [err, setErr]         = useState('')
  const [loading, setLoading] = useState(false)
  const { login }             = useSuperAdminStore()
  const navigate              = useNavigate()

  const submit = async e => {
    e.preventDefault(); setErr(''); setLoading(true)
    try {
      await login(form.email, form.password)
      navigate('/super-admin')
    } catch(e) { setErr(e.response?.data?.detail || 'Invalid credentials') }
    finally { setLoading(false) }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>
          <img src={image1} alt="Logo" style={{ width:'auto', height:'40px' }} />
        </div>

        <div style={s.box}>
          <div style={s.badge}>⚡ Platform Admin</div>
          <h1 style={s.h1}>Super Admin Login</h1>
          <p style={s.sub}>Sign in to the super admin portal</p>

          {err && (
            <div style={s.err}>
              <span>⚠</span> {err}
            </div>
          )}

          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            <div>
              <label style={s.lbl}>Email address</label>
              <input type="email" required value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="admin@example.com"
                style={s.inp} onFocus={onFocus} onBlur={onBlur} />
            </div>
            <div>
              <label style={s.lbl}>Password</label>
              <input type="password" required value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="••••••••"
                style={s.inp} onFocus={onFocus} onBlur={onBlur} />
            </div>
            <button type="submit" disabled={loading}
              style={{ ...s.btn, background: loading ? '#21262d' : '#f85149', cursor: loading ? 'not-allowed' : 'pointer' }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#ff6b6b' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#f85149' }}>
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>
        </div>

        <p style={s.note}>Super Admin access only</p>
      </div>
    </div>
  )
}
