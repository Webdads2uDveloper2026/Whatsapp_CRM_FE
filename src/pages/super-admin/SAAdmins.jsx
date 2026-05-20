import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import superAdminApi from '../../services/superAdminApi'

const S = {
  page:    { padding:'28px 32px', maxWidth:'1200px', fontFamily:"'Inter',system-ui,sans-serif", color:'#e6edf3' },
  hdr:     { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'12px' },
  h1:      { fontSize:'20px', fontWeight:'700', color:'#e6edf3', margin:0 },
  card:    { background:'#161b22', border:'1px solid #21262d', borderRadius:'14px' },
  btn:     { display:'inline-flex', alignItems:'center', gap:'6px', padding:'8px 16px', borderRadius:'10px', fontSize:'13px', fontWeight:'600', border:'none', cursor:'pointer', fontFamily:'inherit', transition:'all .15s' },
  input:   { width:'100%', background:'#1c2128', border:'1px solid #30363d', borderRadius:'10px', padding:'10px 14px', fontSize:'13px', color:'#e6edf3', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  label:   { display:'block', fontSize:'12px', fontWeight:'500', color:'#8b949e', marginBottom:'6px' },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'20px', backdropFilter:'blur(3px)' },
  modal:   { background:'#161b22', border:'1px solid #30363d', borderRadius:'16px', width:'100%', maxWidth:'480px', padding:'28px', boxShadow:'0 24px 64px rgba(0,0,0,.6)', maxHeight:'90vh', overflowY:'auto' },
  mh:      { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' },
  mclose:  { background:'none', border:'none', color:'#8b949e', fontSize:'22px', cursor:'pointer', lineHeight:1 },
  mfoot:   { display:'flex', justifyContent:'flex-end', gap:'10px', paddingTop:'16px', borderTop:'1px solid #21262d', marginTop:'20px' },
  th:      { padding:'10px 16px', fontSize:'11px', fontWeight:'600', color:'#7d8590', textAlign:'left', textTransform:'uppercase', letterSpacing:'.05em', borderBottom:'1px solid #21262d' },
  td:      { padding:'12px 16px', fontSize:'13px', color:'#e6edf3', borderBottom:'1px solid #21262d', verticalAlign:'middle' },
}

const STATUS_STYLE = {
  active:       { bg:'rgba(63,185,80,.1)',   color:'#3fb950', border:'rgba(63,185,80,.2)'   },
  trial:        { bg:'rgba(210,153,34,.1)',  color:'#d29922', border:'rgba(210,153,34,.2)'  },
  suspended:    { bg:'rgba(248,81,73,.1)',   color:'#f85149', border:'rgba(248,81,73,.2)'   },
  pending_waba: { bg:'rgba(139,148,158,.1)', color:'#8b949e', border:'rgba(139,148,158,.2)' },
  pending:      { bg:'rgba(139,148,158,.1)', color:'#8b949e', border:'rgba(139,148,158,.2)' },
}

const PLAN_STYLE = {
  Trial:      { bg:'rgba(139,148,158,.1)', color:'#8b949e', border:'rgba(139,148,158,.2)' },
  Starter:    { bg:'rgba(56,139,253,.1)',  color:'#388bfd', border:'rgba(56,139,253,.2)'  },
  Growth:     { bg:'rgba(137,87,229,.1)',  color:'#8957e5', border:'rgba(137,87,229,.2)'  },
  Pro:        { bg:'rgba(210,153,34,.1)',  color:'#d29922', border:'rgba(210,153,34,.2)'  },
  Enterprise: { bg:'rgba(248,81,73,.1)',   color:'#f85149', border:'rgba(248,81,73,.2)'   },
}

function StatusBadge({ status }) {
  const cfg = STATUS_STYLE[status] || STATUS_STYLE.pending
  return <span style={{ fontSize:'11px', fontWeight:'600', padding:'3px 9px', borderRadius:'99px', background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}`, textTransform:'capitalize' }}>{status?.replace('_',' ')}</span>
}

function PlanBadge({ name }) {
  const cfg = PLAN_STYLE[name] || PLAN_STYLE.Trial
  return <span style={{ fontSize:'11px', fontWeight:'600', padding:'3px 9px', borderRadius:'99px', background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}` }}>{name || 'Trial'}</span>
}

const onFocus = e => { e.target.style.borderColor = '#f85149' }
const onBlur  = e => { e.target.style.borderColor = '#30363d' }

function ErrBox({ msg }) {
  if (!msg) return null
  return <div style={{ background:'rgba(248,81,73,.1)', border:'1px solid rgba(248,81,73,.3)', borderRadius:'8px', padding:'10px 14px', fontSize:'12px', color:'#f85149', marginBottom:'14px' }}>{msg}</div>
}

function LimitRow({ label, value }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid #21262d' }}>
      <span style={{ fontSize:'12px', color:'#8b949e' }}>{label}</span>
      <span style={{ fontSize:'12px', fontWeight:'600', color:'#e6edf3' }}>{value}</span>
    </div>
  )
}

export default function SAAdmins() {
  const navigate = useNavigate()
  const [tenants, setTenants]     = useState([])
  const [plans, setPlans]         = useState([])
  const [filtered, setFiltered]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [openMenu, setOpenMenu]   = useState(null)
  const menuRef = useRef()

  // Create modal
  const [showCreate, setShowCreate]   = useState(false)
  const [createForm, setCreateForm]   = useState({ business_name:'', email:'', password:'', plan_id:'', notes:'' })
  const [createErr, setCreateErr]     = useState('')
  const [creating, setCreating]       = useState(false)

  // Assign plan modal
  const [assignTenant, setAssignTenant] = useState(null)
  const [assignPlanId, setAssignPlanId] = useState('')
  const [assigning, setAssigning]       = useState(false)
  const [assignErr, setAssignErr]       = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [tr, pr] = await Promise.all([
        superAdminApi.get('/super-admin/tenants'),
        superAdminApi.get('/super-admin/plans'),
      ])
      setTenants(tr.data?.tenants || [])
      setPlans(pr.data?.plans || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    let list = [...tenants]
    if (statusFilter !== 'all') list = list.filter(t => t.status === statusFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(t => t.business_name?.toLowerCase().includes(q) || t.email?.toLowerCase().includes(q))
    }
    setFiltered(list)
  }, [tenants, search, statusFilter])

  useEffect(() => {
    const handler = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleCreate = async e => {
    e.preventDefault(); setCreateErr(''); setCreating(true)
    try {
      const payload = { ...createForm }
      if (!payload.plan_id) delete payload.plan_id
      if (!payload.notes) delete payload.notes
      await superAdminApi.post('/super-admin/tenants', payload)
      setShowCreate(false)
      setCreateForm({ business_name:'', email:'', password:'', plan_id:'', notes:'' })
      load()
    } catch(e) { setCreateErr(e.response?.data?.detail || 'Error creating admin') }
    setCreating(false)
  }

  const handleSuspend = async t => {
    try { await superAdminApi.post(`/super-admin/tenants/${t.id}/suspend`); load() } catch {}
    setOpenMenu(null)
  }

  const handleActivate = async t => {
    try { await superAdminApi.post(`/super-admin/tenants/${t.id}/activate`); load() } catch {}
    setOpenMenu(null)
  }

  const handleAssign = async () => {
    if (!assignPlanId || !assignTenant) return
    setAssigning(true); setAssignErr('')
    try {
      await superAdminApi.post(`/super-admin/tenants/${assignTenant.id}/assign-plan`, { plan_id: assignPlanId })
      load()
      setAssignTenant(null)
    } catch(e) { setAssignErr(e.response?.data?.detail || 'Error assigning plan') }
    setAssigning(false)
  }

  const selectedPlan = plans.find(p => p.id === assignPlanId)

  return (
    <div style={S.page} ref={menuRef}>
      {/* Header */}
      <div style={S.hdr}>
        <div>
          <h1 style={S.h1}>Admins</h1>
          <p style={{ fontSize:'13px', color:'#8b949e', margin:'4px 0 0' }}>{filtered.length} of {tenants.length} accounts</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          style={{ ...S.btn, background:'#f85149', color:'#fff' }}>
          + Create Admin
        </button>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:'10px', marginBottom:'16px', flexWrap:'wrap' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          style={{ ...S.input, maxWidth:'280px' }}
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ ...S.input, maxWidth:'160px', appearance:'none', cursor:'pointer' }}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="suspended">Suspended</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ ...S.card, overflow:'hidden' }}>
        {loading ? (
          <div style={{ padding:'48px', textAlign:'center', color:'#8b949e', fontSize:'13px' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:'48px', textAlign:'center', color:'#8b949e' }}>
            <p style={{ fontSize:'32px', opacity:.3, marginBottom:'10px' }}>🏢</p>
            <p style={{ fontSize:'13px' }}>No admins found.</p>
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['Business Name','Email','Plan','Status','WhatsApp','Agents','Joined','Actions'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.02)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <td style={S.td}>
                    <button onClick={() => navigate(`/super-admin/admins/${t.id}`)}
                      style={{ background:'none', border:'none', color:'#388bfd', cursor:'pointer', fontFamily:'inherit', fontSize:'13px', fontWeight:'600', padding:0, textAlign:'left' }}>
                      {t.business_name}
                    </button>
                  </td>
                  <td style={{ ...S.td, color:'#8b949e', fontSize:'12px' }}>{t.email}</td>
                  <td style={S.td}><PlanBadge name={t.plan_name} /></td>
                  <td style={S.td}><StatusBadge status={t.status} /></td>
                  <td style={S.td}>
                    <span style={{ fontSize:'12px', color: t.waba_connected ? '#3fb950' : '#6e7681', fontWeight:'500' }}>
                      {t.waba_connected ? '✓' : '✗'}
                    </span>
                  </td>
                  <td style={{ ...S.td, color:'#8b949e', fontSize:'12px' }}>
                    {typeof t.agent_count === 'number'
                      ? `${t.agent_count} / ${t.agent_limit || 1}`
                      : `0 / ${t.agent_limit || 1}`}
                  </td>
                  <td style={{ ...S.td, color:'#8b949e', fontSize:'12px' }}>
                    {t.created_at ? new Date(t.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : '—'}
                  </td>
                  <td style={S.td}>
                    <div style={{ position:'relative' }}>
                      <button
                        onClick={() => setOpenMenu(openMenu === t.id ? null : t.id)}
                        style={{ background:'#21262d', border:'1px solid #30363d', borderRadius:'8px', color:'#e6edf3', cursor:'pointer', padding:'5px 10px', fontSize:'16px', fontFamily:'inherit' }}>
                        ⋯
                      </button>
                      {openMenu === t.id && (
                        <div style={{ position:'absolute', right:0, top:'100%', zIndex:100, background:'#161b22', border:'1px solid #30363d', borderRadius:'10px', padding:'4px', boxShadow:'0 8px 32px rgba(0,0,0,.5)', minWidth:'160px', marginTop:'4px' }}>
                          {[
                            { label:'View Details',  action: () => { navigate(`/super-admin/admins/${t.id}`); setOpenMenu(null) } },
                            { label:'Assign Plan',   action: () => { setAssignTenant(t); setAssignPlanId(t.plan_id || ''); setAssignErr(''); setOpenMenu(null) } },
                            { label: t.status === 'suspended' ? 'Activate' : 'Suspend',
                              action: () => t.status === 'suspended' ? handleActivate(t) : handleSuspend(t),
                              danger: t.status !== 'suspended' },
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

      {/* ── Create Admin Modal ─────────────────────────────────────────────── */}
      {showCreate && (
        <div style={S.overlay} onClick={() => setShowCreate(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.mh}>
              <h2 style={{ fontSize:'16px', fontWeight:'600', margin:0 }}>Create Admin Account</h2>
              <button onClick={() => setShowCreate(false)} style={S.mclose}>×</button>
            </div>
            <ErrBox msg={createErr} />
            <form onSubmit={handleCreate} style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              {[
                { k:'business_name', l:'Business Name', t:'text',     p:'Acme Corp'        },
                { k:'email',         l:'Email',          t:'email',    p:'admin@company.com' },
                { k:'password',      l:'Password',       t:'password', p:'Min 8 characters'  },
              ].map(f => (
                <div key={f.k}>
                  <label style={S.label}>{f.l}</label>
                  <input required type={f.t} value={createForm[f.k]}
                    onChange={e => setCreateForm(p => ({ ...p, [f.k]: e.target.value }))}
                    placeholder={f.p} style={S.input} onFocus={onFocus} onBlur={onBlur} />
                </div>
              ))}
              <div>
                <label style={S.label}>Assign Plan (optional)</label>
                <select value={createForm.plan_id} onChange={e => setCreateForm(p => ({ ...p, plan_id: e.target.value }))}
                  style={{ ...S.input, cursor:'pointer', appearance:'none' }}>
                  <option value="">No plan (Trial)</option>
                  {plans.filter(p => p.is_active).map(p => (
                    <option key={p.id} value={p.id}>{p.name} — ₹{p.price_monthly}/mo</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={S.label}>Internal Notes (optional)</label>
                <textarea value={createForm.notes}
                  onChange={e => setCreateForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Notes visible only to super admins…"
                  rows={3}
                  style={{ ...S.input, resize:'vertical', lineHeight:'1.5' }} />
              </div>
              <div style={S.mfoot}>
                <button type="button" onClick={() => setShowCreate(false)}
                  style={{ ...S.btn, background:'#21262d', color:'#c9d1d9', border:'1px solid #30363d' }}>Cancel</button>
                <button type="submit" disabled={creating}
                  style={{ ...S.btn, background: creating ? '#21262d' : '#f85149', color: creating ? '#8b949e' : '#fff', cursor: creating ? 'not-allowed' : 'pointer' }}>
                  {creating ? 'Creating…' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Assign Plan Modal ──────────────────────────────────────────────── */}
      {assignTenant && (
        <div style={S.overlay} onClick={() => setAssignTenant(null)}>
          <div style={{ ...S.modal, maxWidth:'420px' }} onClick={e => e.stopPropagation()}>
            <div style={S.mh}>
              <h2 style={{ fontSize:'16px', fontWeight:'600', margin:0 }}>Assign Plan</h2>
              <button onClick={() => setAssignTenant(null)} style={S.mclose}>×</button>
            </div>
            <p style={{ fontSize:'13px', color:'#8b949e', marginBottom:'16px' }}>
              Assign a subscription plan to <strong style={{ color:'#e6edf3' }}>{assignTenant.business_name}</strong>
            </p>
            <ErrBox msg={assignErr} />
            <div style={{ marginBottom:'16px' }}>
              <label style={S.label}>Select Plan</label>
              <select value={assignPlanId} onChange={e => setAssignPlanId(e.target.value)}
                style={{ ...S.input, cursor:'pointer', appearance:'none' }}>
                <option value="">Choose a plan…</option>
                {plans.filter(p => p.is_active).map(p => (
                  <option key={p.id} value={p.id}>{p.name} — ₹{p.price_monthly}/mo</option>
                ))}
              </select>
            </div>

            {/* Plan preview */}
            {selectedPlan && (
              <div style={{ background:'#0d1117', border:'1px solid #21262d', borderRadius:'10px', padding:'14px', marginBottom:'16px' }}>
                <p style={{ fontSize:'12px', fontWeight:'600', color:'#8b949e', margin:'0 0 10px', textTransform:'uppercase', letterSpacing:'.05em' }}>Plan Details</p>
                <LimitRow label="Agents"     value={selectedPlan.agent_limit} />
                <LimitRow label="Broadcasts" value={selectedPlan.broadcast_limit?.toLocaleString() + '/mo'} />
                <LimitRow label="Contacts"   value={selectedPlan.contact_limit?.toLocaleString()} />
                <LimitRow label="Templates"  value={selectedPlan.template_limit} />
                <LimitRow label="Flow Builder" value={selectedPlan.flow_builder ? '✓ Yes' : '✗ No'} />
                <LimitRow label="Analytics"  value={selectedPlan.analytics ? '✓ Yes' : '✗ No'} />
              </div>
            )}

            <div style={S.mfoot}>
              <button onClick={() => setAssignTenant(null)}
                style={{ ...S.btn, background:'#21262d', color:'#c9d1d9', border:'1px solid #30363d' }}>Cancel</button>
              <button onClick={handleAssign} disabled={assigning || !assignPlanId}
                style={{ ...S.btn, background: (assigning || !assignPlanId) ? '#21262d' : '#f85149', color: (assigning || !assignPlanId) ? '#8b949e' : '#fff', cursor: (assigning || !assignPlanId) ? 'not-allowed' : 'pointer' }}>
                {assigning ? 'Assigning…' : 'Assign Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
