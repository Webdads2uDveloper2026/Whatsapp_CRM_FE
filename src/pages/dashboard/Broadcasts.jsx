import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../../services/api'

// ── Status config ─────────────────────────────────────────────────────────────
const ST = {
  draft:     { cls:'bg-slate-100 text-slate-600 border-slate-200',   dot:'bg-slate-400',   label:'Draft'     },
  scheduled: { cls:'bg-blue-50 text-blue-600 border-blue-200',       dot:'bg-blue-500',    label:'Scheduled' },
  queued:    { cls:'bg-amber-50 text-amber-500 border-amber-200',     dot:'bg-amber-400',   label:'Queued'    },
  running:   { cls:'bg-amber-50 text-amber-600 border-amber-200',     dot:'bg-amber-500 animate-pulse', label:'Sending…' },
  completed: { cls:'bg-emerald-50 text-emerald-600 border-emerald-200', dot:'bg-emerald-500', label:'Sent'   },
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

const fmt     = iso => iso ? new Date(iso).toLocaleDateString([],{day:'numeric',month:'short',year:'numeric'}) : '—'
const fmtTime = iso => iso ? new Date(iso).toLocaleString([],{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'
const pct     = (n, t) => t > 0 ? Math.round((n/t)*100) : 0

// ── WhatsApp Preview ──────────────────────────────────────────────────────────
function WaPreview({ templateName, bodyText, variables = {}, headerType, headerText, footerText, buttons = [] }) {
  const body = (bodyText || '').replace(/\{\{(\w+)\}\}/g, (_, k) => variables[k] || `{{${k}}}`)
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
                <div className={`px-2.5 pt-2 text-[10px] font-bold text-slate-800 ${headerType === 'image' ? 'bg-slate-100 py-4 text-center text-slate-400' : ''}`}>
                  {headerType === 'image' ? '🖼 Image' : headerText}
                </div>
              )}
              <div className="px-2.5 py-2">
                <p className="text-[10px] text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {body || <span className="text-slate-300 italic">Preview…</span>}
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

  const allOptedIn = contacts.filter(c => c.opted_in)
  const allTags    = [...new Set(contacts.flatMap(c => c.tags || []))]

  const filtered = allOptedIn.filter(c => {
    const q = search.toLowerCase()
    return (!q || c.profile_name?.toLowerCase().includes(q) || c.wa_id?.includes(q))
        && (!tagFilter || (c.tags||[]).includes(tagFilter))
  })

  const bg = name => {
    const cols = ['bg-violet-500','bg-blue-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-cyan-500']
    let h = 0; for (const ch of name||'') h = ch.charCodeAt(0)+((h<<5)-h)
    return cols[Math.abs(h)%cols.length]
  }

  const audienceCount = mode==='all' ? allOptedIn.length
    : mode==='tag' ? allOptedIn.filter(c=>(c.tags||[]).includes(tagFilter)).length
    : selectedIds.length

  return (
    <div className="space-y-3">
      {/* Mode tabs */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { v:'all',  icon:'👥', label:'All Contacts',  sub:`${allOptedIn.length} opted-in` },
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
          <p className="text-sm font-semibold text-emerald-700">{allOptedIn.length} opted-in contacts will receive this broadcast</p>
        </div>
      )}

      {/* Mode: Tag */}
      {mode==='tag' && (
        <div className="space-y-2">
          <select value={tagFilter} onChange={e => setTagFilter(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 appearance-none cursor-pointer">
            <option value="">— choose a tag —</option>
            {allTags.map(t => <option key={t}>{t}</option>)}
          </select>
          {tagFilter && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <span className="text-xl">🏷️</span>
              <p className="text-sm font-semibold text-blue-700">
                {allOptedIn.filter(c=>(c.tags||[]).includes(tagFilter)).length} contacts tagged <code className="font-mono">"{tagFilter}"</code>
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
              className="flex-1 bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-xs outline-none focus:border-blue-400" />
            <select value={tagFilter} onChange={e=>setTagFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs appearance-none cursor-pointer outline-none">
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
            {filtered.length===0 && <p className="py-8 text-center text-slate-400 text-sm">No opted-in contacts</p>}
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
function ViewModal({ broadcast: b, onClose, onEdit, onDelete, onSend, onReset }) {
  const [contacts,      setContacts]     = useState([])
  const [loadingCtx,    setLoadingCtx]   = useState(false)
  const [ctxTotal,      setCtxTotal]     = useState(0)
  const [tab,           setTab]          = useState('details')

  useEffect(() => {
    if (tab !== 'contacts') return
    setLoadingCtx(true)
    api.get(`/broadcasts/${b.id}/contacts?limit=50`).then(r => {
      setContacts(r.data.contacts || [])
      setCtxTotal(r.data.total || 0)
    }).catch(()=>{}).finally(()=>setLoadingCtx(false))
  }, [tab, b.id])

  const total = b.total_recipients || 0

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
                  { l:'Total', v:total,               c:'text-slate-700', bg:'bg-slate-50' },
                  { l:'Sent',  v:b.sent_count||0,     c:'text-blue-600',  bg:'bg-blue-50'  },
                  { l:'Delivered', v:b.delivered_count||0, c:'text-emerald-600', bg:'bg-emerald-50' },
                  { l:'Read',  v:b.read_count||0,     c:'text-violet-600',bg:'bg-violet-50'},
                ].map(s => (
                  <div key={s.l} className={`${s.bg} rounded-xl p-4 text-center border border-slate-100`}>
                    <p className={`text-2xl font-bold ${s.c}`}>{s.v.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400 mt-1 font-semibold uppercase tracking-wider">{s.l}</p>
                  </div>
                ))}
              </div>
              {[
                { l:'Sent',      v:b.sent_count||0,      color:'bg-blue-400'    },
                { l:'Delivered', v:b.delivered_count||0, color:'bg-emerald-400' },
                { l:'Read',      v:b.read_count||0,      color:'bg-violet-400'  },
                { l:'Failed',    v:b.failed_count||0,    color:'bg-red-400'     },
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
            </div>
          )}

          {/* Contacts tab */}
          {tab==='contacts' && (
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-3">
                {ctxTotal} contact{ctxTotal!==1?'s':''} in audience
              </p>
              {loadingCtx && <div className="py-8 text-center text-slate-400 text-sm">Loading…</div>}
              {!loadingCtx && contacts.length === 0 && (
                <div className="py-8 text-center text-slate-400 text-sm">No contacts found</div>
              )}
              <div className="space-y-2">
                {contacts.map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {(c.profile_name||c.wa_id||'?').slice(0,2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{c.profile_name || <span className="text-slate-400 italic">No name</span>}</p>
                      <p className="text-xs text-slate-400 font-mono">+{c.wa_id}</p>
                    </div>
                    {(c.tags||[]).map(t=>(
                      <span key={t} className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full hidden sm:block">{t}</span>
                    ))}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.opted_in?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-500'}`}>
                      {c.opted_in?'Opted In':'Not opted'}
                    </span>
                  </div>
                ))}
              </div>
              {ctxTotal > 50 && (
                <p className="text-xs text-slate-400 text-center mt-3">Showing 50 of {ctxTotal} contacts</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Edit modal ────────────────────────────────────────────────────────────────
function EditModal({ broadcast: b, templates, onClose, onSaved }) {
  const [form,   setForm]   = useState({ name:b.name, template_id:'', template_language:b.template_language })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const save = async e => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const tpl = templates.find(t => t.id === form.template_id)
      await api.patch(`/broadcasts/${b.id}`, {
        name:             form.name,
        template_name:    tpl?.name    || b.template_name,
        template_language: tpl?.language || form.template_language,
      })
      onSaved(); onClose()
    } catch (e) { setError(e.response?.data?.detail || 'Save failed') }
    setSaving(false)
  }

  const inp = "w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all text-slate-700"

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">Edit Broadcast</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2.5 rounded-xl">{error}</div>}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Campaign Name</label>
            <input required value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Change Template (optional)</label>
            <select value={form.template_id} onChange={e=>setForm(p=>({...p,template_id:e.target.value}))} className={`${inp} appearance-none cursor-pointer`}>
              <option value="">— Keep: {b.template_name} —</option>
              {templates.map(t=><option key={t.id} value={t.id}>{t.name} ({t.language})</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white text-sm font-semibold rounded-xl transition-colors">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Create Wizard ─────────────────────────────────────────────────────────────
const STEPS = ['Details & Audience', 'Message', 'Preview', 'Schedule', 'Review & Send']

function CreateWizard({ onClose, onCreated, templates, contacts }) {
  const [step,   setStep]   = useState(0)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const [form, setForm] = useState({
    name:'', audienceMode:'all', audienceTag:'', selectedIds:[],
    templateId:'', headerType:'none', headerText:'', headerMedia:'',
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
      headerText:hdr?.format==='TEXT'?(hdr.text||''):'', buttons:btns }))
  }

  const bodyVars = [...new Set((form.bodyText.match(/\{\{(\w+)\}\}/g)||[]).map(m=>m.replace(/[{}]/g,'')))]

  const allOptedIn = contacts.filter(c=>c.opted_in)
  const audienceCount = useMemo(() => {
    if (form.audienceMode==='all')  return allOptedIn.length
    if (form.audienceMode==='tag')  return allOptedIn.filter(c=>(c.tags||[]).includes(form.audienceTag)).length
    return form.selectedIds.length
  }, [form.audienceMode, form.audienceTag, form.selectedIds.length, allOptedIn.length])

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
                <label className={lbl}>Select Audience <span className="text-red-400">*</span></label>
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
                            <code className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-mono shrink-0">{`{{${v}}}`}</code>
                            <input value={form.variables[v]||''} onChange={e=>setForm(p=>({...p,variables:{...p.variables,[v]:e.target.value}}))}
                              placeholder={`Value for ${v}`} className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-blue-400"/>
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
                            className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white appearance-none outline-none">
                            <option value="reply">Reply</option><option value="url">URL</option><option value="phone">Call</option>
                          </select>
                          <input value={b.label} placeholder="Label" onChange={e=>setForm(p=>({...p,buttons:p.buttons.map((x,j)=>j===i?{...x,label:e.target.value}:x)}))}
                            className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-blue-400"/>
                          <button onClick={()=>setForm(p=>({...p,buttons:p.buttons.filter((_,j)=>j!==i)}))} className="text-slate-400 hover:text-red-500 text-lg leading-none">×</button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-center">
                <WaPreview templateName={tpl?.name} bodyText={form.bodyText} variables={form.variables}
                  headerType={form.headerType} headerText={form.headerText} footerText={form.footerText} buttons={form.buttons}/>
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
                  headerType={form.headerType} headerText={form.headerText} footerText={form.footerText} buttons={form.buttons}/>
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
                  min={new Date().toISOString().slice(0,16)} className={inp}/>
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
                  <li>Messages will be sent to <strong>{audienceCount}</strong> opted-in contacts</li>
                  <li>Only APPROVED templates work for outbound broadcasts</li>
                  <li>Meta requires components type in <strong>lowercase</strong> (header, body, button) — handled automatically</li>
                  <li>Cannot be undone once sending starts</li>
                </ul>
              </div>
              <label className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-blue-600" required/>
                <span className="text-sm text-slate-700">I confirm this broadcast is ready to send to <strong>{audienceCount} contacts</strong></span>
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
              : <button type="button" onClick={submit} disabled={saving}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2">
                  {saving ? <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity=".3"/><path d="M22 12A10 10 0 0012 2" stroke="white" strokeWidth="3" strokeLinecap="round"/></svg>Launching…</> : form.scheduleType==='now' ? '🚀 Send Broadcast' : '⏰ Schedule'}
                </button>
            }
          </div>
        </div>
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

  useEffect(() => {
    api.get('/templates/local').then(r => setTemplates((r.data.templates||[]).filter(t=>t.status==='APPROVED'))).catch(()=>{})

    const fetchAll = async () => {
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
    }
    fetchAll()
  }, [])

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
      await api.post('/broadcasts', {
        name:              `${b.name} (copy)`,
        template_name:     b.template_name,
        template_language: b.template_language,
        audience_type:     b.audience_type || 'all',
        schedule_type:     'draft',
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
    completed: broadcasts.filter(b=>b.status==='completed').length,
    scheduled: broadcasts.filter(b=>b.status==='scheduled').length,
    reach:     broadcasts.reduce((a,b)=>a+(b.total_recipients||0),0),
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
                      {b.status==='draft'&&(
                        <button onClick={()=>setEditing(b)} title="Edit" className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors text-sm">✏️</button>
                      )}
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
        <CreateWizard onClose={()=>setShowCreate(false)} onCreated={load} templates={templates} contacts={contacts}/>
      )}
      {viewing && (
        <ViewModal
          broadcast={viewing}
          onClose={()=>setViewing(null)}
          onEdit={b=>setEditing(b)}
          onDelete={id=>{ deleteBc(id); setViewing(null) }}
          onSend={id=>{ sendNow(id); setViewing(null) }}
          onReset={id=>{ resetBc(id); setViewing(null) }}
        />
      )}
      {editing && (
        <EditModal
          broadcast={editing}
          templates={templates}
          onClose={()=>setEditing(null)}
          onSaved={()=>{ load(); setEditing(null) }}
        />
      )}
    </div>
  )
}