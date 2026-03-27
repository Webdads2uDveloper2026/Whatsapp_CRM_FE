import { useEffect, useState } from 'react'
import api from '../../services/api'

const S = {
  page:   { padding:'28px 32px', maxWidth:'1200px', fontFamily:"'Inter',system-ui,sans-serif", color:'#e6edf3' },
  hdr:    { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'14px' },
  h1:     { fontSize:'20px', fontWeight:'700', color:'#e6edf3' },
  btn:    { display:'inline-flex', alignItems:'center', gap:'6px', padding:'8px 16px', borderRadius:'10px', fontSize:'12px', fontWeight:'600', border:'none', cursor:'pointer', fontFamily:'inherit', transition:'all .15s' },
  input:  { width:'100%', background:'#1c2128', border:'1px solid #30363d', borderRadius:'10px', padding:'10px 14px', fontSize:'13px', color:'#e6edf3', outline:'none', fontFamily:'inherit' },
  label:  { display:'block', fontSize:'12px', fontWeight:'500', color:'#8b949e', marginBottom:'6px' },
  card:   { background:'#161b22', border:'1px solid #21262d', borderRadius:'14px' },
  overlay:{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'20px', backdropFilter:'blur(3px)' },
  modal:  { background:'#161b22', border:'1px solid #30363d', borderRadius:'16px', width:'100%', maxWidth:'400px', padding:'28px', boxShadow:'0 24px 64px rgba(0,0,0,.6)', maxHeight:'90vh', overflowY:'auto' },
  mh:     { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' },
  mclose: { background:'none', border:'none', color:'#8b949e', fontSize:'20px', cursor:'pointer', lineHeight:1, fontFamily:'inherit' },
  mfoot:  { display:'flex', justifyContent:'flex-end', gap:'10px', paddingTop:'16px', borderTop:'1px solid #21262d', marginTop:'20px' },
}

const ROLE = {
  superadmin: { bg:'rgba(248,81,73,.1)',   color:'#f85149', border:'rgba(248,81,73,.2)'  },
  manager:    { bg:'rgba(56,139,253,.1)',   color:'#388bfd', border:'rgba(56,139,253,.2)' },
  agent:      { bg:'rgba(139,148,158,.1)', color:'#8b949e', border:'rgba(139,148,158,.2)'},
}

function RoleBadge({ role }) {
  const cfg = ROLE[role] || ROLE.agent
  return <span style={{ fontSize:'11px', fontWeight:'600', padding:'3px 9px', borderRadius:'99px', background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}` }}>{role}</span>
}

const onFocus = e => { e.target.style.borderColor = '#388bfd' }
const onBlur  = e => { e.target.style.borderColor = '#30363d' }

export default function Agents() {
  const [agents,  setAgents]  = useState([])
  const [show,    setShow]    = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [form,    setForm]    = useState({ name:'', email:'', password:'', role:'agent' })

  const load = () => api.get('/agents').then(r => setAgents(r.data || [])).catch(() => {})
  useEffect(() => { load() }, [])

  const create = async e => {
    e.preventDefault(); setSaving(true); setError('')
    try { await api.post('/agents', form); setShow(false); load() }
    catch (e) { setError(e.response?.data?.detail || 'Error') }
    setSaving(false)
  }

  return (
    <div style={S.page}>
      <div style={S.hdr}>
        <h1 style={S.h1}>Agents</h1>
        <button onClick={() => setShow(true)} style={{ ...S.btn, background:'#1f6feb', color:'#fff' }}>+ Add Agent</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'14px' }}>
        {agents.length === 0 && (
          <div style={{ gridColumn:'1/-1', ...S.card, padding:'48px', textAlign:'center', color:'#8b949e' }}>
            <p style={{ fontSize:'32px', marginBottom:'10px', opacity:.3 }}>👤</p>
            <p style={{ fontSize:'13px' }}>No agents yet</p>
          </div>
        )}
        {agents.map(a => (
          <div key={a.id}
            style={{ ...S.card, display:'flex', alignItems:'center', gap:'14px', padding:'16px', transition:'border-color .15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#30363d'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#21262d'}>
            <div style={{ width:'44px', height:'44px', borderRadius:'50%', background:'linear-gradient(135deg,#8957e5,#388bfd)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', color:'#fff', fontSize:'15px', flexShrink:0 }}>
              {a.avatar_initials || a.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ fontSize:'13px', fontWeight:'600', color:'#e6edf3' }}>{a.name}</p>
              <p style={{ fontSize:'12px', color:'#8b949e', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.email}</p>
              <div style={{ marginTop:'5px' }}><RoleBadge role={a.role} /></div>
            </div>
            <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:a.is_active ? '#3fb950' : '#6e7681', flexShrink:0 }} title={a.is_active ? 'Active' : 'Inactive'} />
          </div>
        ))}
      </div>

      {show && (
        <div style={S.overlay} onClick={() => setShow(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.mh}>
              <h2 style={{ fontSize:'16px', fontWeight:'600' }}>Add Agent</h2>
              <button onClick={() => setShow(false)} style={S.mclose}>×</button>
            </div>
            {error && (
              <div style={{ background:'rgba(248,81,73,.1)', border:'1px solid rgba(248,81,73,.3)', borderRadius:'8px', padding:'10px 14px', fontSize:'12px', color:'#f85149', marginBottom:'14px' }}>{error}</div>
            )}
            <form onSubmit={create} style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              {[
                { k:'name',     l:'Full name', t:'text',     p:'Jane Smith'       },
                { k:'email',    l:'Email',     t:'email',    p:'jane@company.com' },
                { k:'password', l:'Password',  t:'password', p:'Min 8 characters' },
              ].map(f => (
                <div key={f.k}>
                  <label style={S.label}>{f.l}</label>
                  <input required type={f.t} value={form[f.k]}
                    onChange={e => setForm(p => ({ ...p, [f.k]:e.target.value }))}
                    placeholder={f.p} style={S.input} onFocus={onFocus} onBlur={onBlur} />
                </div>
              ))}
              <div>
                <label style={S.label}>Role</label>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role:e.target.value }))}
                  style={{ ...S.input, cursor:'pointer', appearance:'none' }}>
                  <option value="agent">Agent</option>
                  <option value="manager">Manager</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </div>
              <div style={S.mfoot}>
                <button type="button" onClick={() => setShow(false)}
                  style={{ ...S.btn, background:'#21262d', color:'#c9d1d9', border:'1px solid #30363d' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  style={{ ...S.btn, background:saving ? '#21262d' : '#1f6feb', color:saving ? '#8b949e' : '#fff', cursor:saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Adding…' : 'Add Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}