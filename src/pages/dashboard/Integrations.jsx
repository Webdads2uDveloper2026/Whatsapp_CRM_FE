import { useState, useEffect } from 'react'
import api from '../../services/api'

const S = {
  page:    { padding: '32px', maxWidth: '720px' },
  heading: { fontSize: '22px', fontWeight: '600', color: '#e6edf3', marginBottom: '6px' },
  sub:     { fontSize: '13px', color: '#8b949e', marginBottom: '28px' },
  card:    { background: '#161b22', border: '1px solid #21262d', borderRadius: '12px', padding: '24px', marginBottom: '20px' },
  cardTitle: { fontSize: '15px', fontWeight: '600', color: '#e6edf3', marginBottom: '4px' },
  cardSub:   { fontSize: '12px', color: '#6e7681', marginBottom: '20px' },
  label:   { display: 'block', fontSize: '12px', fontWeight: '500', color: '#8b949e', marginBottom: '6px' },
  input:   { width: '100%', background: '#0d1117', border: '1px solid #30363d', borderRadius: '8px', color: '#e6edf3', padding: '9px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  row:     { display: 'flex', gap: '12px', alignItems: 'center' },
  btn:     { background: '#388bfd', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
  btnGhost:{ background: 'transparent', color: '#388bfd', border: '1px solid #388bfd', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
  btnDanger:{ background: 'transparent', color: '#f85149', border: '1px solid rgba(248,81,73,.3)', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
  toggle:  { position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer', flexShrink: 0 },
  toggleLabel: { fontSize: '13px', color: '#8b949e' },
  infoBox: { background: 'rgba(56,139,253,.08)', border: '1px solid rgba(56,139,253,.2)', borderRadius: '8px', padding: '14px 16px' },
  infoTitle: { fontSize: '13px', fontWeight: '600', color: '#58a6ff', marginBottom: '8px' },
  infoItem:  { fontSize: '12px', color: '#8b949e', marginBottom: '4px' },
  toast:   { position: 'fixed', top: '20px', right: '20px', padding: '12px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: '500', zIndex: 9999 },
}

export default function Integrations() {
  const [webhookUrl, setWebhookUrl]   = useState('')
  const [apiKey, setApiKey]           = useState('')
  const [enabled, setEnabled]         = useState(false)
  const [showKey, setShowKey]         = useState(false)
  const [saving, setSaving]           = useState(false)
  const [testing, setTesting]         = useState(false)
  const [toast, setToast]             = useState(null)

  useEffect(() => {
    api.get('/crm-integration/settings').then(r => {
      setWebhookUrl(r.data.webhook_url || '')
      setApiKey(r.data.api_key || '')
      setEnabled(r.data.enabled || false)
    }).catch(() => {})
  }, [])

  function showToast(msg, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleSave() {
    if (!webhookUrl) { showToast('Webhook URL is required', false); return }
    setSaving(true)
    try {
      await api.post('/crm-integration/settings', { webhook_url: webhookUrl, api_key: apiKey, enabled })
      showToast('Settings saved successfully')
    } catch {
      showToast('Failed to save settings', false)
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    if (!webhookUrl) { showToast('Save a webhook URL first', false); return }
    setTesting(true)
    try {
      const { data } = await api.post('/crm-integration/test')
      if (data.success) {
        showToast(`Test delivered — ${data.status_code} in ${data.response_time_ms}ms`)
      } else {
        showToast(`Test failed — ${data.error || `HTTP ${data.status_code}`}`, false)
      }
    } catch {
      showToast('Test request failed', false)
    } finally {
      setTesting(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Remove CRM integration settings?')) return
    try {
      await api.delete('/crm-integration/settings')
      setWebhookUrl(''); setApiKey(''); setEnabled(false)
      showToast('Settings removed')
    } catch {
      showToast('Failed to remove settings', false)
    }
  }

  return (
    <div style={S.page}>
      {toast && (
        <div style={{ ...S.toast, background: toast.ok ? '#1a2e1a' : '#2e1a1a', color: toast.ok ? '#3fb950' : '#f85149', border: `1px solid ${toast.ok ? '#3fb950' : '#f85149'}` }}>
          {toast.ok ? '✓' : '✕'} {toast.msg}
        </div>
      )}

      <div style={S.heading}>Integrations</div>
      <div style={S.sub}>Connect your WhatsApp CRM to external systems via webhooks.</div>

      {/* Webhook card */}
      <div style={S.card}>
        <div style={S.cardTitle}>External CRM Webhook</div>
        <div style={S.cardSub}>Push real-time events (messages, contacts, leads) to your external CRM.</div>

        {/* Enable toggle */}
        <div style={{ ...S.row, marginBottom: '20px' }}>
          <label style={S.toggle}>
            <input
              type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span style={{
              position: 'absolute', inset: 0, borderRadius: '24px', transition: '.2s',
              background: enabled ? '#388bfd' : '#30363d',
            }} />
            <span style={{
              position: 'absolute', left: enabled ? '22px' : '2px', top: '2px',
              width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: '.2s',
            }} />
          </label>
          <span style={S.toggleLabel}>{enabled ? 'Enabled' : 'Disabled'}</span>
        </div>

        {/* Webhook URL */}
        <div style={{ marginBottom: '16px' }}>
          <label style={S.label}>Webhook URL</label>
          <input
            style={S.input} type="url" placeholder="https://your-crm.com/webhook"
            value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
          />
        </div>

        {/* API Key */}
        <div style={{ marginBottom: '24px' }}>
          <label style={S.label}>API Key (optional)</label>
          <div style={{ position: 'relative' }}>
            <input
              style={{ ...S.input, paddingRight: '70px' }}
              type={showKey ? 'text' : 'password'}
              placeholder="Sent as X-API-Key header"
              value={apiKey} onChange={e => setApiKey(e.target.value)}
            />
            <button
              onClick={() => setShowKey(v => !v)}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6e7681', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit' }}>
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div style={{ ...S.row, flexWrap: 'wrap', gap: '10px' }}>
          <button style={S.btn} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          <button style={S.btnGhost} onClick={handleTest} disabled={testing}>
            {testing ? 'Sending…' : 'Send Test'}
          </button>
          <button style={S.btnDanger} onClick={handleDelete}>Remove</button>
        </div>
      </div>

      {/* Instructions */}
      <div style={S.card}>
        <div style={S.cardTitle}>Events Sent</div>
        <div style={{ marginTop: '12px' }}>
          {[
            ['message.received', 'New inbound WhatsApp message'],
            ['contact.created',  'New contact added via CRM'],
            ['lead.imported',    'Facebook lead imported to contacts'],
            ['test',             'Manual test from this page'],
          ].map(([event, desc]) => (
            <div key={event} style={{ display: 'flex', gap: '12px', marginBottom: '10px', alignItems: 'flex-start' }}>
              <code style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: '5px', padding: '2px 8px', fontSize: '11px', color: '#58a6ff', flexShrink: 0 }}>{event}</code>
              <span style={{ fontSize: '13px', color: '#8b949e' }}>{desc}</span>
            </div>
          ))}
        </div>

        <div style={{ ...S.infoBox, marginTop: '16px' }}>
          <div style={S.infoTitle}>Payload structure</div>
          <pre style={{ margin: 0, fontSize: '12px', color: '#8b949e', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{`{
  "event": "message.received",
  "timestamp": "2024-01-01T00:00:00Z",
  "tenant_id": "...",
  "whatsapp_number": "+91...",
  "data": { ... }
}`}</pre>
        </div>
      </div>
    </div>
  )
}
