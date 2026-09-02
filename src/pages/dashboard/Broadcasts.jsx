import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../../services/api'
import TemplateText, { extractVars } from '../../components/TemplateText'
import BulkAddContacts from '../../components/BulkAddContacts'

// ── Status config ─────────────────────────────────────────────────────────────
const ST = {
  draft:     { cls:'bg-slate-100 text-slate-600 border-slate-200',   dot:'bg-slate-400',   label:'Draft'     },
  scheduled: { cls:'bg-blue-50 text-blue-600 border-blue-200',       dot:'bg-blue-500',    label:'Scheduled' },
  queued:    { cls:'bg-amber-50 text-amber-500 border-amber-200',     dot:'bg-amber-400',   label:'Queued'    },
  running:   { cls:'bg-amber-50 text-amber-600 border-amber-200',     dot:'bg-amber-500 animate-pulse', label:'Sending…' },
  completed: { cls:'bg-emerald-50 text-emerald-600 border-emerald-200', dot:'bg-emerald-500', label:'Sent'   },
  partial:   { cls:'bg-amber-50 text-amber-600 border-amber-200',     dot:'bg-amber-500',   label:'Partly sent' },
  failed:    { cls:'bg-red-50 text-red-600 border-red-200',           dot:'bg-red-500',     label:'Failed'    },
}

function Badge({ status }) {
  const s = ST[status] || ST.draft
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}/>{s.label}
    </span>
  )
}

// Per-recipient delivery status in the broadcast Contacts tab.
const DELIVERY = {
  sent:      { cls:'bg-blue-50 text-blue-600 border-blue-200',        label:'Sent'      },
  delivered: { cls:'bg-emerald-50 text-emerald-600 border-emerald-200', label:'Delivered' },
  read:      { cls:'bg-violet-50 text-violet-600 border-violet-200',    label:'Read'      },
  failed:    { cls:'bg-red-50 text-red-600 border-red-200',             label:'Failed'    },
  pending:   { cls:'bg-slate-100 text-slate-500 border-slate-200',      label:'Pending'   },
}
function DeliveryBadge({ status }) {
  const s = DELIVERY[status] || DELIVERY.pending
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${s.cls}`}>{s.label}</span>
}

// Failure root-cause buckets — keys must match app/services/failure_categories.py
// (backend groups each failed message's Meta error into one of these).
const FAILURE_CAT = {
  undeliverable:    { icon:'📵', label:'Message Undeliverable',   cls:'bg-red-50 text-red-600 border-red-200',
                       hint:"This number isn't a valid WhatsApp user." },
  marketing_capped: { icon:'🚫', label:'Marketing Message Limit', cls:'bg-orange-50 text-orange-600 border-orange-200',
                       hint:'Your marketing message limit is reached.' },
  window_expired:   { icon:'🕐', label:'Messaging Window Expired',cls:'bg-amber-50 text-amber-600 border-amber-200',
                       hint:'The required messaging window has expired.' },
  other:            { icon:'⚠️', label:'Other',                   cls:'bg-slate-100 text-slate-500 border-slate-200',
                       hint:'See the error details on the recipient.' },
}
// Mirrors app/services/failure_categories.py::categorize_failure (code → bucket,
// no text sniffing) — used only to pick an icon for a single recipient's error
// inline; the authoritative counts come from the backend's `failure_breakdown`.
const FAILURE_CODE_MAP = {
  131026: 'undeliverable', 131030: 'undeliverable', 1013: 'undeliverable', 133010: 'undeliverable',
  131049: 'marketing_capped',
  131047: 'window_expired',
}
function categorizeError(error) {
  if (!error) return 'other'
  return FAILURE_CODE_MAP[Number(error.code)] || 'other'
}

const TZ = 'Asia/Kolkata'
// Backend may return IST-offset strings ("+05:30") or legacy naive UTC strings.
// Ensure naive strings are treated as UTC before converting to IST for display.
const parseUTC = iso => { if (!iso) return null; const s = /[Z+]/.test(iso.slice(-6)) ? iso : iso + 'Z'; return new Date(s) }
const fmt     = iso => { const d = parseUTC(iso); return d ? d.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:TZ}) : '—' }
const fmtTime = iso => { const d = parseUTC(iso); return d ? d.toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:TZ}) : '—' }
// Current IST time formatted for <input type="datetime-local"> min attribute
const nowISTLocal = () => new Date().toLocaleString('sv-SE',{timeZone:TZ}).replace(' ','T').slice(0,16)
const pct     = (n, t) => t > 0 ? Math.round((n/t)*100) : 0

// ── Template header media ─────────────────────────────────────────────────────
// The stored header file is served behind JWT auth, so it can't go straight into
// an <img src>. Fetch it as a blob through the authenticated client (same pattern
// as Inbox) and hand back an object URL. A plain http(s) override URL — one the
// user typed into the form — is used as-is.
function useHeaderMedia(mediaPath, overrideUrl) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    const manual = (overrideUrl || '').trim()
    if (manual) { setUrl(manual); return }

    setUrl(null)
    if (!mediaPath) return

    let cancelled = false, objectUrl = null
    api.get(mediaPath, { responseType: 'blob' })
      .then(({ data }) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(data)
        setUrl(objectUrl)
      })
      .catch(() => { /* no stored copy — fall back to the placeholder */ })

    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [mediaPath, overrideUrl])

  return url
}

// ── WhatsApp Preview ──────────────────────────────────────────────────────────
function WaPreview({ templateName, bodyText, variables = {}, headerType, headerText, footerText, buttons = [],
                     headerMediaPath = '', headerMediaUrl = '' }) {
  const mediaUrl = useHeaderMedia(headerMediaPath, headerMediaUrl)
  const isMediaHeader = ['image', 'video', 'document'].includes(headerType)
  return (
    <div className="flex flex-col items-center select-none">
      <div className="w-56 bg-[#111] rounded-[36px] p-2 shadow-xl border-4 border-[#1a1a1a]">
        <div className="bg-[#ECE5DD] rounded-[28px] overflow-hidden">
          <div className="bg-[#075E54] px-3 py-2 flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center font-bold text-white text-[10px]">W</div>
            <p className="text-white text-[10px] font-semibold flex-1">WhatsApp Business</p>
          </div>
          <div className="p-2.5 min-h-[160px]">
            <div className="flex justify-center mb-2">
              <span className="text-[8px] text-slate-500 bg-white/60 px-2 py-0.5 rounded-full">Today</span>
            </div>
            <div className="max-w-[90%] bg-white rounded-xl rounded-tl-sm shadow-sm overflow-hidden">
              {headerType && headerType !== 'none' && (
                isMediaHeader ? (
                  mediaUrl && headerType === 'image' ? (
                    <img src={mediaUrl} alt="" className="w-full max-h-32 object-cover"/>
                  ) : mediaUrl && headerType === 'video' ? (
                    <video src={mediaUrl} className="w-full max-h-32 object-cover" muted/>
                  ) : (
                    <div className="bg-slate-100 py-4 text-center text-[10px] font-bold text-slate-400">
                      {headerType === 'video' ? '🎬 Video' : headerType === 'document' ? '📄 Document' : '🖼 Image'}
                    </div>
                  )
                ) : (
                  <div className="px-2.5 pt-2 text-[10px] font-bold text-slate-800">{headerText}</div>
                )
              )}
              <div className="px-2.5 py-2">
                <p className="text-[10px] text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {bodyText
                    ? <TemplateText text={bodyText} variables={variables}/>
                    : <span className="text-slate-300 italic">Preview…</span>}
                </p>
              </div>
              {footerText && <p className="px-2.5 pb-1.5 text-[8px] text-slate-400">{footerText}</p>}
              <div className="flex justify-end px-2.5 pb-1"><span className="text-[7px] text-slate-400">10:30 ✓✓</span></div>
              {buttons.length > 0 && (
                <div className="border-t border-slate-100">
                  {buttons.map((b, i) => (
                    <div key={i} className={`text-center py-1.5 text-[9px] font-semibold text-[#075E54] ${i>0?'border-t border-slate-100':''}`}>
                      {b.type==='url'?'🔗 ':b.type==='phone'?'📞 ':''}{b.label}
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

// ── Contact Selector ──────────────────────────────────────────────────────────
function ContactSelector({ contacts, selectedIds, onChange, audienceMode, audienceTag, onModeChange }) {
  const [search,    setSearch]    = useState('')
  const mode      = audienceMode || 'all'
  const tagFilter = audienceTag  || ''
  const setMode = (m) => onModeChange && onModeChange(m, '')
  const setTagFilter = (t) => onModeChange && onModeChange(mode, t)

  // Every imported contact is selectable — opt-in and tags are optional and do
  // not gate who can be added to a broadcast.
  const allContacts = contacts
  const allTags    = [...new Set(contacts.flatMap(c => c.tags || []))]

  const filtered = allContacts.filter(c => {
    const q = search.toLowerCase()
    return (!q || c.profile_name?.toLowerCase().includes(q) || c.wa_id?.includes(q))
        && (!tagFilter || (c.tags||[]).includes(tagFilter))
  })

  const bg = name => {
    const cols = ['bg-violet-500','bg-blue-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-cyan-500']
    let h = 0; for (const ch of name||'') h = ch.charCodeAt(0)+((h<<5)-h)
    return cols[Math.abs(h)%cols.length]
  }

  const audienceCount = mode==='all' ? allContacts.length
    : mode==='tag' ? allContacts.filter(c=>(c.tags||[]).includes(tagFilter)).length
    : selectedIds.length

  return (
    <div className="space-y-3">
      {/* Mode tabs */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { v:'all',  icon:'👥', label:'All Contacts',  sub:`${allContacts.length} contacts` },
          { v:'tag',  icon:'🏷️', label:'By Tag',        sub:'Filter segment'                },
          { v:'pick', icon:'☑️', label:'Hand-pick',     sub:'Select manually'               },
        ].map(o => (
          <button key={o.v} type="button" onClick={() => { setMode(o.v); onChange([]) ; onModeChange && onModeChange(o.v, '') }}
            className={`p-3 rounded-xl border-2 text-left transition-all ${mode===o.v?'border-blue-500 bg-blue-50':'border-slate-200 hover:border-slate-300'}`}>
            <div className="text-base mb-0.5">{o.icon}</div>
            <p className="text-xs font-bold text-slate-700">{o.label}</p>
            <p className="text-[10px] text-slate-400">{o.sub}</p>
          </button>
        ))}
      </div>

      {/* Mode: All */}
      {mode==='all' && (
        <div className="flex items-center gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
          <span className="text-xl">✅</span>
          <p className="text-sm font-semibold text-emerald-700">All {allContacts.length} contacts will receive this broadcast</p>
        </div>
      )}

      {/* Mode: Tag */}
      {mode==='tag' && (
        <div className="space-y-2">
          <select value={tagFilter} onChange={e => setTagFilter(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 appearance-none cursor-pointer">
            <option value="">— choose a tag —</option>
            {allTags.map(t => <option key={t}>{t}</option>)}
          </select>
          {tagFilter && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <span className="text-xl">🏷️</span>
              <p className="text-sm font-semibold text-blue-700">
                {allContacts.filter(c=>(c.tags||[]).includes(tagFilter)).length} contacts tagged <code className="font-mono">"{tagFilter}"</code>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Mode: Pick */}
      {mode==='pick' && (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 bg-slate-50">
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…"
              className="flex-1 bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-400" />
            <select value={tagFilter} onChange={e=>setTagFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 appearance-none cursor-pointer outline-none">
              <option value="">All tags</option>
              {allTags.map(t=><option key={t}>{t}</option>)}
            </select>
            <button type="button" onClick={() => onChange(filtered.map(c=>c.id))}
              className="text-xs text-blue-600 font-semibold px-2 hover:underline whitespace-nowrap">All</button>
            {selectedIds.length>0 && (
              <button type="button" onClick={() => onChange([])} className="text-xs text-slate-400 hover:text-slate-600 px-1">Clear</button>
            )}
          </div>
          {selectedIds.length>0 && (
            <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-100 text-xs font-semibold text-blue-600">
              {selectedIds.length} selected
            </div>
          )}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length===0 && <p className="py-8 text-center text-slate-400 text-sm">No contacts</p>}
            {filtered.map(c => {
              const sel = selectedIds.includes(c.id)
              return (
                <div key={c.id} onClick={() => onChange(sel ? selectedIds.filter(x=>x!==c.id) : [...selectedIds,c.id])}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b border-slate-50 last:border-0 transition-colors ${sel?'bg-blue-50':'hover:bg-slate-50'}`}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${sel?'bg-blue-600 border-blue-600':'border-slate-300'}`}>
                    {sel && <svg viewBox="0 0 12 10" fill="none" className="w-3 h-3"><path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <div className={`w-7 h-7 rounded-full ${bg(c.profile_name||c.wa_id)} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                    {(c.profile_name||c.wa_id||'?').slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{c.profile_name || <span className="text-slate-400 italic">No name</span>}</p>
                    <p className="text-[10px] text-slate-400 font-mono">+{c.wa_id}</p>
                  </div>
                  {(c.tags||[]).slice(0,2).map(t=>(
                    <span key={t} className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded hidden sm:block">{t}</span>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
      <p className="text-xs text-slate-400 font-medium">{audienceCount} recipient{audienceCount!==1?'s':''} selected</p>
    </div>
  )
}

// ── View / Details modal ──────────────────────────────────────────────────────
function ViewModal({ broadcast: b, onClose, onEdit, onDelete, onSend, onReset, onResent }) {
  const [detail,        setDetail]       = useState(null)   // fresh doc w/ live analytics
  const [contacts,      setContacts]     = useState([])
  const [loadingCtx,    setLoadingCtx]   = useState(false)
  const [ctxTotal,      setCtxTotal]     = useState(0)
  const [statusCounts,  setStatusCounts] = useState(null)
  const [statusFilter,  setStatusFilter] = useState('')      // '' | sent | delivered | read | failed
  const [tab,           setTab]          = useState('details')
  const [resending,     setResending]    = useState(false)
  const [resendMsg,     setResendMsg]    = useState('')

  // Pull fresh analytics (computed from real messages) so Failed etc. are accurate,
  // even for older broadcasts whose stored counters were never updated.
  useEffect(() => {
    let cancelled = false
    api.get(`/broadcasts/${b.id}`).then(r => { if (!cancelled) setDetail(r.data) }).catch(() => {})
    return () => { cancelled = true }
  }, [b.id])

  useEffect(() => {
    if (tab !== 'contacts') return
    let cancelled = false
    setLoadingCtx(true)
    const qs = statusFilter ? `&status=${statusFilter}` : ''
    // Page through every recipient so the list is complete, not capped.
    const fetchAll = async () => {
      const all = []; let page = 1; let total = 0
      while (!cancelled) {
        try {
          const { data } = await api.get(`/broadcasts/${b.id}/contacts?page=${page}&limit=500${qs}`)
          const batch = data.contacts || []
          total = data.total || 0
          if (data.status_counts) setStatusCounts(data.status_counts)
          all.push(...batch)
          if (batch.length < 500 || all.length >= total || page >= 40) break
          page++
        } catch { break }
      }
      if (!cancelled) { setContacts(all); setCtxTotal(total); setLoadingCtx(false) }
    }
    fetchAll()
    return () => { cancelled = true }
  }, [tab, b.id, statusFilter])

  const stat  = detail || b
  const a     = stat.analytics || {}
  const total = a.total ?? stat.total_recipients ?? 0
  const nSent      = a.sent      ?? stat.sent_count      ?? 0
  const nDelivered = a.delivered ?? stat.delivered_count ?? 0
  const nRead      = a.read      ?? stat.read_count      ?? 0
  const nFailed    = a.failed    ?? stat.failed_count    ?? 0
  const nPending   = a.pending   ?? 0
  const breakdown  = a.failure_breakdown || {}

  const failedCount = statusCounts?.failed ?? nFailed
  const resendFailed = async () => {
    if (!confirm(`Resend the template to ${failedCount.toLocaleString()} failed recipient(s)? This starts a new broadcast.`)) return
    setResending(true); setResendMsg('')
    try {
      const { data } = await api.post(`/broadcasts/${b.id}/resend-failed`)
      setResendMsg(data.info || `Resending to ${data.recipients} recipients`)
      onResent && onResent()
    } catch (e) {
      setResendMsg(e.response?.data?.detail || 'Resend failed')
    }
    setResending(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col" onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-base font-bold text-slate-800">{b.name}</h2>
              <Badge status={b.status}/>
            </div>
            <p className="text-xs text-slate-400">Created {fmtTime(b.created_at)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            {b.status==='draft' && (
              <>
                <button onClick={() => { onClose(); onEdit(b) }}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors">
                  ✏️ Edit
                </button>
                <button onClick={() => { onClose(); onSend(b.id) }}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors">
                  ▶ Send Now
                </button>
              </>
            )}
            {(b.status==='running'||b.status==='queued'||b.status==='failed') && (
              <button onClick={() => { onClose(); onReset(b.id) }}
                className="px-3 py-1.5 text-xs font-semibold text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors">
                ↺ Reset
              </button>
            )}
            <button onClick={() => { if(confirm('Delete this broadcast?')) { onDelete(b.id); onClose() } }}
              className="px-3 py-1.5 text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors">
              🗑 Delete
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors text-xl leading-none">×</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 border-b border-slate-100">
          {['details','analytics','contacts'].map(t => (
            <button key={t} onClick={()=>setTab(t)}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg capitalize transition-colors ${tab===t?'bg-white border border-b-white border-slate-200 text-blue-600 -mb-px relative z-10':'text-slate-500 hover:text-slate-700'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">

          {/* Details tab */}
          {tab==='details' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { l:'Template',    v:<code className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{b.template_name}</code> },
                  { l:'Language',    v:b.template_language },
                  { l:'Audience',    v:b.audience_type==='all'?'All opted-in':b.audience_type==='tag'?`Tag: ${(b.audience_tags||[]).join(', ')}`:`${(b.audience_contact_ids||[]).length} contacts` },
                  { l:'Scheduled',   v:b.scheduled_at ? fmtTime(b.scheduled_at) : 'Immediate' },
                  { l:'Recipients',  v:(b.total_recipients||0).toLocaleString() },
                  { l:'Last updated',v:fmtTime(b.updated_at) },
                ].map(r => (
                  <div key={r.l} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{r.l}</p>
                    <p className="text-sm font-medium text-slate-700">{r.v}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Analytics tab */}
          {tab==='analytics' && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { l:'Total',  v:total,     c:'text-slate-700',  bg:'bg-slate-50' },
                  { l:'Sent',   v:nSent,     c:'text-blue-600',   bg:'bg-blue-50'  },
                  { l:'Delivered', v:nDelivered, c:'text-emerald-600', bg:'bg-emerald-50' },
                  { l:'Failed', v:nFailed,   c:'text-red-600',    bg:'bg-red-50'   },
                ].map(s => (
                  <div key={s.l} className={`${s.bg} rounded-xl p-4 text-center border border-slate-100`}>
                    <p className={`text-2xl font-bold ${s.c}`}>{s.v.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400 mt-1 font-semibold uppercase tracking-wider">{s.l}</p>
                  </div>
                ))}
              </div>
              {[
                { l:'Sent',      v:nSent,      color:'bg-blue-400'    },
                { l:'Delivered', v:nDelivered, color:'bg-emerald-400' },
                { l:'Read',      v:nRead,      color:'bg-violet-400'  },
                { l:'Failed',    v:nFailed,    color:'bg-red-400'     },
              ].map(r => (
                <div key={r.l}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-slate-600">{r.l}</span>
                    <span className="font-bold text-slate-700">{r.v.toLocaleString()} <span className="text-slate-400">({pct(r.v,total)}%)</span></span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${r.color} rounded-full transition-all duration-500`} style={{width:`${pct(r.v,total)}%`}}/>
                  </div>
                </div>
              ))}

              {/* Why messages failed — per Meta error-code category */}
              {nFailed > 0 && (
                <div className="pt-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Why {nFailed.toLocaleString()} failed</p>
                  <div className="space-y-2">
                    {Object.entries(breakdown)
                      .filter(([, n]) => n > 0)
                      .sort(([, a], [, b]) => b - a)
                      .map(([key, n]) => {
                        const c = FAILURE_CAT[key] || FAILURE_CAT.other
                        return (
                          <div key={key} className={`flex items-start gap-2.5 rounded-xl p-3 border ${c.cls}`} title={c.hint}>
                            <span className="text-base leading-none shrink-0">{c.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold">{c.label}</span>
                                <span className="text-xs font-bold shrink-0">{n.toLocaleString()} <span className="opacity-70">({pct(n, nFailed)}%)</span></span>
                              </div>
                              <p className="text-[11px] opacity-80 mt-0.5">{c.hint}</p>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}

              {/* Sent, not yet confirmed delivered/read/failed */}
              {nPending > 0 && (
                <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <span className="text-xs font-medium text-slate-600">⏳ Sent / Pending — waiting for delivery confirmation</span>
                  <span className="text-xs font-bold text-slate-700">{nPending.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}

          {/* Contacts tab */}
          {tab==='contacts' && (
            <div>
              {/* Status filter chips (counts from real messages) */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {[
                  { k:'',          l:'All',       n:statusCounts?.total },
                  { k:'sent',      l:'Sent',      n:statusCounts?.sent },
                  { k:'delivered', l:'Delivered', n:statusCounts?.delivered },
                  { k:'read',      l:'Read',      n:statusCounts?.read },
                  { k:'failed',    l:'Failed',    n:statusCounts?.failed },
                ].map(f => (
                  <button key={f.k||'all'} onClick={()=>setStatusFilter(f.k)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${statusFilter===f.k
                      ? (f.k==='failed'?'bg-red-600 border-red-600 text-white':'bg-blue-600 border-blue-600 text-white')
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    {f.l}{f.n!=null?` · ${f.n.toLocaleString()}`:''}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-sm font-semibold text-slate-700">
                  {ctxTotal.toLocaleString()} {statusFilter?`${statusFilter} `:''}recipient{ctxTotal!==1?'s':''}
                </p>
                {failedCount > 0 && (
                  <button onClick={resendFailed} disabled={resending}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-slate-300 rounded-lg transition-colors whitespace-nowrap">
                    {resending ? 'Resending…' : `↻ Resend to ${failedCount.toLocaleString()} failed`}
                  </button>
                )}
              </div>
              {resendMsg && (
                <div className="mb-3 bg-blue-50 border border-blue-200 text-blue-700 text-xs px-3 py-2 rounded-xl">{resendMsg}</div>
              )}
              {loadingCtx && <div className="py-8 text-center text-slate-400 text-sm">Loading…</div>}
              {!loadingCtx && contacts.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-sm">No {statusFilter||''} recipients</div>
              )}
              <div className="space-y-2">
                {contacts.map(c => (
                  <div key={c.id || c.wa_id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {(c.profile_name||c.wa_id||'?').slice(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{c.profile_name || <span className="text-slate-400 italic">No name</span>}</p>
                      <p className="text-xs text-slate-400 font-mono">+{c.wa_id}</p>
                      {c.status==='failed' && c.error && (
                        <p className="text-[11px] text-red-500 mt-0.5 truncate" title={c.error.details||c.error.message}>
                          {FAILURE_CAT[categorizeError(c.error)].icon} {c.error.details || c.error.message || `Error ${c.error.code||''}`}
                        </p>
                      )}
                    </div>
                    <DeliveryBadge status={c.status}/>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Edit modal ────────────────────────────────────────────────────────────────
function EditModal({ broadcast: b, templates, contacts = [], onClose, onSaved }) {
  const [form, setForm] = useState({
    // A sent broadcast is edited as a copy — give it a distinct name up front
    name:              ['draft','scheduled'].includes(b.status) ? (b.name || '') : `${b.name || 'Broadcast'} (copy)`,
    template_id:       '',
    template_language: b.template_language || 'en_US',
    // Seed the audience from the saved broadcast so edits start where it left off
    audienceMode:      b.audience_type === 'contact_ids' ? 'pick'
                     : b.audience_type === 'tag'          ? 'tag' : 'all',
    audienceTag:       (b.audience_tags || [])[0] || '',
    selectedIds:       b.audience_contact_ids || [],
    variables:         b.variables || {},
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  // The template the broadcast will actually use: the newly chosen one, or the
  // current one when "Keep" is selected. Its body {{n}} placeholders decide which
  // variable inputs to show — a template like promotional_offer needs all filled
  // or the send aborts with "needs variables […] but supplied none".
  const effectiveTpl = form.template_id
    ? templates.find(t => t.id === form.template_id)
    : templates.find(t => t.name === b.template_name)
  const bodyText = effectiveTpl?.components?.find(c => c.type === 'BODY')?.text || ''
  const bodyVars = extractVars(bodyText)
  const missingVars = bodyVars.filter(v => !(form.variables[v] || '').trim())

  // How many contacts the current audience selection resolves to
  const audienceCount = form.audienceMode === 'all'
      ? contacts.length
      : form.audienceMode === 'tag'
        ? contacts.filter(c => (c.tags || []).includes(form.audienceTag)).length
        : form.selectedIds.length

  // Draft & scheduled edit in place; a sent/failed broadcast is immutable, so
  // editing it produces a NEW draft copy (its analytics stay intact).
  const inPlace = ['draft', 'scheduled'].includes(b.status)

  const save = async e => {
    e.preventDefault()
    if (audienceCount === 0) { setError('Select at least one contact'); return }
    if (missingVars.length) { setError(`Fill all template variables: ${missingVars.map(v=>`{{${v}}}`).join(', ')}`); return }
    setSaving(true); setError('')
    try {
      const tpl = templates.find(t => t.id === form.template_id)
      // Keep only variables the effective template actually uses
      const cleanVars = {}
      bodyVars.forEach(v => { if ((form.variables[v] || '').trim()) cleanVars[v] = form.variables[v] })

      const audience = {
        audience_type:        form.audienceMode === 'pick' ? 'contact_ids'
                            : form.audienceMode === 'tag'  ? 'tag' : 'all',
        audience_tags:        form.audienceMode === 'tag'  ? [form.audienceTag] : [],
        audience_contact_ids: form.audienceMode === 'pick' ? form.selectedIds : [],
      }

      if (inPlace) {
        await api.patch(`/broadcasts/${b.id}`, {
          name:              form.name,
          template_name:     tpl?.name     || b.template_name,
          template_language: tpl?.language  || form.template_language,
          variables:         cleanVars,
          ...audience,
        })
      } else {
        // Sent/failed: save the edits as a fresh draft copy rather than mutating history
        await api.post('/broadcasts', {
          name:              form.name,
          template_name:     tpl?.name     || b.template_name,
          template_language: tpl?.language  || form.template_language,
          variables:         cleanVars,
          header_type:       b.header_type || 'none',
          header_text:       b.header_text || '',
          header_media:      b.header_media || '',
          button_payloads:   b.button_payloads || [],
          components:        b.components || [],
          schedule_type:     'draft',
          ...audience,
        })
      }
      onSaved(); onClose()
    } catch (e) { setError(e.response?.data?.detail || 'Save failed') }
    setSaving(false)
  }

  const inp = "w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all text-slate-700"
  const lbl = "block text-xs font-semibold text-slate-600 mb-1.5"

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl my-8 shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h2 className="text-sm font-bold text-slate-800">{inPlace ? 'Edit Broadcast' : 'Edit as New Draft'}</h2>
            {!inPlace && <p className="text-[11px] text-slate-400 mt-0.5">This broadcast was already sent — your changes are saved as a new draft.</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={save} className="p-6 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2.5 rounded-xl">{error}</div>}
          {!inPlace && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs px-3 py-2.5 rounded-xl">
              You're editing a <strong>{b.status}</strong> broadcast. Saving creates a new <strong>draft</strong> — the original stays unchanged with its analytics.
            </div>
          )}
          <div>
            <label className={lbl}>Campaign Name</label>
            <input required value={form.name} onChange={e=>set('name', e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl}>Change Template (optional)</label>
            <select value={form.template_id} onChange={e=>set('template_id', e.target.value)} className={`${inp} appearance-none cursor-pointer`}>
              <option value="">— Keep: {b.template_name} —</option>
              {templates.map(t=><option key={t.id} value={t.id}>{t.name} ({t.language})</option>)}
            </select>
          </div>
          {bodyVars.length > 0 && (
            <div>
              <label className={lbl}>Template Variables <span className="text-red-400">*</span></label>
              <div className="space-y-2">
                {bodyVars.map(v => (
                  <div key={v} className="flex items-center gap-2">
                    <code className={`text-[11px] px-2 py-1 rounded font-mono shrink-0 border ${(form.variables[v]||'').trim()?'bg-emerald-100 text-emerald-800 border-emerald-200':'bg-amber-50 text-amber-700 border-dashed border-amber-300'}`}>{`{{${v}}}`}</code>
                    <input
                      value={form.variables[v] || ''}
                      onChange={e=>setForm(p=>({...p, variables:{...p.variables, [v]:e.target.value}}))}
                      placeholder={`Value for {{${v}}}`}
                      className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-400"
                    />
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">This template needs all {bodyVars.length} value{bodyVars.length!==1?'s':''} filled before it can send.</p>
            </div>
          )}
          <div>
            <label className={lbl}>Audience <span className="text-red-400">*</span></label>
            <ContactSelector
              contacts={contacts}
              selectedIds={form.selectedIds}
              audienceMode={form.audienceMode}
              audienceTag={form.audienceTag}
              onModeChange={(mode, tag) => {
                set('audienceMode', mode)
                if (tag !== undefined) set('audienceTag', tag)
                set('selectedIds', [])
              }}
              onChange={ids => set('selectedIds', ids)}
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white text-sm font-semibold rounded-xl transition-colors">
              {saving ? 'Saving…' : inPlace ? `Save Changes (${audienceCount} recipient${audienceCount!==1?'s':''})` : `Save as Draft (${audienceCount} recipient${audienceCount!==1?'s':''})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Create Wizard ─────────────────────────────────────────────────────────────
const STEPS = ['Details & Audience', 'Message', 'Preview', 'Schedule', 'Review & Send']

function CreateWizard({ onClose, onCreated, templates, contacts, onContactsChanged }) {
  const [step,   setStep]   = useState(0)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [showBulkAdd, setShowBulkAdd] = useState(false)
  const [confirmChecked, setConfirmChecked] = useState(false)

  const [form, setForm] = useState({
    name:'', audienceMode:'all', audienceTag:'', selectedIds:[],
    templateId:'', headerType:'none', headerText:'', headerMedia:'', headerMediaPath:'',
    bodyText:'', footerText:'', variables:{}, buttons:[],
    scheduleType:'now', scheduleTime:'',
  })

  const set  = (k,v) => setForm(p=>({...p,[k]:v}))
  const tpl  = templates.find(t=>t.id===form.templateId)

  const applyTpl = t => {
    const body   = t.components?.find(c=>c.type==='BODY')?.text   || ''
    const hdr    = t.components?.find(c=>c.type==='HEADER')
    const footer = t.components?.find(c=>c.type==='FOOTER')?.text || ''
    const btns   = (t.components?.find(c=>c.type==='BUTTONS')?.buttons||[]).map(b=>({type:(b.type||'reply').toLowerCase(),label:b.text||''}))
    setForm(p=>({...p, templateId:t.id, bodyText:body, footerText:footer,
      headerType:hdr?(hdr.format||'none').toLowerCase():'none',
      headerText:hdr?.format==='TEXT'?(hdr.text||''):'',
      // Path to the header image stored when the template was created — the
      // preview renders this, and the backend sends it when no URL is supplied.
      headerMediaPath: t.header_media_url || '',
      headerMedia:'', buttons:btns }))
  }

  const bodyVars = extractVars(form.bodyText)

  // All contacts are eligible — opt-in is not required to receive a broadcast.
  const audienceCount = useMemo(() => {
    if (form.audienceMode==='all')  return contacts.length
    if (form.audienceMode==='tag')  return contacts.filter(c=>(c.tags||[]).includes(form.audienceTag)).length
    return form.selectedIds.length
  }, [form.audienceMode, form.audienceTag, form.selectedIds.length, contacts])

  const canNext = [
    form.name.trim()!=='' && (form.audienceMode!=='tag'||form.audienceTag!=='') && (form.audienceMode!=='pick'||form.selectedIds.length>0),
    form.templateId!=='',
    true, true, true,
  ][step]

  const buildComponents = () => {
    // Build correct Meta Cloud API component format
    const comps = []

    if (form.headerType !== 'none') {
      const param = form.headerType === 'text'
        ? { type:'text', text:form.headerText }
        : { type:form.headerType, [form.headerType]:{ link:form.headerMedia } }
      comps.push({ type:'header', parameters:[param] })
    }

    // Body parameters for {{1}}, {{2}} etc. OR named {{name}}
    if (Object.keys(form.variables).length > 0) {
      const params = bodyVars
        .filter(v => form.variables[v])
        .map(v => ({ type:'text', text: form.variables[v] }))
      if (params.length > 0) {
        comps.push({ type:'body', parameters:params })
      }
    }

    // Quick reply button payloads
    form.buttons.forEach((b,i) => {
      if (b.type === 'reply') {
        comps.push({ type:'button', sub_type:'quick_reply', index:String(i), parameters:[{type:'payload',payload:b.label}] })
      }
    })

    return comps
  }

  const submit = async () => {
    if (audienceCount===0) { setError('No contacts selected'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        name:                 form.name,
        template_name:        tpl?.name || '',
        template_language:    tpl?.language || 'en_US',
        audience_type:        form.audienceMode==='pick'?'contact_ids':form.audienceMode==='tag'?'tag':'all',
        audience_tags:        form.audienceMode==='tag' ? [form.audienceTag] : [],
        audience_contact_ids: form.audienceMode==='pick' ? form.selectedIds : [],
        components:           buildComponents(),
        variables:            form.variables,      // ← body variable values
        header_type:          form.headerType,
        header_text:          form.headerText,
        header_media:         form.headerMedia,
        button_payloads:      form.buttons,
        schedule_type:        form.scheduleType,
        scheduled_at:         form.scheduleType==='later' ? form.scheduleTime : null,
      }
      console.log('[BROADCAST] Submitting payload:', JSON.stringify(payload, null, 2))
      const { data } = await api.post('/broadcasts', payload)
      if (form.scheduleType==='now') await api.post(`/broadcasts/${data.id}/send`)
      onCreated(); onClose()
    } catch(e) { setError(e.response?.data?.detail||'Failed') }
    setSaving(false)
  }

  const inp = "w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all placeholder-slate-400"
  const sel = `${inp} appearance-none cursor-pointer`
  const lbl = "block text-sm font-semibold text-slate-700 mb-2"

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-5xl my-8 shadow-2xl border border-slate-100">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-800">Create Broadcast</h2>
            <p className="text-xs text-slate-400 mt-0.5">Step {step+1}/{STEPS.length} — {STEPS[step]}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors text-xl leading-none">×</button>
        </div>

        {/* Steps */}
        <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100">
          <div className="flex items-center">
            {STEPS.map((s,i)=>(
              <div key={s} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1 min-w-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all
                    ${i<step?'bg-emerald-500 text-white':i===step?'bg-blue-600 text-white shadow-md shadow-blue-200':'bg-slate-200 text-slate-500'}`}>
                    {i<step?'✓':i+1}
                  </div>
                  <span className={`text-[10px] font-medium whitespace-nowrap hidden sm:block ${i===step?'text-blue-600':'text-slate-400'}`}>{s}</span>
                </div>
                {i<STEPS.length-1&&<div className={`h-0.5 flex-1 mx-1.5 mt-[-14px] sm:mt-[-22px] ${i<step?'bg-emerald-400':'bg-slate-200'}`}/>}
              </div>
            ))}
          </div>
        </div>

        {error && <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>}

        <div className="p-6">

          {/* Step 0 */}
          {step===0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <label className={lbl}>Campaign Name <span className="text-red-400">*</span></label>
                <input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Diwali Offer 2024" className={inp}/>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className={`${lbl} mb-0`}>Select Audience <span className="text-red-400">*</span></label>
                  <button type="button" onClick={()=>setShowBulkAdd(true)}
                    className="px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
                    + Bulk Add Contacts
                  </button>
                </div>
                <ContactSelector
                  contacts={contacts}
                  selectedIds={form.selectedIds}
                  audienceMode={form.audienceMode}
                  audienceTag={form.audienceTag}
                  onModeChange={(mode, tag) => {
                    set('audienceMode', mode)
                    if (tag !== undefined) set('audienceTag', tag)
                    set('selectedIds', [])
                  }}
                  onChange={ids => set('selectedIds', ids)}
                />
              </div>
            </div>
          )}

          {/* Step 1 */}
          {step===1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div>
                  <label className={lbl}>Template <span className="text-red-400">*</span></label>
                  {templates.length===0 ? (
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center text-sm text-slate-500">
                      No approved templates. Go to Templates → Sync from Meta.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {templates.map(t=>(
                        <label key={t.id} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${form.templateId===t.id?'border-blue-500 bg-blue-50':'border-slate-200 hover:border-slate-300'}`}>
                          <input type="radio" checked={form.templateId===t.id} onChange={()=>applyTpl(t)} className="mt-0.5 accent-blue-600"/>
                          <div>
                            <p className="text-xs font-bold font-mono text-slate-700">{t.name}</p>
                            <p className="text-[10px] text-slate-400">{t.category} · {t.language}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {form.templateId && (
                  <>
                    <div>
                      <label className={lbl}>Header</label>
                      <select value={form.headerType} onChange={e=>set('headerType',e.target.value)} className={sel}>
                        <option value="none">No header</option>
                        <option value="text">Text</option>
                        <option value="image">Image URL</option>
                        <option value="video">Video URL</option>
                        <option value="document">Document URL</option>
                      </select>
                      {form.headerType==='text' && <input value={form.headerText} onChange={e=>set('headerText',e.target.value)} placeholder="Header text" className={`${inp} mt-2`}/>}
                      {['image','video','document'].includes(form.headerType) && <input value={form.headerMedia} onChange={e=>set('headerMedia',e.target.value)} placeholder={`${form.headerType} URL`} className={`${inp} mt-2`}/>}
                    </div>

                    {bodyVars.length>0 && (
                      <div>
                        <label className={lbl}>Variables</label>
                        {bodyVars.map(v=>(
                          <div key={v} className="flex items-center gap-2 mb-2">
                            <code className={`text-xs px-2 py-1 rounded font-mono shrink-0 border transition-colors ${
                              (form.variables[v]||'').trim()
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-dashed border-amber-300'
                            }`}>{`{{${v}}}`}</code>
                            <input value={form.variables[v]||''} onChange={e=>setForm(p=>({...p,variables:{...p.variables,[v]:e.target.value}}))}
                              placeholder={`Value for ${v}`} className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium placeholder-slate-400 placeholder:font-normal outline-none focus:border-blue-400"/>
                          </div>
                        ))}
                      </div>
                    )}

                    <div>
                      <label className={lbl}>Footer (optional)</label>
                      <input value={form.footerText} onChange={e=>set('footerText',e.target.value)} placeholder="Reply STOP to unsubscribe" className={inp}/>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-slate-700">Buttons</label>
                        <button type="button" onClick={()=>setForm(p=>({...p,buttons:[...p.buttons,{type:'reply',label:''}]}))}
                          className="text-xs text-blue-600 font-semibold hover:underline">+ Add</button>
                      </div>
                      {form.buttons.map((b,i)=>(
                        <div key={i} className="flex gap-2 mb-2">
                          <select value={b.type} onChange={e=>setForm(p=>({...p,buttons:p.buttons.map((x,j)=>j===i?{...x,type:e.target.value}:x)}))}
                            className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 bg-white appearance-none outline-none">
                            <option value="reply">Reply</option><option value="url">URL</option><option value="phone">Call</option>
                          </select>
                          <input value={b.label} placeholder="Label" onChange={e=>setForm(p=>({...p,buttons:p.buttons.map((x,j)=>j===i?{...x,label:e.target.value}:x)}))}
                            className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-400"/>
                          <button onClick={()=>setForm(p=>({...p,buttons:p.buttons.filter((_,j)=>j!==i)}))} className="text-slate-400 hover:text-red-500 text-lg leading-none">×</button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-center">
                <WaPreview templateName={tpl?.name} bodyText={form.bodyText} variables={form.variables}
                  headerType={form.headerType} headerText={form.headerText} footerText={form.footerText} buttons={form.buttons}
                  headerMediaPath={form.headerMediaPath} headerMediaUrl={form.headerMedia}/>
              </div>
            </div>
          )}

          {/* Step 2 — Preview */}
          {step===2 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-4">Summary</h3>
                {[
                  {l:'Name',      v:form.name},
                  {l:'Template',  v:tpl?.name||'—'},
                  {l:'Audience',  v:`${audienceCount} contacts`},
                  {l:'Header',    v:form.headerType==='none'?'None':form.headerType},
                  {l:'Buttons',   v:form.buttons.length>0?form.buttons.map(b=>b.label).join(', '):'None'},
                  {l:'Schedule',  v:form.scheduleType==='now'?'Immediately':form.scheduleTime||'Not set'},
                ].map(r=>(
                  <div key={r.l} className="flex justify-between py-2.5 border-b border-slate-100">
                    <span className="text-sm text-slate-500">{r.l}</span>
                    <span className="text-sm font-semibold text-slate-800 text-right max-w-[220px] truncate">{r.v}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-center">
                <WaPreview templateName={tpl?.name} bodyText={form.bodyText} variables={form.variables}
                  headerType={form.headerType} headerText={form.headerText} footerText={form.footerText} buttons={form.buttons}
                  headerMediaPath={form.headerMediaPath} headerMediaUrl={form.headerMedia}/>
              </div>
            </div>
          )}

          {/* Step 3 — Schedule */}
          {step===3 && (
            <div className="max-w-lg space-y-3">
              {[
                {v:'now',   icon:'🚀', label:'Send immediately',  sub:'Starts right after you confirm'},
                {v:'later', icon:'⏰', label:'Schedule for later', sub:'Pick a date and time'},
              ].map(o=>(
                <label key={o.v} className={`flex items-start gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all ${form.scheduleType===o.v?'border-blue-500 bg-blue-50':'border-slate-200 hover:border-slate-300'}`}>
                  <span className="text-2xl">{o.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <input type="radio" checked={form.scheduleType===o.v} onChange={()=>set('scheduleType',o.v)} className="accent-blue-600"/>
                      <p className="text-sm font-bold text-slate-700">{o.label}</p>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 ml-5">{o.sub}</p>
                  </div>
                </label>
              ))}
              {form.scheduleType==='later' && (
                <input type="datetime-local" value={form.scheduleTime} onChange={e=>set('scheduleTime',e.target.value)}
                  min={nowISTLocal()} className={inp}/>
              )}
            </div>
          )}

          {/* Step 4 — Review */}
          {step===4 && (
            <div className="max-w-2xl space-y-5">
              <div className="grid grid-cols-3 gap-4">
                {[
                  {l:'Recipients', v:audienceCount.toLocaleString(), c:'text-blue-600', bg:'bg-blue-50'},
                  {l:'Template',   v:tpl?.name||'—',                 c:'text-slate-700',bg:'bg-slate-50'},
                  {l:'Send',       v:form.scheduleType==='now'?'Now':form.scheduleTime?.replace('T',' ')||'—', c:'text-emerald-600',bg:'bg-emerald-50'},
                ].map(s=>(
                  <div key={s.l} className={`${s.bg} border border-slate-100 rounded-2xl p-4 text-center`}>
                    <p className={`text-xl font-bold truncate ${s.c}`}>{s.v}</p>
                    <p className="text-xs text-slate-500 mt-1">{s.l}</p>
                  </div>
                ))}
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm">
                <p className="font-bold text-amber-800 mb-2">⚠ Before sending</p>
                <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                  <li>Messages will be sent to <strong>{audienceCount}</strong> contact{audienceCount!==1?'s':''}</li>
                  <li>Only APPROVED templates work for outbound broadcasts</li>
                  <li>Meta requires components type in <strong>lowercase</strong> (header, body, button) — handled automatically</li>
                  <li>Cannot be undone once sending starts</li>
                </ul>
              </div>
              <label className={`flex items-center gap-3 p-4 border rounded-2xl cursor-pointer transition-colors ${confirmChecked?'bg-emerald-50 border-emerald-300':'bg-slate-50 border-slate-200'}`}>
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-emerald-600"
                  checked={confirmChecked}
                  onChange={e=>setConfirmChecked(e.target.checked)}
                />
                <span className="text-sm text-slate-700">I confirm this broadcast is ready to send to <strong>{audienceCount} contact{audienceCount!==1?'s':''}</strong></span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <span className="text-xs text-slate-400">{audienceCount} recipient{audienceCount!==1?'s':''}</span>
          <div className="flex gap-3">
            {step>0 && <button type="button" onClick={()=>setStep(s=>s-1)} className="px-5 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-100 transition-colors">← Back</button>}
            {step<STEPS.length-1
              ? <button type="button" onClick={()=>{ if(canNext) setStep(s=>s+1); else setError('Complete required fields') }}
                  className={`px-6 py-2.5 text-sm font-semibold rounded-xl transition-colors ${canNext?'bg-blue-600 hover:bg-blue-700 text-white':'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                  Continue →
                </button>
              : <button type="button"
                  onClick={()=>{ if(!confirmChecked){ setError('Please tick the confirmation box first'); return } if(audienceCount===0){ setError('No contacts selected'); return } setError(''); setConfirmOpen(true) }}
                  disabled={saving || !confirmChecked}
                  title={!confirmChecked ? 'Tick the confirmation box to continue' : ''}
                  className={`px-6 py-2.5 text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 ${confirmChecked && !saving ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                  {saving ? <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity=".3"/><path d="M22 12A10 10 0 0012 2" stroke="white" strokeWidth="3" strokeLinecap="round"/></svg>Launching…</> : form.scheduleType==='now' ? '🚀 Send Broadcast' : '⏰ Schedule'}
                </button>
            }
          </div>
        </div>

        {/* Confirmation dialog — nothing is sent until the user confirms here */}
        {showBulkAdd && (
          <BulkAddContacts
            onClose={()=>setShowBulkAdd(false)}
            onDone={()=>{ onContactsChanged && onContactsChanged() }}
          />
        )}

        {confirmOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={()=>!saving&&setConfirmOpen(false)}>
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden" onClick={e=>e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-xl">
                    {form.scheduleType==='now' ? '🚀' : '⏰'}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">
                      {form.scheduleType==='now' ? 'Send this broadcast now?' : 'Schedule this broadcast?'}
                    </h3>
                    <p className="text-xs text-slate-500">This cannot be undone once sending starts.</p>
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-slate-500">Template</span><span className="font-semibold text-slate-700">{tpl?.name || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Recipients</span><span className="font-bold text-emerald-600">{audienceCount.toLocaleString()} contact{audienceCount===1?'':'s'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">When</span><span className="font-semibold text-slate-700">{form.scheduleType==='now' ? 'Immediately' : (form.scheduleTime || 'Not set')}</span></div>
                </div>
                {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
              </div>
              <div className="flex gap-3 px-6 pb-6">
                <button type="button" disabled={saving} onClick={()=>setConfirmOpen(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button type="button" disabled={saving} onClick={submit}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                  {saving ? <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity=".3"/><path d="M22 12A10 10 0 0012 2" stroke="white" strokeWidth="3" strokeLinecap="round"/></svg>Sending…</> : (form.scheduleType==='now' ? 'Yes, send now' : 'Yes, schedule')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Broadcasts() {
  const [broadcasts, setBroadcasts] = useState([])
  const [total,      setTotal]      = useState(0)
  const [loading,    setLoading]    = useState(false)
  const [search,     setSearch]     = useState('')
  const [filter,     setFilter]     = useState('')
  const [templates,  setTemplates]  = useState([])
  const [contacts,   setContacts]   = useState([])

  // Modal states
  const [showCreate, setShowCreate] = useState(false)
  const [viewing,    setViewing]    = useState(null)   // broadcast to view
  const [editing,    setEditing]    = useState(null)   // broadcast to edit

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/broadcasts?limit=100')
      setBroadcasts(data.broadcasts || [])
      setTotal(data.total || 0)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const loadContacts = useCallback(async () => {
    const all = []; let page = 1
    while (true) {
      try {
        const { data } = await api.get(`/contacts?limit=100&page=${page}`)
        const batch = data.contacts || []
        all.push(...batch)
        if (batch.length < 100 || page >= 50) break
        page++
      } catch { break }
    }
    setContacts(all)
  }, [])

  useEffect(() => {
    api.get('/templates/local').then(r => setTemplates((r.data.templates||[]).filter(t=>t.status==='APPROVED'))).catch(()=>{})
    loadContacts()
  }, [loadContacts])

  const sendNow = async id => {
    if (!confirm('Send this broadcast now?')) return
    try { await api.post(`/broadcasts/${id}/send`); load() }
    catch (e) { alert(e.response?.data?.detail || 'Error') }
  }

  const resetBc = async id => {
    if (!confirm('Reset this broadcast to Draft?')) return
    try { await api.post(`/broadcasts/${id}/reset`); load() }
    catch (e) { alert(e.response?.data?.detail || 'Error') }
  }

  const deleteBc = async id => {
    try { await api.delete(`/broadcasts/${id}`); load() }
    catch (e) { alert(e.response?.data?.detail || 'Error') }
  }

  const duplicate = async b => {
    try {
      // Copy the whole configuration — audience, template payload and header —
      // so the copy is a faithful, editable draft, not a stripped-down shell.
      await api.post('/broadcasts', {
        name:                 `${b.name} (copy)`,
        template_name:        b.template_name,
        template_language:    b.template_language,
        audience_type:        b.audience_type || 'all',
        audience_tags:        b.audience_tags || [],
        audience_contact_ids: b.audience_contact_ids || [],
        components:           b.components || [],
        variables:            b.variables || {},
        header_type:          b.header_type || 'none',
        header_text:          b.header_text || '',
        header_media:         b.header_media || '',
        button_payloads:      b.button_payloads || [],
        schedule_type:        'draft',
      })
      load()
    } catch (e) { alert(e.response?.data?.detail || 'Error') }
  }

  const filtered = broadcasts.filter(b => {
    const q = search.toLowerCase()
    return (!q || b.name?.toLowerCase().includes(q) || b.template_name?.toLowerCase().includes(q))
        && (!filter || b.status === filter)
  })

  const stats = {
    total:     broadcasts.length,
    // "Sent" counts fully- and partly-delivered campaigns (partial still reached people)
    completed: broadcasts.filter(b=>b.status==='completed'||b.status==='partial').length,
    scheduled: broadcasts.filter(b=>b.status==='scheduled').length,
    // Reach = messages actually sent, not audience size (which counts failures too)
    reach:     broadcasts.reduce((a,b)=>a+(b.sent_count||0),0),
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Top header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-screen-xl mx-auto">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Broadcasts</h1>
            <p className="text-sm text-slate-400 mt-0.5">Send WhatsApp campaigns to your contacts</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all">
            + Create Broadcast
          </button>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            {l:'Total Campaigns',   v:stats.total,                      c:'text-slate-700' },
            {l:'Sent',              v:stats.completed,                  c:'text-emerald-600'},
            {l:'Scheduled',         v:stats.scheduled,                  c:'text-blue-600'  },
            {l:'Total Reach',       v:stats.reach.toLocaleString(),     c:'text-violet-600' },
          ].map(s=>(
            <div key={s.l} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <p className={`text-2xl font-bold ${s.c}`}>{s.v}</p>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 flex gap-3 flex-wrap shadow-sm">
          <div className="relative flex-1 min-w-48">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="none"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/><path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search campaigns…"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 transition-all"/>
          </div>
          <select value={filter} onChange={e=>setFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-2.5 outline-none appearance-none cursor-pointer focus:border-blue-400 min-w-36">
            <option value="">All statuses</option>
            {Object.entries(ST).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
          {(search||filter) && (
            <button onClick={()=>{setSearch('');setFilter('')}} className="text-sm text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors">Clear</button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                {['Campaign','Template','Status','Recipients','Sent','Delivered','Read','Date','Actions'].map(h=>(
                  <th key={h} className="px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && [...Array(3)].map((_,i)=>(
                <tr key={i} className="border-b border-slate-50">
                  {[...Array(9)].map((_,j)=>(
                    <td key={j} className="px-5 py-4"><div className="h-4 bg-slate-100 rounded animate-pulse" style={{width:['140px','90px','70px','50px','50px','60px','50px','80px','80px'][j]}}/></td>
                  ))}
                </tr>
              ))}

              {!loading && filtered.length===0 && (
                <tr><td colSpan={9}>
                  <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-400">
                    <span className="text-5xl opacity-30">📢</span>
                    <div className="text-center">
                      <p className="text-base font-semibold text-slate-600">No broadcasts yet</p>
                      <p className="text-sm mt-1">Create your first campaign</p>
                    </div>
                    <button onClick={()=>setShowCreate(true)} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
                      + Create Broadcast
                    </button>
                  </div>
                </td></tr>
              )}

              {!loading && filtered.map((b,ri)=>(
                <tr key={b.id}
                  onClick={()=>setViewing(b)}
                  className={`border-b border-slate-50 last:border-0 hover:bg-slate-50/80 transition-colors cursor-pointer ${ri%2===1?'bg-slate-50/30':''}`}>
                  <td className="px-5 py-4">
                    <p className="text-sm font-semibold text-slate-800">{b.name}</p>
                    {b.audience_type==='contact_ids'&&<p className="text-xs text-blue-500 mt-0.5">📋 {(b.audience_contact_ids||[]).length} contacts</p>}
                    {b.audience_type==='tag'&&b.audience_tags?.[0]&&<p className="text-xs text-violet-500 mt-0.5">🏷 {b.audience_tags[0]}</p>}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">{b.template_name||'—'}</span>
                  </td>
                  <td className="px-5 py-4"><Badge status={b.status}/></td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-700">{(b.total_recipients||0).toLocaleString()}</td>
                  <td className="px-5 py-4 text-sm text-slate-600">{(b.sent_count||0).toLocaleString()}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-emerald-600 font-medium">{(b.delivered_count||0).toLocaleString()}</span>
                      {b.total_recipients>0&&<span className="text-xs text-slate-400">{pct(b.delivered_count||0,b.total_recipients)}%</span>}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-violet-600 font-medium">{(b.read_count||0).toLocaleString()}</span>
                      {b.total_recipients>0&&<span className="text-xs text-slate-400">{pct(b.read_count||0,b.total_recipients)}%</span>}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs text-slate-500">{fmt(b.created_at)}</td>
                  <td className="px-5 py-4" onClick={e=>e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      {b.status==='draft'&&(
                        <button onClick={()=>sendNow(b.id)} title="Send now" className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors text-sm">▶</button>
                      )}
                      {(b.status==='running'||b.status==='queued'||b.status==='failed')&&(
                        <button onClick={()=>resetBc(b.id)} title="Reset to draft" className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors font-bold text-sm">↺</button>
                      )}
                      <button
                        onClick={()=>setEditing(b)}
                        title={['draft','scheduled'].includes(b.status) ? 'Edit' : 'Edit as new draft'}
                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors text-sm">✏️</button>
                      <button onClick={()=>duplicate(b)} title="Duplicate" className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors text-sm">⧉</button>
                      <button onClick={()=>{ if(confirm('Delete?')) deleteBc(b.id) }} title="Delete" className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors text-sm">🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length>0&&(
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-400">
              Showing {filtered.length} of {total} campaigns · Click any row to view details
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreate && (
        <CreateWizard onClose={()=>setShowCreate(false)} onCreated={load} templates={templates} contacts={contacts} onContactsChanged={loadContacts}/>
      )}
      {viewing && (
        <ViewModal
          broadcast={viewing}
          onClose={()=>setViewing(null)}
          onEdit={b=>setEditing(b)}
          onDelete={id=>{ deleteBc(id); setViewing(null) }}
          onSend={id=>{ sendNow(id); setViewing(null) }}
          onReset={id=>{ resetBc(id); setViewing(null) }}
          onResent={load}
        />
      )}
      {editing && (
        <EditModal
          broadcast={editing}
          templates={templates}
          contacts={contacts}
          onClose={()=>setEditing(null)}
          onSaved={()=>{ load(); setEditing(null) }}
        />
      )}
    </div>
  )
}