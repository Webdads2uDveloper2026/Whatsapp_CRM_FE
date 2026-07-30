import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'

const inp = 'w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-blue-400'
const errText = e => {
  const d = e.response?.data?.detail
  return d?.error?.details || d?.error?.message || d?.info || d || 'Something went wrong'
}

// ── Overview tab ────────────────────────────────────────────────────────────
function Overview({ group, reload }) {
  const [subject, setSubject] = useState(group.subject || '')
  const [description, setDescription] = useState(group.description || '')
  const [saving, setSaving] = useState(false)
  const [link, setLink] = useState(group.invite_link || '')
  const [msg, setMsg] = useState('')

  const saveSettings = async () => {
    setSaving(true); setMsg('')
    try {
      await api.post(`/whatsapp/groups/${group.id}/settings`, { subject, description })
      setMsg('Saved'); reload()
    } catch (e) { setMsg(errText(e)) }
    setSaving(false)
  }
  const getLink = async () => {
    try { const r = await api.get(`/whatsapp/groups/${group.id}/invite-link`); setLink(r.data.invite_link || '') }
    catch (e) { setMsg(errText(e)) }
  }
  const resetLink = async () => {
    if (!confirm('Reset the invite link? The current link will stop working immediately.')) return
    try { const r = await api.post(`/whatsapp/groups/${group.id}/invite-link/reset`); setLink(r.data.invite_link || '') }
    catch (e) { setMsg(errText(e)) }
  }

  const pct = Math.min(100, Math.round(((group.total_participant_count || 0) / 8) * 100))

  return (
    <div className="space-y-5 max-w-2xl">
      {group.suspended && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-xl">🚫</span>
          <div>
            <p className="text-sm font-semibold text-red-700">This group is suspended by WhatsApp</p>
            <p className="text-xs text-red-600 mt-0.5">Messaging is blocked while the group is suspended.</p>
          </div>
        </div>
      )}
      {group.status === 'create_failed' && group.last_error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600">
          Create failed{group.last_error.code ? ` (#${group.last_error.code})` : ''}: {group.last_error.details || group.last_error.message}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Subject</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
          <input value={description} onChange={e => setDescription(e.target.value)} className={inp} />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={saveSettings} disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white text-xs font-semibold rounded-lg transition-colors">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {msg && <span className="text-xs text-slate-500">{msg}</span>}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <p className="text-xs font-semibold text-slate-600">Participants</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-semibold text-slate-600">{group.total_participant_count || 0}/8</span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <p className="text-xs font-semibold text-slate-600">Invite link</p>
        {link ? (
          <div className="flex items-center gap-2">
            <input readOnly value={link} className={`${inp} font-mono text-xs`} />
            <button onClick={() => navigator.clipboard?.writeText(link)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap">Copy</button>
          </div>
        ) : (
          <button onClick={getLink} className="px-4 py-2 text-xs border border-slate-200 rounded-lg hover:bg-slate-50">Get invite link</button>
        )}
        <button onClick={resetLink} className="text-xs text-red-500 hover:underline">Reset link</button>
      </div>
    </div>
  )
}

// ── Participants tab ────────────────────────────────────────────────────────
function Participants({ group, reload }) {
  const [parts, setParts] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    api.get(`/whatsapp/groups/${group.id}/participants`)
      .then(r => setParts(r.data.participants || [])).catch(() => {}).finally(() => setLoading(false))
  }, [group.id])
  useEffect(() => { load() }, [load])

  const toggle = wa => { const n = new Set(selected); n.has(wa) ? n.delete(wa) : n.add(wa); setSelected(n) }

  const removeSelected = async () => {
    const ids = [...selected].filter(wa => !parts.find(p => p.wa_id === wa)?.is_admin)
    if (!ids.length) return
    if (!confirm(`Remove ${ids.length} participant(s)?`)) return
    setMsg('')
    try {
      // API caps at 8 per call — batch client-side
      for (let i = 0; i < ids.length; i += 8) {
        await api.delete(`/whatsapp/groups/${group.id}/participants`, { data: { wa_ids: ids.slice(i, i + 8) } })
      }
      setSelected(new Set()); load(); reload()
    } catch (e) { setMsg(errText(e)) }
  }

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>
  return (
    <div className="max-w-2xl space-y-3">
      {msg && <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-xl">{msg}</div>}
      {selected.size > 0 && (
        <button onClick={removeSelected} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg">
          Remove {selected.size} selected
        </button>
      )}
      <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
        {parts.length === 0 && <p className="py-8 text-center text-slate-400 text-sm">No participants yet — share the invite link.</p>}
        {parts.map(p => (
          <div key={p.wa_id} className="flex items-center gap-3 px-4 py-3">
            <input type="checkbox" disabled={p.is_admin} checked={selected.has(p.wa_id)} onChange={() => toggle(p.wa_id)} className="accent-blue-600" />
            <span className="flex-1 text-sm font-mono text-slate-700">+{p.wa_id}</span>
            {p.is_admin && <span className="text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-full">Admin (you)</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Join Requests tab ───────────────────────────────────────────────────────
function JoinRequests({ group }) {
  const [reqs, setReqs] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    api.get(`/whatsapp/groups/${group.id}/join-requests`)
      .then(r => setReqs(r.data.join_requests || [])).catch(() => {}).finally(() => setLoading(false))
  }, [group.id])
  useEffect(() => { load() }, [load])

  const act = async (approve, ids) => {
    if (!ids.length) return
    setMsg('')
    try {
      const path = approve ? 'approve' : 'reject'
      const { data } = await api.post(`/whatsapp/groups/${group.id}/join-requests/${path}`, { join_request_ids: ids })
      if (data.failed?.length) setMsg(`${data.failed.length} failed: ${data.failed.map(f => f.error?.message || f.error?.details).filter(Boolean).join('; ')}`)
      setSelected(new Set()); load()
    } catch (e) { setMsg(errText(e)) }
  }
  const toggle = id => { const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n) }

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>
  return (
    <div className="max-w-2xl space-y-3">
      {msg && <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2 rounded-xl">{msg}</div>}
      {selected.size > 0 && (
        <div className="flex gap-2">
          <button onClick={() => act(true, [...selected])} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg">Approve {selected.size}</button>
          <button onClick={() => act(false, [...selected])} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg">Reject {selected.size}</button>
        </div>
      )}
      <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
        {reqs.length === 0 && <p className="py-8 text-center text-slate-400 text-sm">No pending join requests.</p>}
        {reqs.map(r => (
          <div key={r.join_request_id} className="flex items-center gap-3 px-4 py-3">
            <input type="checkbox" checked={selected.has(r.join_request_id)} onChange={() => toggle(r.join_request_id)} className="accent-blue-600" />
            <span className="flex-1 text-sm font-mono text-slate-700">+{r.wa_id}</span>
            <button onClick={() => act(true, [r.join_request_id])} className="px-3 py-1 text-xs text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50">Approve</button>
            <button onClick={() => act(false, [r.join_request_id])} className="px-3 py-1 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50">Reject</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Messages tab (⚠️ send/pin Graph shapes not yet verified live) ───────────
function Messages({ group }) {
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    api.get(`/whatsapp/groups/${group.id}/messages`).then(r => setMsgs(r.data.messages || [])).catch(() => {})
  }, [group.id])
  useEffect(() => { load() }, [load])

  const send = async () => {
    if (!text.trim()) return
    setSending(true); setErr('')
    try {
      await api.post(`/whatsapp/groups/${group.id}/messages`, { type: 'text', text })
      setText(''); load()
    } catch (e) { setErr(errText(e)) }
    setSending(false)
  }
  const togglePin = async m => {
    try { await api.post(`/whatsapp/groups/${group.id}/messages/${m.wa_message_id}/${m.pinned ? 'unpin' : 'pin'}`); load() }
    catch (e) { setErr(errText(e)) }
  }

  const pinned = msgs.filter(m => m.pinned)
  return (
    <div className="max-w-2xl space-y-3">
      <div className="bg-amber-50 border border-amber-200 text-amber-700 text-[11px] px-3 py-2 rounded-xl">
        ⚠️ Group messaging (send / pin) uses Graph API shapes that still need live verification. Only text, media, and text/media templates are allowed — interactive, catalog, auth templates, and calling are blocked.
      </div>
      {err && <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2 rounded-xl">{err}</div>}

      {pinned.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-xl p-3">
          <p className="text-[10px] font-bold text-amber-600 uppercase mb-1">📌 Pinned</p>
          {pinned.map(m => <p key={m.id} className="text-xs text-slate-700">{m.content?.body || `[${m.msg_type}]`}</p>)}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl max-h-96 overflow-y-auto divide-y divide-slate-50">
        {msgs.length === 0 && <p className="py-8 text-center text-slate-400 text-sm">No messages yet.</p>}
        {msgs.map(m => (
          <div key={m.id} className={`px-4 py-2.5 flex items-start gap-2 group ${m.direction === 'outbound' ? 'bg-emerald-50/30' : ''}`}>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-400">{m.direction === 'outbound' ? 'You' : `+${m.from_wa_id || ''}`}</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{m.content?.body || `[${m.msg_type}]`}</p>
            </div>
            {m.wa_message_id && (
              <button onClick={() => togglePin(m)} title={m.pinned ? 'Unpin' : 'Pin'}
                className="opacity-0 group-hover:opacity-100 text-xs text-slate-400 hover:text-amber-500 transition-opacity">📌</button>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input value={text} onChange={e => setText(e.target.value)} disabled={group.suspended}
          onKeyDown={e => e.key === 'Enter' && send()} placeholder={group.suspended ? 'Group suspended — messaging blocked' : 'Type a message…'} className={inp} />
        <button onClick={send} disabled={sending || group.suspended}
          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white text-sm font-semibold rounded-xl transition-colors">
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  )
}

// ── Send Invite tab ─────────────────────────────────────────────────────────
function SendInvite({ group }) {
  const [templates, setTemplates] = useState([])
  const [tpl, setTpl] = useState('')
  const [wa, setWa] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.get('/whatsapp/groups/invite-templates').then(r => setTemplates(r.data.templates || [])).catch(() => {})
  }, [])

  const send = async () => {
    if (!tpl || !wa.trim()) { setMsg('Pick a template and enter a number'); return }
    setMsg('')
    try {
      const t = templates.find(x => (x.name || x) === tpl) || {}
      await api.post(`/whatsapp/groups/${group.id}/invite-template`, {
        template_name: tpl, language: t.language || 'en', to_wa_id: wa.trim(),
      })
      setMsg('Invite sent ✓'); setWa('')
    } catch (e) { setMsg(errText(e)) }
  }

  return (
    <div className="max-w-md space-y-4">
      <div className="bg-blue-50 border border-blue-200 text-blue-700 text-[11px] px-3 py-2 rounded-xl">
        Send the group invite-link template to a WhatsApp contact. Templates come from the Template Library (topic: group_invite_link) to stay utility-priced.
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Invite template</label>
        <select value={tpl} onChange={e => setTpl(e.target.value)} className={`${inp} appearance-none cursor-pointer`}>
          <option value="">— choose a template —</option>
          {templates.map((t, i) => <option key={i} value={t.name || t}>{t.name || t}</option>)}
        </select>
        {templates.length === 0 && <p className="text-[11px] text-slate-400 mt-1">No group-invite templates found in your Template Library.</p>}
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Recipient number</label>
        <input value={wa} onChange={e => setWa(e.target.value)} placeholder="919876543210" className={`${inp} font-mono`} />
      </div>
      <button onClick={send} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">Send invite</button>
      {msg && <p className="text-xs text-slate-500">{msg}</p>}
    </div>
  )
}

// ── Detail page shell ───────────────────────────────────────────────────────
const TABS = ['Overview', 'Participants', 'Join Requests', 'Messages', 'Send Invite']

export default function WhatsAppGroupDetail() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const [group, setGroup] = useState(null)
  const [tab, setTab] = useState('Overview')
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(() => {
    api.get(`/whatsapp/groups/${groupId}?refresh=true`)
      .then(r => setGroup(r.data)).catch(() => setNotFound(true))
  }, [groupId])
  useEffect(() => { load() }, [load])

  const del = async () => {
    if (!confirm('Delete this group? This cannot be undone.')) return
    try { await api.delete(`/whatsapp/groups/${groupId}`); navigate('/dashboard/groups') }
    catch (e) { alert(errText(e)) }
  }

  if (notFound) return <div className="p-6 text-slate-500">Group not found. <button onClick={() => navigate('/dashboard/groups')} className="text-blue-600 hover:underline">Back to groups</button></div>
  if (!group) return <div className="p-6 text-slate-400">Loading…</div>

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-6">
      <div className="max-w-screen-xl mx-auto space-y-5">
        <button onClick={() => navigate('/dashboard/groups')} className="text-sm text-slate-500 hover:text-slate-700">← Back to groups</button>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-800">{group.subject || 'Untitled group'}</h1>
            <p className="text-sm text-slate-500">{group.total_participant_count || 0}/8 members · {group.join_approval_mode === 'approval_required' ? 'Approval required' : 'Auto-approve'}</p>
          </div>
          <button onClick={del} className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors">Delete group</button>
        </div>

        <div className="flex gap-1 border-b border-slate-200">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="pt-2">
          {tab === 'Overview'      && <Overview group={group} reload={load} />}
          {tab === 'Participants'  && <Participants group={group} reload={load} />}
          {tab === 'Join Requests' && <JoinRequests group={group} />}
          {tab === 'Messages'      && <Messages group={group} />}
          {tab === 'Send Invite'   && <SendInvite group={group} />}
        </div>
      </div>
    </div>
  )
}
