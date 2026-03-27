import { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import api from '../../services/api'

const S = {
  page:  { padding:'28px 32px', maxWidth:'800px', fontFamily:"'Inter',system-ui,sans-serif", color:'#e6edf3' },
  h1:    { fontSize:'20px', fontWeight:'700', color:'#e6edf3', marginBottom:'24px' },
  card:  { background:'#161b22', border:'1px solid #21262d', borderRadius:'14px', padding:'24px', marginBottom:'16px' },
  h2:    { fontSize:'14px', fontWeight:'600', color:'#e6edf3', marginBottom:'20px' },
  input: { width:'100%', background:'#1c2128', border:'1px solid #30363d', borderRadius:'10px', padding:'10px 14px', fontSize:'13px', color:'#e6edf3', outline:'none', fontFamily:'inherit' },
  label: { display:'block', fontSize:'12px', fontWeight:'500', color:'#8b949e', marginBottom:'6px' },
  btn:   { display:'inline-flex', alignItems:'center', gap:'6px', padding:'8px 16px', borderRadius:'10px', fontSize:'12px', fontWeight:'600', border:'none', cursor:'pointer', fontFamily:'inherit', transition:'all .15s' },
}

const onFocus = e => { e.target.style.borderColor = '#388bfd' }
const onBlur  = e => { e.target.style.borderColor = '#30363d' }

export default function Settings() {
  const { tenant }        = useAuthStore()
  const [form, setForm]   = useState({ business_name:'', website:'', industry:'', timezone:'UTC' })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (tenant) setForm(p => ({ ...p, business_name: tenant.businessName || '' }))
  }, [tenant])

  const save = async e => {
    e.preventDefault()
    try {
      await api.patch('/tenants/me', form)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {}
  }

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Settings</h1>

      <div style={S.card}>
        <h2 style={S.h2}>Business Profile</h2>
        <form onSubmit={save} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          {[
            { k:'business_name', l:'Business name', p:'Acme Corp'        },
            { k:'website',       l:'Website',       p:'https://acme.com' },
            { k:'industry',      l:'Industry',      p:'E-commerce'       },
          ].map(f => (
            <div key={f.k}>
              <label style={S.label}>{f.l}</label>
              <input value={form[f.k] || ''} onChange={e => setForm(p => ({ ...p, [f.k]:e.target.value }))}
                placeholder={f.p} style={S.input} onFocus={onFocus} onBlur={onBlur} />
            </div>
          ))}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:'6px' }}>
            {saved && <span style={{ fontSize:'12px', color:'#3fb950' }}>✓ Saved successfully</span>}
            <button type="submit" style={{ ...S.btn, background:'#1f6feb', color:'#fff', marginLeft:'auto' }}>
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}