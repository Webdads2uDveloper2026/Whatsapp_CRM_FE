import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

const inp = 'w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-blue-400'

// ── Teams section ───────────────────────────────────────────────────────────
function Teams({ agents }) {
  const [teams, setTeams] = useState([])
  const [name, setName] = useState('')
  const [expanded, setExpanded] = useState(null)

  const load = useCallback(() => api.get('/inbox/teams').then(r => setTeams(r.data.teams || [])).catch(() => {}), [])
  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!name.trim()) return
    await api.post('/inbox/teams', { name: name.trim() })
    setName(''); load()
  }
  const toggleMember = async (team, agentId, isMember) => {
    await api.post(`/inbox/teams/${team.id}/members`, isMember ? { remove: [agentId] } : { add: [agentId] })
    load()
  }
  const remove = async team => {
    if (!confirm(`Delete team “${team.name}”? Conversations stay, just un-teamed.`)) return
    await api.delete(`/inbox/teams/${team.id}`); load()
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()}
          placeholder="New team name (e.g. Sales, Support, Night Shift)" className={inp} />
        <button onClick={create} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl whitespace-nowrap">+ Create</button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
        {teams.length === 0 && <p className="py-8 text-center text-slate-400 text-sm">No teams yet</p>}
        {teams.map(t => {
          const memberIds = new Set(t.member_ids || [])
          const open = expanded === t.id
          return (
            <div key={t.id}>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-800">{t.name}</p>
                  <p className="text-xs text-slate-400">{t.member_count} member{t.member_count === 1 ? '' : 's'}</p>
                </div>
                <button onClick={() => setExpanded(open ? null : t.id)} className="text-xs text-blue-600 hover:underline">{open ? 'Done' : 'Manage members'}</button>
                <button onClick={() => remove(t)} className="text-xs text-red-500 hover:text-red-600">🗑</button>
              </div>
              {open && (
                <div className="px-4 pb-3">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl divide-y divide-slate-100 max-h-60 overflow-y-auto">
                    {agents.length === 0 && <p className="py-4 text-center text-xs text-slate-400">No agents. Create agents first.</p>}
                    {agents.map(a => {
                      const isMember = memberIds.has(a.id)
                      return (
                        <label key={a.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white">
                          <input type="checkbox" checked={isMember} onChange={() => toggleMember(t, a.id, isMember)} className="accent-blue-600" />
                          <span className="text-sm text-slate-700 flex-1">{a.name}</span>
                          <span className="text-[10px] text-slate-400">{a.email}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Canned responses section ────────────────────────────────────────────────
function Canned() {
  const [rows, setRows] = useState([])
  const [shortcut, setShortcut] = useState('')
  const [text, setText] = useState('')

  const load = useCallback(() => api.get('/inbox/canned-responses').then(r => setRows(r.data.canned_responses || [])).catch(() => {}), [])
  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!shortcut.trim() || !text.trim()) return
    await api.post('/inbox/canned-responses', { shortcut: shortcut.trim(), message_text: text.trim() })
    setShortcut(''); setText(''); load()
  }
  const remove = async r => { await api.delete(`/inbox/canned-responses/${r.id}`); load() }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
        <div className="flex gap-2">
          <input value={shortcut} onChange={e => setShortcut(e.target.value)} placeholder="/thanks" className={`${inp} font-mono max-w-[160px]`} />
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()} placeholder="Message text inserted when typed" className={inp} />
          <button onClick={create} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl whitespace-nowrap">+ Add</button>
        </div>
        <p className="text-[11px] text-slate-400">In the Team Inbox composer, type the shortcut (e.g. <code className="font-mono">/thanks</code>) to insert the message.</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
        {rows.length === 0 && <p className="py-8 text-center text-slate-400 text-sm">No canned responses yet</p>}
        {rows.map(r => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3">
            <code className="text-xs font-mono bg-blue-50 text-blue-600 px-2 py-0.5 rounded shrink-0">{r.shortcut}</code>
            <p className="flex-1 text-sm text-slate-600 truncate">{r.message_text}</p>
            <button onClick={() => remove(r)} className="text-xs text-red-500 hover:text-red-600">🗑</button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TeamSettings() {
  const [tab, setTab] = useState('teams')
  const [agents, setAgents] = useState([])
  const navigate = useNavigate()
  useEffect(() => { api.get('/agents').then(r => setAgents(r.data || [])).catch(() => {}) }, [])

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-6">
      <div className="max-w-4xl mx-auto space-y-5">
        <button onClick={() => navigate('/dashboard/team-inbox')} className="text-sm text-slate-500 hover:text-slate-700">← Back to Team Inbox</button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Team Inbox Settings</h1>
          <p className="text-sm text-slate-500">Manage teams and canned responses</p>
        </div>
        <div className="flex gap-1 border-b border-slate-200">
          {[['teams', 'Teams'], ['canned', 'Canned Responses']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === k ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{l}</button>
          ))}
        </div>
        {tab === 'teams' ? <Teams agents={agents} /> : <Canned />}
      </div>
    </div>
  )
}
