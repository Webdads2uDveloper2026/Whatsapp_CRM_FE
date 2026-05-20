import { useEffect, useState } from 'react'
import api from '../../services/api'
import { useAuthStore } from '../../store/authStore'

const S = {
  page:    { padding:'28px 32px', fontFamily:"'Inter',system-ui,sans-serif", color:'#e6edf3' },
  hdr:     { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:14 },
  h1:      { fontSize:20, fontWeight:700, color:'#e6edf3', margin:0 },
  sub:     { fontSize:13, color:'#8b949e', marginTop:4 },
  btn:     { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' },
  input:   { width:'100%', background:'#1c2128', border:'1px solid #30363d', borderRadius:10, padding:'10px 14px', fontSize:13, color:'#e6edf3', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  label:   { display:'block', fontSize:12, fontWeight:500, color:'#8b949e', marginBottom:6 },
  card:    { background:'#161b22', border:'1px solid #21262d', borderRadius:14 },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:20, backdropFilter:'blur(3px)' },
  modal:   { background:'#161b22', border:'1px solid #30363d', borderRadius:16, width:'100%', maxWidth:440, padding:28, boxShadow:'0 24px 64px rgba(0,0,0,.6)', maxHeight:'90vh', overflowY:'auto' },
  th:      { padding:'10px 16px', fontSize:11, color:'#8b949e', textAlign:'left', textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:'1px solid #21262d', fontWeight:600 },
  td:      { padding:'14px 16px', fontSize:13, color:'#e6edf3', borderBottom:'1px solid #1c2128' },
}

const ROLE = {
  superadmin: { bg:'rgba(248,81,73,.1)',   color:'#f85149', border:'rgba(248,81,73,.2)'  },
  manager:    { bg:'rgba(56,139,253,.1)',   color:'#388bfd', border:'rgba(56,139,253,.2)' },
  agent:      { bg:'rgba(139,148,158,.1)', color:'#8b949e', border:'rgba(139,148,158,.2)'},
}

function RoleBadge({ role }) {
  const c = ROLE[role] || ROLE.agent
  return (
    <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:99,
                   background:c.bg, color:c.color, border:`1px solid ${c.border}` }}>
      {role === 'superadmin' ? 'Super Admin' : role === 'manager' ? 'Manager' : 'Agent'}
    </span>
  )
}

const onFocus = e => { e.target.style.borderColor = '#388bfd' }
const onBlur  = e => { e.target.style.borderColor = '#30363d' }

const EMPTY_FORM = { name:'', email:'', password:'', role:'agent' }

export default function Agents() {
  const { tenant } = useAuthStore()
  const [agents,    setAgents]   = useState([])
  const [loading,   setLoading]  = useState(true)
  const [show,      setShow]     = useState(false)
  const [editAgent, setEditAgent]= useState(null)
  const [form,      setForm]     = useState(EMPTY_FORM)
  const [saving,    setSaving]   = useState(false)
  const [error,     setError]    = useState('')
  const [copied,    setCopied]   = useState(false)

  const load = async () => {
    setLoading(true)
    try { const r = await api.get('/agents'); setAgents(r.data || []) } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setForm(EMPTY_FORM); setError(''); setEditAgent(null); setShow(true)
  }

  const openEdit = a => {
    setForm({ name: a.name, email: a.email, password: '', role: a.role })
    setError(''); setEditAgent(a); setShow(true)
  }

  const closeModal = () => { setShow(false); setEditAgent(null); setForm(EMPTY_FORM); setError('') }

  const submit = async e => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      if (editAgent) {
        const payload = { name: form.name, role: form.role }
        if (form.password) payload.password = form.password
        await api.patch(`/agents/${editAgent.id}`, payload)
      } else {
        await api.post('/agents', form)
      }
      closeModal(); load()
    } catch (e) {
      setError(e.response?.data?.detail || 'Something went wrong')
    } finally { setSaving(false) }
  }

  const toggleActive = async a => {
    try {
      await api.post(`/agents/${a.id}/${a.is_active ? 'deactivate' : 'activate'}`)
      load()
    } catch {}
  }

  const deleteAgent = async a => {
    if (!window.confirm(`Remove ${a.name}? This cannot be undone.`)) return
    try { await api.delete(`/agents/${a.id}`); load() } catch {}
  }

  const copyTenantId = () => {
    navigator.clipboard.writeText(tenant?.id || '')
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={S.page}>

      {/* Header */}
      <div style={S.hdr}>
        <div>
          <h1 style={S.h1}>Agents</h1>
          <p style={S.sub}>{agents.length} team member{agents.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openAdd} style={{ ...S.btn, background:'#1f6feb', color:'#fff' }}>
          + Add Agent
        </button>
      </div>

      {/* Tenant ID card */}
      <div style={{ background:'rgba(56,139,253,.06)', border:'1px solid rgba(56,139,253,.2)',
                    borderRadius:12, padding:'12px 18px', marginBottom:24,
                    display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize:11, color:'#8b949e', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:3 }}>
            Tenant ID — Share with agents for login
          </div>
          <div style={{ fontSize:13, fontFamily:'monospace', color:'#e6edf3', wordBreak:'break-all' }}>
            {tenant?.r || '—'}
          </div>
        </div>
        <button onClick={copyTenantId}
          style={{ ...S.btn, background: copied ? '#238636' : '#21262d',
                   color: copied ? '#fff' : '#e6edf3', border:'1px solid #30363d', fontSize:12 }}>
          {copied ? '✓ Copied' : 'Copy ID'}
        </button>
      </div>

      {/* Table */}
      <div style={S.card}>
        {loading ? (
          <div style={{ padding:'48px', textAlign:'center', color:'#8b949e', fontSize:13 }}>Loading...</div>
        ) : agents.length === 0 ? (
          <div style={{ padding:'64px', textAlign:'center', color:'#8b949e' }}>
            <div style={{ fontSize:40, marginBottom:12, opacity:.3 }}>👤</div>
            <div style={{ fontSize:14, marginBottom:6 }}>No agents yet</div>
            <div style={{ fontSize:12 }}>Click "+ Add Agent" to invite your first team member</div>
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['Agent','Email','Role','Status','Actions'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map(a => (
                <tr key={a.id}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                  <td style={S.td}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:34, height:34, borderRadius:'50%', flexShrink:0,
                                   background:'linear-gradient(135deg,#8957e5,#388bfd)',
                                   display:'flex', alignItems:'center', justifyContent:'center',
                                   fontSize:13, fontWeight:700, color:'#fff' }}>
                        {a.avatar_initials || a.name?.[0]?.toUpperCase() || 'A'}
                      </div>
                      <span style={{ fontWeight:500 }}>{a.name}</span>
                    </div>
                  </td>

                  <td style={{ ...S.td, color:'#8b949e' }}>{a.email}</td>

                  <td style={S.td}><RoleBadge role={a.role} /></td>

                  <td style={S.td}>
                    <span style={{ fontSize:13, color: a.is_active ? '#3fb950' : '#8b949e' }}>
                      {a.is_active ? '● Active' : '● Inactive'}
                    </span>
                  </td>

                  <td style={S.td}>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      <button onClick={() => openEdit(a)}
                        style={{ ...S.btn, background:'#21262d', color:'#e6edf3',
                                 border:'1px solid #30363d', padding:'5px 12px', fontSize:12 }}>
                        Edit
                      </button>
                      <button onClick={() => toggleActive(a)}
                        style={{ ...S.btn, padding:'5px 12px', fontSize:12, border:'1px solid',
                                 background:   a.is_active ? 'rgba(210,153,34,.1)' : 'rgba(63,185,80,.1)',
                                 color:        a.is_active ? '#d29922' : '#3fb950',
                                 borderColor:  a.is_active ? 'rgba(210,153,34,.25)' : 'rgba(63,185,80,.25)' }}>
                        {a.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => deleteAgent(a)}
                        style={{ ...S.btn, background:'rgba(248,81,73,.1)', color:'#f85149',
                                 border:'1px solid rgba(248,81,73,.2)', padding:'5px 12px', fontSize:12 }}>
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Modal */}
      {show && (
        <div style={S.overlay} onClick={closeModal}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <h2 style={{ fontSize:16, fontWeight:600, margin:0 }}>
                {editAgent ? 'Edit Agent' : 'Add Agent'}
              </h2>
              <button onClick={closeModal}
                style={{ background:'none', border:'none', color:'#8b949e', fontSize:22, cursor:'pointer', lineHeight:1 }}>×</button>
            </div>

            {error && (
              <div style={{ background:'rgba(248,81,73,.1)', border:'1px solid rgba(248,81,73,.3)',
                            borderRadius:8, padding:'10px 14px', fontSize:12, color:'#f85149', marginBottom:14 }}>
                {error}
              </div>
            )}

            <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>

              <div>
                <label style={S.label}>Full Name</label>
                <input required type="text" value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Jane Smith" style={S.input} onFocus={onFocus} onBlur={onBlur} />
              </div>

              <div>
                <label style={S.label}>Email</label>
                <input required type="email" value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="jane@company.com"
                  readOnly={!!editAgent}
                  style={{ ...S.input, opacity: editAgent ? 0.6 : 1, cursor: editAgent ? 'not-allowed' : 'text' }}
                  onFocus={editAgent ? undefined : onFocus}
                  onBlur={editAgent ? undefined : onBlur} />
              </div>

              <div>
                <label style={S.label}>
                  {editAgent ? 'New Password (leave blank to keep current)' : 'Password'}
                </label>
                <input
                  required={!editAgent}
                  type="password"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder={editAgent ? 'Leave blank to keep current' : 'Min 8 characters'}
                  style={S.input} onFocus={onFocus} onBlur={onBlur} />
              </div>

              <div>
                <label style={S.label}>Role</label>
                <select value={form.role}
                  onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                  style={{ ...S.input, cursor:'pointer' }}>
                  <option value="agent">Agent — Inbox and Contacts only</option>
                  <option value="manager">Manager — Broadcasts, Templates, Analytics access</option>
                </select>
                <div style={{ fontSize:11, color:'#8b949e', marginTop:6 }}>
                  {form.role === 'agent'
                    ? '✅ Inbox  ✅ Contacts  ❌ Broadcasts  ❌ Templates  ❌ Analytics'
                    : '✅ Inbox  ✅ Contacts  ✅ Broadcasts  ✅ Templates  ✅ Analytics'}
                </div>
              </div>

              <div style={{ display:'flex', justifyContent:'flex-end', gap:10, paddingTop:16,
                            borderTop:'1px solid #21262d', marginTop:4 }}>
                <button type="button" onClick={closeModal}
                  style={{ ...S.btn, background:'#21262d', color:'#c9d1d9', border:'1px solid #30363d' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  style={{ ...S.btn, background: saving ? '#21262d' : '#1f6feb',
                           color: saving ? '#8b949e' : '#fff', cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Saving…' : editAgent ? 'Save Changes' : 'Add Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
