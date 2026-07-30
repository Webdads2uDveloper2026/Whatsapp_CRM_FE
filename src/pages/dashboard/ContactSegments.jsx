import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../../services/api'
import TemplateText, { extractVars } from '../../components/TemplateText'

// ── Shared bits ────────────────────────────────────────────────────────────────
const inp = 'w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all'
const bgFor = name => {
  const cols = ['bg-violet-500','bg-blue-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-cyan-500']
  let h = 0; for (const ch of name || '') h = ch.charCodeAt(0) + ((h << 5) - h)
  return cols[Math.abs(h) % cols.length]
}
const Avatar = ({ name = '?', size = 'w-8 h-8 text-[11px]' }) => (
  <div className={`${size} rounded-full ${bgFor(name)} flex items-center justify-center text-white font-bold shrink-0`}>
    {(name || '?').slice(0, 2).toUpperCase()}
  </div>
)

// ── Contact picker (search + checkboxes) ───────────────────────────────────────
function ContactPicker({ contacts, selectedIds, onChange }) {
  const [search, setSearch] = useState('')
  const filtered = contacts.filter(c => {
    const q = search.toLowerCase()
    return !q || c.profile_name?.toLowerCase().includes(q) || c.wa_id?.includes(q)
  })
  const toggle = id =>
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id])

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 bg-slate-50">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts…"
          className="flex-1 bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-400" />
        <button type="button" onClick={() => onChange(filtered.map(c => c.id))}
          className="text-xs text-blue-600 font-semibold px-2 hover:underline whitespace-nowrap">All</button>
        {selectedIds.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-xs text-slate-400 hover:text-slate-600 px-1">Clear</button>
        )}
      </div>
      {selectedIds.length > 0 && (
        <div className="px-3 py-1.5 bg-blue-50 border-b border-blue-100 text-xs font-semibold text-blue-600">
          {selectedIds.length} selected
        </div>
      )}
      <div className="max-h-64 overflow-y-auto">
        {filtered.length === 0 && <p className="py-8 text-center text-slate-400 text-sm">No contacts</p>}
        {filtered.map(c => {
          const sel = selectedIds.includes(c.id)
          return (
            <div key={c.id} onClick={() => toggle(c.id)}
              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b border-slate-50 last:border-0 transition-colors ${sel ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${sel ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                {sel && <svg viewBox="0 0 12 10" fill="none" className="w-3 h-3"><path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </div>
              <Avatar name={c.profile_name || c.wa_id} size="w-7 h-7 text-[10px]" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">{c.profile_name || <span className="text-slate-400 italic">No name</span>}</p>
                <p className="text-[10px] text-slate-400 font-mono">+{c.wa_id}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Create / Edit group modal ──────────────────────────────────────────────────
function GroupModal({ group, contacts, onClose, onSaved }) {
  const editing = !!group
  const [name, setName] = useState(group?.name || '')
  const [description, setDescription] = useState(group?.description || '')
  const [memberIds, setMemberIds] = useState(group?.member_ids || [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async e => {
    e.preventDefault()
    if (!name.trim()) { setError('Group name is required'); return }
    setSaving(true); setError('')
    try {
      const payload = { name: name.trim(), description: description.trim(), member_ids: memberIds }
      if (editing) await api.patch(`/segments/${group.id}`, payload)
      else await api.post('/segments', payload)
      onSaved(); onClose()
    } catch (err) { setError(err.response?.data?.detail || 'Save failed') }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl my-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-sm font-bold text-slate-800">{editing ? 'Edit Group' : 'Create Group'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={save} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2.5 rounded-xl">{error}</div>}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Group Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. VIP customers" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description <span className="text-slate-400 font-normal">(optional)</span></label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this group for?" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Members <span className="text-slate-400 font-normal">({memberIds.length} selected)</span></label>
            <ContactPicker contacts={contacts} selectedIds={memberIds} onChange={setMemberIds} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white text-sm font-semibold rounded-xl transition-colors">
              {saving ? 'Saving…' : editing ? 'Save Changes' : `Create Segment (${memberIds.length})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Send-to-group modal ────────────────────────────────────────────────────────
function SendModal({ group, templates, onClose, onSent }) {
  const [templateId, setTemplateId] = useState('')
  const [variables, setVariables] = useState({})
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)

  const tpl = templates.find(t => t.id === templateId)
  const bodyText = tpl?.components?.find(c => c.type === 'BODY')?.text || ''
  const headerComp = tpl?.components?.find(c => c.type === 'HEADER')
  const bodyVars = extractVars(bodyText)
  const missing = bodyVars.filter(v => !(variables[v] || '').trim())

  const send = async () => {
    if (!tpl) { setError('Choose a template'); return }
    if (missing.length) { setError(`Fill all variables: ${missing.map(v => `{{${v}}}`).join(', ')}`); return }
    setSending(true); setError('')
    try {
      const cleanVars = {}
      bodyVars.forEach(v => { if ((variables[v] || '').trim()) cleanVars[v] = variables[v] })
      const { data } = await api.post(`/segments/${group.id}/send`, {
        template_name: tpl.name,
        template_language: tpl.language || 'en_US',
        variables: cleanVars,
        header_type: headerComp ? (headerComp.format || 'none').toLowerCase() : 'none',
        header_text: headerComp?.format === 'TEXT' ? (headerComp.text || '') : '',
      })
      setDone(data)
      onSent && onSent()
    } catch (err) { setError(err.response?.data?.detail || err.response?.data?.info || 'Send failed') }
    setSending(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg my-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Send to “{group.name}”</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{group.member_count} member{group.member_count === 1 ? '' : 's'} · one template each</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        {done ? (
          <div className="p-8 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-2xl">🚀</div>
            <h3 className="text-sm font-bold text-slate-800">Sending started</h3>
            <p className="text-xs text-slate-500">{done.info || `Delivering to ${done.recipients} members`}</p>
            <p className="text-[11px] text-slate-400">Track delivery on the Broadcasts page.</p>
            <button onClick={onClose} className="mt-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-xl transition-colors">Done</button>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {error && <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2.5 rounded-xl">{error}</div>}
            <div className="bg-amber-50 border border-amber-200 text-amber-700 text-[11px] px-3 py-2 rounded-xl">
              WhatsApp doesn't support group chats — each member receives the template individually. Only <b>approved</b> templates can be sent.
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Template</label>
              <select value={templateId} onChange={e => { setTemplateId(e.target.value); setVariables({}) }} className={`${inp} appearance-none cursor-pointer`}>
                <option value="">— choose an approved template —</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name} ({t.language})</option>)}
              </select>
            </div>

            {tpl && (
              <>
                {bodyVars.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Variables</label>
                    <div className="space-y-2">
                      {bodyVars.map(v => (
                        <div key={v} className="flex items-center gap-2">
                          <code className={`text-[11px] px-2 py-1 rounded font-mono shrink-0 border ${(variables[v] || '').trim() ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-700 border-dashed border-amber-300'}`}>{`{{${v}}}`}</code>
                          <input value={variables[v] || ''} onChange={e => setVariables(p => ({ ...p, [v]: e.target.value }))}
                            placeholder={`Value for {{${v}}}`}
                            className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-blue-400" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Preview</label>
                  <div className="bg-[#ECE5DD] rounded-xl p-3">
                    <div className="bg-white rounded-lg rounded-tl-sm shadow-sm px-3 py-2 max-w-[85%]">
                      {headerComp?.format === 'TEXT' && headerComp.text && (
                        <p className="text-[11px] font-bold text-slate-800 mb-1">{headerComp.text}</p>
                      )}
                      {['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp?.format) && (
                        <div className="bg-slate-100 rounded py-3 text-center text-[10px] text-slate-400 mb-1">
                          {headerComp.format === 'IMAGE' ? '🖼 Image' : headerComp.format === 'VIDEO' ? '🎬 Video' : '📄 Document'} header
                        </div>
                      )}
                      <p className="text-[11px] text-slate-800 whitespace-pre-wrap leading-relaxed">
                        <TemplateText text={bodyText} variables={variables} />
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
              <button type="button" onClick={send} disabled={sending || !tpl}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white text-sm font-semibold rounded-xl transition-colors">
                {sending ? 'Sending…' : `Send to ${group.member_count}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ContactSegments() {
  const [groups, setGroups] = useState([])
  const [contacts, setContacts] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editGroup, setEditGroup] = useState(undefined)   // undefined=closed, null=create, obj=edit
  const [sendGroup, setSendGroup] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    api.get('/segments').then(r => setGroups(r.data.groups || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // Load ALL contacts (paginated) + approved templates once
  useEffect(() => {
    api.get('/templates/local')
      .then(r => setTemplates((r.data.templates || []).filter(t => t.status === 'APPROVED')))
      .catch(() => {})
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

  const remove = async g => {
    if (!confirm(`Delete segment “${g.name}”? Contacts are not deleted.`)) return
    try { await api.delete(`/segments/${g.id}`); load() }
    catch (e) { alert(e.response?.data?.detail || 'Delete failed') }
  }

  const filtered = useMemo(() =>
    groups.filter(g => !search || g.name.toLowerCase().includes(search.toLowerCase())),
    [groups, search])

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-6">
      <div className="max-w-screen-xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Contact Segments</h1>
            <p className="text-sm text-slate-500">Save contacts into reusable segments and message them together</p>
          </div>
          <button onClick={() => setEditGroup(null)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
            + Create Segment
          </button>
        </div>

        {/* Search */}
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search segments…"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-sm text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400" />
        </div>

        {/* List */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-white border border-slate-200 rounded-2xl animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl py-16 flex flex-col items-center gap-4 text-slate-400">
            <span className="text-5xl opacity-30">👥</span>
            <div className="text-center">
              <p className="text-base font-semibold text-slate-600">No segments yet</p>
              <p className="text-sm mt-1">Create a segment to message a group of contacts at once</p>
            </div>
            <button onClick={() => setEditGroup(null)} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">+ Create Segment</button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(g => (
              <div key={g.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <Avatar name={g.name} size="w-10 h-10 text-sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{g.name}</p>
                    <p className="text-xs text-slate-500 truncate">{g.description || <span className="italic text-slate-400">No description</span>}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="bg-blue-50 text-blue-600 border border-blue-100 font-semibold px-2 py-0.5 rounded-full">
                    {g.member_count} member{g.member_count === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="flex gap-2 mt-auto pt-1">
                  <button onClick={() => setSendGroup(g)} disabled={g.member_count === 0}
                    className="flex-1 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg transition-colors">
                    Send
                  </button>
                  <button onClick={() => setEditGroup(g)} title="Edit / members"
                    className="px-3 py-2 text-xs font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">Edit</button>
                  <button onClick={() => remove(g)} title="Delete"
                    className="px-3 py-2 text-xs text-red-500 border border-slate-200 rounded-lg hover:bg-red-50 transition-colors">🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editGroup !== undefined && (
        <GroupModal group={editGroup} contacts={contacts} onClose={() => setEditGroup(undefined)} onSaved={load} />
      )}
      {sendGroup && (
        <SendModal group={sendGroup} templates={templates} onClose={() => setSendGroup(null)} onSent={load} />
      )}
    </div>
  )
}
