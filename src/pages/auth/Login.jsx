import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import image1 from '../../assets/webdadslogo.svg'
import image2 from '../../assets/webdadsicon.svg'

const s = {
  page: { minHeight:'100vh', background:'#0d1117', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', fontFamily:"'Inter',system-ui,sans-serif" },
  card: { width:'100%', maxWidth:'400px' },
  logo: { display:'flex', alignItems:'center', gap:'10px', justifyContent:'center', marginBottom:'36px' },
  mark: { width:'40px', height:'40px', borderRadius:'12px', background:'linear-gradient(135deg,#25D366,#128C7E)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'800', color:'#fff', fontSize:'20px', boxShadow:'0 4px 16px rgba(37,211,102,.3)' },
  box:  { background:'#161b22', border:'1px solid #21262d', borderRadius:'16px', padding:'36px', boxShadow:'0 24px 64px rgba(0,0,0,.5)' },
  h1:   { fontSize:'22px', fontWeight:'700', color:'#e6edf3', marginBottom:'6px' },
  sub:  { fontSize:'14px', color:'#8b949e', marginBottom:'28px' },
  err:  { background:'rgba(248,81,73,.08)', border:'1px solid rgba(248,81,73,.25)', borderRadius:'10px', padding:'11px 14px', fontSize:'13px', color:'#f85149', marginBottom:'18px', display:'flex', alignItems:'center', gap:'8px' },
  lbl:  { display:'block', fontSize:'12px', fontWeight:'500', color:'#7d8590', marginBottom:'6px' },
  inp:  { width:'100%', background:'#0d1117', border:'1px solid #30363d', borderRadius:'10px', padding:'11px 14px', fontSize:'14px', color:'#e6edf3', outline:'none', fontFamily:'inherit', transition:'border-color .15s, box-shadow .15s' },
  btn:  { width:'100%', background:'#238636', color:'#fff', border:'none', borderRadius:'10px', padding:'12px', fontSize:'14px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit', transition:'background .15s', marginTop:'4px' },
  foot: { textAlign:'center', fontSize:'13px', color:'#7d8590', marginTop:'20px' },
  lnk:  { color:'#388bfd', textDecoration:'none', fontWeight:'500' },
}

const onFocus = e => { e.target.style.borderColor='#388bfd'; e.target.style.boxShadow='0 0 0 3px rgba(56,139,253,.12)' }
const onBlur  = e => { e.target.style.borderColor='#30363d'; e.target.style.boxShadow='none' }

export default function Login() {
  const [form, setForm]     = useState({ email:'', password:'' })
  const [err, setErr]       = useState('')
  const [loading, setLoading] = useState(false)
  const { login }           = useAuthStore()
  const navigate            = useNavigate()

  const submit = async e => {
    e.preventDefault(); setErr(''); setLoading(true)
    try {
      const { status } = await login(form.email, form.password)
      navigate(status === 'active' ? '/dashboard' : '/onboarding')
    } catch(e) { setErr(e.response?.data?.detail || 'Invalid email or password') }
    finally { setLoading(false) }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>
          {/* <div style={s.mark}>W</div>
          <span style={{ fontSize:'18px', fontWeight:'700', color:'#e6edf3' }}>WhatsApp CRM</span> */}
          <img src={image2} alt="Logo" style={{ width:'40px', height:'40px'}} />
          <img src={image1} alt="Logo" style={{ width:'100px', height:'40px' }} />

        </div>

        <div style={s.box}>
          <h1 style={s.h1}>Welcome back</h1>
          <p style={s.sub}>Sign in to your account to continue</p>

          {err && (
            <div style={s.err}>
              <span>⚠</span> {err}
            </div>
          )}

          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
            <div>
              <label style={s.lbl}>Email address</label>
              <input type="email" required value={form.email}
                onChange={e=>setForm(p=>({...p,email:e.target.value}))}
                placeholder="you@company.com" style={s.inp} onFocus={onFocus} onBlur={onBlur} />
            </div>
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
                <label style={s.lbl}>Password</label>
                <a href="#" style={{ fontSize:'12px', color:'#388bfd', textDecoration:'none' }}>Forgot password?</a>
              </div>
              <input type="password" required value={form.password}
                onChange={e=>setForm(p=>({...p,password:e.target.value}))}
                placeholder="••••••••" style={s.inp} onFocus={onFocus} onBlur={onBlur} />
            </div>
            <button type="submit" disabled={loading}
              style={{ ...s.btn, background: loading?'#21262d':'#238636', cursor: loading?'not-allowed':'pointer' }}
              onMouseEnter={e=>{ if(!loading) e.currentTarget.style.background='#2ea043' }}
              onMouseLeave={e=>{ if(!loading) e.currentTarget.style.background='#238636' }}>
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>
        </div>

        <p style={s.foot}>
          Don't have an account?{' '}
          <Link to="/register" style={s.lnk}>Create one free</Link>
        </p>
      </div>
    </div>
  )
}