import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

const inp = 'w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all'

const STATUS = {
  active:        { cls: 'bg-emerald-50 text-emerald-600 border-emerald-200', label: 'Active' },
  creating:      { cls: 'bg-amber-50 text-amber-600 border-amber-200',       label: 'Creating…' },
  create_failed: { cls: 'bg-red-50 text-red-600 border-red-200',             label: 'Create failed' },
  deleted:       { cls: 'bg-slate-100 text-slate-500 border-slate-200',      label: 'Deleted' },
}
function StatusBadge({ status, suspended }) {
  if (suspended) return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-200">Suspended</span>
  const s = STATUS[status] || STATUS.active
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.cls}`}>{s.label}</span>
}

// ── Create group modal ──────────────────────────────────────────────────────
function CreateModal({ onClose, onCreated }) {
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [approval, setApproval] = useState('auto_approve')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const create = async e => {
    e.preventDefault()
    if (!subject.trim()) { setError('Subject is required'); return }
    setSaving(true); setError('')
    try {
      await api.post('/whatsapp/groups', {
        subject: subject.trim(), description: description.trim(), join_approval_mode: approval,
      })
      onCreated(); onClose()
    } catch (err) {
      const d = err.response?.data?.detail
      setError(d?.error?.details || d?.error?.message || d?.info || 'Create failed')
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">Create WhatsApp Group</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={create} className="p-6 space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2.5 rounded-xl">{error}</div>}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Subject</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Group name" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description <span className="text-slate-400 font-normal">(optional)</span></label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this group about?" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Join approval</label>
            <select value={approval} onChange={e => setApproval(e.target.value)} className={`${inp} appearance-none cursor-pointer`}>
              <option value="auto_approve">Auto-approve — anyone with the link joins instantly</option>
              <option value="approval_required">Require approval — you approve each join request</option>
            </select>
          </div>
          <p className="text-[11px] text-slate-400">Members join via invite link only (max 8). Your business number is added as admin automatically.</p>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white text-sm font-semibold rounded-xl transition-colors">
              {saving ? 'Creating…' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main list page ──────────────────────────────────────────────────────────
export default function WhatsAppGroups() {
  const [eligible, setEligible] = useState(null)   // null=loading, true/false
  const [eligReason, setEligReason] = useState('')
  const [groups, setGroups] = useState([])
  const [paging, setPaging] = useState({})
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/whatsapp/groups/eligibility')
      .then(r => { setEligible(!!r.data.is_groups_eligible); setEligReason(r.data.reason || '') })
      .catch(() => { setEligible(false); setEligReason('Could not verify eligibility.') })
  }, [])

  const load = useCallback((after) => {
    setLoading(true)
    const q = after ? `?after=${encodeURIComponent(after)}` : ''
    api.get(`/whatsapp/groups${q}`)
      .then(r => {
        setGroups(prev => after ? [...prev, ...(r.data.groups || [])] : (r.data.groups || []))
        setPaging(r.data.paging || {})
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { if (eligible) load() }, [eligible, load])

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-6">
      <div className="max-w-screen-xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-800">WhatsApp Groups</h1>
            <p className="text-sm text-slate-500">Native WhatsApp groups (invite-link based, max 8 members)</p>
          </div>
          <button onClick={() => setShowCreate(true)} disabled={!eligible}
            title={!eligible ? (eligReason || 'Not eligible') : ''}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors">
            + Create Group
          </button>
        </div>

        {eligible === false && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">Groups API not available for this number</p>
              <p className="text-xs text-amber-700 mt-1">{eligReason || 'The WhatsApp Groups API requires an Official Business Account on Cloud API (not a WhatsApp Business App / Coexistence number).'}</p>
            </div>
          </div>
        )}

        {eligible && (
          loading && groups.length === 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-white border border-slate-200 rounded-2xl animate-pulse" />)}
            </div>
          ) : groups.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl py-16 flex flex-col items-center gap-4 text-slate-400">
              <span className="text-5xl opacity-30">💬</span>
              <div className="text-center">
                <p className="text-base font-semibold text-slate-600">No groups yet</p>
                <p className="text-sm mt-1">Create a group and share its invite link to add members</p>
              </div>
              <button onClick={() => setShowCreate(true)} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">+ Create Group</button>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {groups.map(g => (
                  <div key={g.id} onClick={() => navigate(`/dashboard/groups/${g.id}`)}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-slate-800 truncate flex-1">{g.subject || 'Untitled group'}</p>
                      <StatusBadge status={g.status} suspended={g.suspended} />
                    </div>
                    <p className="text-xs text-slate-500 truncate">{g.description || <span className="italic text-slate-400">No description</span>}</p>
                    <div className="flex items-center gap-2 mt-auto pt-1">
                      <span className="text-xs bg-blue-50 text-blue-600 border border-blue-100 font-semibold px-2 py-0.5 rounded-full">
                        {g.total_participant_count || 0}/8 members
                      </span>
                      {g.join_approval_mode === 'approval_required' && (
                        <span className="text-[10px] text-violet-600 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full">Approval required</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {paging.after && (
                <div className="flex justify-center">
                  <button onClick={() => load(paging.after)} disabled={loading}
                    className="px-5 py-2 text-sm font-medium border border-slate-200 bg-white text-slate-600 rounded-xl hover:bg-slate-50 transition-colors">
                    {loading ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          )
        )}
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={() => load()} />}
    </div>
  )
}
