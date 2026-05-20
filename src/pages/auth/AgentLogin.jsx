import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAgentStore } from '../../store/agentStore'
import image1 from '../../assets/webdadslogo.svg'
import image2 from '../../assets/webdadsicon.svg'

const s = {
  page: { minHeight:'100vh', background:'#0d1117', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', fontFamily:"'Inter',system-ui,sans-serif" },
  card: { width:'100%', maxWidth:'400px' },
  logo: { display:'flex', alignItems:'center', gap:'10px', justifyContent:'center', marginBottom:'36px' },
  box:  { background:'#161b22', border:'1px solid #21262d', borderRadius:'16px', padding:'36px', boxShadow:'0 24px 64px rgba(0,0,0,.5)' },
  h1:   { fontSize:'22px', fontWeight:'700', color:'#e6edf3', marginBottom:'6px' },
  sub:  { fontSize:'14px', color:'#8b949e', marginBottom:'28px' },
  err:  { background:'rgba(248,81,73,.08)', border:'1px solid rgba(248,81,73,.25)', borderRadius:'10px', padding:'11px 14px', fontSize:'13px', color:'#f85149', marginBottom:'18px', display:'flex', alignItems:'center', gap:'8px' },
  lbl:  { display:'block', fontSize:'12px', fontWeight:'500', color:'#7d8590', marginBottom:'6px' },
  inp:  { width:'100%', background:'#0d1117', border:'1px solid #30363d', borderRadius:'10px', padding:'11px 14px', fontSize:'14px', color:'#e6edf3', outline:'none', fontFamily:'inherit', transition:'border-color .15s, box-shadow .15s', boxSizing:'border-box' },
  btn:  { width:'100%', background:'#1f6feb', color:'#fff', border:'none', borderRadius:'10px', padding:'12px', fontSize:'14px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit', transition:'background .15s', marginTop:'4px' },
  foot: { textAlign:'center', fontSize:'13px', color:'#7d8590', marginTop:'20px' },
  lnk:  { color:'#388bfd', textDecoration:'none', fontWeight:'500' },
  hint: { fontSize:'11px', color:'#484f58', marginTop:'4px' },
}

const onFocus = e => { e.target.style.borderColor='#388bfd'; e.target.style.boxShadow='0 0 0 3px rgba(56,139,253,.12)' }
const onBlur  = e => { e.target.style.borderColor='#30363d'; e.target.style.boxShadow='none' }

export default function AgentLogin() {
  const [form, setForm]       = useState({ tenantId: '', email: '', password: '' })
  const [err, setErr]         = useState('')
  const [loading, setLoading] = useState(false)
  const { loginAgent }        = useAgentStore()
  const navigate              = useNavigate()

  const submit = async e => {
    e.preventDefault()
    setErr('')
    if (!form.tenantId.trim()) return setErr('Tenant ID is required')
    if (!form.email.trim())    return setErr('Email is required')
    if (!form.password)        return setErr('Password is required')
    setLoading(true)
    try {
      await loginAgent(form.email, form.password, form.tenantId)
      navigate('/agent')
    } catch (e) {
      const msg = e.response?.data?.detail
      if (!msg || msg === 'Invalid email or password') {
        setErr('Invalid Tenant ID, email, or password')
      } else if (msg.includes('deactivated')) {
        setErr('Your account has been deactivated. Contact your admin.')
      } else {
        setErr(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>
          <img src={image2} alt="Logo" style={{ width:'40px', height:'40px' }} />
          <img src={image1} alt="Logo" style={{ width:'100px', height:'40px' }} />
        </div>

        <div style={s.box}>
          <h1 style={s.h1}>Agent Sign In</h1>
          <p style={s.sub}>Enter your Tenant ID to access your workspace</p>

          {err && (
            <div style={s.err}>
              <span>⚠</span> {err}
            </div>
          )}

          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            <div>
              <label style={s.lbl}>Tenant ID</label>
              <input
                type="text" required value={form.tenantId}
                onChange={e => setForm(p => ({ ...p, tenantId: e.target.value }))}
                placeholder="e.g. 6732abc9def..."
                style={{ ...s.inp, fontFamily:'monospace' }}
                onFocus={onFocus} onBlur={onBlur}
              />
              <span style={s.hint}>Get your Tenant ID from your admin</span>
            </div>
            <div>
              <label style={s.lbl}>Email address</label>
              <input
                type="email" required value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="you@company.com"
                style={s.inp} onFocus={onFocus} onBlur={onBlur}
              />
            </div>
            <div>
              <label style={s.lbl}>Password</label>
              <input
                type="password" required value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="••••••••"
                style={s.inp} onFocus={onFocus} onBlur={onBlur}
              />
            </div>
            <button
              type="submit" disabled={loading}
              style={{ ...s.btn, background: loading ? '#21262d' : '#1f6feb', cursor: loading ? 'not-allowed' : 'pointer' }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#388bfd' }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#1f6feb' }}>
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>
        </div>

        <p style={s.foot}>
          Account owner?{' '}
          <Link to="/login" style={s.lnk}>Sign in here</Link>
        </p>
      </div>
    </div>
  )
}
