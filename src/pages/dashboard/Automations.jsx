/**
 * Automations.jsx — Auto-reply rules manager
 * src/pages/dashboard/Automations.jsx
 */
import { useState, useEffect } from 'react'
import api from '../../services/api'

const TRIGGER_TYPES = [
  { value: 'any',           label: 'Any message',      desc: 'Fires on every inbound message' },
  { value: 'first_message', label: 'First message',    desc: 'Only when conversation starts' },
  { value: 'keyword',       label: 'Keyword match',    desc: 'When message contains keywords' },
  { value: 'outside_hours', label: 'Outside hours',    desc: 'Outside 9am–6pm UTC Mon–Fri' },
]
const MATCH_TYPES = [
  { value: 'contains',    label: 'Contains' },
  { value: 'exact',       label: 'Exact match' },
  { value: 'starts_with', label: 'Starts with' },
]
const ACTION_TYPES = [
  { value: 'text',     label: 'Text message' },
  { value: 'template', label: 'Template message' },
]

const BLANK_RULE = {
  name:      '',
  is_active: true,
  priority:  10,
  trigger:   { type: 'any', keywords: [], match: 'contains' },
  action:    { type: 'text', text: '', template_name: '', language: 'en_US', variables: {} },
  conditions: { only_first_message: false, cooldown_minutes: 0, business_hours_only: false },
}

export default function Automations() {
  const [rules,     setRules]     = useState([])
  const [templates, setTemplates] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [editing,   setEditing]   = useState(null)   // rule being edited
  const [form,      setForm]      = useState(BLANK_RULE)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [kwInput,   setKwInput]   = useState('')     // keyword input buffer

  const load = async () => {
    setLoading(true)
    try {
      const [r, t] = await Promise.all([
        api.get('/autoreplies'),
        api.get('/templates/local'),
      ])
      setRules(r.data.autoreplies || [])
      setTemplates((t.data.templates || []).filter(x => x.status === 'APPROVED'))
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew = () => {
    setEditing(null)
    setForm(BLANK_RULE)
    setKwInput('')
    setError('')
    setShowForm(true)
  }

  const openEdit = rule => {
    setEditing(rule)
    setForm({
      name:       rule.name,
      is_active:  rule.is_active,
      priority:   rule.priority,
      trigger:    { ...rule.trigger },
      action:     { ...rule.action, variables: rule.action?.variables || {} },
      conditions: { ...rule.conditions },
    })
    setKwInput((rule.trigger?.keywords || []).join(', '))
    setError('')
    setShowForm(true)
  }

  const setT = (key, val) => setForm(p => ({ ...p, trigger: { ...p.trigger, [key]: val } }))
  const setA = (key, val) => setForm(p => ({ ...p, action:  { ...p.action,  [key]: val } }))
  const setC = (key, val) => setForm(p => ({ ...p, conditions: { ...p.conditions, [key]: val } }))

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    if (form.action.type === 'text' && !form.action.text.trim()) { setError('Reply text is required'); return }
    if (form.action.type === 'template' && !form.action.template_name.trim()) { setError('Select a template'); return }

    // Parse keywords from input
    const keywords = kwInput.split(',').map(k => k.trim()).filter(Boolean)
    const payload  = { ...form, trigger: { ...form.trigger, keywords } }

    setSaving(true); setError('')
    try {
      if (editing) {
        await api.patch(`/autoreplies/${editing.id}`, payload)
      } else {
        await api.post('/autoreplies', payload)
      }
      await load()
      setShowForm(false)
    } catch (e) {
      setError(e.response?.data?.detail || 'Save failed')
    }
    setSaving(false)
  }

  const handleDelete = async id => {
    if (!confirm('Delete this auto-reply rule?')) return
    try { await api.delete(`/autoreplies/${id}`); await load() } catch {}
  }

  const handleToggle = async rule => {
    try {
      await api.patch(`/autoreplies/${rule.id}/toggle`)
      setRules(p => p.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r))
    } catch {}
  }

  // Extract variables from template body
  const templateVars = tplName => {
    const tpl  = templates.find(t => t.name === tplName)
    const body = tpl?.components?.find(c => c.type === 'BODY')
    if (!body?.text) return []
    return [...new Set((body.text.match(/\{\{(\w+)\}\}/g) || []).map(m => m.replace(/[{}]/g, '')))]
  }

  const tplVars = form.action.type === 'template' ? templateVars(form.action.template_name) : []

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div>
          <h1 className="text-lg font-bold">Automations</h1>
          <p className="text-xs text-slate-400 mt-0.5">Auto-reply rules for inbound WhatsApp messages</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors">
          <span className="text-base">+</span> New Rule
        </button>
      </div>

      {/* Rules list */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && (
          <div className="flex items-center justify-center h-40 text-slate-500">
            <svg className="w-6 h-6 animate-spin mr-2" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".2"/>
              <path d="M22 12A10 10 0 0012 2" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            </svg>
            Loading rules…
          </div>
        )}

        {!loading && rules.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-500">
            <span className="text-5xl opacity-20">🤖</span>
            <p className="text-base font-medium text-slate-400">No auto-reply rules yet</p>
            <p className="text-sm text-center max-w-xs">Create rules to automatically reply to incoming WhatsApp messages based on keywords or timing.</p>
            <button onClick={openNew}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors mt-2">
              Create your first rule
            </button>
          </div>
        )}

        <div className="space-y-3 max-w-3xl">
          {rules.map((rule, idx) => {
            const triggerLabel = TRIGGER_TYPES.find(t => t.value === rule.trigger?.type)?.label || rule.trigger?.type
            const actionLabel  = rule.action?.type === 'template' ? `📋 ${rule.action.template_name}` : `💬 "${rule.action?.text?.slice(0, 40)}${rule.action?.text?.length > 40 ? '…' : ''}"`
            const kws = rule.trigger?.keywords || []

            return (
              <div key={rule.id}
                className={`bg-slate-900 border rounded-2xl p-5 transition-all ${rule.is_active ? 'border-slate-700' : 'border-slate-800 opacity-60'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Priority badge */}
                    <div className="w-7 h-7 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-xs font-bold text-slate-400 shrink-0 mt-0.5">
                      {rule.priority}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-200">{rule.name}</p>
                        {rule.is_active
                          ? <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">ACTIVE</span>
                          : <span className="text-[10px] font-bold text-slate-500 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full">PAUSED</span>
                        }
                      </div>

                      {/* Trigger */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-[11px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-md font-medium">
                          IF: {triggerLabel}
                        </span>
                        {kws.length > 0 && kws.slice(0, 3).map(k => (
                          <span key={k} className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded-md font-mono">"{k}"</span>
                        ))}
                        {kws.length > 3 && <span className="text-[10px] text-slate-500">+{kws.length - 3} more</span>}
                      </div>

                      {/* Action */}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[11px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-md font-medium">
                          THEN: {actionLabel}
                        </span>
                      </div>

                      {/* Conditions */}
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {rule.conditions?.only_first_message && (
                          <span className="text-[10px] text-amber-400/70 bg-amber-400/5 border border-amber-400/10 px-2 py-0.5 rounded-md">First message only</span>
                        )}
                        {rule.conditions?.cooldown_minutes > 0 && (
                          <span className="text-[10px] text-slate-400 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-md">⏱ {rule.conditions.cooldown_minutes}min cooldown</span>
                        )}
                        {rule.stats?.sent > 0 && (
                          <span className="text-[10px] text-slate-500 px-2 py-0.5">✓ Sent {rule.stats.sent} times</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Toggle switch */}
                    <button onClick={() => handleToggle(rule)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${rule.is_active ? 'bg-emerald-600' : 'bg-slate-700'}`}
                      title={rule.is_active ? 'Pause' : 'Activate'}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${rule.is_active ? 'translate-x-5' : 'translate-x-0.5'}`}/>
                    </button>
                    <button onClick={() => openEdit(rule)}
                      className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors text-sm"
                      title="Edit">✏️</button>
                    <button onClick={() => handleDelete(rule.id)}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors text-sm"
                      title="Delete">🗑️</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Rule form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white">{editing ? 'Edit Rule' : 'New Auto-Reply Rule'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white text-xl leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {error && (
                <div className="bg-red-900/20 border border-red-800/40 text-red-400 text-xs px-4 py-2.5 rounded-xl">⚠ {error}</div>
              )}

              {/* Name + Priority */}
              <div className="grid grid-cols-[1fr_100px] gap-3">
                <div>
                  <label className="label">Rule name</label>
                  <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
                    placeholder="e.g. Welcome message"
                    className="input" />
                </div>
                <div>
                  <label className="label">Priority</label>
                  <input type="number" min={1} max={100} value={form.priority}
                    onChange={e => setForm(p => ({...p, priority: Number(e.target.value)}))}
                    className="input" />
                  <p className="text-[10px] text-slate-500 mt-1">Lower = first</p>
                </div>
              </div>

              {/* ── TRIGGER section ────────────────────────────────────────── */}
              <div className="border border-slate-800 rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">When (Trigger)</p>

                <div className="grid grid-cols-2 gap-2">
                  {TRIGGER_TYPES.map(t => (
                    <button key={t.value} onClick={() => setT('type', t.value)}
                      className={`text-left p-3 rounded-xl border transition-colors ${form.trigger.type === t.value ? 'bg-blue-600/20 border-blue-500/50 text-blue-300' : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                      <p className="text-xs font-semibold">{t.label}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>

                {form.trigger.type === 'keyword' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_140px] gap-2">
                      <div>
                        <label className="label">Keywords <span className="text-slate-500">(comma-separated)</span></label>
                        <input value={kwInput} onChange={e => setKwInput(e.target.value)}
                          placeholder="hello, hi, start, help"
                          className="input font-mono text-xs" />
                      </div>
                      <div>
                        <label className="label">Match type</label>
                        <select value={form.trigger.match} onChange={e => setT('match', e.target.value)} className="input">
                          {MATCH_TYPES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                      </div>
                    </div>
                    {kwInput.trim() && (
                      <div className="flex flex-wrap gap-1.5">
                        {kwInput.split(',').map(k => k.trim()).filter(Boolean).map(k => (
                          <span key={k} className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-md font-mono">"{k}"</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── ACTION section ────────────────────────────────────────── */}
              <div className="border border-slate-800 rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Then (Action)</p>

                <div className="flex gap-2">
                  {ACTION_TYPES.map(at => (
                    <button key={at.value} onClick={() => setA('type', at.value)}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold transition-colors ${form.action.type === at.value ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300' : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                      {at.label}
                    </button>
                  ))}
                </div>

                {form.action.type === 'text' && (
                  <div>
                    <label className="label">Reply message</label>
                    <textarea rows={3} value={form.action.text} onChange={e => setA('text', e.target.value)}
                      placeholder="Hi! Thanks for your message. We'll get back to you shortly. 😊"
                      className="input resize-none leading-relaxed" />
                    <p className="text-[10px] text-slate-500 mt-1">{form.action.text.length} characters</p>
                  </div>
                )}

                {form.action.type === 'template' && (
                  <div className="space-y-3">
                    <div>
                      <label className="label">Template</label>
                      <select value={form.action.template_name} onChange={e => { setA('template_name', e.target.value); setA('variables', {}) }} className="input">
                        <option value="">— Select template —</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.name}>{t.name} ({t.language})</option>
                        ))}
                      </select>
                      {templates.length === 0 && <p className="text-[10px] text-amber-400 mt-1">⚠ No approved templates. Sync templates first.</p>}
                    </div>

                    {/* Template variables — static values */}
                    {tplVars.length > 0 && (
                      <div>
                        <label className="label">Variable values <span className="text-slate-500">(static — same for everyone)</span></label>
                        <div className="space-y-2">
                          {tplVars.map(v => (
                            <div key={v} className="flex items-center gap-2">
                              <code className="text-[11px] bg-blue-900/30 text-blue-400 border border-blue-800/40 px-2.5 py-1.5 rounded-lg font-mono shrink-0 min-w-[70px] text-center">{`{{${v}}}`}</code>
                              <input
                                value={form.action.variables[v] || ''}
                                onChange={e => setA('variables', { ...form.action.variables, [v]: e.target.value })}
                                placeholder={`Value for ${v}`}
                                className="flex-1 input text-xs" />
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2">💡 These are static values sent to everyone. For personalised variables (like contact name), use a text reply instead.</p>
                      </div>
                    )}

                    {tplVars.length === 0 && form.action.template_name && (
                      <p className="text-[11px] text-emerald-400/70 bg-emerald-400/5 border border-emerald-400/10 px-3 py-2 rounded-lg">✅ No variables needed for this template</p>
                    )}
                  </div>
                )}
              </div>

              {/* ── CONDITIONS section ────────────────────────────────────── */}
              <div className="border border-slate-800 rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Conditions (optional)</p>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.conditions.only_first_message}
                    onChange={e => setC('only_first_message', e.target.checked)}
                    className="w-4 h-4 rounded accent-blue-500" />
                  <div>
                    <p className="text-xs font-medium text-slate-300">First message only</p>
                    <p className="text-[11px] text-slate-500">Only fire on the very first message from a contact (new conversation)</p>
                  </div>
                </label>

                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="label">Cooldown (minutes)</label>
                    <input type="number" min={0} value={form.conditions.cooldown_minutes}
                      onChange={e => setC('cooldown_minutes', Number(e.target.value))}
                      placeholder="0 = no cooldown"
                      className="input" />
                    <p className="text-[10px] text-slate-500 mt-1">Don't re-trigger for the same contact within this many minutes</p>
                  </div>
                </div>
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div onClick={() => setForm(p => ({...p, is_active: !p.is_active}))}
                  className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${form.is_active ? 'bg-emerald-600' : 'bg-slate-700'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_active ? 'translate-x-5' : 'translate-x-0.5'}`}/>
                </div>
                <span className="text-sm text-slate-300">{form.is_active ? 'Active — rule will fire' : 'Paused — rule is disabled'}</span>
              </label>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800">
              <button onClick={() => setShowForm(false)} className="px-5 py-2.5 border border-slate-700 text-slate-400 text-sm rounded-xl hover:bg-slate-800 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2">
                {saving ? (
                  <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity=".3"/><path d="M22 12A10 10 0 0012 2" stroke="white" strokeWidth="3" strokeLinecap="round"/></svg>Saving…</>
                ) : (editing ? '💾 Save changes' : '✅ Create rule')}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .label { display:block; font-size:11px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px; }
        .input { width:100%; background:#1e293b; border:1px solid #334155; color:#e2e8f0; font-size:13px; border-radius:10px; padding:8px 12px; outline:none; transition:border-color .15s; }
        .input:focus { border-color:#3b82f6; }
        .input option { background:#1e293b; }
        textarea.input { font-family:inherit; }
      `}</style>
    </div>
  )
}