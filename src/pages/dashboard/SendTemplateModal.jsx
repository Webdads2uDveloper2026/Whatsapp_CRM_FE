/**
 * SendTemplateModal.jsx
 * 
 * Drop this in: src/pages/dashboard/SendTemplateModal.jsx
 * 
 * Import in Inbox.jsx:
 *   import SendTemplateModal from './SendTemplateModal'
 * 
 * Usage in Inbox.jsx:
 *   {showTplModal && (
 *     <SendTemplateModal
 *       onClose={() => setShowTplModal(false)}
 *       onSend={handleSendTemplate}
 *     />
 *   )}
 * 
 * handleSendTemplate receives:
 *   { template_name, language, header_type, header_link, header_media_id,
 *     header_filename, body_variables, buttons }
 */
import { useState, useEffect, useMemo } from 'react'
import api from '../../services/api'

/**
 * Media-header templates need real media attached on EVERY send — Meta approves
 * the header's shape, not its content. The `example.header_handle` URL on an
 * approved template is a signed, expiring preview asset that only an
 * authenticated session can load, so it is useless both here and at send time
 * (Meta's fetcher gets 403 → message fails with error 131053).
 *
 * The media the recipient actually receives is the copy the backend keeps for
 * the template; `has_header_media` reports whether that copy exists.
 */

export default function SendTemplateModal({ onClose, onSend }) {
  const [templates,  setTemplates]  = useState([])
  const [selected,   setSelected]   = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [sending,    setSending]    = useState(false)
  const [error,      setError]      = useState('')

  // Runtime values the user fills in
  const [variables,  setVariables]  = useState({})   // { "first_name": "", "1": "" }
  const [search,     setSearch]     = useState('')
  const [uploading,  setUploading]  = useState(false)
  const [localPrev,  setLocalPrev]  = useState('')   // object URL of a just-uploaded file

  useEffect(() => {
    api.get('/templates/local')
      .then(r => setTemplates((r.data.templates || []).filter(t => t.status === 'APPROVED')))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Extract variable names from template body
  const bodyVars = useMemo(() => {
    if (!selected) return []
    const body = selected.components?.find(c => c.type === 'BODY')
    if (!body?.text) return []
    const matches = [...new Set((body.text.match(/\{\{(\w+)\}\}/g) || []).map(m => m.replace(/[{}]/g, '')))]
    return matches
  }, [selected])

  const headerComp = selected?.components?.find(c => c.type === 'HEADER')
  const headerFmt  = headerComp?.format?.toLowerCase() || 'none'
  const hasMedia   = ['image', 'video', 'document'].includes(headerFmt)
  const hasText    = headerFmt === 'text'
  const hasVars    = bodyVars.length > 0

  // Whether the backend holds a sendable copy of this template's header media.
  const hasStoredMedia = !!selected?.has_header_media

  // Not gated on stored media: when none is stored the backend first tries to
  // adopt the template's approved asset, and only fails the send with a clear
  // error if that doesn't work. Blocking here would stop sends that succeed.
  const canSend = selected && (!hasVars || bodyVars.every(v => variables[v]?.trim()))

  const handleSelect = tpl => {
    setSelected(tpl)
    setVariables({})
    setError('')
    setLocalPrev('')
  }

  const handleHeaderUpload = async file => {
    if (!file || !selected) return
    setUploading(true); setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.post(`/templates/${selected.name}/header-media`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setLocalPrev(URL.createObjectURL(file))
      const updated = { ...selected, has_header_media: true }
      setSelected(updated)
      setTemplates(ts => ts.map(t => (t.id === updated.id ? updated : t)))
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Upload failed')
    }
    setUploading(false)
  }

  const handleSend = async () => {
    if (!canSend) return
    setSending(true); setError('')
    try {
      // Build ordered variables — bodyVars is already in template body order
      // Use Object.fromEntries to preserve order when sending to backend
      const orderedVars = {}
      bodyVars.forEach(v => { if (variables[v]) orderedVars[v] = variables[v] })

      const payload = {
        msg_type:        'template',
        template_name:   selected.name,
        language:        selected.language || 'en_US',
        header_type:     headerFmt,
        // Media header: leave both blank — the backend attaches its stored copy
        // of the header media. Never pass example.header_handle here; Meta
        // cannot fetch it and the message fails asynchronously with 131053.
        header_media_id: '',
        header_link:     '',
        body_variables:  hasVars ? orderedVars : {},
        buttons:         [],
      }
      await onSend(payload)
      onClose()
    } catch (e) {
      setError(e.response?.data?.detail || e.message || 'Send failed')
    }
    setSending(false)
  }

  const filtered = templates.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase())
  )

  // ── Preview phone ─────────────────────────────────────────────────────────
  const PreviewPhone = () => {
    if (!selected) return null
    const body = selected.components?.find(c => c.type === 'BODY')
    const footer = selected.components?.find(c => c.type === 'FOOTER')
    const buttons = selected.components?.find(c => c.type === 'BUTTONS')
    const btns = buttons?.buttons || []

    const previewText = (body?.text || '').replace(/\{\{(\w+)\}\}/g, (_, k) =>
      variables[k] || '[' + k + ']'
    )

    return (
      <div className="flex flex-col items-center gap-2 select-none">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Preview</p>
        <div className="bg-[#0d0d0d] rounded-[38px] p-2 shadow-2xl border-4 border-[#1a1a1a] w-[200px]">
          <div className="bg-[#ece5dd] rounded-[30px] overflow-hidden">
            <div className="bg-[#075E54] px-3 pt-5 pb-2 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center font-bold text-white text-[10px]">W</div>
              <p className="text-white text-[9px] font-bold">WhatsApp Business</p>
            </div>
            <div className="p-2.5 min-h-[160px]">
              <div className="flex justify-center mb-2">
                <span className="text-[8px] text-slate-500 bg-black/10 px-2 py-0.5 rounded-full">Today</span>
              </div>
              <div className="bg-white rounded-2xl rounded-tl-sm shadow overflow-hidden max-w-[95%]">
                {/* Header */}
                {hasText && headerComp?.text && (
                  <div className="px-2.5 pt-2 pb-0.5 text-[10px] font-bold text-slate-800">{headerComp.text}</div>
                )}
                {hasMedia && (
                  localPrev && headerFmt === 'image' ? (
                    <img src={localPrev} alt="header" className="w-full h-16 object-cover"/>
                  ) : localPrev && headerFmt === 'video' ? (
                    <video src={localPrev} muted playsInline className="w-full h-16 object-cover bg-black"/>
                  ) : (
                    <div className="w-full h-16 bg-slate-200 flex items-center justify-center">
                      <span className="text-xl opacity-50">
                        {headerFmt === 'image' ? '🖼️' : headerFmt === 'video' ? '🎥' : '📄'}
                      </span>
                    </div>
                  )
                )}
                {/* Body */}
                <div className="px-2.5 py-2">
                  <p className="text-[10px] text-slate-800 whitespace-pre-wrap leading-relaxed min-h-[14px]">
                    {previewText || <span className="text-slate-300 italic text-[9px]">Body text…</span>}
                  </p>
                </div>
                {/* Footer */}
                {footer && <p className="px-2.5 pb-1 text-[8px] text-slate-400">{footer.text}</p>}
                <div className="flex justify-end px-2.5 pb-1.5">
                  <span className="text-[7px] text-slate-400">10:30 ✓✓</span>
                </div>
                {/* Buttons */}
                {btns.length > 0 && (
                  <div className="border-t border-slate-100">
                    {btns.slice(0, 3).map((b, i) => (
                      <div key={i} className={`text-center py-1.5 text-[9px] font-semibold text-[#075E54] ${i > 0 ? 'border-t border-slate-100' : ''}`}>
                        {b.type === 'URL' ? '🔗 ' : b.type === 'PHONE_NUMBER' ? '📞 ' : '↩ '}{b.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Send Template</h2>
            <p className="text-xs text-slate-400 mt-0.5">{templates.length} approved templates available</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl text-xl">×</button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Left — template list */}
          <div className="w-56 border-r border-slate-100 flex flex-col shrink-0">
            <div className="p-3 border-b border-slate-100">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search templates…"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-blue-400"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading && [...Array(4)].map((_, i) => (
                <div key={i} className="p-3 border-b border-slate-50">
                  <div className="h-3 bg-slate-100 rounded animate-pulse w-3/4 mb-1.5"/>
                  <div className="h-2.5 bg-slate-100 rounded animate-pulse w-1/2"/>
                </div>
              ))}
              {!loading && filtered.length === 0 && (
                <div className="p-6 text-center text-slate-400">
                  <p className="text-sm">No approved templates</p>
                  <p className="text-xs mt-1">Sync templates first</p>
                </div>
              )}
              {!loading && filtered.map(t => {
                const body = t.components?.find(c => c.type === 'BODY')
                const vars = (body?.text?.match(/\{\{(\w+)\}\}/g) || []).length
                const hdr  = t.components?.find(c => c.type === 'HEADER')
                const hfmt = hdr?.format || ''
                return (
                  <button
                    key={t.id}
                    onClick={() => handleSelect(t)}
                    className={'w-full text-left p-3 border-b border-slate-50 transition-colors ' +
                      (selected?.id === t.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-slate-50')}
                  >
                    <p className="text-xs font-semibold text-slate-800 truncate font-mono">{t.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {hfmt && hfmt !== 'TEXT' && <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{hfmt}</span>}
                      {vars > 0 && <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{vars} var{vars !== 1 ? 's' : ''}</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right — variable inputs + preview */}
          <div className="flex-1 overflow-y-auto p-5">
            {!selected ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                <span className="text-4xl opacity-30">📋</span>
                <p className="text-sm font-medium">Select a template</p>
                <p className="text-xs">Choose from the list on the left</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Selected</p>
                    <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
                      <span className="text-sm font-mono font-semibold text-blue-800">{selected.name}</span>
                      <span className="text-xs text-blue-500">{selected.language}</span>
                    </div>
                  </div>

                  {/* Body preview */}
                  {(() => {
                    const body = selected.components?.find(c => c.type === 'BODY')
                    return body?.text ? (
                      <div>
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Body</p>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-600 whitespace-pre-wrap">
                          {body.text}
                        </div>
                      </div>
                    ) : null
                  })()}

                  {/* Media header — fixed by the template, not customisable (like WATI) */}
                  {hasMedia && (
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                        {headerFmt.charAt(0).toUpperCase() + headerFmt.slice(1)} header
                      </label>
                      {hasStoredMedia ? (
                        <div className="border border-emerald-200 bg-emerald-50 rounded-xl overflow-hidden">
                          {localPrev && headerFmt === 'image' && (
                            <img src={localPrev} alt="template header" className="w-full max-h-44 object-contain bg-slate-50"/>
                          )}
                          {localPrev && headerFmt === 'video' && (
                            <video src={localPrev} controls className="w-full max-h-44 bg-black"/>
                          )}
                          <p className="text-[11px] text-emerald-700 px-3 py-2">
                            ✅ {headerFmt.charAt(0).toUpperCase() + headerFmt.slice(1)} stored — attached automatically on every send.
                          </p>
                          <label className="block px-3 pb-2 text-[10px] text-emerald-600 underline cursor-pointer">
                            Replace {headerFmt}
                            <input
                              type="file"
                              className="hidden"
                              disabled={uploading}
                              accept={headerFmt === 'image' ? 'image/*' : headerFmt === 'video' ? 'video/*' : undefined}
                              onChange={e => handleHeaderUpload(e.target.files?.[0])}
                            />
                          </label>
                        </div>
                      ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                          <p className="text-[11px] text-amber-700">
                            No {headerFmt} stored yet. WhatsApp requires the {headerFmt} to be attached on every
                            send — on first send we'll try to adopt the template's approved {headerFmt}
                            automatically. Upload one here if that fails, or to use a different {headerFmt}.
                            Either way the template is unchanged and needs no re-approval.
                          </p>
                          <label className={'inline-block mt-2 px-3 py-1.5 text-[11px] font-semibold rounded-lg cursor-pointer ' +
                            (uploading ? 'bg-slate-200 text-slate-400' : 'bg-amber-600 text-white hover:bg-amber-700')}>
                            {uploading ? 'Uploading…' : `Upload ${headerFmt}`}
                            <input
                              type="file"
                              className="hidden"
                              disabled={uploading}
                              accept={headerFmt === 'image' ? 'image/*' : headerFmt === 'video' ? 'video/*' : undefined}
                              onChange={e => handleHeaderUpload(e.target.files?.[0])}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Body variables */}
                  {hasVars && (
                    <div>
                      <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
                        Variable Values <span className="text-red-400">*</span>
                      </p>
                      <div className="space-y-2">
                        {bodyVars.map(v => (
                          <div key={v} className="flex items-center gap-3">
                            <code className="text-[11px] bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-lg font-mono shrink-0 min-w-[70px] text-center">
                              {'{{'}{v}{'}}'}
                            </code>
                            <input
                              value={variables[v] || ''}
                              onChange={e => setVariables(p => ({ ...p, [v]: e.target.value }))}
                              placeholder={`Value for ${v}`}
                              className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 placeholder-slate-400"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No variables needed */}
                  {!hasVars && !hasMedia && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                      <p className="text-xs text-emerald-700 font-medium">✅ No variables needed — ready to send</p>
                    </div>
                  )}

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                      <p className="text-xs text-red-600">⚠ {error}</p>
                    </div>
                  )}
                </div>

                {/* Preview */}
                <div className="flex justify-center lg:justify-start lg:pt-6">
                  <PreviewPhone />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/60">
          <p className="text-xs text-slate-400">
            {!selected ? 'Choose a template'
              : hasVars ? `${bodyVars.filter(v => variables[v]?.trim()).length}/${bodyVars.length} variables filled`
              :           'Ready to send'}
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-100">
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={!canSend || sending}
              className={'px-6 py-2.5 text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 ' +
                (canSend && !sending ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed')}
            >
              {sending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity=".3"/>
                    <path d="M22 12A10 10 0 0012 2" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  Sending…
                </>
              ) : '📋 Send Template'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}