import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../../services/api'

// ─────────────────────────────────────────────────────────────────────────────
// Constants & config
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION']
const LANGUAGES  = [
  { code:'en_US', label:'English (US)' }, { code:'en_GB', label:'English (UK)' },
  { code:'hi',    label:'Hindi'        }, { code:'ta',    label:'Tamil'        },
  { code:'te',    label:'Telugu'       }, { code:'mr',    label:'Marathi'      },
  { code:'bn',    label:'Bengali'      }, { code:'gu',    label:'Gujarati'     },
  { code:'kn',    label:'Kannada'      }, { code:'ml',    label:'Malayalam'    },
  { code:'pa',    label:'Punjabi'      }, { code:'ur',    label:'Urdu'         },
  { code:'ar',    label:'Arabic'       }, { code:'es',    label:'Spanish'      },
  { code:'pt_BR', label:'Portuguese'   }, { code:'fr',    label:'French'       },
  { code:'de',    label:'German'       }, { code:'id',    label:'Indonesian'   },
  { code:'ja',    label:'Japanese'     }, { code:'ko',    label:'Korean'       },
]

const STATUS_CFG = {
  APPROVED: { cls:'bg-emerald-50 text-emerald-700 border-emerald-200', dot:'bg-emerald-500', label:'Approved'  },
  PENDING:  { cls:'bg-amber-50 text-amber-700 border-amber-200',       dot:'bg-amber-400 animate-pulse', label:'Pending'   },
  REJECTED: { cls:'bg-red-50 text-red-700 border-red-200',             dot:'bg-red-500',    label:'Rejected'  },
  PAUSED:   { cls:'bg-slate-100 text-slate-600 border-slate-200',      dot:'bg-slate-400',  label:'Paused'    },
}

const CAT_CFG = {
  MARKETING:      { cls:'bg-violet-50 text-violet-700 border-violet-200', icon:'📢' },
  UTILITY:        { cls:'bg-blue-50 text-blue-700 border-blue-200',       icon:'⚙️' },
  AUTHENTICATION: { cls:'bg-orange-50 text-orange-700 border-orange-200', icon:'🔐' },
}

const fmt = iso => iso ? new Date(iso).toLocaleDateString([],{day:'numeric',month:'short',year:'numeric'}) : '—'

// ─────────────────────────────────────────────────────────────────────────────
// Small re-usable atoms
// ─────────────────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUS_CFG[status] || STATUS_CFG.PENDING
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}/>{s.label}
    </span>
  )
}
function CatBadge({ category }) {
  const c = CAT_CFG[category] || CAT_CFG.UTILITY
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${c.cls}`}>
      {c.icon} {category}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp Mobile Preview — used in create wizard & detail view
// ─────────────────────────────────────────────────────────────────────────────
function WaPhone({ form = {} }) {
  const bodyRaw = form.body_text || ''
  const vars    = form.variables || {}
  // Replace {{name}} or {{1}} with sample values
  const body = bodyRaw.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    vars[k] || `[${k}]`
  )
  const hasHeader = form.header_type && form.header_type !== 'none'
  const buttons   = form.buttons || []

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      {/* phone frame */}
      <div className="relative w-[230px]">
        {/* bezel */}
        <div className="bg-[#0d0d0d] rounded-[42px] p-[10px] shadow-2xl border-4 border-[#1a1a1a]">
          {/* notch */}
          <div className="absolute top-[18px] left-1/2 -translate-x-1/2 w-16 h-5 bg-[#0d0d0d] rounded-full z-20"/>
          {/* screen */}
          <div className="bg-[#ece5dd] rounded-[34px] overflow-hidden">
            {/* WA top bar */}
            <div className="bg-[#075E54] px-3 pt-6 pb-2.5 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-white text-xs shrink-0">W</div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-[11px] font-semibold leading-tight truncate">WhatsApp Business</p>
                <p className="text-white/60 text-[9px]">online</p>
              </div>
              <div className="text-white/60 text-[10px]">📞 ⋮</div>
            </div>

            {/* chat area */}
            <div className="bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0iI2ZjZjNlNiIvPjwvc3ZnPg==')] p-3 min-h-[220px]">
              <div className="flex justify-center mb-3">
                <span className="text-[9px] text-slate-500 bg-black/10 px-3 py-0.5 rounded-full">Today</span>
              </div>

              {/* message bubble */}
              <div className="max-w-[88%] bg-white rounded-2xl rounded-tl-sm shadow overflow-hidden">

                {/* Header */}
                {hasHeader && (
                  <>
                    {form.header_type === 'text' && form.header_text && (
                      <div className="px-3 pt-2.5 pb-0.5">
                        <p className="text-[11px] font-bold text-slate-900">{form.header_text}</p>
                      </div>
                    )}
                    {form.header_type === 'image' && (
                      <div className="w-full h-28 bg-gradient-to-br from-slate-200 to-slate-300 flex flex-col items-center justify-center gap-1">
                        <span className="text-2xl opacity-60">🖼️</span>
                        <span className="text-[9px] text-slate-500">Image</span>
                      </div>
                    )}
                    {form.header_type === 'video' && (
                      <div className="w-full h-28 bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                        <span className="text-3xl text-white/70">▶</span>
                      </div>
                    )}
                    {form.header_type === 'document' && (
                      <div className="flex items-center gap-2.5 px-3 py-2 bg-blue-50 border-b border-blue-100">
                        <span className="text-xl">📄</span>
                        <span className="text-[9px] text-blue-700 font-medium truncate">
                          {form.header_doc_name || 'Document.pdf'}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {/* Body */}
                <div className="px-3 py-2">
                  <p className="text-[11px] text-slate-800 whitespace-pre-wrap leading-relaxed min-h-[18px]">
                    {body || <span className="text-slate-300 italic">Your message will appear here…</span>}
                  </p>
                </div>

                {/* Footer */}
                {form.footer_text && (
                  <div className="px-3 pb-1.5">
                    <p className="text-[9px] text-slate-400 leading-snug">{form.footer_text}</p>
                  </div>
                )}

                {/* Timestamp */}
                <div className="flex justify-end px-3 pb-2">
                  <span className="text-[8px] text-slate-400">10:30 AM ✓✓</span>
                </div>

                {/* Buttons */}
                {buttons.length > 0 && (
                  <div className="border-t border-slate-100">
                    {buttons.slice(0, 3).map((b, i) => (
                      <div key={i}
                        className={`flex items-center justify-center gap-1 py-2 text-[10px] font-semibold text-[#075E54] cursor-pointer hover:bg-slate-50 transition-colors
                          ${i > 0 ? 'border-t border-slate-100' : ''}`}>
                        {b.type === 'url'   && <span>🔗</span>}
                        {b.type === 'phone' && <span>📞</span>}
                        {b.type === 'reply' && <span>↩</span>}
                        <span>{b.text || b.label || 'Button'}</span>
                      </div>
                    ))}
                    {buttons.length > 3 && (
                      <div className="text-center py-1.5 text-[9px] text-slate-400 border-t border-slate-100">
                        +{buttons.length - 3} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-400 font-medium">Live Preview</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Template Detail Modal
// ─────────────────────────────────────────────────────────────────────────────
function DetailModal({ tpl, onClose, onDelete, onDuplicate }) {
  const bodyComp   = tpl.components?.find(c => c.type === 'BODY')
  const headerComp = tpl.components?.find(c => c.type === 'HEADER')
  const footerComp = tpl.components?.find(c => c.type === 'FOOTER')
  const btnsComp   = tpl.components?.find(c => c.type === 'BUTTONS')
  const btns       = btnsComp?.buttons || []

  // Build preview form
  const previewForm = {
    body_text:   bodyComp?.text   || '',
    footer_text: footerComp?.text || '',
    header_type: headerComp?.format?.toLowerCase() || 'none',
    header_text: headerComp?.format === 'TEXT' ? headerComp.text || '' : '',
    buttons:     btns.map(b => ({ type:(b.type||'reply').toLowerCase(), text:b.text||'' })),
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-base font-bold text-slate-900 font-mono">{tpl.name}</h2>
              <StatusBadge status={tpl.status}/>
              <CatBadge category={tpl.category}/>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Language: <span className="text-slate-600">{LANGUAGES.find(l=>l.code===tpl.language)?.label || tpl.language}</span>
              {' · '}Updated: <span className="text-slate-600">{fmt(tpl.created_at)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => { onDuplicate(tpl); onClose() }}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors">
              ⧉ Duplicate
            </button>
            {tpl.status !== 'APPROVED' && (
              <button onClick={() => { if(confirm(`Delete "${tpl.name}"?`)) { onDelete(tpl.name); onClose() } }}
                className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors">
                🗑 Delete
              </button>
            )}
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl text-xl leading-none transition-colors">×</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">

            {/* Left: Content */}
            <div className="p-6 space-y-5">

              {/* Rejection reason */}
              {tpl.status === 'REJECTED' && tpl.rejected_reason && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-red-700 mb-1">❌ Rejection Reason</p>
                  <p className="text-xs text-red-600">{tpl.rejected_reason}</p>
                </div>
              )}

              {/* Components */}
              <div className="space-y-4">
                {headerComp && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Header · {headerComp.format}</p>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700">
                      {headerComp.format === 'TEXT' ? headerComp.text : <span className="text-slate-400 flex items-center gap-2"><span className="text-xl">{headerComp.format==='IMAGE'?'🖼️':headerComp.format==='VIDEO'?'🎥':'📄'}</span> {headerComp.format} media</span>}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Body</p>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {bodyComp?.text || <span className="text-slate-400 italic">No body text</span>}
                  </div>
                </div>

                {footerComp && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Footer</p>
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-500">
                      {footerComp.text}
                    </div>
                  </div>
                )}

                {btns.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Buttons ({btns.length})</p>
                    <div className="space-y-2">
                      {btns.map((b, i) => (
                        <div key={i} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                          <span className="text-base">{b.type==='URL'?'🔗':b.type==='PHONE_NUMBER'?'📞':'↩'}</span>
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-slate-700">{b.text}</p>
                            {b.url && <p className="text-[10px] text-blue-500 truncate">{b.url}</p>}
                            {b.phone_number && <p className="text-[10px] text-slate-400 font-mono">{b.phone_number}</p>}
                          </div>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${b.type==='URL'?'bg-blue-100 text-blue-700':b.type==='PHONE_NUMBER'?'bg-emerald-100 text-emerald-700':'bg-slate-200 text-slate-600'}`}>
                            {b.type?.replace('_',' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                {[
                  { l:'Usage Count', v:tpl.usage_count ?? '—',   c:'text-blue-600' },
                  { l:'Quality',     v:tpl.quality_score ?? '—', c:'text-emerald-600' },
                  { l:'ID',          v:tpl.meta_id ? tpl.meta_id.slice(-6) : '—', c:'text-slate-600' },
                ].map(s => (
                  <div key={s.l} className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center">
                    <p className={`text-base font-bold ${s.c}`}>{s.v}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{s.l}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Preview */}
            <div className="p-6 flex items-center justify-center bg-slate-50/40">
              <WaPhone form={previewForm}/>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Create / Edit Template Wizard
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = ['Basic Info', 'Message Content', 'Buttons', 'Review & Submit']

function CreateWizard({ onClose, onCreated, prefill = null }) {
  const [step,   setStep]   = useState(0)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  // Header file upload state
  const [headerHandle,    setHeaderHandle]    = useState('')
  const [headerUploading, setHeaderUploading] = useState(false)
  const [headerFileName,  setHeaderFileName]  = useState('')

  const uploadHeaderFile = async (file) => {
    setHeaderUploading(true); setHeaderHandle(''); setHeaderFileName('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await api.post('/templates/upload-header', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setHeaderHandle(data.header_handle)
      setHeaderFileName(data.file_name)
    } catch (e) {
      alert('Upload failed: ' + (e.response?.data?.detail || e.message))
    }
    setHeaderUploading(false)
  }

  const [form, setForm] = useState({
    name:         prefill?.name ? `${prefill.name}_copy` : '',
    category:     prefill?.category  || 'MARKETING',
    language:     prefill?.language  || 'en_US',
    header_type:  'none',
    header_text:  '',
    header_media: '',
    header_doc_name: '',
    body_text:    prefill ? (prefill.components?.find(c=>c.type==='BODY')?.text||'') : '',
    footer_text:  prefill ? (prefill.components?.find(c=>c.type==='FOOTER')?.text||'') : '',
    variables:    {},
    buttons:      prefill ? ((prefill.components?.find(c=>c.type==='BUTTONS')?.buttons||[]).map(b=>({type:(b.type||'QUICK_REPLY').toUpperCase(),text:b.text||'',url:b.url||'',phone:b.phone_number||''}))) : [],
  })

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // Extract variable placeholders from body
  const bodyVars = useMemo(() => {
    const matches = form.body_text.match(/\{\{(\w+)\}\}/g) || []
    return [...new Set(matches.map(m => m.replace(/[{}]/g,'')))]
  }, [form.body_text])

  const canNext = [
    form.name.trim().length >= 2 && /^[a-z0-9_]+$/.test(form.name),
    form.body_text.trim().length >= 2,
    true,
    true,
  ][step]

  const buildComponents = () => {
    const comps = []

    if (form.header_type !== 'none') {
      const comp = { type: 'HEADER' }
      if (form.header_type === 'text') {
        comp.format = 'TEXT'
        comp.text   = form.header_text
      } else {
        comp.format = form.header_type.toUpperCase()
        if (headerHandle) {
          comp.example = { header_handle: [headerHandle] }
        }
        // If no handle yet (unlikely if UI enforces upload), skip example
      }
      comps.push(comp)
    }

    const bodyComp = { type: 'BODY', text: form.body_text }
    if (bodyVars.length > 0) {
      bodyComp.example = {
        body_text: [bodyVars.map(v => form.variables[v] || `Sample ${v}`)]
      }
    }
    comps.push(bodyComp)

    if (form.footer_text.trim()) {
      comps.push({ type: 'FOOTER', text: form.footer_text })
    }

    if (form.buttons.length > 0) {
      const buttons = form.buttons.map(b => {
        if (b.type === 'URL')          return { type:'URL',          text:b.text, url:b.url }
        if (b.type === 'PHONE_NUMBER') return { type:'PHONE_NUMBER', text:b.text, phone_number:b.phone }
        return { type:'QUICK_REPLY', text:b.text }
      })
      comps.push({ type: 'BUTTONS', buttons })
    }

    return comps
  }

  const submit = async () => {
    setSaving(true); setError('')
    try {
      await api.post('/templates', {
        name:       form.name,
        category:   form.category,
        language:   form.language,
        components: buildComponents(),
      })
      onCreated()
      onClose()
    } catch (e) {
      setError(e.response?.data?.detail || 'Submission failed. Check your template content.')
    }
    setSaving(false)
  }

  const previewForm = {
    body_text:       form.body_text,
    footer_text:     form.footer_text,
    header_type:     form.header_type,
    header_text:     form.header_text,
    header_doc_name: form.header_doc_name,
    variables:       form.variables,
    buttons:         form.buttons.map(b => ({ type:b.type.toLowerCase(), text:b.text })),
  }

  // Input styles
  const inp = "w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all placeholder-slate-400 font-[inherit]"
  const lbl = "block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide"

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-5xl my-8 shadow-2xl border border-slate-100">

        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">{prefill ? 'Duplicate Template' : 'Create Template'}</h2>
            <p className="text-xs text-slate-400 mt-0.5">Step {step+1} of {STEPS.length} — {STEPS[step]}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl text-xl leading-none">×</button>
        </div>

        {/* Step bar */}
        <div className="px-6 py-4 border-b border-slate-50 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-0">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0
                    ${i < step  ? 'bg-emerald-500 text-white shadow-sm' :
                      i === step ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' :
                                   'bg-slate-200 text-slate-500'}`}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span className={`text-[10px] font-semibold whitespace-nowrap hidden sm:block ${i===step?'text-blue-600':'text-slate-400'}`}>{s}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-2 mt-[-18px] sm:mt-[-24px] rounded-full transition-all ${i < step ? 'bg-emerald-400' : 'bg-slate-200'}`}/>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl flex items-start gap-2">
            <span className="shrink-0 mt-0.5">⚠️</span> {error}
          </div>
        )}

        {/* Content — split layout with preview always visible from step 1 */}
        <div className={`p-6 ${step >= 1 ? 'grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-8' : ''}`}>

          {/* ── Step 0: Basic Info ── */}
          {step === 0 && (
            <div className="max-w-xl space-y-5">
              <div>
                <label className={lbl}>Template Name <span className="text-red-400">*</span></label>
                <input value={form.name} onChange={e => set('name', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,''))}
                  placeholder="order_confirmation" className={inp}/>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Lowercase letters, numbers, underscores only. Min 2 characters.
                  {form.name && !/^[a-z0-9_]+$/.test(form.name) && <span className="text-red-500 ml-2">Invalid characters</span>}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Category <span className="text-red-400">*</span></label>
                  <div className="space-y-2">
                    {CATEGORIES.map(c => (
                      <label key={c} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                        ${form.category===c?'border-blue-500 bg-blue-50':'border-slate-200 hover:border-slate-300'}`}>
                        <input type="radio" name="cat" checked={form.category===c} onChange={()=>set('category',c)} className="accent-blue-600"/>
                        <div>
                          <p className="text-xs font-bold text-slate-700">{CAT_CFG[c].icon} {c}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={lbl}>Language <span className="text-red-400">*</span></label>
                  <select value={form.language} onChange={e=>set('language',e.target.value)}
                    className={`${inp} appearance-none cursor-pointer`}>
                    {LANGUAGES.map(l=><option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>

                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-xs font-bold text-amber-800 mb-2">📋 Meta review process</p>
                    <ul className="text-[11px] text-amber-700 space-y-1 list-disc list-inside">
                      <li>Templates are reviewed by Meta (usually 24h)</li>
                      <li>Marketing templates need business verification</li>
                      <li>Avoid prohibited content per WhatsApp policy</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 1: Message Content ── */}
          {step === 1 && (
            <>
              <div className="space-y-5">
                {/* Header */}
                <div>
                  <label className={lbl}>Header (optional)</label>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[
                      { v:'none',     icon:'—',  label:'None'     },
                      { v:'text',     icon:'T',  label:'Text'     },
                      { v:'image',    icon:'🖼', label:'Image'    },
                      { v:'document', icon:'📄', label:'Document' },
                    ].map(o => (
                      <button key={o.v} type="button" onClick={()=>set('header_type',o.v)}
                        className={`py-2 px-3 rounded-xl border-2 text-xs font-semibold transition-all
                          ${form.header_type===o.v?'border-blue-500 bg-blue-50 text-blue-700':'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                        <div className="text-sm mb-0.5">{o.icon}</div>
                        {o.label}
                      </button>
                    ))}
                  </div>

                  {form.header_type === 'text' && (
                    <input value={form.header_text} onChange={e=>set('header_text',e.target.value)}
                      placeholder="Bold header text (max 60 chars)" maxLength={60} className={inp}/>
                  )}
                  {['image','video','document'].includes(form.header_type) && (
                    <div className="space-y-3">
                      {/* File upload — backend does resumable upload to Meta */}
                      <label className="flex flex-col items-center gap-2 cursor-pointer border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-4 transition-colors bg-slate-50 hover:bg-blue-50">
                        <input type="file"
                          accept={form.header_type === 'image' ? 'image/*' : form.header_type === 'video' ? 'video/*' : 'application/pdf'}
                          className="hidden"
                          onChange={e => { if (e.target.files[0]) uploadHeaderFile(e.target.files[0]) }}
                        />
                        {headerUploading ? (
                          <div className="flex items-center gap-2 text-blue-600 text-sm">
                            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".2"/><path d="M22 12A10 10 0 0012 2" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
                            Uploading to Meta…
                          </div>
                        ) : headerHandle ? (
                          <div className="text-center">
                            <p className="text-emerald-600 text-sm font-semibold">✅ {headerFileName || 'File uploaded'}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Click to change</p>
                          </div>
                        ) : (
                          <div className="text-center">
                            <p className="text-2xl mb-1">{form.header_type === 'image' ? '🖼️' : form.header_type === 'video' ? '🎥' : '📄'}</p>
                            <p className="text-sm font-medium text-slate-600">Click to upload {form.header_type}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {form.header_type === 'image' ? 'JPG, PNG, WebP (max 5MB)' : form.header_type === 'video' ? 'MP4 (max 16MB)' : 'PDF (max 100MB)'}
                            </p>
                          </div>
                        )}
                      </label>
                      {!headerHandle && !headerUploading && (
                        <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          ⚠ Upload a sample {form.header_type} — Meta requires this for template approval
                        </p>
                      )}
                      {form.header_type === 'document' && (
                        <input value={form.header_doc_name} onChange={e=>set('header_doc_name',e.target.value)}
                          placeholder="Filename shown to recipients (e.g. invoice.pdf)" className={inp}/>
                      )}
                    </div>
                  )}
                </div>

                {/* Body */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={lbl.replace('mb-1.5','')}>Body <span className="text-red-400">*</span></label>
                    <div className="flex gap-1">
                      {[['*','bold'],['_','italic'],['~','strike']].map(([sym,tip]) => (
                        <button key={sym} type="button" title={`Add ${tip}`}
                          onClick={() => set('body_text', form.body_text + sym + sym)}
                          className="w-6 h-6 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded font-mono transition-colors">
                          {sym}
                        </button>
                      ))}
                      <button type="button" title="Add variable {{1}}"
                        onClick={() => {
                          const n = (bodyVars.length + 1)
                          set('body_text', form.body_text + `{{${n}}}`)
                        }}
                        className="px-2 h-6 bg-blue-100 hover:bg-blue-200 text-blue-700 text-[10px] font-bold rounded transition-colors">
                        {'+ {{var}}'}
                      </button>
                    </div>
                  </div>
                  <textarea rows={5} value={form.body_text} onChange={e=>set('body_text',e.target.value)}
                    placeholder="Hi {{1}}, your order {{2}} has been confirmed! Thank you for shopping with us. 🎉"
                    className={`${inp} resize-y min-h-[100px]`}
                    maxLength={1024}/>
                  <div className="flex justify-between mt-1">
                    <p className="text-[11px] text-slate-400">Use <code className="bg-slate-100 px-1 rounded">{'{{1}}'}</code> for positional or <code className="bg-slate-100 px-1 rounded">{'{{name}}'}</code> for named variables</p>
                    <p className="text-[11px] text-slate-400">{form.body_text.length}/1024</p>
                  </div>

                  {/* Variable examples */}
                  {bodyVars.length > 0 && (
                    <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-blue-700 mb-2 uppercase tracking-wide">Sample variable values (for Meta review)</p>
                      <div className="space-y-2">
                        {bodyVars.map(v => (
                          <div key={v} className="flex items-center gap-2">
                            <code className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-mono shrink-0">{`{{${v}}}`}</code>
                            <input value={form.variables[v]||''}
                              onChange={e => setForm(p=>({...p,variables:{...p.variables,[v]:e.target.value}}))}
                              placeholder={`Example value for ${v}`}
                              className="flex-1 bg-white border border-blue-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-blue-400 transition-colors"/>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div>
                  <label className={lbl}>Footer (optional)</label>
                  <input value={form.footer_text} onChange={e=>set('footer_text',e.target.value)}
                    placeholder="Not dispatched by WhatsApp. Reply STOP to opt out."
                    maxLength={60} className={inp}/>
                  <p className="text-[11px] text-slate-400 mt-1">Max 60 characters</p>
                </div>
              </div>

              {/* Preview */}
              <div className="flex justify-center lg:justify-start">
                <WaPhone form={previewForm}/>
              </div>
            </>
          )}

          {/* ── Step 2: Buttons ── */}
          {step === 2 && (
            <>
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Add Buttons</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Up to 3 buttons (mix of CTA and Quick Reply)</p>
                  </div>
                  {form.buttons.length < 3 && (
                    <div className="flex gap-2">
                      {[
                        { type:'QUICK_REPLY',   label:'Quick Reply', icon:'↩' },
                        { type:'URL',           label:'URL',         icon:'🔗' },
                        { type:'PHONE_NUMBER',  label:'Call',        icon:'📞' },
                      ].map(b => (
                        <button key={b.type} type="button"
                          onClick={() => setForm(p=>({...p,buttons:[...p.buttons,{type:b.type,text:'',url:'',phone:''}]}))}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-blue-400 text-slate-600 text-xs font-semibold rounded-lg transition-colors">
                          {b.icon} {b.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {form.buttons.length === 0 && (
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center">
                    <p className="text-3xl mb-3 opacity-30">🔘</p>
                    <p className="text-sm font-medium text-slate-500">No buttons yet</p>
                    <p className="text-xs text-slate-400 mt-1">Add Quick Reply or Call-to-Action buttons above</p>
                  </div>
                )}

                <div className="space-y-3">
                  {form.buttons.map((b, i) => (
                    <div key={i} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border
                            ${b.type==='URL'?'bg-blue-50 text-blue-700 border-blue-200':
                              b.type==='PHONE_NUMBER'?'bg-emerald-50 text-emerald-700 border-emerald-200':
                              'bg-slate-200 text-slate-600 border-slate-300'}`}>
                            {b.type==='URL'?'🔗 URL Button':b.type==='PHONE_NUMBER'?'📞 Call Button':'↩ Quick Reply'}
                          </span>
                          <span className="text-xs text-slate-400">Button {i + 1}</span>
                        </div>
                        <button onClick={() => setForm(p=>({...p,buttons:p.buttons.filter((_,j)=>j!==i)}))}
                          className="text-slate-400 hover:text-red-500 transition-colors text-lg leading-none">×</button>
                      </div>

                      <div className={`grid gap-3 ${b.type==='QUICK_REPLY'?'grid-cols-1':'grid-cols-1'}`}>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Button Label</label>
                          <input value={b.text} maxLength={25}
                            onChange={e=>setForm(p=>({...p,buttons:p.buttons.map((x,j)=>j===i?{...x,text:e.target.value}:x)}))}
                            placeholder="e.g. Track Order" className={inp}/>
                        </div>
                        {b.type === 'URL' && (
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">URL</label>
                            <input value={b.url}
                              onChange={e=>setForm(p=>({...p,buttons:p.buttons.map((x,j)=>j===i?{...x,url:e.target.value}:x)}))}
                              placeholder="https://example.com/track/{{1}}" className={inp}/>
                          </div>
                        )}
                        {b.type === 'PHONE_NUMBER' && (
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Phone Number</label>
                            <input value={b.phone}
                              onChange={e=>setForm(p=>({...p,buttons:p.buttons.map((x,j)=>j===i?{...x,phone:e.target.value}:x)}))}
                              placeholder="+91 9876543210" className={inp}/>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Button tips */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-slate-600 mb-2 uppercase tracking-wide">Button Rules</p>
                  <ul className="text-[11px] text-slate-500 space-y-1.5">
                    <li>✓ Max 3 buttons total per template</li>
                    <li>✓ Button text max 25 characters</li>
                    <li>✓ URL buttons can have dynamic suffix: <code className="bg-white px-1 rounded">{'{{1}}'}</code></li>
                    <li>✓ Max 2 URL buttons + 1 phone, or up to 3 Quick Replies</li>
                  </ul>
                </div>
              </div>

              {/* Preview */}
              <div className="flex justify-center lg:justify-start">
                <WaPhone form={previewForm}/>
              </div>
            </>
          )}

          {/* ── Step 3: Review ── */}
          {step === 3 && (
            <>
              <div className="space-y-5">
                <h3 className="text-sm font-bold text-slate-800">Review before submitting to Meta</h3>

                {[
                  { l:'Template name', v:<code className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{form.name}</code> },
                  { l:'Category',      v:<CatBadge category={form.category}/> },
                  { l:'Language',      v:LANGUAGES.find(l=>l.code===form.language)?.label },
                  { l:'Header',        v:form.header_type==='none'?<span className="text-slate-400">None</span>:`${form.header_type.charAt(0).toUpperCase()+form.header_type.slice(1)}` },
                  { l:'Buttons',       v:form.buttons.length > 0 ? `${form.buttons.length} button${form.buttons.length!==1?'s':''}` : <span className="text-slate-400">None</span> },
                  { l:'Variables',     v:bodyVars.length > 0 ? bodyVars.map(v=>`{{${v}}}`).join(', ') : <span className="text-slate-400">None</span> },
                ].map(r => (
                  <div key={r.l} className="flex items-center justify-between py-2.5 border-b border-slate-100">
                    <span className="text-sm text-slate-500">{r.l}</span>
                    <span className="text-sm font-semibold text-slate-800">{r.v}</span>
                  </div>
                ))}

                <div>
                  <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Body preview</p>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {form.body_text}
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-blue-800 mb-2">ℹ️ What happens next</p>
                  <ol className="text-[11px] text-blue-700 space-y-1 list-decimal list-inside">
                    <li>Template is submitted to Meta for review</li>
                    <li>Meta typically reviews within 24 hours</li>
                    <li>Status changes to Approved / Rejected in Templates page</li>
                    <li>Approved templates can be used in Broadcasts immediately</li>
                  </ol>
                </div>
              </div>

              {/* Final Preview */}
              <div className="flex justify-center lg:justify-start">
                <WaPhone form={previewForm}/>
              </div>
            </>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/60">
          <p className="text-xs text-slate-400">
            {step === 3 ? 'Ready to submit to Meta for review' : `Next: ${STEPS[step + 1] || ''}`}
          </p>
          <div className="flex gap-3">
            {step > 0 && (
              <button type="button" onClick={() => setStep(s=>s-1)}
                className="px-5 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-100 transition-colors">
                ← Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button type="button"
                onClick={() => { if (canNext) setStep(s=>s+1); else setError(step===0?'Name must be at least 2 characters, lowercase with no spaces.':'Body text is required.') }}
                className={`px-6 py-2.5 text-sm font-semibold rounded-xl transition-colors flex items-center gap-2
                  ${canNext?'bg-blue-600 hover:bg-blue-700 text-white shadow-sm':'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                Continue →
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={saving}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2">
                {saving ? (
                  <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity=".3"/><path d="M22 12A10 10 0 0012 2" stroke="white" strokeWidth="3" strokeLinecap="round"/></svg>Submitting…</>
                ) : '🚀 Submit for Approval'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Templates Page
// ─────────────────────────────────────────────────────────────────────────────
const PER_PAGE = 12

export default function Templates() {
  const [templates,  setTemplates]  = useState([])
  const [total,      setTotal]      = useState(0)
  const [loading,    setLoading]    = useState(false)
  const [syncing,    setSyncing]    = useState(false)
  const [search,     setSearch]     = useState('')
  const [filterSt,   setFilterSt]   = useState('')
  const [filterCat,  setFilterCat]  = useState('')
  const [page,       setPage]       = useState(1)
  const [viewTpl,    setViewTpl]    = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [prefill,    setPrefill]    = useState(null)
  const [layout,     setLayout]     = useState('table')  // table | card

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/templates/local')
      setTemplates(data.templates || [])
      setTotal((data.templates||[]).length)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const sync = async () => {
    setSyncing(true)
    try { await api.post('/templates/sync'); await load() }
    catch (e) { alert(e.response?.data?.detail || 'Sync failed') }
    setSyncing(false)
  }

  const deleteTemplate = async name => {
    try { await api.delete(`/templates/${name}`); load() }
    catch (e) { alert(e.response?.data?.detail || 'Delete failed') }
  }

  const duplicate = tpl => {
    setPrefill(tpl)
    setShowCreate(true)
  }

  // Client-side filter + paginate
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return templates.filter(t =>
      (!q || t.name?.toLowerCase().includes(q)) &&
      (!filterSt  || t.status === filterSt) &&
      (!filterCat || t.category === filterCat)
    )
  }, [templates, search, filterSt, filterCat])

  const pages   = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const visible = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE)

  const stats = useMemo(() => ({
    total:    templates.length,
    approved: templates.filter(t=>t.status==='APPROVED').length,
    pending:  templates.filter(t=>t.status==='PENDING').length,
    rejected: templates.filter(t=>t.status==='REJECTED').length,
  }), [templates])

  // reset page when filters change
  useEffect(() => setPage(1), [search, filterSt, filterCat])

  return (
    <div className="min-h-screen bg-slate-50 font-sans">

      {/* ── Top Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4 max-w-screen-xl mx-auto">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900">Templates</h1>
            <p className="text-xs text-slate-400 mt-0.5">Manage your WhatsApp message templates</p>
          </div>

          {/* Search */}
          <div className="relative w-56 hidden md:block">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="none">
              <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search templates…"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 transition-colors"/>
          </div>

          {/* Filters */}
          <select value={filterSt} onChange={e=>setFilterSt(e.target.value)}
            className="hidden md:block bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-3 py-2 outline-none appearance-none cursor-pointer focus:border-blue-400 min-w-28">
            <option value="">All Status</option>
            {Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>

          <select value={filterCat} onChange={e=>setFilterCat(e.target.value)}
            className="hidden md:block bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-3 py-2 outline-none appearance-none cursor-pointer focus:border-blue-400 min-w-32">
            <option value="">All Categories</option>
            {CATEGORIES.map(c=><option key={c}>{c}</option>)}
          </select>

          {/* Layout toggle */}
          <div className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {[['table','☰'],['card','⊞']].map(([v,icon])=>(
              <button key={v} onClick={()=>setLayout(v)}
                className={`w-8 h-7 rounded-lg text-sm transition-all ${layout===v?'bg-white shadow-sm text-slate-800':'text-slate-400 hover:text-slate-600'}`}>
                {icon}
              </button>
            ))}
          </div>

          {/* Sync */}
          <button onClick={sync} disabled={syncing}
            className={`flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-xl transition-colors ${syncing?'opacity-60 cursor-not-allowed':''}`}>
            <svg className={`w-4 h-4 ${syncing?'animate-spin':''}`} viewBox="0 0 20 20" fill="none">
              <path d="M17 10A7 7 0 003.55 6M3 3v3h3M3 10A7 7 0 0016.45 14M17 17v-3h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {syncing ? 'Syncing…' : 'Sync'}
          </button>

          {/* Create */}
          <button onClick={()=>{ setPrefill(null); setShowCreate(true) }}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm shadow-blue-200 transition-all hover:shadow-md">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"/></svg>
            Create Template
          </button>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-6 space-y-5">

        {/* ── Stats row ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { l:'Total Templates', v:stats.total,    c:'text-slate-700',   bg:'', icon:'📋' },
            { l:'Approved',        v:stats.approved, c:'text-emerald-600', bg:'', icon:'✅' },
            { l:'Pending',         v:stats.pending,  c:'text-amber-600',   bg:'', icon:'⏳' },
            { l:'Rejected',        v:stats.rejected, c:'text-red-600',     bg:'', icon:'❌' },
          ].map(s=>(
            <div key={s.l} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <p className="text-2xl font-bold {s.c}">{s.v}</p>
                <span className="text-xl opacity-70">{s.icon}</span>
              </div>
              <p className={`text-2xl font-bold ${s.c} hidden`}>{s.v}</p>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{s.l}</p>
            </div>
          ))}
        </div>

        {/* ── Table or Card view ────────────────────────────────────────── */}
        {layout === 'table' ? (

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            {/* Mobile search */}
            <div className="md:hidden px-4 pt-4 pb-3 border-b border-slate-100">
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-sm outline-none focus:border-blue-400"/>
            </div>

            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  {['Template Name','Category','Status','Language','Updated','Actions'].map(h=>(
                    <th key={h} className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && [...Array(5)].map((_,i)=>(
                  <tr key={i} className="border-b border-slate-50">
                    {[...Array(6)].map((_,j)=>(
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" style={{width:['160px','90px','80px','80px','80px','90px'][j]}}/>
                      </td>
                    ))}
                  </tr>
                ))}

                {!loading && visible.length === 0 && (
                  <tr><td colSpan={6}>
                    <div className="flex flex-col items-center justify-center py-16 gap-4">
                      <span className="text-5xl opacity-20">📋</span>
                      <div className="text-center">
                        <p className="text-base font-semibold text-slate-600">
                          {search || filterSt || filterCat ? 'No templates match your filters' : 'No templates yet'}
                        </p>
                        <p className="text-sm text-slate-400 mt-1">
                          {search || filterSt || filterCat ? 'Try clearing the filters' : 'Click "Sync" to fetch from Meta, or "Create Template" to build one'}
                        </p>
                      </div>
                      {!search && !filterSt && !filterCat && (
                        <button onClick={()=>{ setPrefill(null); setShowCreate(true) }}
                          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
                          + Create Template
                        </button>
                      )}
                    </div>
                  </td></tr>
                )}

                {!loading && visible.map((t, ri) => (
                  <tr key={t.id}
                    onClick={() => setViewTpl(t)}
                    className={`border-b border-slate-50 last:border-0 hover:bg-blue-50/40 cursor-pointer transition-colors ${ri%2===1?'bg-slate-50/30':''}`}>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 ${CAT_CFG[t.category]?.cls.replace('text-','')} bg-slate-100`}>
                          {CAT_CFG[t.category]?.icon || '📋'}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800 font-mono">{t.name}</p>
                          {t.components?.find(c=>c.type==='BODY')?.text && (
                            <p className="text-xs text-slate-400 mt-0.5 max-w-[220px] truncate">
                              {t.components.find(c=>c.type==='BODY').text}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4"><CatBadge category={t.category}/></td>
                    <td className="px-5 py-4"><StatusBadge status={t.status}/></td>

                    <td className="px-5 py-4">
                      <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-lg font-medium">
                        {LANGUAGES.find(l=>l.code===t.language)?.label || t.language}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-xs text-slate-500">{fmt(t.created_at)}</td>

                    <td className="px-5 py-4" onClick={e=>e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button onClick={()=>setViewTpl(t)} title="View" className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors text-sm">👁</button>
                        <button onClick={()=>duplicate(t)}  title="Duplicate" className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors text-sm">⧉</button>
                        {t.status !== 'APPROVED' && (
                          <button onClick={()=>{ if(confirm(`Delete "${t.name}"?`)) deleteTemplate(t.name) }}
                            title="Delete" className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors text-sm">🗑</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {pages > 1 && (
              <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  Showing {((page-1)*PER_PAGE)+1}–{Math.min(page*PER_PAGE,filtered.length)} of {filtered.length} templates
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm">←</button>
                  {[...Array(pages)].map((_,i)=>(
                    <button key={i} onClick={()=>setPage(i+1)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-colors
                        ${page===i+1?'bg-blue-600 text-white':'border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                      {i+1}
                    </button>
                  )).slice(Math.max(0,page-3),Math.min(pages,page+2))}
                  <button onClick={()=>setPage(p=>Math.min(pages,p+1))} disabled={page===pages}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm">→</button>
                </div>
              </div>
            )}
          </div>

        ) : (
          /* ── Card layout ── */
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {loading && [...Array(8)].map((_,i)=>(
                <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 animate-pulse">
                  <div className="h-4 bg-slate-100 rounded w-3/4"/>
                  <div className="h-3 bg-slate-100 rounded w-1/2"/>
                  <div className="h-12 bg-slate-100 rounded"/>
                </div>
              ))}
              {!loading && visible.map(t => (
                <div key={t.id}
                  onClick={()=>setViewTpl(t)}
                  className="bg-white border border-slate-200 rounded-2xl p-5 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-xl">{CAT_CFG[t.category]?.icon || '📋'}</div>
                    <StatusBadge status={t.status}/>
                  </div>
                  <p className="text-sm font-bold text-slate-800 font-mono mb-1 truncate">{t.name}</p>
                  <p className="text-xs text-slate-400 mb-3">{t.category} · {t.language}</p>
                  {t.components?.find(c=>c.type==='BODY')?.text && (
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed border-l-2 border-slate-200 pl-2">
                      {t.components.find(c=>c.type==='BODY').text}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400">{fmt(t.created_at)}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>duplicate(t)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-xs transition-colors">⧉</button>
                      {t.status !== 'APPROVED' && (
                        <button onClick={()=>{ if(confirm(`Delete?`)) deleteTemplate(t.name) }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg text-xs transition-colors">🗑</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination for cards */}
            {pages > 1 && (
              <div className="flex justify-center gap-2">
                <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}
                  className="px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-xl hover:bg-slate-100 disabled:opacity-40 transition-colors">← Prev</button>
                <span className="px-4 py-2 text-sm text-slate-600">Page {page} of {pages}</span>
                <button onClick={()=>setPage(p=>Math.min(pages,p+1))} disabled={page===pages}
                  className="px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-xl hover:bg-slate-100 disabled:opacity-40 transition-colors">Next →</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {viewTpl && (
        <DetailModal
          tpl={viewTpl}
          onClose={()=>setViewTpl(null)}
          onDelete={name => { deleteTemplate(name) }}
          onDuplicate={duplicate}
        />
      )}

      {showCreate && (
        <CreateWizard
          onClose={()=>{ setShowCreate(false); setPrefill(null) }}
          onCreated={load}
          prefill={prefill}
        />
      )}
    </div>
  )
}