/**
 * SendFlowModal.jsx — Picker modal to send a published WhatsApp Flow
 * to a contact from the Inbox.
 */
import { useState } from 'react'

const uid = () => Math.random().toString(36).slice(2, 9)

// ── Field helpers ──────────────────────────────────────────────────────────────
function Field({ label, hint, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>
        {label}
      </label>
      {children}
      {hint && <p style={{ fontSize: 10, color: '#6e7681', marginTop: 4 }}>{hint}</p>}
    </div>
  )
}

const inputStyle = {
  width: '100%', background: '#1e293b', border: '1px solid #334155',
  color: '#e2e8f0', fontSize: 13, borderRadius: 10, padding: '8px 12px',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  transition: 'border-color .15s',
}

export default function SendFlowModal({ onClose, onSend, flows = [] }) {
  const publishedFlows = flows.filter(f => f.status === 'PUBLISHED')

  const [step, setStep]           = useState('pick')   // 'pick' | 'compose'
  const [selectedFlow, setSelectedFlow] = useState(null)
  const [form, setForm] = useState({
    flow_id:     '',
    flow_cta:    'Open',
    flow_header: '',
    flow_body:   'Tap the button below to get started.',
    flow_footer: '',
    flow_screen: '',
  })
  const [sending, setSending] = useState(false)
  const [error, setError]     = useState('')

  const set = key => e => setForm(p => ({ ...p, [key]: e.target.value }))

  // Pick a flow from the list → pre-fill form
  const pickFlow = (flow) => {
    setSelectedFlow(flow)
    setForm(p => ({
      ...p,
      flow_id:     flow.meta_flow_id || flow.id || '',
      flow_screen: flow.screens?.[0]?.id || '',
    }))
    setStep('compose')
  }

  const handleSend = async () => {
    setError('')
    if (!form.flow_id.trim()) { setError('Meta Flow ID is required'); return }
    if (!form.flow_body.trim()) { setError('Body text is required'); return }
    setSending(true)
    try {
      await onSend({
        msg_type:    'flow',
        flow_id:     form.flow_id.trim(),
        flow_cta:    form.flow_cta.trim()    || 'Open',
        flow_header: form.flow_header.trim(),
        flow_body:   form.flow_body.trim(),
        flow_footer: form.flow_footer.trim(),
        flow_screen: form.flow_screen.trim(),
        flow_token:  uid(),
      })
      onClose()
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to send flow')
      setSending(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16, backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 20, width: '100%', maxWidth: 480, boxShadow: '0 25px 50px rgba(0,0,0,.5)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #21262d', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {step === 'compose' && (
              <button onClick={() => setStep('pick')} style={{ background: 'none', border: 'none', color: '#6e7681', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px 0 0' }}>‹</button>
            )}
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: '#e6edf3' }}>
                {step === 'pick' ? 'Send a Flow' : `Configure: ${selectedFlow?.name || 'Flow'}`}
              </h2>
              <p style={{ fontSize: 11, color: '#6e7681', marginTop: 2 }}>
                {step === 'pick' ? 'Choose a published flow to send' : 'Set the message that wraps the flow'}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6e7681', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>

          {/* ── STEP 1: Pick flow ── */}
          {step === 'pick' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {publishedFlows.length > 0 ? (
                publishedFlows.map(flow => (
                  <button
                    key={flow.id}
                    onClick={() => pickFlow(flow)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', borderRadius: 12,
                      background: 'rgba(255,255,255,.03)', border: '1px solid #21262d',
                      cursor: 'pointer', textAlign: 'left', transition: 'border-color .15s, background .15s', fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56,139,253,.08)'; e.currentTarget.style.borderColor = 'rgba(56,139,253,.3)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.03)'; e.currentTarget.style.borderColor = '#21262d' }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(56,139,253,.12)', border: '1px solid rgba(56,139,253,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                      🔀
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{flow.name}</p>
                      <p style={{ fontSize: 11, color: '#6e7681', marginTop: 2 }}>
                        {flow.category?.replace(/_/g, ' ')} · {flow.screens?.length || 0} screen{flow.screens?.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#3fb950', background: 'rgba(63,185,80,.12)', border: '1px solid rgba(63,185,80,.25)', padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>
                      PUBLISHED
                    </span>
                  </button>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#6e7681' }}>
                  <p style={{ fontSize: 28, opacity: .3 }}>🔀</p>
                  <p style={{ fontSize: 13, marginTop: 8 }}>No published flows found</p>
                  <p style={{ fontSize: 11, marginTop: 4, color: '#484f58' }}>Publish a flow first from the Flows page</p>
                </div>
              )}

              {/* Manual flow ID entry */}
              <div style={{ borderTop: '1px solid #21262d', paddingTop: 16, marginTop: 8 }}>
                <p style={{ fontSize: 11, color: '#6e7681', marginBottom: 10 }}>Or enter a Meta Flow ID manually:</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={form.flow_id}
                    onChange={set('flow_id')}
                    placeholder="e.g. 1234567890123456"
                    style={{ ...inputStyle, flex: 1 }}
                    onFocus={e => e.target.style.borderColor = '#388bfd'}
                    onBlur={e => e.target.style.borderColor = '#334155'}
                  />
                  <button
                    onClick={() => form.flow_id.trim() && setStep('compose')}
                    disabled={!form.flow_id.trim()}
                    style={{ padding: '8px 16px', background: '#388bfd', border: 'none', color: 'white', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: form.flow_id.trim() ? 1 : .4, fontFamily: 'inherit' }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Compose the wrapper message ── */}
          {step === 'compose' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Flow ID (read-only summary or editable if manually entered) */}
              <Field label="Meta Flow ID" hint="The numeric ID from Meta Business Manager or Graph API">
                <input
                  value={form.flow_id}
                  onChange={set('flow_id')}
                  style={inputStyle}
                  placeholder="e.g. 1234567890123456"
                  onFocus={e => e.target.style.borderColor = '#388bfd'}
                  onBlur={e => e.target.style.borderColor = '#334155'}
                />
              </Field>

              <Field label="Button text (CTA)" hint='Text on the button that opens the flow — e.g. "Start", "Fill Form"'>
                <input
                  value={form.flow_cta}
                  onChange={set('flow_cta')}
                  maxLength={20}
                  style={inputStyle}
                  placeholder="Open"
                  onFocus={e => e.target.style.borderColor = '#388bfd'}
                  onBlur={e => e.target.style.borderColor = '#334155'}
                />
              </Field>

              <Field label="Body text *" hint="Main message shown above the button (required)">
                <textarea
                  value={form.flow_body}
                  onChange={set('flow_body')}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                  placeholder="Tap the button below to get started."
                  onFocus={e => e.target.style.borderColor = '#388bfd'}
                  onBlur={e => e.target.style.borderColor = '#334155'}
                />
              </Field>

              <Field label="Header text" hint="Optional short heading shown above the body">
                <input
                  value={form.flow_header}
                  onChange={set('flow_header')}
                  maxLength={60}
                  style={inputStyle}
                  placeholder="e.g. Welcome!"
                  onFocus={e => e.target.style.borderColor = '#388bfd'}
                  onBlur={e => e.target.style.borderColor = '#334155'}
                />
              </Field>

              <Field label="Footer text" hint="Optional small text below the button">
                <input
                  value={form.flow_footer}
                  onChange={set('flow_footer')}
                  maxLength={60}
                  style={inputStyle}
                  placeholder="e.g. Powered by YourBrand"
                  onFocus={e => e.target.style.borderColor = '#388bfd'}
                  onBlur={e => e.target.style.borderColor = '#334155'}
                />
              </Field>

              <Field label="First screen ID" hint="Optional — leave blank to use the flow's default entry screen">
                <input
                  value={form.flow_screen}
                  onChange={set('flow_screen')}
                  style={inputStyle}
                  placeholder="e.g. WELCOME (auto-detected if blank)"
                  onFocus={e => e.target.style.borderColor = '#388bfd'}
                  onBlur={e => e.target.style.borderColor = '#334155'}
                />
              </Field>

              {/* Preview card */}
              <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 12, padding: '12px 14px' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#484f58', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Preview</p>
                <div style={{ background: '#e9f5fe', borderRadius: 10, padding: '10px 12px', maxWidth: 260 }}>
                  {form.flow_header && <p style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>{form.flow_header}</p>}
                  <p style={{ fontSize: 12, color: '#111', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{form.flow_body || '…'}</p>
                  {form.flow_footer && <p style={{ fontSize: 10, color: '#777', marginTop: 6 }}>{form.flow_footer}</p>}
                  <div style={{ marginTop: 8, borderTop: '1px solid #cde5f7', paddingTop: 8 }}>
                    <div style={{ background: '#fff', border: '1px solid #25D366', borderRadius: 8, padding: '6px 10px', textAlign: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#25D366' }}>🔀 {form.flow_cta || 'Open'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <p style={{ fontSize: 12, color: '#f85149', background: 'rgba(248,81,73,.08)', border: '1px solid rgba(248,81,73,.2)', borderRadius: 8, padding: '8px 12px' }}>
                  ⚠ {error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        {step === 'compose' && (
          <div style={{ padding: '14px 22px', borderTop: '1px solid #21262d', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
            <button onClick={onClose}
              style={{ padding: '9px 18px', background: 'transparent', border: '1px solid #30363d', color: '#8b949e', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button onClick={handleSend} disabled={sending || !form.flow_id.trim() || !form.flow_body.trim()}
              style={{
                padding: '9px 20px', border: 'none', color: 'white', borderRadius: 10, fontSize: 13, fontWeight: 700,
                cursor: (sending || !form.flow_id.trim() || !form.flow_body.trim()) ? 'not-allowed' : 'pointer',
                background: (sending || !form.flow_id.trim() || !form.flow_body.trim()) ? '#21262d' : 'linear-gradient(135deg,#22c55e,#0d9488)',
                display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
                opacity: (!form.flow_id.trim() || !form.flow_body.trim()) ? .5 : 1,
              }}>
              {sending ? (
                <>
                  <svg style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity=".3"/>
                    <path d="M22 12A10 10 0 0012 2" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  Sending…
                </>
              ) : '🚀 Send Flow'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
