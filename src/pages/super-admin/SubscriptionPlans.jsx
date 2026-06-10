import { useEffect, useState } from 'react'
import superAdminApi from '../../services/superAdminApi'

const C = {
  bg: '#0f1117', card: '#161b22', border: '#21262d',
  text: '#e6edf3', muted: '#8b949e', dim: '#6e7681',
  blue: '#388bfd', red: '#f85149', green: '#3fb950',
  purple: '#8957e5', gold: '#e3b341',
}

const PLAN_COLOR = {
  Starter:  C.muted,
  Growth:   C.blue,
  Pro:      C.purple,
  Business: C.gold,
  Trial:    C.dim,
}

const S = {
  page:    { padding: '28px 32px', fontFamily: "'Inter',system-ui,sans-serif", color: C.text, background: C.bg, minHeight: '100vh' },
  hdr:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' },
  h1:      { fontSize: '20px', fontWeight: '700', margin: 0 },
  card:    { background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden' },
  th:      { padding: '10px 16px', fontSize: '11px', fontWeight: '600', color: C.dim, textTransform: 'uppercase', letterSpacing: '.05em', background: '#0d1117', borderBottom: `1px solid ${C.border}`, textAlign: 'left', whiteSpace: 'nowrap' },
  td:      { padding: '12px 16px', fontSize: '13px', borderBottom: `1px solid ${C.border}`, verticalAlign: 'middle' },
  btn:     { background: C.blue, color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
  btnSm:   (variant='ghost') => ({ background: 'transparent', color: variant === 'danger' ? C.red : C.blue, border: `1px solid ${variant === 'danger' ? 'rgba(248,81,73,.3)' : 'rgba(56,139,253,.3)'}`, borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: '500' }),
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px', backdropFilter: 'blur(4px)' },
  modal:   { background: C.card, border: `1px solid #30363d`, borderRadius: '16px', width: '100%', maxWidth: '560px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' },
  label:   { display: 'block', fontSize: '12px', fontWeight: '500', color: C.muted, marginBottom: '5px' },
  input:   { width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', color: C.text, padding: '8px 12px', fontSize: '13px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  grid:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' },
  row:     { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
  toast:   (ok) => ({ position: 'fixed', top: '20px', right: '20px', padding: '12px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '500', zIndex: 9999, background: ok ? '#1a2e1a' : '#2e1a1a', color: ok ? C.green : C.red, border: `1px solid ${ok ? C.green : C.red}` }),
}

const EMPTY = {
  name: '', description: '', price_monthly: 0, price_yearly: 0,
  agent_limit: 3, broadcast_limit: 1000, template_limit: 10, contact_limit: 1000,
  api_calls_per_month: 0, api_access: false, webhooks_enabled: false,
  integrations_enabled: false, flow_builder: false, analytics: false,
  automations: true, sort_order: 0,
}

function Toggle({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}>
      <span style={{ fontSize: '13px', color: '#c9d1d9' }}>{label}</span>
      <div onClick={onChange} style={{ width: '36px', height: '20px', borderRadius: '10px', background: checked ? C.blue : '#30363d', position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: '3px', left: checked ? '19px' : '3px', width: '14px', height: '14px', borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
      </div>
    </label>
  )
}

function PlanBadge({ name }) {
  const color = PLAN_COLOR[name] || C.muted
  return (
    <span style={{ color, fontWeight: '600', fontSize: '12px' }}>{name}</span>
  )
}

export default function SubscriptionPlans() {
  const [plans, setPlans]     = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(null)   // null | 'create' | plan object
  const [form, setForm]       = useState(EMPTY)
  const [saving, setSaving]   = useState(false)
  const [toast, setToast]     = useState(null)
  const [usage, setUsage]     = useState(null)
  const [usageOpen, setUO]    = useState(false)

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t) }
  }, [toast])

  async function load() {
    setLoading(true)
    try {
      const { data } = await superAdminApi.get('/super-admin/plans')
      setPlans(data.plans || [])
    } catch { setToast({ msg: 'Failed to load plans', ok: false }) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  function openCreate() { setForm(EMPTY); setModal('create') }

  function openEdit(plan) {
    setForm({ ...plan, price_monthly: plan.price_monthly||0, price_yearly: plan.price_yearly||0 })
    setModal(plan)
  }

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function save() {
    if (!form.name) { setToast({ msg: 'Plan name is required', ok: false }); return }
    setSaving(true)
    try {
      if (modal === 'create') {
        const { data } = await superAdminApi.post('/super-admin/plans', form)
        setPlans(v => [...v, data])
        setToast({ msg: `Plan "${data.name}" created`, ok: true })
      } else {
        const { data } = await superAdminApi.put(`/super-admin/plans/${modal.id}`, form)
        setPlans(v => v.map(p => p.id === data.id ? data : p))
        setToast({ msg: `Plan "${data.name}" updated`, ok: true })
      }
      setModal(null)
    } catch(e) {
      setToast({ msg: e.response?.data?.detail || 'Save failed', ok: false })
    } finally { setSaving(false) }
  }

  async function deactivate(plan) {
    if (!confirm(`Deactivate plan "${plan.name}"?`)) return
    try {
      await superAdminApi.delete(`/super-admin/plans/${plan.id}`)
      setPlans(v => v.map(p => p.id === plan.id ? { ...p, is_active: false } : p))
      setToast({ msg: 'Plan deactivated', ok: true })
    } catch { setToast({ msg: 'Failed', ok: false }) }
  }

  async function loadUsage() {
    try {
      const { data } = await superAdminApi.get('/super-admin/api-usage')
      setUsage(data)
      setUO(true)
    } catch { setToast({ msg: 'Failed to load usage', ok: false }) }
  }

  return (
    <div style={S.page}>
      {toast && <div style={S.toast(toast.ok)}>{toast.ok ? '✓' : '✕'} {toast.msg}</div>}

      <div style={S.hdr}>
        <h1 style={S.h1}>Subscription Plans</h1>
        <div style={S.row}>
          <button style={{ ...S.btn, background: 'transparent', color: C.muted, border: `1px solid ${C.border}` }} onClick={loadUsage}>📊 API Usage</button>
          <button style={S.btn} onClick={openCreate}>+ Create Plan</button>
        </div>
      </div>

      {/* Plans table */}
      <div style={S.card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Plan','Price/mo','API Calls/mo','Webhooks','Integrations','API Access','Status','Actions'].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', color: C.muted, padding: '32px' }}>Loading…</td></tr>
            ) : plans.length === 0 ? (
              <tr><td colSpan={8} style={{ ...S.td, textAlign: 'center', color: C.muted, padding: '32px' }}>No plans yet. Create one above.</td></tr>
            ) : plans.map(plan => (
              <tr key={plan.id} style={{ opacity: plan.is_active ? 1 : 0.5 }}>
                <td style={S.td}><PlanBadge name={plan.name} /></td>
                <td style={S.td}>${plan.price_monthly}/mo</td>
                <td style={S.td}>
                  {plan.api_calls_per_month === -1 ? <span style={{ color: C.green }}>Unlimited</span>
                    : plan.api_calls_per_month === 0 ? <span style={{ color: C.dim }}>Disabled</span>
                    : plan.api_calls_per_month.toLocaleString()}
                </td>
                <td style={S.td}>
                  <span style={{ color: plan.webhooks_enabled ? C.green : C.dim }}>
                    {plan.webhooks_enabled ? '✓' : '✗'}
                  </span>
                </td>
                <td style={S.td}>
                  <span style={{ color: plan.integrations_enabled ? C.green : C.dim }}>
                    {plan.integrations_enabled ? '✓' : '✗'}
                  </span>
                </td>
                <td style={S.td}>
                  <span style={{ color: plan.api_access ? C.green : C.dim }}>
                    {plan.api_access ? '✓' : '✗'}
                  </span>
                </td>
                <td style={S.td}>
                  <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '99px', background: plan.is_active ? 'rgba(63,185,80,.1)' : 'rgba(139,148,158,.1)', color: plan.is_active ? C.green : C.dim, border: `1px solid ${plan.is_active ? C.green : C.dim}` }}>
                    {plan.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={S.td}>
                  <div style={S.row}>
                    <button style={S.btnSm()} onClick={() => openEdit(plan)}>Edit</button>
                    {plan.is_active && <button style={S.btnSm('danger')} onClick={() => deactivate(plan)}>Deactivate</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create/Edit modal */}
      {modal !== null && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={S.modal}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <span style={{ fontSize: '16px', fontWeight: '700' }}>{modal === 'create' ? 'Create Plan' : `Edit — ${modal.name}`}</span>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', color: C.muted, fontSize: '22px', cursor: 'pointer' }}>×</button>
            </div>

            <div style={S.grid}>
              <div><label style={S.label}>Plan Name *</label><input style={S.input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Starter" /></div>
              <div><label style={S.label}>Price / month ($)</label><input style={S.input} type="number" value={form.price_monthly} onChange={e => set('price_monthly', +e.target.value)} /></div>
              <div><label style={S.label}>Agent Limit</label><input style={S.input} type="number" value={form.agent_limit} onChange={e => set('agent_limit', +e.target.value)} /></div>
              <div><label style={S.label}>Contact Limit (-1=∞)</label><input style={S.input} type="number" value={form.contact_limit} onChange={e => set('contact_limit', +e.target.value)} /></div>
              <div><label style={S.label}>Broadcast Limit</label><input style={S.input} type="number" value={form.broadcast_limit} onChange={e => set('broadcast_limit', +e.target.value)} /></div>
              <div><label style={S.label}>Template Limit</label><input style={S.input} type="number" value={form.template_limit} onChange={e => set('template_limit', +e.target.value)} /></div>
              <div><label style={S.label}>API Calls/month (0=off, -1=∞)</label><input style={S.input} type="number" value={form.api_calls_per_month} onChange={e => set('api_calls_per_month', +e.target.value)} /></div>
              <div><label style={S.label}>Sort Order</label><input style={S.input} type="number" value={form.sort_order} onChange={e => set('sort_order', +e.target.value)} /></div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <label style={S.label}>Description</label>
              <input style={S.input} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief plan description" />
            </div>

            <div style={{ marginTop: '16px', padding: '12px', background: '#0d1117', borderRadius: '8px', border: `1px solid ${C.border}` }}>
              <Toggle label="API Access"          checked={form.api_access}          onChange={() => set('api_access', !form.api_access)} />
              <Toggle label="Webhooks"            checked={form.webhooks_enabled}    onChange={() => set('webhooks_enabled', !form.webhooks_enabled)} />
              <Toggle label="Integrations"        checked={form.integrations_enabled}onChange={() => set('integrations_enabled', !form.integrations_enabled)} />
              <Toggle label="Flow Builder"        checked={form.flow_builder}        onChange={() => set('flow_builder', !form.flow_builder)} />
              <Toggle label="Analytics"           checked={form.analytics}           onChange={() => set('analytics', !form.analytics)} />
              <Toggle label="Automations"         checked={form.automations}         onChange={() => set('automations', !form.automations)} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: `1px solid ${C.border}` }}>
              <button onClick={() => setModal(null)} style={{ ...S.btn, background: 'transparent', color: C.muted, border: `1px solid ${C.border}` }}>Cancel</button>
              <button onClick={save} disabled={saving} style={S.btn}>{saving ? 'Saving…' : modal === 'create' ? 'Create Plan' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* API Usage modal */}
      {usageOpen && usage && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setUO(false)}>
          <div style={{ ...S.modal, maxWidth: '720px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <span style={{ fontSize: '16px', fontWeight: '700' }}>API Usage — All Tenants</span>
              <button onClick={() => setUO(false)} style={{ background: 'none', border: 'none', color: C.muted, fontSize: '22px', cursor: 'pointer' }}>×</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>{['Business','Plan','Used','Limit','Usage %'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {usage.tenants.map(t => (
                  <tr key={t.tenant_id}>
                    <td style={S.td}>{t.business_name}</td>
                    <td style={S.td}><PlanBadge name={t.plan_name} /></td>
                    <td style={S.td}>{t.api_calls_used.toLocaleString()}</td>
                    <td style={S.td}>{t.api_calls_limit === -1 ? '∞' : t.api_calls_limit.toLocaleString()}</td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '5px', borderRadius: '3px', background: '#30363d', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${t.usage_pct}%`, background: t.usage_pct > 85 ? C.red : C.blue, borderRadius: '3px' }} />
                        </div>
                        <span style={{ color: t.usage_pct > 85 ? C.red : C.muted, minWidth: '40px', textAlign: 'right' }}>{t.usage_pct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
