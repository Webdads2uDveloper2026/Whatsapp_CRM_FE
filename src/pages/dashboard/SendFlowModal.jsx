/**
 * SendFlowModal.jsx — Picker modal to send a published WhatsApp Flow
 * to a contact from the Inbox. Supports text, image, video, and document
 * headers — each accepting either a CDN URL or a direct file upload.
 */
import { useState, useRef } from 'react'
import api from '../../services/api'

const uid = () => { const c='abcdefghijklmnopqrstuvwxyz'; let r=''; for(let i=0;i<8;i++) r+=c[Math.floor(Math.random()*26)]; return r }

// ── Shared styles ──────────────────────────────────────────────────────────────
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

const HEADER_TYPES = [
  { value: 'none',     label: 'None',     icon: '—' },
  { value: 'text',     label: 'Text',     icon: 'T' },
  { value: 'image',    label: 'Image',    icon: '🖼' },
  { value: 'video',    label: 'Video',    icon: '🎬' },
  { value: 'document', label: 'Document', icon: '📄' },
]

// MIME types accepted per header type
const ACCEPT = {
  image:    'image/jpeg,image/png,image/webp',
  video:    'video/mp4,video/3gpp',
  document: 'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv',
}

// ── Media header sub-component ─────────────────────────────────────────────────
function MediaHeaderInput({ type, value, onChange, onUploaded }) {
  const fileRef      = useRef(null)
  const [mode, setMode]         = useState('url')   // 'url' | 'upload'
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState('')
  const [uploadedName, setUploadedName] = useState('')

  const handleFile = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadErr('')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', type)
      const res = await api.post('/media/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setUploadedName(file.name)
      onUploaded(res.data.id)
    } catch (err) {
      setUploadErr(err?.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 6 }}>
        {['url', 'upload'].map(m => (
          <button key={m} onClick={() => { setMode(m); onChange(''); setUploadedName('') }}
            style={{
              padding: '5px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: 'none',
              background: mode === m ? '#388bfd' : '#1e293b',
              color:      mode === m ? '#fff'    : '#8b949e',
            }}>
            {m === 'url' ? '🔗 CDN URL' : '⬆ Upload File'}
          </button>
        ))}
      </div>

      {mode === 'url' ? (
        <input
          value={value}
          onChange={e => { onChange(e.target.value); setUploadedName('') }}
          placeholder={`https://example.com/file.${type === 'image' ? 'jpg' : type === 'video' ? 'mp4' : 'pdf'}`}
          style={inputStyle}
          onFocus={e => e.target.style.borderColor = '#388bfd'}
          onBlur={e => e.target.style.borderColor = '#334155'}
        />
      ) : (
        <div>
          <input ref={fileRef} type="file" accept={ACCEPT[type]} style={{ display: 'none' }} onChange={handleFile} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              width: '100%', padding: '9px 14px', background: '#1e293b', border: '1px dashed #334155',
              color: uploading ? '#6e7681' : '#8b949e', borderRadius: 10, fontSize: 12, cursor: uploading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            {uploading ? (
              <>
                <svg style={{ width: 14, height: 14, animation: 'spin 1s linear infinite', flexShrink: 0 }} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity=".3"/>
                  <path d="M22 12A10 10 0 0012 2" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                </svg>
                Uploading…
              </>
            ) : uploadedName ? (
              <><span style={{ color: '#3fb950' }}>✓</span> {uploadedName}</>
            ) : (
              `Choose ${type} file`
            )}
          </button>
          {uploadErr && (
            <p style={{ fontSize: 11, color: '#f85149', marginTop: 4 }}>⚠ {uploadErr}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main modal ─────────────────────────────────────────────────────────────────
export default function SendFlowModal({ onClose, onSend, flows = [] }) {
  const publishedFlows = flows.filter(f => f.status === 'PUBLISHED')

  const [step, setStep]               = useState('pick')   // 'pick' | 'compose'
  const [selectedFlow, setSelectedFlow] = useState(null)
  const [form, setForm] = useState({
    flow_id:              '',
    flow_cta:             'Open',
    flow_header_type:     'none',   // none | text | image | video | document
    flow_header:          '',       // text content when type=text
    flow_header_link:     '',       // CDN URL when type=image/video/document + url mode
    flow_header_media_id: '',       // Meta media_id when uploaded
    flow_body:            'Tap the button below to get started.',
    flow_footer:          '',
    flow_screen:          '',
  })
  const [sending, setSending] = useState(false)
  const [error, setError]     = useState('')

  const set = key => e => setForm(p => ({ ...p, [key]: e.target.value }))

  const pickFlow = flow => {
    if (!flow.meta_flow_id) {
      setError('This flow has no Meta flow ID — publish it on Meta first before sending.')
      return
    }
    setSelectedFlow(flow)
    setForm(p => ({ ...p, flow_id: flow.meta_flow_id, flow_screen: flow.screens?.[0]?.id || '' }))
    setStep('compose')
  }

  const handleSend = async () => {
    setError('')
    if (!form.flow_id.trim())   { setError('Meta Flow ID is required'); return }
    if (!/^\d+$/.test(form.flow_id.trim())) { setError('Invalid Meta Flow ID — must be a numeric ID.'); return }
    if (!form.flow_body.trim()) { setError('Body text is required'); return }

    const ht = form.flow_header_type
    if (ht === 'text' && !form.flow_header.trim())            { setError('Header text is required when header type is Text'); return }
    if (['image','video','document'].includes(ht) && !form.flow_header_media_id && !form.flow_header_link.trim()) {
      setError(`Please upload a ${ht} or enter a CDN URL for the header`); return
    }

    setSending(true)
    try {
      await onSend({
        msg_type:             'flow',
        flow_id:              form.flow_id.trim(),
        flow_cta:             form.flow_cta.trim()    || 'Open',
        flow_header_type:     ht === 'none' ? '' : ht,
        flow_header:          ht === 'text' ? form.flow_header.trim() : '',
        flow_header_media_id: form.flow_header_media_id,
        flow_header_link:     form.flow_header_link.trim(),
        flow_body:            form.flow_body.trim(),
        flow_footer:          form.flow_footer.trim(),
        flow_screen:          form.flow_screen.trim(),
        flow_token:           uid(),
      })
      onClose()
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to send flow')
      setSending(false)
    }
  }

  const headerTypeMeta = HEADER_TYPES.find(h => h.value === form.flow_header_type) || HEADER_TYPES[0]

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
                publishedFlows.map(flow => {
                  const hasMetaId = !!flow.meta_flow_id
                  return (
                    <button
                      key={flow.id}
                      onClick={() => pickFlow(flow)}
                      disabled={!hasMetaId}
                      title={hasMetaId ? '' : 'No Meta flow ID — republish this flow first'}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', borderRadius: 12,
                        background: 'rgba(255,255,255,.03)', border: '1px solid #21262d',
                        cursor: hasMetaId ? 'pointer' : 'not-allowed',
                        opacity: hasMetaId ? 1 : 0.45,
                        textAlign: 'left', transition: 'border-color .15s, background .15s', fontFamily: 'inherit',
                      }}
                      onMouseEnter={e => { if (hasMetaId) { e.currentTarget.style.background = 'rgba(56,139,253,.08)'; e.currentTarget.style.borderColor = 'rgba(56,139,253,.3)' } }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,.03)'; e.currentTarget.style.borderColor = '#21262d' }}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(56,139,253,.12)', border: '1px solid rgba(56,139,253,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                        🔀
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#e6edf3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{flow.name}</p>
                        <p style={{ fontSize: 11, color: '#6e7681', marginTop: 2 }}>
                          {flow.category?.replace(/_/g, ' ')} · {flow.screens?.length || 0} screen{flow.screens?.length !== 1 ? 's' : ''}
                          {!hasMetaId && ' · No Meta ID'}
                        </p>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#3fb950', background: 'rgba(63,185,80,.12)', border: '1px solid rgba(63,185,80,.25)', padding: '2px 8px', borderRadius: 20, flexShrink: 0 }}>
                        PUBLISHED
                      </span>
                    </button>
                  )
                })
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

              <Field label="Button text (CTA)" hint='Text on the button that opens the flow — max 20 chars'>
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

              {/* Header type pills */}
              <Field label="Header type" hint="Optional header shown above the body — pick None to skip">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {HEADER_TYPES.map(h => (
                    <button
                      key={h.value}
                      onClick={() => setForm(p => ({ ...p, flow_header_type: h.value, flow_header: '', flow_header_link: '', flow_header_media_id: '' }))}
                      style={{
                        padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit',
                        border: form.flow_header_type === h.value ? '1px solid #388bfd' : '1px solid #30363d',
                        background: form.flow_header_type === h.value ? 'rgba(56,139,253,.15)' : '#1e293b',
                        color: form.flow_header_type === h.value ? '#79c0ff' : '#8b949e',
                        transition: 'all .15s',
                      }}
                    >
                      {h.icon} {h.label}
                    </button>
                  ))}
                </div>
              </Field>

              {/* Header content inputs — conditional on type */}
              {form.flow_header_type === 'text' && (
                <Field label="Header text" hint="Short heading shown above the body — max 60 chars">
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
              )}

              {['image', 'video', 'document'].includes(form.flow_header_type) && (
                <Field
                  label={`Header ${headerTypeMeta.label}`}
                  hint="Upload from your device or paste a public CDN URL"
                >
                  <MediaHeaderInput
                    type={form.flow_header_type}
                    value={form.flow_header_link}
                    onChange={link => setForm(p => ({ ...p, flow_header_link: link, flow_header_media_id: '' }))}
                    onUploaded={id => setForm(p => ({ ...p, flow_header_media_id: id, flow_header_link: '' }))}
                  />
                  {form.flow_header_media_id && (
                    <p style={{ fontSize: 10, color: '#3fb950', marginTop: 4 }}>
                      ✓ Uploaded · Media ID: {form.flow_header_media_id}
                    </p>
                  )}
                </Field>
              )}

              <Field label="Footer text" hint="Optional small text below the button — max 60 chars">
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

              {form.flow_screen && (
                <div style={{ fontSize: 10, color: '#484f58', padding: '4px 0' }}>
                  Entry screen: <code style={{ color: '#6e7681' }}>{form.flow_screen}</code>
                  <span style={{ marginLeft: 6, color: '#3fb950' }}>→ auto-mapped to SCREEN_A</span>
                </div>
              )}

              {/* Preview card */}
              <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 12, padding: '12px 14px' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#484f58', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Preview</p>
                <div style={{ background: '#e9f5fe', borderRadius: 10, padding: '10px 12px', maxWidth: 260 }}>
                  {/* Media header preview */}
                  {['image', 'video', 'document'].includes(form.flow_header_type) && (
                    <div style={{
                      background: '#cde5f7', borderRadius: 8, padding: '12px', marginBottom: 6,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, color: '#555',
                    }}>
                      {form.flow_header_type === 'image' ? (
                        form.flow_header_media_id || form.flow_header_link
                          ? <img src={form.flow_header_link || ''} alt="" style={{ maxHeight: 80, maxWidth: '100%', borderRadius: 6, display: form.flow_header_link ? 'block' : 'none' }} onError={e => e.target.style.display='none'} />
                          : '🖼'
                      ) : form.flow_header_type === 'video' ? '🎬' : '📄'}
                      {(form.flow_header_media_id || (form.flow_header_type !== 'image')) && (
                        <span style={{ fontSize: 11, color: '#555', marginLeft: 6 }}>
                          {form.flow_header_media_id ? 'Uploaded' : form.flow_header_link ? 'CDN URL' : `No ${form.flow_header_type} yet`}
                        </span>
                      )}
                    </div>
                  )}
                  {form.flow_header_type === 'text' && form.flow_header && (
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>{form.flow_header}</p>
                  )}
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
            <button
              onClick={handleSend}
              disabled={sending || !form.flow_id.trim() || !form.flow_body.trim()}
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
