import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

// Decode the JWT payload (no verification) to identify the current actor.
function currentUser() {
  try {
    const tok = localStorage.getItem('access_token') || ''
    const p = JSON.parse(atob(tok.split('.')[1] || ''))
    return { id: p.sub || '', name: localStorage.getItem('user_name') || 'You' }
  } catch { return { id: '', name: 'You' } }
}

const bgFor = name => {
  const cols = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500']
  let h = 0; for (const ch of name || '') h = ch.charCodeAt(0) + ((h << 5) - h)
  return cols[Math.abs(h) % cols.length]
}
const Avatar = ({ name = '?', size = 'w-9 h-9 text-xs' }) => (
  <div className={`${size} rounded-full ${bgFor(name)} flex items-center justify-center text-white font-bold shrink-0`}>
    {(name || '?').slice(0, 2).toUpperCase()}
  </div>
)
const fmtTime = iso => { if (!iso) return ''; const d = new Date(/[Z+]/.test(String(iso).slice(-6)) ? iso : iso + 'Z'); return isNaN(d) ? '' : d.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) }

const TABS = [
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'mine',       label: 'My Chats' },
  { key: 'team',       label: 'Team' },
  { key: 'resolved',   label: 'Resolved' },
]

export default function TeamInbox() {
  const me = useMemo(currentUser, [])
  const navigate = useNavigate()
  const [tab, setTab] = useState('unassigned')
  const [teams, setTeams] = useState([])
  const [teamFilter, setTeamFilter] = useState('')
  const [agents, setAgents] = useState([])
  const [canned, setCanned] = useState([])
  const [tagFilter, setTagFilter] = useState('')
  const [search, setSearch] = useState('')
  const [convos, setConvos] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [notes, setNotes] = useState([])
  const [noteText, setNoteText] = useState('')
  const [showNotes, setShowNotes] = useState(true)
  const [text, setText] = useState('')
  const [newTag, setNewTag] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  // Reference data
  useEffect(() => {
    api.get('/agents').then(r => setAgents(r.data || [])).catch(() => {})
    api.get('/inbox/teams').then(r => { setTeams(r.data.teams || []); setTeamFilter((r.data.teams || [])[0]?.id || '') }).catch(() => {})
    api.get('/inbox/canned-responses').then(r => setCanned(r.data.canned_responses || [])).catch(() => {})
  }, [])

  // Canned-response autocomplete: when the composer text starts with "/", suggest
  // matching shortcuts; selecting one replaces the text with its message.
  const cannedMatches = useMemo(() => {
    const t = text.trim()
    if (!t.startsWith('/') || t.includes(' ')) return []
    return canned.filter(c => c.shortcut.toLowerCase().startsWith(t.toLowerCase())).slice(0, 6)
  }, [text, canned])

  const allTags = useMemo(() => [...new Set(convos.flatMap(c => c.tags || []))], [convos])

  const loadConvos = useCallback(() => {
    const p = new URLSearchParams()
    if (tab === 'unassigned') p.set('status', 'unassigned')
    else if (tab === 'resolved') p.set('status', 'resolved')
    else if (tab === 'mine') p.set('agent', me.id)
    else if (tab === 'team') { if (teamFilter) p.set('team', teamFilter); else return setConvos([]) }
    if (tagFilter) p.set('tag', tagFilter)
    if (search) p.set('search', search)
    api.get(`/inbox/conversations?${p}`).then(r => setConvos(r.data.conversations || [])).catch(() => {})
  }, [tab, teamFilter, tagFilter, search, me.id])

  useEffect(() => { loadConvos() }, [loadConvos])

  const openConvo = useCallback(c => {
    setSelected(c)
    api.get(`/conversations/${c.id}/messages?limit=50`).then(r => {
      setMessages(r.data.messages || [])
      setTimeout(() => bottomRef.current?.scrollIntoView(), 60)
    }).catch(() => setMessages([]))
    api.get(`/inbox/conversations/${c.id}/notes`).then(r => setNotes(r.data.notes || [])).catch(() => setNotes([]))
  }, [])

  const patchSelected = fields => {
    setSelected(s => ({ ...s, ...fields }))
    setConvos(cs => cs.map(c => c.id === selected.id ? { ...c, ...fields } : c))
  }

  const send = async () => {
    if (!text.trim() || !selected) return
    setSending(true)
    try {
      await api.post(`/conversations/${selected.id}/messages`, { msg_type: 'text', content: { body: text.trim() } })
      setText('')
      const r = await api.get(`/conversations/${selected.id}/messages?limit=50`)
      setMessages(r.data.messages || [])
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
    } catch (e) { alert(e.response?.data?.detail || 'Send failed') }
    setSending(false)
  }

  const assign = async (kind, id) => {
    const body = kind === 'agent' ? { agent_id: id } : { team_id: id }
    const { data } = await api.post(`/inbox/conversations/${selected.id}/assign`, body)
    patchSelected({
      inbox_status: data.inbox_status,
      assigned_agent_id: data.assigned_agent_id,
      assigned_team_id: data.assigned_team_id,
      assigned_agent_name: kind === 'agent' ? (agents.find(a => a.id === id)?.name || '') : selected.assigned_agent_name,
      assigned_team_name: kind === 'team' ? (teams.find(t => t.id === id)?.name || '') : selected.assigned_team_name,
    })
  }

  const resolve = async () => {
    await api.post(`/inbox/conversations/${selected.id}/resolve`)
    patchSelected({ inbox_status: 'resolved' })
    loadConvos()
  }
  const reopen = async () => {
    const { data } = await api.post(`/inbox/conversations/${selected.id}/reopen`)
    patchSelected({ inbox_status: data.inbox_status })
    loadConvos()
  }

  const addTag = async () => {
    const t = newTag.trim(); if (!t) return
    const { data } = await api.post(`/inbox/conversations/${selected.id}/tags`, { add: [t] })
    patchSelected({ tags: data.tags }); setNewTag('')
  }
  const removeTag = async t => {
    const { data } = await api.post(`/inbox/conversations/${selected.id}/tags`, { remove: [t] })
    patchSelected({ tags: data.tags })
  }

  const addNote = async () => {
    if (!noteText.trim()) return
    const { data } = await api.post(`/inbox/conversations/${selected.id}/notes`, {
      note: noteText.trim(), agent_id: me.id, agent_name: me.name,
    })
    setNotes(n => [...n, data]); setNoteText('')
  }

  const statusPill = s => ({
    unassigned: 'bg-slate-100 text-slate-500',
    assigned: 'bg-blue-50 text-blue-600',
    resolved: 'bg-emerald-50 text-emerald-600',
  }[s] || 'bg-slate-100 text-slate-500')

  return (
    <div className="h-screen flex bg-slate-50 font-sans text-slate-800">
      {/* ── Left: filters + list ─────────────────────────────────────────── */}
      <aside className="w-80 shrink-0 flex flex-col border-r border-slate-200 bg-white">
        <div className="p-3 border-b border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-sm font-bold">Team Inbox</h1>
            <button onClick={() => navigate('/dashboard/team-inbox/teams')}
              className="text-[11px] text-blue-600 hover:underline">⚙ Teams &amp; Canned</button>
          </div>
          <div className="flex gap-1 mb-2">
            {TABS.map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); setSelected(null) }}
                className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}>
                {t.label}
              </button>
            ))}
          </div>
          {tab === 'team' && (
            <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)}
              className="w-full mb-2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-700 outline-none">
              {teams.length === 0 && <option value="">No teams yet</option>}
              {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.member_count})</option>)}
            </select>
          )}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400" />
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {allTags.map(t => (
                <button key={t} onClick={() => setTagFilter(tagFilter === t ? '' : t)}
                  className={`text-[10px] px-2 py-0.5 rounded-full border ${tagFilter === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200'}`}>
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {convos.length === 0 && <p className="py-10 text-center text-slate-400 text-sm">No conversations</p>}
          {convos.map(c => (
            <div key={c.id} onClick={() => openConvo(c)}
              className={`flex items-start gap-3 px-3 py-3 cursor-pointer border-b border-slate-50 transition-colors ${selected?.id === c.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
              <Avatar name={c.contact_name} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold truncate">{c.contact_name}</span>
                  <span className="text-[10px] text-slate-400 shrink-0">{fmtTime(c.last_message_at)}</span>
                </div>
                <p className="text-xs text-slate-500 truncate">{c.last_message_preview || '…'}</p>
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {(c.tags || []).slice(0, 3).map(t => (
                    <span key={t} className="text-[9px] bg-amber-50 text-amber-600 border border-amber-100 px-1.5 py-0.5 rounded-full">{t}</span>
                  ))}
                  {c.assigned_agent_name && <span className="text-[9px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">@{c.assigned_agent_name}</span>}
                  {c.assigned_team_name && <span className="text-[9px] text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">#{c.assigned_team_name}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Middle: chat thread ──────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#ECE5DD]">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Select a conversation</div>
        ) : (
          <>
            <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center gap-3">
              <Avatar name={selected.contact_name} size="w-8 h-8 text-[10px]" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{selected.contact_name}</p>
                <p className="text-[11px] text-slate-400 font-mono">+{selected.wa_id}</p>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusPill(selected.inbox_status)}`}>{selected.inbox_status}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.map(m => {
                const out = m.direction === 'outbound'
                const body = m.content?.body || (m.msg_type !== 'text' ? `[${m.msg_type}]` : '')
                return (
                  <div key={m.id} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-3 py-2 rounded-xl text-sm shadow-sm ${out ? 'bg-[#DCF8C6] rounded-tr-sm' : 'bg-white rounded-tl-sm'}`}>
                      <p className="whitespace-pre-wrap text-slate-800">{body}</p>
                      <p className="text-[9px] text-slate-400 text-right mt-0.5">{fmtTime(m.created_at)}</p>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>
            <div className="relative">
              {cannedMatches.length > 0 && (
                <div className="absolute bottom-full left-3 right-3 mb-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-10">
                  <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400 border-b border-slate-100">Canned responses</p>
                  {cannedMatches.map(c => (
                    <button key={c.id} onClick={() => setText(c.message_text)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center gap-2">
                      <code className="text-[11px] font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded shrink-0">{c.shortcut}</code>
                      <span className="text-xs text-slate-600 truncate">{c.message_text}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="p-3 bg-white border-t border-slate-200 flex gap-2">
                <input value={text} onChange={e => setText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { if (cannedMatches.length === 1) { setText(cannedMatches[0].message_text); e.preventDefault() } else send() }
                    if (e.key === 'Escape') setText('')
                  }}
                  placeholder="Type a message…  (start with / for canned responses)"
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400" />
                <button onClick={send} disabled={sending}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white text-sm font-semibold rounded-xl transition-colors">Send</button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ── Right: assignment / tags / notes ─────────────────────────────── */}
      {selected && (
        <aside className="w-72 shrink-0 flex flex-col bg-white border-l border-slate-200 overflow-y-auto">
          <div className="p-4 space-y-5">
            {/* Assign */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Assign to agent</p>
              <select value={selected.assigned_agent_id || ''} onChange={e => assign('agent', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400">
                <option value="">— Unassigned —</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-3 mb-2">Assign to team</p>
              <select value={selected.assigned_team_id || ''} onChange={e => assign('team', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400">
                <option value="">— No team —</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            {/* Tags */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(selected.tags || []).map(t => (
                  <span key={t} className="inline-flex items-center gap-1 text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                    {t}<button onClick={() => removeTag(t)} className="text-amber-400 hover:text-red-500">×</button>
                  </span>
                ))}
                {(selected.tags || []).length === 0 && <span className="text-xs text-slate-400 italic">No tags</span>}
              </div>
              <div className="flex gap-1">
                <input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()}
                  placeholder="Add tag (VIP, Hot Lead…)" className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-400" />
                <button onClick={addTag} className="px-2.5 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg">+</button>
              </div>
            </div>

            {/* Internal notes — private, yellow */}
            <div>
              <button onClick={() => setShowNotes(v => !v)} className="w-full flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                <span>📒 Internal notes (private)</span><span>{showNotes ? '−' : '+'}</span>
              </button>
              {showNotes && (
                <div className="space-y-2">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 space-y-2 max-h-52 overflow-y-auto">
                    {notes.length === 0 && <p className="text-[11px] text-amber-600/70 italic">No notes yet. Notes are never sent to the customer.</p>}
                    {notes.map(n => (
                      <div key={n.id} className="text-[11px] text-amber-900">
                        <p className="whitespace-pre-wrap">{n.note}</p>
                        <p className="text-[9px] text-amber-500 mt-0.5">{n.agent_name || 'Agent'} · {fmtTime(n.created_at)}</p>
                      </div>
                    ))}
                  </div>
                  <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={2}
                    placeholder="Add a private note…" className="w-full bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 text-xs text-amber-900 placeholder-amber-400 outline-none resize-none" />
                  <button onClick={addNote} className="w-full py-1.5 text-xs font-semibold bg-amber-400 hover:bg-amber-500 text-white rounded-lg">Add note</button>
                </div>
              )}
            </div>

            {/* Resolve */}
            {selected.inbox_status === 'resolved' ? (
              <button onClick={reopen} className="w-full py-2.5 text-sm font-semibold border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50">Re-open</button>
            ) : (
              <button onClick={resolve} className="w-full py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">✓ Mark resolved</button>
            )}
          </div>
        </aside>
      )}
    </div>
  )
}
