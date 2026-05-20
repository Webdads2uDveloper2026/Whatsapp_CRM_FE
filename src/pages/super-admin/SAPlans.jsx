import { useEffect, useState } from 'react'
import superAdminApi from '../../services/superAdminApi'

const S = {
  page:    { padding:'28px 32px', maxWidth:'1100px', fontFamily:"'Inter',system-ui,sans-serif", color:'#e6edf3' },
  hdr:     { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'12px' },
  h1:      { fontSize:'20px', fontWeight:'700', color:'#e6edf3', margin:0 },
  btn:     { display:'inline-flex', alignItems:'center', gap:'6px', padding:'8px 16px', borderRadius:'10px', fontSize:'13px', fontWeight:'600', border:'none', cursor:'pointer', fontFamily:'inherit', transition:'all .15s' },
  input:   { width:'100%', background:'#1c2128', border:'1px solid #30363d', borderRadius:'10px', padding:'10px 14px', fontSize:'13px', color:'#e6edf3', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  label:   { display:'block', fontSize:'12px', fontWeight:'500', color:'#8b949e', marginBottom:'6px' },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'20px', backdropFilter:'blur(3px)' },
  modal:   { background:'#161b22', border:'1px solid #30363d', borderRadius:'16px', width:'100%', maxWidth:'520px', padding:'28px', boxShadow:'0 24px 64px rgba(0,0,0,.6)', maxHeight:'90vh', overflowY:'auto' },
  mh:      { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' },
  mclose:  { background:'none', border:'none', color:'#8b949e', fontSize:'22px', cursor:'pointer', lineHeight:1 },
  mfoot:   { display:'flex', justifyContent:'flex-end', gap:'10px', paddingTop:'16px', borderTop:'1px solid #21262d', marginTop:'20px' },
}

const PLAN_ACCENT = {
  Trial:      '#8b949e',
  Starter:    '#388bfd',
  Growth:     '#8957e5',
  Pro:        '#d29922',
  Enterprise: '#f85149',
}

const onFocus = e => { e.target.style.borderColor = '#f85149' }
const onBlur  = e => { e.target.style.borderColor = '#30363d' }

function Toggle({ label, checked, onChange }) {
  return (
    <label style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid #21262d', cursor:'pointer' }}>
      <span style={{ fontSize:'13px', color:'#c9d1d9' }}>{label}</span>
      <div
        onClick={onChange}
        style={{ width:'36px', height:'20px', borderRadius:'10px', background: checked ? '#388bfd' : '#30363d', position:'relative', cursor:'pointer', transition:'background .2s', flexShrink:0 }}>
        <div style={{ position:'absolute', top:'3px', left: checked ? '19px' : '3px', width:'14px', height:'14px', borderRadius:'50%', background:'#fff', transition:'left .2s' }} />
      </div>
    </label>
  )
}

function FeatureRow({ emoji, label, value }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 0' }}>
      <span style={{ fontSize:'12px', color:'#8b949e' }}>{emoji} {label}</span>
      <span style={{ fontSize:'13px', fontWeight:'600', color: value === true ? '#3fb950' : value === false ? '#6e7681' : '#e6edf3' }}>
        {value === true ? '✓' : value === false ? '✗' : value}
      </span>
    </div>
  )
}

const EMPTY_FORM = {
  name:'', description:'', price_monthly:0, price_yearly:0,
  agent_limit:3, broadcast_limit:1000, template_limit:10, contact_limit:1000,
  flow_builder:false, analytics:false, automations:true, api_access:false,
  whatsapp_accounts:1, sort_order:0, is_active:true,
}

export default function SAPlans() {
  const [plans, setPlans]     = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editPlan, setEditPlan]   = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await superAdminApi.get('/super-admin/plans')
      setPlans(data.plans || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditPlan(null)
    setForm({ ...EMPTY_FORM, sort_order: plans.length })
    setErr('')
    setShowModal(true)
  }

  const openEdit = p => {
    setEditPlan(p)
    setForm({
      name: p.name, description: p.description,
      price_monthly: p.price_monthly, price_yearly: p.price_yearly,
      agent_limit: p.agent_limit, broadcast_limit: p.broadcast_limit,
      template_limit: p.template_limit, contact_limit: p.contact_limit,
      flow_builder: p.flow_builder, analytics: p.analytics,
      automations: p.automations, api_access: p.api_access,
      whatsapp_accounts: p.whatsapp_accounts,
      sort_order: p.sort_order, is_active: p.is_active,
    })
    setErr('')
    setShowModal(true)
  }

  const handleSave = async e => {
    e.preventDefault(); setErr(''); setSaving(true)
    try {
      if (editPlan) {
        await superAdminApi.patch(`/super-admin/plans/${editPlan.id}`, form)
      } else {
        await superAdminApi.post('/super-admin/plans', form)
      }
      setShowModal(false)
      load()
    } catch(e) { setErr(e.response?.data?.detail || 'Error saving plan') }
    setSaving(false)
  }

  const handleDelete = async p => {
    if (!window.confirm(`Delete plan "${p.name}"? This cannot be undone.`)) return
    try { await superAdminApi.delete(`/super-admin/plans/${p.id}`); load() } catch {}
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div style={S.page}>
      <div style={S.hdr}>
        <div>
          <h1 style={S.h1}>Subscription Plans</h1>
          <p style={{ fontSize:'13px', color:'#8b949e', margin:'4px 0 0' }}>{plans.length} plans configured</p>
        </div>
        <button onClick={openCreate}
          style={{ ...S.btn, background:'#f85149', color:'#fff' }}>
          + Create Plan
        </button>
      </div>

      {loading ? (
        <div style={{ padding:'60px', textAlign:'center', color:'#8b949e', fontSize:'13px' }}>Loading…</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'16px' }}>
          {plans.map(p => {
            const accent = PLAN_ACCENT[p.name] || '#8b949e'
            return (
              <div key={p.id} style={{ background:'#161b22', border:`1px solid ${p.is_active ? '#21262d' : 'rgba(139,148,158,.2)'}`, borderTop:`3px solid ${accent}`, borderRadius:'14px', padding:'20px', opacity: p.is_active ? 1 : .6 }}>
                {/* Plan header */}
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'4px' }}>
                  <div>
                    <h3 style={{ fontSize:'16px', fontWeight:'700', color:accent, margin:'0 0 2px' }}>{p.name}</h3>
                    {!p.is_active && <span style={{ fontSize:'10px', color:'#6e7681', fontWeight:'600' }}>INACTIVE</span>}
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'18px', fontWeight:'700', color:'#e6edf3' }}>
                      {p.price_monthly > 0 ? `₹${p.price_monthly.toLocaleString()}` : 'Free'}
                    </div>
                    {p.price_monthly > 0 && <div style={{ fontSize:'10px', color:'#8b949e' }}>/month</div>}
                  </div>
                </div>
                {p.description && <p style={{ fontSize:'12px', color:'#7d8590', marginBottom:'14px' }}>{p.description}</p>}

                <div style={{ borderTop:'1px solid #21262d', paddingTop:'12px', marginBottom:'14px' }}>
                  <FeatureRow emoji="👥" label="Agents"      value={p.agent_limit === 999 ? 'Unlimited' : p.agent_limit} />
                  <FeatureRow emoji="📢" label="Broadcasts"  value={p.broadcast_limit === 999999 ? 'Unlimited' : `${p.broadcast_limit.toLocaleString()}/mo`} />
                  <FeatureRow emoji="📋" label="Templates"   value={p.template_limit === 999 ? 'Unlimited' : p.template_limit} />
                  <FeatureRow emoji="👤" label="Contacts"    value={p.contact_limit === 999999 ? 'Unlimited' : p.contact_limit.toLocaleString()} />
                  <FeatureRow emoji="🔀" label="Flow Builder" value={p.flow_builder} />
                  <FeatureRow emoji="📊" label="Analytics"   value={p.analytics} />
                  <FeatureRow emoji="⚡" label="Automations" value={p.automations} />
                  <FeatureRow emoji="🔧" label="API Access"  value={p.api_access} />
                </div>

                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={() => openEdit(p)}
                    style={{ ...S.btn, background:'#21262d', color:'#c9d1d9', border:'1px solid #30363d', flex:1, justifyContent:'center', fontSize:'12px', padding:'7px 12px' }}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(p)}
                    style={{ ...S.btn, background:'rgba(248,81,73,.08)', color:'#f85149', border:'1px solid rgba(248,81,73,.2)', flex:1, justifyContent:'center', fontSize:'12px', padding:'7px 12px' }}>
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Create / Edit Modal ──────────────────────────────────────────────── */}
      {showModal && (
        <div style={S.overlay} onClick={() => setShowModal(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.mh}>
              <h2 style={{ fontSize:'16px', fontWeight:'600', margin:0 }}>{editPlan ? 'Edit Plan' : 'Create Plan'}</h2>
              <button onClick={() => setShowModal(false)} style={S.mclose}>×</button>
            </div>
            {err && <div style={{ background:'rgba(248,81,73,.1)', border:'1px solid rgba(248,81,73,.3)', borderRadius:'8px', padding:'10px 14px', fontSize:'12px', color:'#f85149', marginBottom:'14px' }}>{err}</div>}

            <form onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={S.label}>Plan Name</label>
                  <input required type="text" value={form.name} onChange={e => f('name', e.target.value)}
                    placeholder="e.g. Growth" style={S.input} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={S.label}>Description</label>
                  <input type="text" value={form.description} onChange={e => f('description', e.target.value)}
                    placeholder="Short description" style={S.input} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div>
                  <label style={S.label}>Monthly Price (₹)</label>
                  <input type="number" min="0" value={form.price_monthly} onChange={e => f('price_monthly', +e.target.value)}
                    style={S.input} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div>
                  <label style={S.label}>Yearly Price (₹)</label>
                  <input type="number" min="0" value={form.price_yearly} onChange={e => f('price_yearly', +e.target.value)}
                    style={S.input} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div>
                  <label style={S.label}>Agent Limit</label>
                  <input type="number" min="1" value={form.agent_limit} onChange={e => f('agent_limit', +e.target.value)}
                    style={S.input} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div>
                  <label style={S.label}>Broadcast Limit/mo</label>
                  <input type="number" min="0" value={form.broadcast_limit} onChange={e => f('broadcast_limit', +e.target.value)}
                    style={S.input} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div>
                  <label style={S.label}>Template Limit</label>
                  <input type="number" min="0" value={form.template_limit} onChange={e => f('template_limit', +e.target.value)}
                    style={S.input} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div>
                  <label style={S.label}>Contact Limit</label>
                  <input type="number" min="0" value={form.contact_limit} onChange={e => f('contact_limit', +e.target.value)}
                    style={S.input} onFocus={onFocus} onBlur={onBlur} />
                </div>
                <div>
                  <label style={S.label}>Sort Order</label>
                  <input type="number" min="0" value={form.sort_order} onChange={e => f('sort_order', +e.target.value)}
                    style={S.input} onFocus={onFocus} onBlur={onBlur} />
                </div>
              </div>

              <div style={{ background:'#0d1117', border:'1px solid #21262d', borderRadius:'10px', padding:'14px' }}>
                <p style={{ fontSize:'12px', fontWeight:'600', color:'#8b949e', margin:'0 0 4px', textTransform:'uppercase', letterSpacing:'.05em' }}>Features</p>
                <Toggle label="Flow Builder"  checked={form.flow_builder}  onChange={() => f('flow_builder',  !form.flow_builder)} />
                <Toggle label="Analytics"     checked={form.analytics}     onChange={() => f('analytics',     !form.analytics)} />
                <Toggle label="Automations"   checked={form.automations}   onChange={() => f('automations',   !form.automations)} />
                <Toggle label="API Access"    checked={form.api_access}    onChange={() => f('api_access',    !form.api_access)} />
                <Toggle label="Active (visible to assign)" checked={form.is_active} onChange={() => f('is_active', !form.is_active)} />
              </div>

              <div style={S.mfoot}>
                <button type="button" onClick={() => setShowModal(false)}
                  style={{ ...S.btn, background:'#21262d', color:'#c9d1d9', border:'1px solid #30363d' }}>Cancel</button>
                <button type="submit" disabled={saving}
                  style={{ ...S.btn, background: saving ? '#21262d' : '#f85149', color: saving ? '#8b949e' : '#fff', cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Saving…' : editPlan ? 'Save Changes' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
