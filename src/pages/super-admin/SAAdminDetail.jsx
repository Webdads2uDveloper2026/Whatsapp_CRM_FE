import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import superAdminApi from '../../services/superAdminApi'

const S = {
  page:  { minHeight: '100vh', background: '#0f1117', color: '#e6edf3',
           fontFamily: "'Inter', system-ui, sans-serif", padding: '32px 40px' },
  back:  { background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer',
           fontSize: 14, display: 'flex', alignItems: 'center', gap: 6,
           marginBottom: 28, padding: 0 },
  card:  { background: '#161b22', border: '1px solid #21262d', borderRadius: 14,
           padding: 24, marginBottom: 20 },
  label: { fontSize: 11, color: '#8b949e', textTransform: 'uppercase',
           letterSpacing: '0.5px', marginBottom: 4 },
  val:   { fontSize: 14, color: '#e6edf3' },
  btn:   { padding: '8px 18px', borderRadius: 8, border: 'none',
           cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  th:    { padding: '10px 16px', fontSize: 11, color: '#8b949e',
           textAlign: 'left', textTransform: 'uppercase', letterSpacing: '0.4px',
           borderBottom: '1px solid #21262d' },
  td:    { padding: '13px 16px', fontSize: 13, color: '#e6edf3',
           borderBottom: '1px solid #1c2128' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 },
  row:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center',
           padding: '8px 0', borderBottom: '1px solid #1c2128' },
}

function Badge({ children, color }) {
  const map = {
    green:  { bg: 'rgba(63,185,80,.12)',   color: '#3fb950', border: 'rgba(63,185,80,.25)'  },
    red:    { bg: 'rgba(248,81,73,.12)',    color: '#f85149', border: 'rgba(248,81,73,.25)'  },
    yellow: { bg: 'rgba(210,153,34,.12)',   color: '#d29922', border: 'rgba(210,153,34,.25)' },
    blue:   { bg: 'rgba(56,139,253,.12)',   color: '#388bfd', border: 'rgba(56,139,253,.25)' },
    gray:   { bg: 'rgba(139,148,158,.12)',  color: '#8b949e', border: 'rgba(139,148,158,.25)'},
  }
  const c = map[color] || map.gray
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                   fontSize: 12, fontWeight: 600, background: c.bg, color: c.color,
                   border: `1px solid ${c.border}` }}>
      {children}
    </span>
  )
}

const STATUS_COLOR = { active: 'green', suspended: 'red', trial: 'yellow', pending: 'yellow', pending_waba: 'gray' }
const ROLE_COLOR   = { superadmin: 'red', manager: 'blue', agent: 'gray' }
const ROLE_LABEL   = { superadmin: 'Super Admin', manager: 'Manager', agent: 'Agent' }

export default function SAAdminDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [plans, setPlans]         = useState([])
  const [notes, setNotes]         = useState('')
  const [saving, setSaving]       = useState(false)
  const [savedOk, setSavedOk]     = useState(false)
  const [showPlan, setShowPlan]   = useState(false)
  const [selPlan, setSelPlan]     = useState('')
  const [assigning, setAssigning] = useState(false)
  const [toggling, setToggling]   = useState(false)

  useEffect(() => { load(); loadPlans() }, [id])

  async function load() {
    setLoading(true)
    try {
      const res = await superAdminApi.get(`/super-admin/tenants/${id}`)
      setData(res.data)
      setNotes(res.data.notes || '')
    } catch { navigate('/super-admin/admins') }
    finally { setLoading(false) }
  }

  async function loadPlans() {
    try {
      const res = await superAdminApi.get('/super-admin/plans')
      setPlans((res.data.plans || []).filter(p => p.is_active))
    } catch {}
  }

  async function saveNotes() {
    setSaving(true)
    try {
      await superAdminApi.patch(`/super-admin/tenants/${id}`, { notes })
      setSavedOk(true); setTimeout(() => setSavedOk(false), 2000)
    } catch {}
    finally { setSaving(false) }
  }

  async function toggleStatus() {
    if (toggling) return
    setToggling(true)
    const action = data.status === 'active' ? 'suspend' : 'activate'
    try {
      await superAdminApi.post(`/super-admin/tenants/${id}/${action}`)
      setData(d => ({ ...d, status: action === 'suspend' ? 'suspended' : 'active' }))
    } catch {}
    finally { setToggling(false) }
  }

  async function assignPlan() {
    if (!selPlan || assigning) return
    setAssigning(true)
    try {
      await superAdminApi.post(`/super-admin/tenants/${id}/assign-plan`, { plan_id: selPlan })
      setShowPlan(false); setSelPlan(''); load()
    } catch {}
    finally { setAssigning(false) }
  }

  if (loading) return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#8b949e' }}>Loading...</span>
    </div>
  )
  if (!data) return null

  const isActive = data.status === 'active'
  const agents   = data.agents || []

  return (
    <div style={S.page}>

      {/* Back + Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <button style={S.back} onClick={() => navigate('/super-admin/admins')}>
          ← Back to Admins
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            style={{ ...S.btn,
                     background: isActive ? 'rgba(248,81,73,.1)' : 'rgba(63,185,80,.1)',
                     color:      isActive ? '#f85149' : '#3fb950',
                     border:    `1px solid ${isActive ? 'rgba(248,81,73,.25)' : 'rgba(63,185,80,.25)'}`,
                     opacity: toggling ? 0.6 : 1 }}
            onClick={toggleStatus} disabled={toggling}>
            {toggling ? '...' : isActive ? 'Suspend Admin' : 'Activate Admin'}
          </button>
          <button
            style={{ ...S.btn, background: '#388bfd', color: '#fff' }}
            onClick={() => setShowPlan(true)}>
            Assign Plan
          </button>
        </div>
      </div>

      {/* Business Info */}
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>{data.business_name}</div>
            <div style={{ color: '#8b949e', fontSize: 14 }}>{data.email}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge color={STATUS_COLOR[data.status] || 'gray'}>
              {data.status?.replace('_', ' ').toUpperCase()}
            </Badge>
            {data.waba_connected && <Badge color="green">WhatsApp ✓</Badge>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20, marginBottom: 20 }}>
          {[
            ['Tenant ID',  data.id,          true],
            ['Phone',      data.phone_number || '—', false],
            ['WABA ID',    data.waba_id || '—',      true],
            ['Joined',     new Date(data.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }), false],
          ].map(([label, val, mono]) => (
            <div key={label}>
              <div style={S.label}>{label}</div>
              <div style={{ ...S.val, fontFamily: mono ? 'monospace' : 'inherit',
                            fontSize: mono ? 12 : 14, wordBreak: 'break-all' }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Notes */}
        <div>
          <div style={{ ...S.label, marginBottom: 8 }}>Internal Notes (visible only to super admins)</div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add private notes about this admin..."
            style={{ width: '100%', background: '#0d1117', border: '1px solid #21262d',
                     borderRadius: 8, padding: '10px 12px', color: '#e6edf3', fontSize: 13,
                     resize: 'vertical', minHeight: 80, boxSizing: 'border-box',
                     outline: 'none', fontFamily: 'inherit' }}
          />
          <button
            style={{ ...S.btn, background: savedOk ? '#238636' : '#21262d',
                     color: savedOk ? '#fff' : '#e6edf3', marginTop: 8, opacity: saving ? 0.6 : 1 }}
            onClick={saveNotes} disabled={saving}>
            {saving ? 'Saving...' : savedOk ? '✓ Saved' : 'Save Notes'}
          </button>
        </div>
      </div>

      {/* 2-col grid */}
      <div style={S.grid2}>

        {/* Subscription */}
        <div style={S.card}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Subscription & Limits</div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={S.label}>Plan</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{data.plan_name || 'Trial'}</div>
            </div>
            <Badge color={data.subscription_status === 'active' ? 'green' : 'yellow'}>
              {(data.subscription_status || 'trial').toUpperCase()}
            </Badge>
          </div>

          {data.subscription_start && (
            <div style={{ marginBottom: 14 }}>
              <div style={S.label}>Active Since</div>
              <div style={S.val}>
                {new Date(data.subscription_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
          )}

          <div style={{ borderTop: '1px solid #21262d', paddingTop: 14 }}>
            {[
              ['👥 Agents',     `${data.agent_count ?? agents.length} / ${data.agent_limit || 1}`],
              ['📢 Broadcasts', `— / ${(data.broadcast_limit || 0).toLocaleString()}/mo`],
              ['📋 Templates',  `— / ${data.template_limit || 5}`],
              ['👤 Contacts',   `— / ${(data.contact_limit || 0).toLocaleString()}`],
            ].map(([label, val]) => (
              <div key={label} style={S.row}>
                <span style={{ color: '#8b949e', fontSize: 13 }}>{label}</span>
                <span style={{ fontSize: 13 }}>{val}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
              <span style={{ fontSize: 12, color: data.flow_builder ? '#3fb950' : '#6e7681' }}>
                {data.flow_builder ? '✅' : '❌'} Flow Builder
              </span>
              <span style={{ fontSize: 12, color: data.analytics_access ? '#3fb950' : '#6e7681' }}>
                {data.analytics_access ? '✅' : '❌'} Analytics
              </span>
            </div>
          </div>
        </div>

        {/* WhatsApp */}
        <div style={S.card}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>WhatsApp Connection</div>
          {data.waba_connected ? (
            <>
              <div style={{ color: '#3fb950', fontSize: 15, fontWeight: 600, marginBottom: 16 }}>● Connected</div>
              {[
                ['Phone Number', data.phone_number || '—', false],
                ['WABA ID',      data.waba_id || '—',      true],
              ].map(([label, val, mono]) => (
                <div key={label} style={{ marginBottom: 12 }}>
                  <div style={S.label}>{label}</div>
                  <div style={{ ...S.val, fontFamily: mono ? 'monospace' : 'inherit',
                                fontSize: mono ? 12 : 14, color: mono ? '#8b949e' : '#e6edf3' }}>{val}</div>
                </div>
              ))}
            </>
          ) : (
            <div>
              <div style={{ color: '#8b949e', fontSize: 15, marginBottom: 12 }}>● Not connected</div>
              <div style={{ fontSize: 12, color: '#6e7681', lineHeight: 1.5 }}>
                Admin needs to complete WhatsApp onboarding from their dashboard.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Agents Table */}
      <div style={S.card}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
          Team Members ({agents.length})
        </div>
        {agents.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name', 'Email', 'Role', 'Status', 'Last Login'].map(h => (
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                   background: 'linear-gradient(135deg,#388bfd,#8957e5)',
                                   display: 'flex', alignItems: 'center', justifyContent: 'center',
                                   fontSize: 13, fontWeight: 700 }}>
                        {(a.name || 'A')[0].toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 500 }}>{a.name}</span>
                    </div>
                  </td>
                  <td style={{ ...S.td, color: '#8b949e' }}>{a.email}</td>
                  <td style={S.td}>
                    <Badge color={ROLE_COLOR[a.role] || 'gray'}>
                      {ROLE_LABEL[a.role] || a.role}
                    </Badge>
                  </td>
                  <td style={S.td}>
                    <span style={{ color: a.is_active ? '#3fb950' : '#8b949e', fontSize: 13 }}>
                      {a.is_active ? '● Active' : '● Inactive'}
                    </span>
                  </td>
                  <td style={{ ...S.td, color: '#8b949e' }}>
                    {a.last_login_at
                      ? new Date(a.last_login_at).toLocaleDateString('en-IN')
                      : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#8b949e', fontSize: 14 }}>
            No team members yet
          </div>
        )}
      </div>

      {/* Assign Plan Modal */}
      {showPlan && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#161b22', border: '1px solid #21262d',
                        borderRadius: 16, padding: 28, width: 460, maxWidth: '90vw' }}>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 20 }}>Assign Subscription Plan</div>

            <div style={{ marginBottom: 6, fontSize: 13, color: '#8b949e' }}>Select Plan</div>
            <select
              value={selPlan}
              onChange={e => setSelPlan(e.target.value)}
              style={{ width: '100%', background: '#0d1117', border: '1px solid #30363d',
                       borderRadius: 10, padding: '10px 12px', color: '#e6edf3',
                       fontSize: 14, outline: 'none', marginBottom: 16 }}>
              <option value="">Choose a plan...</option>
              {plans.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} — ₹{p.price_monthly.toLocaleString()}/mo
                  ({p.agent_limit} agents, {(p.broadcast_limit || 0).toLocaleString()} broadcasts/mo)
                </option>
              ))}
            </select>

            {selPlan && (() => {
              const p = plans.find(x => x.id === selPlan)
              return p ? (
                <div style={{ background: '#0d1117', border: '1px solid #21262d',
                              borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, color: '#8b949e' }}>
                    <span>👥 {p.agent_limit} Agents</span>
                    <span>📢 {(p.broadcast_limit || 0).toLocaleString()} Broadcasts/mo</span>
                    <span>📋 {p.template_limit} Templates</span>
                    <span>👤 {(p.contact_limit || 0).toLocaleString()} Contacts</span>
                    <span>{p.flow_builder ? '✅' : '❌'} Flow Builder</span>
                    <span>{p.analytics ? '✅' : '❌'} Analytics</span>
                  </div>
                  {/* Connector / API fields */}
                  <div style={{ borderTop: '1px solid #21262d', marginTop: 10, paddingTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <span style={{ color: p.api_access ? '#3fb950' : '#6e7681' }}>
                      {p.api_access ? '✅' : '❌'} API Access
                    </span>
                    <span style={{ color: p.webhooks_enabled ? '#3fb950' : '#6e7681' }}>
                      {p.webhooks_enabled ? '✅' : '❌'} Webhooks
                    </span>
                    <span style={{ color: '#8b949e' }}>
                      🔁 {p.api_calls_per_month === -1 ? 'Unlimited' : p.api_calls_per_month === 0 ? 'No' : (p.api_calls_per_month || 0).toLocaleString()} API calls/mo
                    </span>
                    <span style={{ color: p.integrations_enabled ? '#3fb950' : '#6e7681' }}>
                      {p.integrations_enabled ? '✅' : '❌'} Integrations
                    </span>
                  </div>
                  {!p.api_access && (
                    <div style={{ marginTop: 8, color: '#e3b341', fontSize: 11 }}>
                      ⚠ This plan has no API access — tenant won't be able to use the Connector.
                    </div>
                  )}
                </div>
              ) : null
            })()}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                style={{ ...S.btn, background: '#21262d', color: '#e6edf3' }}
                onClick={() => { setShowPlan(false); setSelPlan('') }}>
                Cancel
              </button>
              <button
                style={{ ...S.btn, background: '#388bfd', color: '#fff',
                         opacity: selPlan && !assigning ? 1 : 0.5 }}
                onClick={assignPlan} disabled={!selPlan || assigning}>
                {assigning ? 'Assigning...' : 'Assign Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
