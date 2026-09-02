import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import image1 from '../../assets/zylo-logo-white.png'

const inp = {
  width:'100%', background:'#0d1117', border:'1px solid #30363d',
  borderRadius:'10px', padding:'11px 14px', fontSize:'14px',
  color:'#e6edf3', outline:'none', fontFamily:'inherit',
}
const onFocus = e => { e.target.style.borderColor='#388bfd'; e.target.style.boxShadow='0 0 0 3px rgba(56,139,253,.12)' }
const onBlur  = e => { e.target.style.borderColor='#30363d'; e.target.style.boxShadow='none' }

const FEATURES = [
  { icon:'💬', title:'Unified Inbox',       desc:'All WhatsApp conversations in one place' },
  { icon:'📢', title:'Broadcast Campaigns', desc:'Send to thousands with one click' },
  { icon:'🤖', title:'Smart Automations',   desc:'Auto-replies, bots, and workflows' },
  { icon:'📊', title:'Analytics',           desc:'Delivery, read rates, and conversion tracking' },
  { icon:'👥', title:'Team Collaboration',  desc:'Multi-agent support with assignment rules' },
]

export default function Register() {
  const [form, setForm]       = useState({ business_name:'', email:'', password:'', confirm:'' })
  const [err, setErr]         = useState('')
  const [loading, setLoading] = useState(false)
  const navigate              = useNavigate()

  // Google → backend → /auth/google (server redirects to Google consent)
  const handleGoogle = () => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'
    window.location.href = `${apiBase}/auth/google`
  }

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    if (form.password !== form.confirm) { setErr('Passwords do not match'); return }
    if (form.password.length < 8)       { setErr('Password must be at least 8 characters'); return }
    setErr(''); setLoading(true)
    try {
      const { data } = await api.post('/onboarding/register', {
        business_name: form.business_name,
        email:         form.email,
        password:      form.password,
      })
      localStorage.setItem('access_token',  data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      navigate('/onboarding')
    } catch (e) {
      setErr(e.response?.data?.detail || 'Registration failed. Try again.')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', fontFamily:"'Inter',system-ui,sans-serif", background:'#0d1117' }}>

      {/* ── LEFT brand panel ──────────────────────────── */}
      <div style={{ width:'460px', flexShrink:0, padding:'48px 44px', background:'linear-gradient(160deg,#0d1117 0%,#161b22 100%)', borderRight:'1px solid #21262d', display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'52px' }}>
            <img src={image1} alt="Logo" style={{ width:'auto', height:'40px' }} />
            {/* <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:'linear-gradient(135deg,#25D366,#128C7E)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'800', color:'#fff', fontSize:'20px', boxShadow:'0 4px 16px rgba(37,211,102,.25)' }}>W</div>
            <span style={{ fontSize:'18px', fontWeight:'700', color:'#e6edf3' }}>WhatsApp CRM</span> */}
          </div>

          <h2 style={{ fontSize:'28px', fontWeight:'800', color:'#e6edf3', lineHeight:1.25, marginBottom:'14px' }}>
            The all-in-one<br/>
            <span style={{ color:'#25D366' }}>WhatsApp platform</span><br/>
            for growing businesses
          </h2>
          <p style={{ fontSize:'13px', color:'#7d8590', lineHeight:1.7, marginBottom:'32px' }}>
            Join thousands of businesses managing customer conversations, sending campaigns, and automating WhatsApp communication.
          </p>

          {FEATURES.map(feat => (
            <div key={feat.title} style={{ display:'flex', alignItems:'flex-start', gap:'12px', marginBottom:'14px' }}>
              <div style={{ width:'34px', height:'34px', borderRadius:'8px', background:'rgba(37,211,102,.07)', border:'1px solid rgba(37,211,102,.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'15px', flexShrink:0 }}>{feat.icon}</div>
              <div>
                <p style={{ fontSize:'13px', fontWeight:'600', color:'#e6edf3', marginBottom:'2px' }}>{feat.title}</p>
                <p style={{ fontSize:'12px', color:'#7d8590' }}>{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p style={{ fontSize:'11px', color:'#484f58', borderTop:'1px solid #21262d', paddingTop:'16px' }}>
          ✓ No credit card required &nbsp;·&nbsp; ✓ 14-day free trial &nbsp;·&nbsp; ✓ 99.9% uptime
        </p>
      </div>

      {/* ── RIGHT form panel ──────────────────────────── */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px', overflowY:'auto' }}>
        <div style={{ width:'100%', maxWidth:'420px' }}>
          <h1 style={{ fontSize:'24px', fontWeight:'700', color:'#e6edf3', marginBottom:'6px' }}>Create your free account</h1>
          <p style={{ fontSize:'14px', color:'#7d8590', marginBottom:'28px' }}>14-day trial. No credit card needed.</p>

          {/* Google */}
          <button onClick={handleGoogle} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px', background:'#fff', color:'#1a1a1a', border:'1px solid #d0d7de', borderRadius:'10px', padding:'11px', fontSize:'14px', fontWeight:'600', cursor:'pointer', marginBottom:'20px', fontFamily:'inherit' }}
            onMouseEnter={e=>e.currentTarget.style.background='#f6f8fa'}
            onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.9 32.9 29.4 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.5 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8.9 20-20 0-1.3-.1-2.7-.4-4z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16.1 18.9 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.2 6.5 29.4 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 10-1.9 13.6-5l-6.3-5.2C29.5 35.5 26.9 36 24 36c-5.3 0-9.8-3.1-11.3-7.5L6 33.5C9.5 39.6 16.3 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.5-4.7 5.8l6.3 5.2C40.8 35.9 44 30.4 44 24c0-1.3-.1-2.7-.4-4z"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'22px' }}>
            <div style={{ flex:1, height:'1px', background:'#21262d' }}/>
            <span style={{ fontSize:'12px', color:'#484f58' }}>or sign up with email</span>
            <div style={{ flex:1, height:'1px', background:'#21262d' }}/>
          </div>

          {err && (
            <div style={{ background:'rgba(248,81,73,.08)', border:'1px solid rgba(248,81,73,.22)', borderRadius:'10px', padding:'11px 14px', fontSize:'13px', color:'#f85149', marginBottom:'16px', display:'flex', gap:'8px' }}>
              <span>⚠</span> {err}
            </div>
          )}

          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            <div>
              <label style={{ display:'block', fontSize:'12px', fontWeight:'500', color:'#7d8590', marginBottom:'6px' }}>Business name</label>
              <input required value={form.business_name} onChange={f('business_name')} placeholder="Acme Corp" style={inp} onFocus={onFocus} onBlur={onBlur} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:'12px', fontWeight:'500', color:'#7d8590', marginBottom:'6px' }}>Work email</label>
              <input type="email" required value={form.email} onChange={f('email')} placeholder="you@company.com" style={inp} onFocus={onFocus} onBlur={onBlur} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div>
                <label style={{ display:'block', fontSize:'12px', fontWeight:'500', color:'#7d8590', marginBottom:'6px' }}>Password</label>
                <input type="password" required value={form.password} onChange={f('password')} placeholder="Min 8 chars" style={inp} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'12px', fontWeight:'500', color:'#7d8590', marginBottom:'6px' }}>Confirm</label>
                <input type="password" required value={form.confirm} onChange={f('confirm')} placeholder="Repeat" style={inp} onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>

            <button type="submit" disabled={loading}
              style={{ width:'100%', background: loading?'#21262d':'#25D366', color: loading?'#484f58':'#0d1117', border:'none', borderRadius:'10px', padding:'12px', fontSize:'14px', fontWeight:'700', cursor: loading?'not-allowed':'pointer', fontFamily:'inherit', marginTop:'4px' }}
              onMouseEnter={e=>{ if(!loading) e.currentTarget.style.background='#22c55e' }}
              onMouseLeave={e=>{ if(!loading) e.currentTarget.style.background='#25D366' }}>
              {loading ? 'Creating account…' : 'Create free account →'}
            </button>
          </form>

          <p style={{ fontSize:'12px', color:'#484f58', textAlign:'center', marginTop:'14px', lineHeight:1.6 }}>
            By signing up you agree to our <a href="#" style={{ color:'#388bfd', textDecoration:'none' }}>Terms</a> and <a href="#" style={{ color:'#388bfd', textDecoration:'none' }}>Privacy Policy</a>
          </p>
          <p style={{ textAlign:'center', fontSize:'13px', color:'#7d8590', marginTop:'16px' }}>
            Already have an account? <Link to="/login" style={{ color:'#388bfd', textDecoration:'none', fontWeight:'600' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}