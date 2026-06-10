import { useState, useEffect } from 'react'
import axios from 'axios'
import api from '../../services/api'

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: '#0f1117', card: '#161b22', border: '#21262d',
  text: '#e6edf3', muted: '#8b949e', dim: '#6e7681',
  blue: '#388bfd', purple: '#8957e5', green: '#3fb950',
  gold: '#e3b341', red: '#f85149',
}
const PLAN_STYLE = {
  trial:    { bg: 'rgba(72,79,88,.2)',   color: '#8b949e', border: '#484f58' },
  starter:  { bg: 'rgba(72,79,88,.2)',   color: '#8b949e', border: '#484f58' },
  growth:   { bg: 'rgba(56,139,253,.1)', color: C.blue,    border: C.blue    },
  pro:      { bg: 'rgba(137,87,229,.1)', color: C.purple,  border: C.purple  },
  business: { bg: 'rgba(227,179,65,.1)', color: C.gold,    border: C.gold    },
}
const METHOD = {
  GET:    { bg: '#0a2218', color: '#3fb950', border: '#1a4731' },
  POST:   { bg: '#0c2040', color: '#79c0ff', border: '#0c2d6b' },
  PUT:    { bg: '#2a1a00', color: '#e3b341', border: '#4a2c00' },
  DELETE: { bg: '#2a0a0a', color: '#ffa198', border: '#4a1a1a' },
}
const S = {
  page:    { padding: '32px', fontFamily: "'Inter',system-ui,sans-serif", color: C.text, minHeight: '100vh', background: C.bg },
  heading: { fontSize: '22px', fontWeight: '700', marginBottom: '4px' },
  sub:     { fontSize: '13px', color: C.muted, marginBottom: '28px' },
  tabs:    { display: 'flex', gap: '4px', borderBottom: `1px solid ${C.border}`, marginBottom: '28px' },
  card:    { background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '20px', marginBottom: '16px' },
  label:   { display: 'block', fontSize: '12px', fontWeight: '500', color: C.muted, marginBottom: '6px' },
  input:   { width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', color: C.text, padding: '9px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  row:     { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' },
  btn:     (v = 'primary') => ({
    background: v === 'primary' ? C.blue : 'transparent',
    color:      v === 'danger' ? C.red : v === 'ghost' ? C.blue : '#fff',
    border:     `1px solid ${v === 'danger' ? 'rgba(248,81,73,.3)' : v === 'ghost' ? C.blue : C.blue}`,
    borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '600',
    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  }),
  code:    { background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', padding: '2px 8px', fontSize: '12px', color: '#79c0ff', fontFamily: 'monospace' },
  pre:     { background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', padding: '14px', fontSize: '12px', color: C.muted, fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'pre-wrap', margin: '10px 0 0' },
  toast:   (ok) => ({ position: 'fixed', top: '20px', right: '20px', padding: '12px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '500', zIndex: 9999, background: ok ? '#1a2e1a' : '#2e1a1a', color: ok ? C.green : C.red, border: `1px solid ${ok ? C.green : C.red}` }),
  badge:   (plan) => { const k = plan?.toLowerCase(); const s = PLAN_STYLE[k] || PLAN_STYLE.starter; return { background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: '99px', padding: '3px 10px', fontSize: '11px', fontWeight: '700', letterSpacing: '.04em', textTransform: 'uppercase' } },
  progress:{ height: '6px', borderRadius: '3px', background: '#30363d', overflow: 'hidden', margin: '6px 0' },
}

const TABS = ['Access Token', 'API', 'Integrations', 'Webhooks']
const LS_KEY = 'connector_api_token'

// ── Helpers ───────────────────────────────────────────────────────────────────

function baseUrl() {
  return (import.meta.env.VITE_API_URL || '').trim().replace('/api/v1', '')
}

// Build a one-off axios instance that uses the connector token (NOT the JWT)
function connectorAxios(token) {
  return axios.create({
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    },
    timeout: 8000,
  })
}

// ── Primitives ────────────────────────────────────────────────────────────────

function Toast({ toast }) {
  if (!toast) return null
  return <div style={S.toast(toast.ok)}>{toast.ok ? '✓' : '✕'} {toast.msg}</div>
}

function CopyBtn({ value, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)
  const copy = () => navigator.clipboard.writeText(value || '').then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) })
  return <button style={{ ...S.btn('ghost'), fontSize: '12px', padding: '6px 12px' }} onClick={copy}>{copied ? '✓ Copied' : label}</button>
}

function Toggle({ checked, onChange }) {
  return (
    <div onClick={onChange} style={{ width: '40px', height: '22px', borderRadius: '11px', background: checked ? C.blue : '#30363d', position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: '3px', left: checked ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
    </div>
  )
}

// ── Tab 1: Access Token ───────────────────────────────────────────────────────

function TabToken({ apiToken, setApiToken, toast, setToast }) {
  const [info, setInfo]       = useState(null)
  const [usage, setUsage]     = useState(null)
  const [showTok, setShowTok] = useState(false)
  const [loading, setLoading] = useState(false)

  const base = baseUrl()

  useEffect(() => {
    Promise.all([
      api.get('/connector/token').then(r => setInfo(r.data)),
      api.get('/connector/usage').then(r => setUsage(r.data)),
    ]).catch(() => {})
  }, [])

  async function generate() {
    if (!confirm('Generate a new token? Your old token will stop working immediately.')) return
    setLoading(true)
    try {
      const { data } = await api.post('/connector/generate-token')
      // Persist token so Try button works after page refresh
      localStorage.setItem(LS_KEY, data.token)
      setApiToken(data.token)
      setInfo({ has_token: true, masked_token: data.token.slice(0,6)+'••••••••'+data.token.slice(-4), created_at: data.created_at, tenant_id_slug: data.tenant_id_slug })
      setToast({ msg: 'Token generated — copy it now, it will be masked after refresh', ok: true })
    } catch (e) {
      setToast({ msg: e.response?.data?.detail || 'Failed to generate token', ok: false })
    } finally { setLoading(false) }
  }

  async function revoke() {
    if (!confirm('Revoke the token? API access will stop immediately.')) return
    await api.delete('/connector/token').catch(() => {})
    localStorage.removeItem(LS_KEY)
    setApiToken(null)
    setInfo(v => ({ ...v, has_token: false, masked_token: null }))
    setToast({ msg: 'Token revoked', ok: true })
  }

  const slug    = info?.tenant_id_slug || '...'
  const pct     = usage ? Math.min((usage.api_calls_used / (usage.api_calls_limit || 1)) * 100, 100) : 0
  const planKey = (usage?.plan_name || 'starter').toLowerCase()
  const accent  = (PLAN_STYLE[planKey] || PLAN_STYLE.starter).color
  const curl    = `curl -X GET "${base}/${slug}/api/v1/getContacts" \\\n  -H "Authorization: Bearer ${apiToken || '<YOUR_TOKEN>'}"`

  return (
    <div style={{ maxWidth: '700px' }}>
      {/* Plan + usage */}
      <div style={S.card}>
        <div style={{ ...S.row, marginBottom: '16px' }}>
          <span style={{ fontSize: '15px', fontWeight: '600' }}>Current Plan</span>
          <span style={S.badge(usage?.plan_name || 'starter')}>{usage?.plan_name || '—'}</span>
          {!usage?.api_access_enabled && (
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: C.dim }}>Contact super admin to enable API access</span>
          )}
        </div>
        {usage && (
          <>
            <div style={{ fontSize: '13px', color: C.muted }}>
              API calls this month: <span style={{ color: C.text, fontWeight: '600' }}>{usage.api_calls_used.toLocaleString()}</span>
              {usage.api_calls_limit > 0  && <> / {usage.api_calls_limit.toLocaleString()}</>}
              {usage.api_calls_limit === -1 && <span style={{ color: C.green }}> (unlimited)</span>}
              {usage.api_calls_limit === 0  && <span style={{ color: C.dim }}> (disabled)</span>}
            </div>
            {usage.api_calls_limit > 0 && (
              <div style={S.progress}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct > 85 ? C.red : accent, borderRadius: '3px', transition: 'width .4s' }} />
              </div>
            )}
            <div style={{ ...S.row, marginTop: '10px', gap: '16px' }}>
              <span style={{ fontSize: '12px', color: usage.webhooks_enabled ? C.green : C.dim }}>{usage.webhooks_enabled ? '✓' : '✗'} Webhooks</span>
              <span style={{ fontSize: '12px', color: usage.api_access_enabled ? C.green : C.dim }}>{usage.api_access_enabled ? '✓' : '✗'} API Access</span>
            </div>
          </>
        )}
      </div>

      {/* Token */}
      <div style={S.card}>
        <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>API Bearer Token</div>
        {!usage?.api_access_enabled ? (
          <div style={{ background: 'rgba(248,81,73,.06)', border: '1px solid rgba(248,81,73,.2)', borderRadius: '8px', padding: '14px 16px', fontSize: '13px', color: C.muted }}>
            ⚠ API access is not enabled on your plan. Ask your super admin to assign a plan with API access.
          </div>
        ) : info?.has_token ? (
          <>
            <div style={{ background: 'rgba(56,139,253,.06)', border: '1px solid rgba(56,139,253,.15)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: C.muted, marginBottom: '14px' }}>
              {apiToken
                ? '✓ Full token loaded — copy it before leaving this session'
                : '⚠ Token is masked after page refresh — rotate to get a new copyable token'}
            </div>
            <div style={{ ...S.row, marginBottom: '12px' }}>
              <input readOnly style={{ ...S.input, flex: 1, fontFamily: 'monospace', fontSize: '12px' }}
                type={showTok ? 'text' : 'password'}
                value={apiToken || info.masked_token || ''} />
              <button style={{ ...S.btn('ghost'), fontSize: '12px', padding: '7px 12px' }} onClick={() => setShowTok(v => !v)}>
                {showTok ? 'Hide' : 'Show'}
              </button>
              <CopyBtn value={apiToken || info.masked_token} />
            </div>
            {info.created_at && <div style={{ fontSize: '12px', color: C.dim, marginBottom: '16px' }}>Created: {new Date(info.created_at).toLocaleString()}</div>}
            <div style={S.row}>
              <button style={S.btn('primary')} onClick={generate} disabled={loading}>{loading ? 'Generating…' : '↺ Rotate Token'}</button>
              <button style={S.btn('danger')} onClick={revoke}>✕ Revoke</button>
            </div>
          </>
        ) : (
          <div>
            <div style={{ fontSize: '13px', color: C.muted, marginBottom: '16px' }}>No token yet. Generate one to start using the API.</div>
            <button style={S.btn('primary')} onClick={generate} disabled={loading}>{loading ? 'Generating…' : '+ Generate Token'}</button>
          </div>
        )}
      </div>

      {/* API Details */}
      <div style={S.card}>
        <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '14px' }}>API Details</div>
        <div style={{ marginBottom: '12px' }}>
          <div style={S.label}>Tenant ID (slug)</div>
          <div style={S.row}><code style={{ ...S.code, fontSize: '14px' }}>{slug}</code><CopyBtn value={slug} /></div>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <div style={S.label}>Base URL</div>
          <div style={S.row}><code style={{ ...S.code, fontSize: '12px' }}>{base}/{slug}/api/v1</code><CopyBtn value={`${base}/${slug}/api/v1`} /></div>
        </div>
        <div>
          <div style={S.label}>Quick Start (cURL)</div>
          <pre style={S.pre}>{curl}</pre>
          <div style={{ marginTop: '6px' }}><CopyBtn value={curl} label="Copy cURL" /></div>
        </div>
      </div>
    </div>
  )
}

// ── Tab 2: API Docs + Try ─────────────────────────────────────────────────────

const API_SECTIONS = [
  { title: 'Contacts', items: [
    { method: 'GET',    path: '/getContacts',                      desc: 'List contacts',          params: 'pageSize, pageNumber, searchText' },
    { method: 'GET',    path: '/getContact/{whatsappNumber}',      desc: 'Get contact by number'   },
    { method: 'POST',   path: '/addContact',                       desc: 'Create contact',          body: '{ name, whatsappNumber, email?, tags?, customParams? }' },
    { method: 'PUT',    path: '/updateContactAttributes/{number}', desc: 'Update attributes',       body: '{ customParams: [{name, value}] }' },
    { method: 'DELETE', path: '/deleteContact/{whatsappNumber}',   desc: 'Delete contact'          },
    { method: 'GET',    path: '/getContactsByTag/{tag}',           desc: 'Contacts by tag'         },
  ]},
  { title: 'Messages', items: [
    { method: 'GET',  path: '/getMessages/{whatsappNumber}',         desc: 'Message history',   params: 'pageSize, pageNumber' },
    { method: 'POST', path: '/sendSessionMessage/{whatsappNumber}',  desc: 'Send text message', body: '{ messageText }' },
    { method: 'POST', path: '/sendTemplateMessage/{whatsappNumber}', desc: 'Send template',     body: '{ template_name, parameters: [{name, value}] }' },
  ]},
  { title: 'Conversations', items: [
    { method: 'GET', path: '/getConversations',                  desc: 'List conversations', params: 'pageSize, pageNumber, status=OPEN|RESOLVED|PENDING' },
    { method: 'PUT', path: '/updateConversationStatus/{id}',     desc: 'Update status',      body: '{ status: "OPEN"|"RESOLVED"|"PENDING" }' },
  ]},
  { title: 'Templates', items: [
    { method: 'GET', path: '/getTemplates', desc: 'List approved templates' },
  ]},
  { title: 'Auth', items: [
    { method: 'POST', path: '/rotateToken', desc: 'Rotate API token (old token is revoked immediately)' },
  ]},
]

function MethodBadge({ method }) {
  const s = METHOD[method] || METHOD.GET
  return <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: '5px', padding: '2px 8px', fontSize: '11px', fontWeight: '700', fontFamily: 'monospace', flexShrink: 0 }}>{method}</span>
}

function TabAPI({ slug, apiToken }) {
  const [active, setActive] = useState('Contacts')
  const [tryOpen, setTryOpen] = useState(null)
  const [tryRes, setTryRes] = useState({})
  const [tryLoading, setTL] = useState({})

  const section = API_SECTIONS.find(s => s.title === active) || API_SECTIONS[0]
  const base    = `${baseUrl()}/${slug || '{slug}'}/api/v1`

  async function runTry(item) {
    const key = item.path
    if (!apiToken) {
      setTryRes(v => ({ ...v, [key]: { ok: false, status: 0, ms: 0, body: 'No API token found.\nGo to the Access Token tab and generate or rotate your token first.' } }))
      setTryOpen(key)
      return
    }
    if (item.method !== 'GET') {
      setTryRes(v => ({ ...v, [key]: { ok: null, status: 0, ms: 0, body: 'Use a REST client (curl, Postman) to test POST/PUT/DELETE endpoints.\nSend:\n  Authorization: Bearer ' + apiToken + '\n  Content-Type: application/json' } }))
      setTryOpen(key)
      return
    }
    setTL(v => ({ ...v, [key]: true }))
    const t0  = Date.now()
    // Use the CONNECTOR token, NOT the JWT axios instance
    const url = `${base}${item.path.replace(/{[^}]+}/g, 'test')}`
    try {
      const r = await connectorAxios(apiToken).get(url)
      setTryRes(v => ({ ...v, [key]: { ok: true, status: r.status, ms: Date.now()-t0, body: JSON.stringify(r.data, null, 2) } }))
    } catch(e) {
      setTryRes(v => ({ ...v, [key]: { ok: false, status: e.response?.status||0, ms: Date.now()-t0, body: JSON.stringify(e.response?.data || { message: e.message }, null, 2) } }))
    } finally {
      setTL(v => ({ ...v, [key]: false }))
      setTryOpen(key)
    }
  }

  return (
    <div style={{ display: 'flex', gap: '24px', maxWidth: '1000px' }}>
      {/* Sidebar */}
      <div style={{ width: '160px', flexShrink: 0 }}>
        {API_SECTIONS.map(s => (
          <button key={s.title} onClick={() => setActive(s.title)}
            style={{ width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: '8px', border: 'none', fontFamily: 'inherit', fontSize: '13px', cursor: 'pointer', marginBottom: '2px', background: active === s.title ? 'rgba(56,139,253,.12)' : 'transparent', color: active === s.title ? C.blue : C.muted, fontWeight: active === s.title ? '600' : '400' }}>
            {s.title}
          </button>
        ))}
      </div>

      {/* Endpoint cards */}
      <div style={{ flex: 1 }}>
        {!apiToken && (
          <div style={{ background: 'rgba(227,179,65,.08)', border: '1px solid rgba(227,179,65,.2)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: C.gold }}>
            ⚠ No API token in this session. Go to the <strong>Access Token</strong> tab and generate or rotate your token to enable live testing.
          </div>
        )}
        <div style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>{active}</div>
        {section.items.map(item => {
          const key  = item.path
          const res  = tryRes[key]
          const isOpen = tryOpen === key
          const curl = `curl -X ${item.method} "${base}${item.path}" \\\n  -H "Authorization: Bearer ${apiToken || '<YOUR_TOKEN>'}"`
          return (
            <div key={key} style={{ ...S.card, marginBottom: '12px' }}>
              <div style={S.row}>
                <MethodBadge method={item.method} />
                <code style={{ ...S.code, flex: 1, fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {slug || '{slug}'}/api/v1{item.path}
                </code>
                <CopyBtn value={curl} label="cURL" />
                <button style={{ ...S.btn('ghost'), fontSize: '12px', padding: '6px 12px' }} onClick={() => runTry(item)}>
                  {tryLoading[key] ? '…' : 'Try'}
                </button>
              </div>
              <div style={{ fontSize: '13px', color: C.muted, marginTop: '8px' }}>{item.desc}</div>
              {item.params && <div style={{ fontSize: '12px', color: C.dim, marginTop: '4px' }}>Params: {item.params}</div>}
              {item.body   && <div style={{ fontSize: '12px', color: C.dim, marginTop: '4px' }}>Body: <code style={S.code}>{item.body}</code></div>}
              {isOpen && res && (
                <div style={{ marginTop: '12px' }}>
                  {res.status > 0 && (
                    <div style={{ ...S.row, marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: res.ok ? C.green : C.red, fontWeight: '600' }}>
                        {res.ok === true ? '✓' : res.ok === false ? '✕' : 'ℹ'} {res.status ? `HTTP ${res.status}` : ''}
                      </span>
                      {res.ms > 0 && <span style={{ fontSize: '12px', color: C.dim }}>{res.ms}ms</span>}
                    </div>
                  )}
                  <pre style={S.pre}>{res.body}</pre>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Tab 3: Integrations ───────────────────────────────────────────────────────

const ICONS = { zoho: '🟠', hubspot: '🟠', salesforce: '☁️', zapier: '⚡', make: '⚙️', sheets: '📊', webhook: '🔗' }

function TabIntegrations() {
  const [data, setData] = useState(null)
  useEffect(() => { api.get('/connector/integrations').then(r => setData(r.data)).catch(() => {}) }, [])
  if (!data) return <div style={{ color: C.muted }}>Loading…</div>
  return (
    <div style={{ maxWidth: '800px' }}>
      {!data.integrations_enabled && (
        <div style={{ background: 'rgba(56,139,253,.08)', border: '1px solid rgba(56,139,253,.2)', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '20px' }}>🔒</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: C.text }}>Integrations require API access</div>
            <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>Ask your super admin to assign a plan with integrations enabled.</div>
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: '14px' }}>
        {data.integrations.map(i => (
          <div key={i.id} style={{ ...S.card, opacity: i.available ? 1 : 0.55 }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>{ICONS[i.id] || '🔌'}</div>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>{i.name}</div>
            <div style={{ fontSize: '12px', color: C.muted, marginBottom: '14px' }}>{i.description}</div>
            {i.connected
              ? <span style={{ fontSize: '11px', fontWeight: '600', color: C.green, background: 'rgba(63,185,80,.1)', border: `1px solid ${C.green}`, borderRadius: '99px', padding: '3px 10px' }}>● Connected</span>
              : i.available
              ? <button style={{ ...S.btn('ghost'), fontSize: '12px', padding: '6px 14px' }}>Connect</button>
              : <span style={{ fontSize: '11px', color: C.dim }}>Upgrade to unlock</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Tab 4: Webhooks ───────────────────────────────────────────────────────────

const ALL_EVENTS = [
  { id: 'message.received',      desc: 'Inbound WhatsApp message'    },
  { id: 'contact.created',       desc: 'New contact added'           },
  { id: 'lead.imported',         desc: 'Facebook lead imported'      },
  { id: 'message.sent',          desc: 'Outbound message sent'       },
  { id: 'conversation.resolved', desc: 'Conversation resolved'       },
]

function TabWebhooks({ toast, setToast }) {
  const [wh, setWh]       = useState(null)
  const [url, setUrl]     = useState('')
  const [events, setEvts] = useState([])
  const [saving, setSav]  = useState(false)
  const [testing, setTest]= useState(false)

  useEffect(() => {
    api.get('/connector/webhook').then(r => {
      setWh(r.data); setUrl(r.data.url || ''); setEvts(r.data.events || [])
    }).catch(() => setWh({ webhooks_enabled: false }))
  }, [])

  function toggleEvt(id) { setEvts(v => v.includes(id) ? v.filter(e => e !== id) : [...v, id]) }

  async function save() {
    setSav(true)
    try {
      await api.post('/connector/webhook', { url, events })
      setToast({ msg: 'Webhook saved', ok: true })
    } catch(e) {
      setToast({ msg: e.response?.data?.detail || 'Save failed', ok: false })
    } finally { setSav(false) }
  }

  async function testWh() {
    setTest(true)
    try {
      const { data } = await api.post('/crm-integration/test')
      setToast({ msg: data.success ? `Delivered — ${data.status_code} in ${data.response_time_ms}ms` : `Failed: ${data.error || data.status_code}`, ok: data.success })
    } catch { setToast({ msg: 'Test failed', ok: false }) }
    finally { setTest(false) }
  }

  async function remove() {
    if (!confirm('Remove webhook?')) return
    await api.delete('/connector/webhook').catch(() => {})
    setUrl(''); setEvts([])
    setToast({ msg: 'Webhook removed', ok: true })
  }

  if (!wh) return <div style={{ color: C.muted }}>Loading…</div>

  if (!wh.webhooks_enabled) return (
    <div style={{ ...S.card, maxWidth: '480px', textAlign: 'center', padding: '32px' }}>
      <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
      <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '6px' }}>Webhooks not available</div>
      <div style={{ fontSize: '13px', color: C.muted }}>Ask your super admin to assign a plan with webhooks enabled.</div>
    </div>
  )

  return (
    <div style={{ maxWidth: '600px' }}>
      <div style={S.card}>
        <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>Webhook Configuration</div>
        <div style={{ marginBottom: '16px' }}>
          <label style={S.label}>Endpoint URL</label>
          <input style={S.input} type="url" placeholder="https://your-server.com/webhook" value={url} onChange={e => setUrl(e.target.value)} />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={S.label}>Events</label>
          {ALL_EVENTS.map(e => (
            <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }}>
              <input type="checkbox" checked={events.includes(e.id)} onChange={() => toggleEvt(e.id)} style={{ accentColor: C.blue, width: '14px', height: '14px' }} />
              <code style={{ ...S.code, fontSize: '11px' }}>{e.id}</code>
              <span style={{ fontSize: '12px', color: C.muted }}>{e.desc}</span>
            </label>
          ))}
        </div>
        <div style={S.row}>
          <button style={S.btn('primary')} onClick={save} disabled={saving || !url}>{saving ? 'Saving…' : 'Save Webhook'}</button>
          <button style={S.btn('ghost')} onClick={testWh} disabled={testing || !wh.url}>{testing ? 'Sending…' : 'Test'}</button>
          <button style={S.btn('danger')} onClick={remove}>Remove</button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Connector() {
  const [tab, setTab]     = useState(0)
  const [toast, setToast] = useState(null)
  const [slug, setSlug]   = useState('')
  // apiToken is the connector API token (NOT the JWT).
  // Loaded from localStorage so the API tab Try button works after page refresh.
  const [apiToken, setApiToken] = useState(() => localStorage.getItem(LS_KEY) || null)

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t) }
  }, [toast])

  useEffect(() => {
    api.get('/connector/token').then(r => setSlug(r.data.tenant_id_slug || '')).catch(() => {})
  }, [])

  // Keep localStorage in sync whenever apiToken changes
  useEffect(() => {
    if (apiToken) localStorage.setItem(LS_KEY, apiToken)
    else localStorage.removeItem(LS_KEY)
  }, [apiToken])

  return (
    <div style={S.page}>
      <Toast toast={toast} />
      <div style={S.heading}>Connector</div>
      <div style={S.sub}>API access, tokens, integrations, and webhooks for your WhatsApp CRM.</div>

      <div style={S.tabs}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{
            background: 'none', border: 'none', padding: '10px 16px', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '13px',
            fontWeight: tab === i ? '600' : '400',
            color: tab === i ? C.blue : C.muted,
            borderBottom: `2px solid ${tab === i ? C.blue : 'transparent'}`,
            marginBottom: '-1px', transition: 'all .15s',
          }}>{t}</button>
        ))}
      </div>

      {tab === 0 && <TabToken apiToken={apiToken} setApiToken={setApiToken} toast={toast} setToast={setToast} />}
      {tab === 1 && <TabAPI   slug={slug} apiToken={apiToken} />}
      {tab === 2 && <TabIntegrations />}
      {tab === 3 && <TabWebhooks toast={toast} setToast={setToast} />}
    </div>
  )
}
