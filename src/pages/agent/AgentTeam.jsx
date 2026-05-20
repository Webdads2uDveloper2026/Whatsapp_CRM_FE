import { useEffect, useState, useRef } from 'react'
import { useAgentStore } from '../../store/agentStore'
import agentApi from '../../services/agentApi'

const S = {
  page:    { padding:'28px 32px', maxWidth:'1100px', fontFamily:"'Inter',system-ui,sans-serif", color:'#e6edf3' },
  hdr:     { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'12px' },
  h1:      { fontSize:'20px', fontWeight:'700', color:'#e6edf3', margin:0 },
  card:    { background:'#161b22', border:'1px solid #21262d', borderRadius:'14px' },
  btn:     { display:'inline-flex', alignItems:'center', gap:'6px', padding:'8px 16px', borderRadius:'10px', fontSize:'13px', fontWeight:'600', border:'none', cursor:'pointer', fontFamily:'inherit', transition:'all .15s' },
  input:   { width:'100%', background:'#1c2128', border:'1px solid #30363d', borderRadius:'10px', padding:'10px 14px', fontSize:'13px', color:'#e6edf3', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  label:   { display:'block', fontSize:'12px', fontWeight:'500', color:'#8b949e', marginBottom:'6px' },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'20px', backdropFilter:'blur(3px)' },
  modal:   { background:'#161b22', border:'1px solid #30363d', borderRadius:'16px', width:'100%', maxWidth:'460px', padding:'28px', boxShadow:'0 24px 64px rgba(0,0,0,.6)', maxHeight:'90vh', overflowY:'auto' },
  mh:      { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' },
  mclose:  { background:'none', border:'none', color:'#8b949e', fontSize:'22px', cursor:'pointer', lineHeight:1 },
  mfoot:   { display:'flex', justifyContent:'flex-end', gap:'10px', paddingTop:'16px', borderTop:'1px solid #21262d', marginTop:'20px' },
  th:      { padding:'10px 16px', fontSize:'11px', fontWeight:'600', color:'#7d8590', textAlign:'left', textTransform:'uppercase', letterSpacing:'.05em', borderBottom:'1px solid #21262d' },
  td:      { padding:'12px 16px', fontSize:'13px', color:'#e6edf3', borderBottom:'1px solid #21262d', verticalAlign:'middle' },
}

const ROLE_COLORS = {
  superadmin: { bg:'rgba(248,81,73,.1)',   color:'#f85149', border:'rgba(248,81,73,.2)'  },
  manager:    { bg:'rgba(56,139,253,.1)',   color:'#388bfd', border:'rgba(56,139,253,.2)' },
  agent:      { bg:'rgba(139,148,158,.1)', color:'#8b949e', border:'rgba(139,148,158,.2)'},
}

const ALL_PERMS = ['inbox','contacts','broadcasts','templates','automations','analytics','settings','agents']

function RoleBadge({ role }) {
  const cfg = ROLE_COLORS[role] || ROLE_COLORS.agent
  return <span style={{ fontSize:'11px', fontWeight:'600', padding:'3px 9px', borderRadius:'99px', background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}` }}>{role}</span>
}

const onFocus = e => { e.target.style.borderColor = '#388bfd' }
const onBlur  = e => { e.target.style.borderColor = '#30363d' }

function ErrBox({ msg }) {
  if (!msg) return null
  return <div style={{ background:'rgba(248,81,73,.1)', border:'1px solid rgba(248,81,73,.3)', borderRadius:'8px', padding:'10px 14px', fontSize:'12px', color:'#f85149', marginBottom:'14px' }}>{msg}</div>
}

export default function AgentTeam() {
  const { agent, isSuperAdmin } = useAgentStore()
  const [agents, setAgents]   = useState([])
  const [roles, setRoles]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied]   = useState(false)
  const [matrixOpen, setMatrixOpen] = useState(false)

  // Invite modal
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ name:'', email:'', password:'', role:'agent' })
  const [inviteErr, setInviteErr]   = useState('')
  const [inviting, setInviting]     = useState(false)

  // Edit modal
  const [editAgent, setEditAgent]   = useState(null)
  const [editForm, setEditForm]     = useState({ name:'', role:'agent', is_active:true, permissions:null, useCustomPerms:false })
  const [editErr, setEditErr]       = useState('')
  const [saving, setSaving]         = useState(false)

  // Reset password modal
  const [resetAgent, setResetAgent] = useState(null)
  const [newPwd, setNewPwd]         = useState('')
  const [resetErr, setResetErr]     = useState('')
  const [resetting, setResetting]   = useState(false)

  // Dropdown
  const [openMenu, setOpenMenu] = useState(null)
  const menuRef = useRef()

  // Manager permissions modal
  const [showManagerPerms, setShowManagerPerms] = useState(false)
  const [managerPerms, setManagerPerms]         = useState([])
  const [savingManagerPerms, setSavingManagerPerms] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [agentRes, roleRes] = await Promise.all([
        agentApi.get('/agents'),
        agentApi.get('/roles'),
      ])
      setAgents(agentRes.data || [])
      setRoles(roleRes.data || null)
      const mgr = roleRes.data?.roles?.find(r => r.role === 'manager')
      if (mgr) setManagerPerms(mgr.permissions || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const handler = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleInvite = async e => {
    e.preventDefault(); setInviteErr(''); setInviting(true)
    try {
      await agentApi.post('/agents', inviteForm)
      setShowInvite(false)
      setInviteForm({ name:'', email:'', password:'', role:'agent' })
      load()
    } catch(e) { setInviteErr(e.response?.data?.detail || 'Error creating agent') }
    setInviting(false)
  }

  const openEdit = a => {
    setEditAgent(a)
    setEditForm({
      name: a.name,
      role: a.role,
      is_active: a.is_active,
      permissions: a.custom_permissions || null,
      useCustomPerms: !!a.custom_permissions,
    })
    setEditErr('')
  }

  const handleEdit = async e => {
    e.preventDefault(); setEditErr(''); setSaving(true)
    try {
      const payload = { name: editForm.name, role: editForm.role, is_active: editForm.is_active }
      if (editForm.useCustomPerms) payload.permissions = editForm.permissions || []
      else payload.permissions = null
      await agentApi.patch(`/agents/${editAgent.id}`, payload)
      setEditAgent(null)
      load()
    } catch(e) { setEditErr(e.response?.data?.detail || 'Error updating agent') }
    setSaving(false)
  }

  const handleReset = async e => {
    e.preventDefault(); setResetErr(''); setResetting(true)
    try {
      await agentApi.post(`/agents/${resetAgent.id}/reset-password`, { new_password: newPwd })
      setResetAgent(null); setNewPwd('')
    } catch(e) { setResetErr(e.response?.data?.detail || 'Error resetting password') }
    setResetting(false)
  }

  const toggleActive = async (a) => {
    const url = a.is_active ? `/agents/${a.id}/deactivate` : `/agents/${a.id}/activate`
    try { await agentApi.post(url); load() } catch {}
  }

  const handleDelete = async (a) => {
    if (!window.confirm(`Remove agent ${a.name}? This cannot be undone.`)) return
    try { await agentApi.delete(`/agents/${a.id}`); load() } catch {}
  }

  const handleSaveManagerPerms = async () => {
    setSavingManagerPerms(true)
    try { await agentApi.patch('/roles/manager/permissions', { permissions: managerPerms }); load() } catch {}
    setSavingManagerPerms(false)
    setShowManagerPerms(false)
  }

  const copyTenantId = () => {
    navigator.clipboard.writeText(agent?.tenant_id || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const activeCount   = agents.filter(a => a.is_active).length
  const inactiveCount = agents.length - activeCount

  if (!isSuperAdmin()) {
    return (
      <div style={{ ...S.page, textAlign:'center', paddingTop:'80px' }}>
        <p style={{ fontSize:'32px', marginBottom:'12px', opacity:.3 }}>🔒</p>
        <p style={{ fontSize:'14px', color:'#8b949e' }}>Super Admin access required to manage team.</p>
      </div>
    )
  }

  return (
    <div style={S.page} ref={menuRef}>
      {/* Tenant ID card */}
      <div style={{ background:'rgba(56,139,253,.06)', border:'1px solid rgba(56,139,253,.2)', borderRadius:'10px', padding:'12px 16px', marginBottom:'20px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'12px' }}>
        <div>
          <span style={{ fontSize:'11px', color:'#8b949e', display:'block', marginBottom:'2px', textTransform:'uppercase', letterSpacing:'.05em' }}>Tenant ID — share with agents for login</span>
          <span style={{ fontSize:'13px', fontFamily:'monospace', color:'#e6edf3' }}>{agent?.tenant_id}</span>
        </div>
        <button onClick={copyTenantId}
          style={{ ...S.btn, background: copied ? '#238636' : '#21262d', color: copied ? '#fff' : '#c9d1d9', border:'1px solid #30363d', whiteSpace:'nowrap' }}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      {/* Header */}
      <div style={S.hdr}>
        <div>
          <h1 style={S.h1}>Team Management</h1>
          <p style={{ fontSize:'13px', color:'#8b949e', margin:'4px 0 0' }}>
            {agents.length} total · {activeCount} active · {inactiveCount} inactive
          </p>
        </div>
        <button onClick={() => setShowInvite(true)}
          style={{ ...S.btn, background:'#1f6feb', color:'#fff' }}>
          + Invite Agent
        </button>
      </div>

      {/* Agents table */}
      <div style={{ ...S.card, overflow:'hidden', marginBottom:'20px' }}>
        {loading ? (
          <div style={{ padding:'48px', textAlign:'center', color:'#8b949e', fontSize:'13px' }}>Loading…</div>
        ) : agents.length === 0 ? (
          <div style={{ padding:'48px', textAlign:'center', color:'#8b949e' }}>
            <p style={{ fontSize:'32px', opacity:.3, marginBottom:'10px' }}>👤</p>
            <p style={{ fontSize:'13px' }}>No agents yet. Invite one to get started.</p>
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['Agent','Email','Role','Status','Last Login','Actions'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {agents.map(a => (
                <tr key={a.id}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.02)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <td style={S.td}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'linear-gradient(135deg,#8957e5,#388bfd)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', color:'#fff', fontSize:'13px', flexShrink:0 }}>
                        {a.avatar_initials || a.name?.[0]?.toUpperCase() || 'A'}
                      </div>
                      <span style={{ fontWeight:'500' }}>{a.name}</span>
                    </div>
                  </td>
                  <td style={{ ...S.td, color:'#8b949e' }}>{a.email}</td>
                  <td style={S.td}><RoleBadge role={a.role} /></td>
                  <td style={S.td}>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                      <div style={{ width:'7px', height:'7px', borderRadius:'50%', background: a.is_active ? '#3fb950' : '#6e7681' }} />
                      <span style={{ fontSize:'12px', color: a.is_active ? '#3fb950' : '#8b949e' }}>
                        {a.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </td>
                  <td style={{ ...S.td, color:'#8b949e', fontSize:'12px' }}>
                    {a.last_login_at ? new Date(a.last_login_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : '—'}
                  </td>
                  <td style={S.td}>
                    <div style={{ position:'relative' }}>
                      <button
                        onClick={() => setOpenMenu(openMenu === a.id ? null : a.id)}
                        style={{ background:'#21262d', border:'1px solid #30363d', borderRadius:'8px', color:'#e6edf3', cursor:'pointer', padding:'5px 10px', fontSize:'16px', fontFamily:'inherit' }}>
                        ⋯
                      </button>
                      {openMenu === a.id && (
                        <div style={{ position:'absolute', right:0, top:'100%', zIndex:100, background:'#161b22', border:'1px solid #30363d', borderRadius:'10px', padding:'4px', boxShadow:'0 8px 32px rgba(0,0,0,.5)', minWidth:'160px', marginTop:'4px' }}>
                          {[
                            { label:'Edit Role & Permissions', action: () => { openEdit(a); setOpenMenu(null) } },
                            { label: a.is_active ? 'Deactivate' : 'Activate', action: () => { toggleActive(a); setOpenMenu(null) } },
                            { label:'Reset Password', action: () => { setResetAgent(a); setNewPwd(''); setResetErr(''); setOpenMenu(null) } },
                            { label:'Remove Agent', action: () => { handleDelete(a); setOpenMenu(null) }, danger: true },
                          ].map(item => (
                            <button key={item.label} onClick={item.action}
                              style={{ display:'block', width:'100%', background:'none', border:'none', color: item.danger ? '#f85149' : '#e6edf3', cursor:'pointer', padding:'8px 12px', fontSize:'13px', textAlign:'left', borderRadius:'7px', fontFamily:'inherit' }}
                              onMouseEnter={e => e.currentTarget.style.background = item.danger ? 'rgba(248,81,73,.08)' : 'rgba(255,255,255,.05)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                              {item.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Permissions matrix */}
      <div style={S.card}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom: matrixOpen ? '1px solid #21262d' : 'none', cursor:'pointer' }}
          onClick={() => setMatrixOpen(v => !v)}>
          <span style={{ fontSize:'14px', fontWeight:'600' }}>Permissions Matrix</span>
          <span style={{ color:'#8b949e', fontSize:'12px' }}>{matrixOpen ? '▲ Hide' : '▼ Show'}</span>
        </div>
        {matrixOpen && roles && (
          <div style={{ padding:'20px', overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, borderBottom:'none', width:'200px' }}>Permission</th>
                  {['agent','manager','superadmin'].map(r => (
                    <th key={r} style={{ ...S.th, borderBottom:'none', textAlign:'center' }}>
                      <RoleBadge role={r} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_PERMS.map(perm => {
                  const matrix = roles.matrix || {}
                  return (
                    <tr key={perm}>
                      <td style={{ padding:'8px 16px', fontSize:'13px', color:'#c9d1d9', fontWeight:'500' }}>{perm}</td>
                      {['agent','manager','superadmin'].map(r => {
                        const has = matrix[r]?.[perm]
                        return (
                          <td key={r} style={{ padding:'8px 16px', textAlign:'center' }}>
                            <span style={{ fontSize:'16px', color: has ? '#3fb950' : '#6e7681' }}>{has ? '✓' : '✗'}</span>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ marginTop:'16px', paddingTop:'16px', borderTop:'1px solid #21262d' }}>
              <button onClick={() => setShowManagerPerms(true)}
                style={{ ...S.btn, background:'rgba(56,139,253,.1)', color:'#388bfd', border:'1px solid rgba(56,139,253,.2)' }}>
                Customize Manager Permissions
              </button>
              <p style={{ fontSize:'11px', color:'#484f58', marginTop:'8px' }}>Super Admin permissions cannot be restricted.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Invite Modal ─────────────────────────────────────────────────────── */}
      {showInvite && (
        <div style={S.overlay} onClick={() => setShowInvite(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.mh}>
              <h2 style={{ fontSize:'16px', fontWeight:'600', margin:0 }}>Invite Agent</h2>
              <button onClick={() => setShowInvite(false)} style={S.mclose}>×</button>
            </div>
            <ErrBox msg={inviteErr} />
            <form onSubmit={handleInvite} style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              {[
                { k:'name',     l:'Full Name',  t:'text',     p:'Jane Smith'       },
                { k:'email',    l:'Email',       t:'email',    p:'jane@company.com' },
                { k:'password', l:'Password',    t:'password', p:'Min 8 characters' },
              ].map(f => (
                <div key={f.k}>
                  <label style={S.label}>{f.l}</label>
                  <input required type={f.t} value={inviteForm[f.k]}
                    onChange={e => setInviteForm(p => ({ ...p, [f.k]: e.target.value }))}
                    placeholder={f.p} style={S.input} onFocus={onFocus} onBlur={onBlur} />
                </div>
              ))}
              <div>
                <label style={S.label}>Role</label>
                <select value={inviteForm.role} onChange={e => setInviteForm(p => ({ ...p, role: e.target.value }))}
                  style={{ ...S.input, cursor:'pointer', appearance:'none' }}>
                  <option value="agent">Agent — Inbox and Contacts only</option>
                  <option value="manager">Manager — Inbox, Contacts, Broadcasts, Templates, Automations, Analytics</option>
                  <option value="superadmin">Super Admin — Full access including Settings and User Management</option>
                </select>
              </div>
              <div style={S.mfoot}>
                <button type="button" onClick={() => setShowInvite(false)}
                  style={{ ...S.btn, background:'#21262d', color:'#c9d1d9', border:'1px solid #30363d' }}>Cancel</button>
                <button type="submit" disabled={inviting}
                  style={{ ...S.btn, background: inviting ? '#21262d' : '#1f6feb', color: inviting ? '#8b949e' : '#fff', cursor: inviting ? 'not-allowed' : 'pointer' }}>
                  {inviting ? 'Inviting…' : 'Invite Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Modal ───────────────────────────────────────────────────────── */}
      {editAgent && (
        <div style={S.overlay} onClick={() => setEditAgent(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.mh}>
              <h2 style={{ fontSize:'16px', fontWeight:'600', margin:0 }}>Edit Agent</h2>
              <button onClick={() => setEditAgent(null)} style={S.mclose}>×</button>
            </div>
            <ErrBox msg={editErr} />
            <form onSubmit={handleEdit} style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <div>
                <label style={S.label}>Full Name</label>
                <input type="text" required value={editForm.name}
                  onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                  style={S.input} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label style={S.label}>Role</label>
                <select value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}
                  style={{ ...S.input, cursor:'pointer', appearance:'none' }}>
                  <option value="agent">Agent</option>
                  <option value="manager">Manager</option>
                  <option value="superadmin">Super Admin</option>
                </select>
              </div>
              <div>
                <label style={S.label}>Status</label>
                <select value={editForm.is_active ? 'active' : 'inactive'}
                  onChange={e => setEditForm(p => ({ ...p, is_active: e.target.value === 'active' }))}
                  style={{ ...S.input, cursor:'pointer', appearance:'none' }}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {editForm.role !== 'superadmin' && (
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
                    <input type="checkbox" id="useCustom" checked={editForm.useCustomPerms}
                      onChange={e => {
                        const use = e.target.checked
                        setEditForm(p => ({
                          ...p,
                          useCustomPerms: use,
                          permissions: use ? (p.permissions || []) : null,
                        }))
                      }} />
                    <label htmlFor="useCustom" style={{ fontSize:'12px', color:'#8b949e', cursor:'pointer' }}>
                      Use custom permissions (overrides role default)
                    </label>
                  </div>
                  {editForm.useCustomPerms && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', background:'#0d1117', border:'1px solid #21262d', borderRadius:'10px', padding:'12px' }}>
                      {ALL_PERMS.map(p => {
                        const checked = (editForm.permissions || []).includes(p)
                        return (
                          <label key={p} style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color: checked ? '#e6edf3' : '#8b949e', cursor:'pointer', padding:'4px 8px', borderRadius:'6px', background: checked ? 'rgba(56,139,253,.1)' : 'transparent', border: `1px solid ${checked ? 'rgba(56,139,253,.25)' : 'transparent'}`, transition:'all .15s' }}>
                            <input type="checkbox" checked={checked}
                              onChange={e => {
                                const cur = editForm.permissions || []
                                setEditForm(prev => ({
                                  ...prev,
                                  permissions: e.target.checked ? [...cur, p] : cur.filter(x => x !== p)
                                }))
                              }} />
                            {p}
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              <div style={S.mfoot}>
                <button type="button" onClick={() => setEditAgent(null)}
                  style={{ ...S.btn, background:'#21262d', color:'#c9d1d9', border:'1px solid #30363d' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  style={{ ...S.btn, background: saving ? '#21262d' : '#1f6feb', color: saving ? '#8b949e' : '#fff', cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ──────────────────────────────────────────────── */}
      {resetAgent && (
        <div style={S.overlay} onClick={() => setResetAgent(null)}>
          <div style={{ ...S.modal, maxWidth:'380px' }} onClick={e => e.stopPropagation()}>
            <div style={S.mh}>
              <h2 style={{ fontSize:'16px', fontWeight:'600', margin:0 }}>Reset Password</h2>
              <button onClick={() => setResetAgent(null)} style={S.mclose}>×</button>
            </div>
            <p style={{ fontSize:'13px', color:'#8b949e', marginBottom:'16px' }}>
              Reset password for <strong style={{ color:'#e6edf3' }}>{resetAgent.name}</strong>
            </p>
            <ErrBox msg={resetErr} />
            <form onSubmit={handleReset} style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <div>
                <label style={S.label}>New Password</label>
                <input type="password" required minLength={8} value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  placeholder="Min 8 characters"
                  style={S.input} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div style={S.mfoot}>
                <button type="button" onClick={() => setResetAgent(null)}
                  style={{ ...S.btn, background:'#21262d', color:'#c9d1d9', border:'1px solid #30363d' }}>Cancel</button>
                <button type="submit" disabled={resetting}
                  style={{ ...S.btn, background: resetting ? '#21262d' : '#f85149', color:'#fff', cursor: resetting ? 'not-allowed' : 'pointer' }}>
                  {resetting ? 'Resetting…' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Manager Permissions Modal ─────────────────────────────────────────── */}
      {showManagerPerms && (
        <div style={S.overlay} onClick={() => setShowManagerPerms(false)}>
          <div style={{ ...S.modal, maxWidth:'420px' }} onClick={e => e.stopPropagation()}>
            <div style={S.mh}>
              <h2 style={{ fontSize:'16px', fontWeight:'600', margin:0 }}>Manager Permissions</h2>
              <button onClick={() => setShowManagerPerms(false)} style={S.mclose}>×</button>
            </div>
            <p style={{ fontSize:'12px', color:'#8b949e', marginBottom:'16px' }}>
              Customize which features Managers can access. Super Admin permissions cannot be restricted.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'20px' }}>
              {ALL_PERMS.filter(p => p !== 'agents' && p !== 'settings').map(p => {
                const checked = managerPerms.includes(p)
                return (
                  <label key={p} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 14px', borderRadius:'8px', background: checked ? 'rgba(56,139,253,.06)' : '#0d1117', border: `1px solid ${checked ? 'rgba(56,139,253,.2)' : '#21262d'}`, cursor:'pointer', transition:'all .15s' }}>
                    <input type="checkbox" checked={checked}
                      onChange={e => {
                        setManagerPerms(prev => e.target.checked ? [...prev, p] : prev.filter(x => x !== p))
                      }} />
                    <span style={{ fontSize:'13px', color: checked ? '#e6edf3' : '#8b949e', fontWeight: checked ? '500' : '400' }}>{p}</span>
                  </label>
                )
              })}
            </div>
            <div style={S.mfoot}>
              <button onClick={() => setShowManagerPerms(false)}
                style={{ ...S.btn, background:'#21262d', color:'#c9d1d9', border:'1px solid #30363d' }}>Cancel</button>
              <button onClick={handleSaveManagerPerms} disabled={savingManagerPerms}
                style={{ ...S.btn, background: savingManagerPerms ? '#21262d' : '#1f6feb', color: savingManagerPerms ? '#8b949e' : '#fff', cursor: savingManagerPerms ? 'not-allowed' : 'pointer' }}>
                {savingManagerPerms ? 'Saving…' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
