import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { useInboxSocket } from '../../hooks/useInboxSocket'
import SendTemplateModal from './SendTemplateModal'
import SendFlowModal from './SendFlowModal'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = iso => {
  if (!iso) return ''
  const d = new Date(iso), now = new Date()
  const diff = Math.floor((now - d) / 86400000)
  if (diff === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diff === 1) return 'Yesterday'
  if (diff < 7)  return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

const AVATAR_BG = ['bg-violet-600','bg-cyan-600','bg-emerald-600','bg-amber-600','bg-rose-600','bg-blue-600','bg-pink-600']
function avatarColor(s = '') { let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h); return AVATAR_BG[Math.abs(h) % AVATAR_BG.length] }

function Avatar({ name = '', size = 'md' }) {
  const sz = { xs:'w-6 h-6 text-[10px]', sm:'w-7 h-7 text-xs', md:'w-9 h-9 text-sm', lg:'w-14 h-14 text-xl' }[size] || 'w-9 h-9 text-sm'
  return (
    <div className={`${sz} ${avatarColor(name)} rounded-full flex items-center justify-center font-bold text-white shrink-0 select-none`}>
      {name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?'}
    </div>
  )
}

function Tick({ status }) {
  if (status === 'read')      return <span className="text-blue-400 text-[11px]">✓✓</span>
  if (status === 'delivered') return <span className="text-slate-400 text-[11px]">✓✓</span>
  if (status === 'sent')      return <span className="text-slate-500 text-[11px]">✓</span>
  if (status === 'failed')    return <span className="text-red-400 text-[11px]">✗</span>
  return null
}

// ── New Conversation Modal ────────────────────────────────────────────────────
function NewConvoModal({ onClose, onCreated }) {
  const [step, setStep]         = useState('search')  // search | confirm | sending
  const [phone, setPhone]       = useState('')
  const [name, setName]         = useState('')
  const [contact, setContact]   = useState(null)
  const [templates, setTemplates] = useState([])
  const [tplId, setTplId]       = useState('')
  const [error, setError]       = useState('')
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    api.get('/templates/local').then(r =>
      setTemplates((r.data.templates || []).filter(t => t.status === 'APPROVED'))
    ).catch(() => {})
  }, [])

  // Search existing contact by phone
  const searchContact = async () => {
    const clean = phone.replace(/[\s+\-()]/g, '')
    if (!clean || clean.length < 7) { setError('Enter a valid phone number with country code'); return }
    setSearching(true); setError('')
    try {
      const { data } = await api.get(`/contacts?search=${clean}&limit=5`)
      const found = (data.contacts || []).find(c => c.wa_id === clean)
      if (found) {
        setContact(found)
        setName(found.profile_name || '')
      } else {
        setContact(null)
        setName('')
      }
      setStep('confirm')
    } catch { setError('Search failed') }
    setSearching(false)
  }

  // Create contact if needed, then start conversation
  const startConversation = async () => {
    setStep('sending'); setError('')
    const clean = phone.replace(/[\s+\-()]/g, '')
    try {
      let contactId = contact?.id

      // Create contact if not exists
      if (!contactId) {
        const { data } = await api.post('/contacts', {
          wa_id: clean,
          profile_name: name || clean,
          opted_in: true,
          status: 'New',
        })
        contactId = data.id
      }

      // Start conversation — find existing open or create new
      let convo = null
      const { data: convos } = await api.get(`/conversations?search=${clean}&limit=10`)
      const existing = (convos.conversations || []).find(c => c.wa_id === clean && c.status === 'open')

      if (existing) {
        convo = existing
      } else {
        // Create conversation by sending the first template message
        if (tplId) {
          const tpl = templates.find(t => t.id === tplId)
          const { data: msg } = await api.post('/conversations/start', {
            wa_id: clean,
            contact_id: contactId,
            template_name: tpl?.name,
            template_language: tpl?.language || 'en_US',
          })
          convo = msg.conversation
        } else {
          // Create bare conversation record
          const { data: msg } = await api.post('/conversations/start', {
            wa_id: clean,
            contact_id: contactId,
          })
          convo = msg.conversation
        }
      }

      onCreated(convo, contactId)
      onClose()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to start conversation')
      setStep('confirm')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-white">New Conversation</h2>
            <p className="text-xs text-slate-400 mt-0.5">Start a chat with any WhatsApp number</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl transition-colors leading-none">&times;</button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-900/20 border border-red-800/40 text-red-400 text-xs px-3 py-2.5 rounded-xl">⚠ {error}</div>
          )}

          {/* Step 1 — Phone input */}
          {(step === 'search' || step === 'confirm') && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Phone number <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setStep('search'); setContact(null) }}
                  onKeyDown={e => e.key === 'Enter' && searchContact()}
                  placeholder="919876543210  (country code + number)"
                  className="flex-1 bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors font-mono"
                />
                {step === 'search' && (
                  <button onClick={searchContact} disabled={searching}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors shrink-0">
                    {searching ? '…' : 'Search'}
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">No + sign. Example: 919876543210 for India +91</p>
            </div>
          )}

          {/* Step 2 — Contact found / not found */}
          {step === 'confirm' && (
            <>
              {contact ? (
                <div className="flex items-center gap-3 p-3 bg-emerald-900/20 border border-emerald-800/40 rounded-xl">
                  <Avatar name={contact.profile_name || contact.wa_id} size="sm" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-400">✓ Existing contact found</p>
                    <p className="text-xs text-slate-300">{contact.profile_name || 'No name'} · +{contact.wa_id}</p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-900/15 border border-amber-800/30 rounded-xl">
                  <p className="text-xs font-semibold text-amber-400 mb-2">New contact — will be created</p>
                  <label className="block text-xs text-slate-400 mb-1">Contact name (optional)</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter name"
                    className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none transition-colors" />
                </div>
              )}

              {/* Template selection — required if 24h window not open */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Opening message template
                  <span className="text-slate-500 ml-1">(required if no recent chat)</span>
                </label>
                <select value={tplId} onChange={e => setTplId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 text-slate-300 text-xs rounded-xl px-3 py-2.5 outline-none appearance-none cursor-pointer transition-colors">
                  <option value="">— No template / just open chat —</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.language})</option>
                  ))}
                </select>
                {templates.length === 0 && (
                  <p className="text-[11px] text-slate-500 mt-1">No approved templates. Go to Templates page to create one.</p>
                )}
              </div>

              <button onClick={startConversation}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H6l-4 4V5z"/></svg>
                Start Conversation
              </button>
            </>
          )}

          {step === 'sending' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <svg className="w-8 h-8 animate-spin text-blue-400" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".2"/>
                <path d="M22 12A10 10 0 0012 2" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
              </svg>
              <p className="text-sm text-slate-400">Starting conversation…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Inbox ────────────────────────────────────────────────────────────────
export default function Inbox() {
  const location   = useLocation()
  const navigate   = useNavigate()

  const [convos, setConvos]           = useState([])
  const [selected, setSelected]       = useState(null)
  const [contact, setContact]         = useState(null)
  const [messages, setMessages]       = useState([])
  const [hasMore, setHasMore]         = useState(false)
  const [page, setPage]               = useState(1)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatusFilter] = useState('open')
  const [text, setText]               = useState('')
  const [sending, setSending]         = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [templates, setTemplates]     = useState([])
  const [agents, setAgents]           = useState([])
  const [rightTab, setRightTab]       = useState('details')
  const [editing, setEditing]         = useState(false)
  const [editForm, setEditForm]       = useState({})
  const [showNewConvo, setShowNewConvo] = useState(false)
  const [showTplModal, setShowTplModal] = useState(false)
  const [showFlowModal, setShowFlowModal] = useState(false)
  const [flows, setFlows] = useState([])
  const [activeMenu,   setActiveMenu]   = useState(null)   // message id with open menu
  const [replyTo,      setReplyTo]      = useState(null)   // message being replied to
  const [msgInfo,      setMsgInfo]      = useState(null)   // message info modal
  const [showRight, setShowRight]     = useState(true)

  const bottomRef = useRef(null)
  const chatRef   = useRef(null)
  const inputRef  = useRef(null)

  // ── Load conversations ──────────────────────────────────────────────────
  const loadConvos = useCallback(() => {
    const p = new URLSearchParams({ status: statusFilter, limit: 60 })
    if (search) p.append('search', search)
    api.get(`/conversations?${p}`).then(r => setConvos(r.data.conversations || [])).catch(() => {})
  }, [statusFilter, search])

  useEffect(() => { loadConvos() }, [loadConvos])

  // ── Load messages ───────────────────────────────────────────────────────
  const loadMessages = useCallback(async (cid, pg = 1, prepend = false) => {
    setLoadingMsgs(true)
    try {
      const { data } = await api.get(`/conversations/${cid}/messages?page=${pg}&limit=30`)
      const msgs = data.messages || []
      if (prepend) {
        const prev = chatRef.current?.scrollHeight || 0
        setMessages(m => [...msgs, ...m])
        setTimeout(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight - prev }, 60)
      } else {
        setMessages(msgs)
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
      }
      setHasMore(msgs.length === 30)
    } catch {}
    setLoadingMsgs(false)
  }, [])

  const loadContact = useCallback(async (cid) => {
    try { const { data } = await api.get(`/contacts/${cid}`); setContact(data); setEditForm(data) } catch {}
  }, [])

  const selectConvo = useCallback(async (c) => {
    setSelected(c); setPage(1); setShowTemplates(false)
    await loadMessages(c.id, 1)
    if (c.contact_id) await loadContact(c.contact_id)
    setConvos(p => p.map(x => x.id === c.id ? { ...x, unread_count: 0 } : x))
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [loadMessages, loadContact])

  // ── Deep link from Contacts "Open Chat" ──────────────────────────────────
  // Navigates here with location.state = { wa_id, contact_id?, contact_name? }
  // Directly opens or creates the conversation — NO modal shown
  useEffect(() => {
    const state = location.state
    if (!state?.wa_id) return

    // Clear state immediately so back-navigation doesn't re-trigger
    window.history.replaceState({}, '')

    const openDirectly = async () => {
      const wa_id = state.wa_id

      // 1. Check for existing open conversation
      try {
        const { data } = await api.get(`/conversations?search=${wa_id}&limit=20`)
        const match = (data.conversations || []).find(c => c.wa_id === wa_id)

        if (match) {
          // Existing conversation found — select it directly
          setConvos(prev => prev.find(c => c.id === match.id) ? prev : [match, ...prev])
          selectConvo(match)
          return
        }
      } catch {}

      // 2. No conversation — create one silently via API
      try {
        const { data } = await api.post('/conversations/start', {
          wa_id:       wa_id,
          contact_id:  state.contact_id || null,
        })

        const newConvo = data.conversation
        if (newConvo) {
          setConvos(prev => [newConvo, ...prev])
          selectConvo(newConvo)
          // Load contact details if available
          if (state.contact_id) {
            loadContact(state.contact_id)
          }
        }
      } catch (e) {
        // Fallback — show error in console but don't crash
        console.error('[Inbox] Failed to start conversation:', e)
      }
    }

    // Small delay to let convos load first
    const timer = setTimeout(openDirectly, 300)
    return () => clearTimeout(timer)
  }, [location.state])

  // Pre-fill phone in new convo modal from navigation state
  const navState = location.state

  // ── WebSocket ───────────────────────────────────────────────────────────
  const onWsMessage = useCallback(ev => {
    if (ev.type === 'new_message') {
      loadConvos()
      if (selected?.id === ev.conversation_id) {
        setMessages(p => {
          // Dedup by id AND by wa_message_id to prevent doubles
          const msgId   = ev.message?.id
          const waMsgId = ev.message?.wa_message_id
          const exists  = p.some(m =>
            (msgId   && m.id           === msgId)   ||
            (waMsgId && m.wa_message_id === waMsgId) ||
            (waMsgId && m.content?.wa_message_id === waMsgId)
          )
          if (exists) return p
          return [...p, ev.message]
        })
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
      }
    }
    if (ev.type === 'status_update') {
      setMessages(p => p.map(m =>
        m.wa_message_id === ev.wa_message_id ? { ...m, status: ev.status } : m
      ))
    }
  }, [selected, loadConvos])

  useInboxSocket(onWsMessage)

  // Load templates + agents
  useEffect(() => {
    api.get('/templates/local').then(r => setTemplates((r.data.templates || []).filter(t => t.status === 'APPROVED'))).catch(() => {})
    api.get('/agents').then(r => setAgents(r.data || [])).catch(() => {})
  }, [])

  // ── Send message ────────────────────────────────────────────────────────
  const sendText = async e => {
    e?.preventDefault()
    if (!text.trim() || !selected || sending) return
    setSending(true); const body = text; setText('')
    try {
      const payload = { msg_type: 'text', content: { body } }
      if (replyTo?.wa_message_id) payload.reply_to_message_id = replyTo.wa_message_id
      const { data } = await api.post(`/conversations/${selected.id}/messages`, payload)
      setReplyTo(null)
      // Add to state immediately for instant feedback
      // WebSocket will also broadcast but dedup check above prevents doubles
      setMessages(p => {
        const exists = p.some(m => m.id === data.id || m.wa_message_id === data.wa_message_id)
        return exists ? p : [...p, data]
      })
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
      loadConvos()
    } catch (e) { alert(e.response?.data?.detail || 'Send failed'); setText(body) }
    setSending(false)
  }

  const sendTemplate = async tpl => {
    // Legacy quick-send — opens modal instead
    setShowTplModal(true)
  }

  const handleSendTemplate = async payload => {
    // payload from SendTemplateModal:
    // { msg_type, template_name, language, header_type, header_link,
    //   header_media_id, header_filename, body_variables, buttons }
    if (!selected) return
    const { data } = await api.post(`/conversations/${selected.id}/messages`, payload)
    setMessages(p => {
      const exists = p.some(m => m.id === data.id)
      return exists ? p : [...p, data]
    })
    setShowTemplates(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
    loadConvos()
  }

  const handleOpenFlowModal = async () => {
    // Load published flows for the picker (falls back to empty list gracefully)
    try {
      const { data } = await api.get('/flows')
      setFlows(data?.flows || data || [])
    } catch {
      setFlows([])
    }
    setShowFlowModal(true)
  }

  const handleSendFlow = async payload => {
    if (!selected) return
    const { data } = await api.post(`/conversations/${selected.id}/messages`, payload)
    setMessages(p => {
      const exists = p.some(m => m.id === data.id)
      return exists ? p : [...p, data]
    })
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
    loadConvos()
  }

  const updateStatus = async status => {
    if (!selected) return
    try {
      await api.patch(`/conversations/${selected.id}/status?status=${status}`)
      setSelected(p => ({ ...p, status }))
      if (status !== statusFilter) { setConvos(p => p.filter(c => c.id !== selected.id)); setSelected(null) }
      else setConvos(p => p.map(c => c.id === selected.id ? { ...c, status } : c))
    } catch {}
  }

  const assignAgent = async agentId => {
    if (!selected) return
    try {
      await api.patch(`/conversations/${selected.id}/assign${agentId ? `?agent_id=${agentId}` : ''}`)
      setSelected(p => ({ ...p, assigned_agent: agentId }))
    } catch {}
  }

  const saveContact = async () => {
    if (!contact) return
    try {
      const { data } = await api.patch(`/contacts/${contact.id}`, {
        profile_name: editForm.profile_name, email: editForm.email,
        tags: typeof editForm.tags === 'string'
          ? editForm.tags.split(',').map(t => t.trim()).filter(Boolean)
          : editForm.tags,
      })
      setContact(data); setEditForm(data); setEditing(false)
    } catch (e) { alert(e.response?.data?.detail || 'Update failed') }
  }

  // When new conversation created from modal
  const handleNewConvoCreated = async (convo, contactId) => {
    loadConvos()
    if (convo) {
      await selectConvo(convo)
    }
    // clear navigation state
    window.history.replaceState({}, '')
  }

  const windowOpen = selected?.window_expires_at && new Date(selected.window_expires_at) > new Date()

  // ── Message context menu ─────────────────────────────────────────────────
  const QUICK_EMOJIS = ['👍','❤️','😂','😮','😢','🙏']

  const MsgMenu = ({ m, onClose }) => {
    const isOut = m.direction === 'outbound'

    const sendReaction = async emoji => {
      onClose()
      try {
        await api.post(`/conversations/${selected.id}/messages`, {
          msg_type: 'reaction',
          content:  { emoji, message_id: m.wa_message_id || m.id }
        })
      } catch {}
    }

    const copyText = () => {
      const text = m.content?.body || m.content?.caption || ''
      navigator.clipboard.writeText(text)
      onClose()
    }

    const deleteMsg = async () => {
      onClose()
      if (!confirm('Delete this message?')) return
      try {
        await api.delete(`/conversations/${selected.id}/messages/${m.id}`)
        setMessages(p => p.filter(x => x.id !== m.id))
      } catch (e) { alert(e.response?.data?.detail || 'Delete failed') }
    }

    const starMsg = async () => {
      onClose()
      setMessages(p => p.map(x => x.id === m.id ? { ...x, starred: !x.starred } : x))
    }

    return (
      <div style={{ zIndex:9999 }}
        className={`fixed bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden w-56`}
        ref={el => {
          if (el) {
            // Smart positioning: keep menu in viewport
            const rect = el.getBoundingClientRect()
            const vw = window.innerWidth
            const vh = window.innerHeight
            if (rect.right > vw)  el.style.left  = (vw - rect.width - 8) + 'px'
            if (rect.bottom > vh) el.style.top   = (rect.top - rect.height - 8) + 'px'
          }
        }}
        onClick={e => e.stopPropagation()}>

        {/* Quick emoji reactions */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800">
          {QUICK_EMOJIS.map(emoji => (
            <button key={emoji} onClick={() => sendReaction(emoji)}
              className="text-xl hover:scale-125 transition-transform active:scale-95">
              {emoji}
            </button>
          ))}
          <button onClick={() => sendReaction('➕')}
            className="text-slate-400 hover:text-slate-200 text-lg transition-colors">+</button>
        </div>

        {/* Actions */}
        {[
          { icon:'ℹ️',  label:'Message info',  fn: () => { setMsgInfo(m); onClose() },       show: true },
          { icon:'↩️',  label:'Reply',          fn: () => { setReplyTo(m); onClose(); setTimeout(()=>inputRef.current?.focus(),100) }, show: true },
          { icon:'📋',  label:'Copy',           fn: copyText,                                show: !!(m.content?.body || m.content?.caption) },
          { icon:'⭐',  label: m.starred ? 'Unstar' : 'Star', fn: starMsg,                  show: true },
          { icon:'🗑️', label:'Delete',          fn: deleteMsg,                               show: true },
        ].filter(a => a.show).map(a => (
          <button key={a.label} onClick={a.fn}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800 transition-colors text-left">
            <span className="text-base w-5 text-center">{a.icon}</span>
            <span className={`text-sm ${a.label === 'Delete' ? 'text-red-400' : 'text-slate-300'}`}>{a.label}</span>
          </button>
        ))}
      </div>
    )
  }

  // ── Message info modal ─────────────────────────────────────────────────────
  const MsgInfoModal = ({ m, onClose }) => (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xs shadow-2xl p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-200">Message Info</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-xl">×</button>
        </div>
        {[
          { icon:'✓',   label:'Sent',      val: m.created_at ? fmt(m.created_at) : '—',  c:'text-slate-400' },
          { icon:'✓✓', label:'Delivered', val: m.delivered_at ? fmt(m.delivered_at) : (m.status === 'delivered' || m.status === 'read' ? 'Yes' : '—'), c:'text-slate-400' },
          { icon:'✓✓', label:'Read',      val: m.read_at ? fmt(m.read_at) : (m.status === 'read' ? 'Yes' : '—'), c:'text-blue-400' },
          { icon:'🆔',  label:'Message ID', val: (m.wa_message_id || m.id || '').slice(-12), c:'text-slate-500' },
          { icon:'📱',  label:'Type',       val: m.type || m.msg_type || 'text', c:'text-slate-400' },
        ].map(r => (
          <div key={r.label} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
            <div className="flex items-center gap-2">
              <span className="text-sm w-5 text-center">{r.icon}</span>
              <span className="text-xs text-slate-400">{r.label}</span>
            </div>
            <span className={`text-xs font-medium font-mono ${r.c}`}>{r.val}</span>
          </div>
        ))}
      </div>
    </div>
  )

  const renderBubble = m => {
    const isOut = m.direction === 'outbound'
    const c     = m.content || {}
    const type  = m.type || m.msg_type || 'text'

    // ── Reaction — inline pill display ────────────────────────────────────
    if (type === 'reaction') {
      return (
        <div key={m.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'} mb-1`}>
          <div className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700/40 rounded-full px-3 py-1">
            <span className="text-lg">{c.emoji || '👍'}</span>
            <span className="text-[10px] text-slate-400">reacted</span>
            <span className="text-[10px] text-slate-500">{fmt(m.created_at)}</span>
          </div>
        </div>
      )
    }

    // ── Bubble content per type ────────────────────────────────────────────
    const renderContent = () => {
      switch (type) {
        case 'text':
          return <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words">{c.body || ''}</p>

        case 'image':
          return (
            <div>
              <div className="w-full max-w-[220px] bg-slate-700 rounded-xl overflow-hidden mb-1.5 flex items-center justify-center" style={{minHeight:120}}>
                <div className="flex flex-col items-center gap-1 p-4 text-slate-400">
                  <span className="text-3xl">🖼️</span>
                  <span className="text-[10px]">Image</span>
                  {c.mime_type && <span className="text-[9px] font-mono text-slate-500">{c.mime_type}</span>}
                </div>
              </div>
              {c.caption && <p className="text-[12px] text-slate-200 mt-1">{c.caption}</p>}
            </div>
          )

        case 'video':
          return (
            <div>
              <div className="w-full max-w-[220px] bg-slate-900 rounded-xl overflow-hidden mb-1.5 flex items-center justify-center" style={{minHeight:100}}>
                <div className="flex flex-col items-center gap-1 p-4 text-slate-400">
                  <span className="text-3xl">🎥</span>
                  <span className="text-[10px]">Video</span>
                </div>
              </div>
              {c.caption && <p className="text-[12px] text-slate-200 mt-1">{c.caption}</p>}
            </div>
          )

        case 'audio':
          return (
            <div className="flex items-center gap-2 px-1 min-w-[160px]">
              <div className="w-8 h-8 rounded-full bg-emerald-600/20 border border-emerald-600/30 flex items-center justify-center shrink-0">
                <span>{c.voice ? '🎤' : '🎵'}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-0.5 h-5">
                  {[3,5,4,7,5,3,6,4,5,3,4,6].map((h,i) => (
                    <div key={i} className="w-1 bg-slate-500 rounded-full" style={{height:h*3}}/>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{c.voice ? 'Voice message' : 'Audio'}</p>
              </div>
            </div>
          )

        case 'document':
          return (
            <div className="flex items-center gap-3 bg-black/20 rounded-xl p-2.5 min-w-[160px] max-w-[220px]">
              <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                <span className="text-lg">📄</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-slate-200 truncate">{c.filename || 'Document'}</p>
                <p className="text-[10px] text-slate-400">{c.mime_type?.split('/')[1]?.toUpperCase() || 'FILE'}</p>
                {c.caption && <p className="text-[10px] text-slate-300 mt-0.5">{c.caption}</p>}
              </div>
            </div>
          )

        case 'sticker':
          return (
            <div className="flex flex-col items-center gap-1 p-1">
              <span className="text-5xl">{c.animated ? '✨' : '😊'}</span>
              <span className="text-[9px] text-slate-500">Sticker</span>
            </div>
          )

        case 'location':
          return (
            <div className="min-w-[160px] max-w-[220px]">
              <div className="bg-slate-700 rounded-xl overflow-hidden mb-1.5 flex items-center justify-center" style={{height:80}}>
                <div className="flex flex-col items-center gap-1 text-slate-400">
                  <span className="text-2xl">📍</span>
                  <span className="text-[10px]">{c.name || 'Location'}</span>
                </div>
              </div>
              {c.address && <p className="text-[11px] text-slate-300">{c.address}</p>}
              {c.latitude && (
                <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                  {Number(c.latitude).toFixed(4)}, {Number(c.longitude).toFixed(4)}
                </p>
              )}
            </div>
          )

        case 'contacts':
          return (
            <div className="flex items-center gap-2 min-w-[140px]">
              <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center shrink-0">👤</div>
              <div>
                <p className="text-[12px] font-medium text-slate-200">{c.names || 'Contact'}</p>
                <p className="text-[10px] text-slate-400">{(c.contacts||[]).length} contact{(c.contacts||[]).length!==1?'s':''}</p>
              </div>
            </div>
          )

        case 'template':
          return (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[10px] font-bold text-blue-400 bg-blue-400/10 border border-blue-400/20 px-2 py-0.5 rounded-full uppercase tracking-wide">
                  📋 Template
                </span>
              </div>
              <p className="text-[12px] font-mono text-blue-300">{c.template_name || c.body || 'Template'}</p>
              {c.language && <p className="text-[10px] text-slate-500 mt-0.5">{c.language}</p>}
            </div>
          )

        case 'interactive':
        case 'button':
          return (
            <div>
              <p className="text-[13.5px] whitespace-pre-wrap break-words">{c.body || ''}</p>
              {(c.button_reply?.title || c.list_reply?.title || c.payload) && (
                <div className="flex items-center gap-1 mt-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg px-2 py-1">
                  <span className="text-[11px] text-blue-300 font-medium">
                    🔘 {c.button_reply?.title || c.list_reply?.title || c.payload}
                  </span>
                </div>
              )}
            </div>
          )

        default:
          return <p className="text-[13.5px] text-slate-300">{c.body || `[${type}]`}</p>
      }
    }

    // ── Reaction badges on bubble ──────────────────────────────────────────
    const reactions = m.reactions || []

    return (
      <div key={m.id}
        className={`flex items-end gap-2 mb-2 group ${isOut ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isOut && <Avatar name={contact?.profile_name || selected?.wa_id || ''} size="sm" />}

        <div className={`flex flex-col max-w-[68%] ${isOut ? 'items-end' : 'items-start'} relative`}>

          {/* Reply quote */}
          {m.reply_to && (
            <div className={`text-[11px] px-3 py-1.5 rounded-xl mb-1 border-l-2 bg-slate-800/60
              ${isOut ? 'border-emerald-500 text-emerald-200/70' : 'border-blue-500 text-slate-400'}`}>
              <p className="font-semibold text-[10px] mb-0.5">{m.reply_to.direction === 'outbound' ? 'You' : contact?.profile_name || 'Contact'}</p>
              <p className="truncate max-w-[180px]">{m.reply_to.content?.body || '📎 Media'}</p>
            </div>
          )}

          {/* Starred indicator */}
          {m.starred && (
            <span className="text-[10px] text-amber-400 mb-0.5">⭐ Starred</span>
          )}

          {/* Main bubble + hover menu trigger */}
          <div className="relative flex items-start gap-1">

            {/* Menu trigger button — left side for outbound */}
            {isOut && (
              <button
                onClick={e => { e.stopPropagation(); setActiveMenu(activeMenu === m.id ? null : m.id) }}
                className="opacity-0 group-hover:opacity-100 transition-opacity mt-2 w-6 h-6 rounded-full bg-slate-700 hover:bg-slate-600 border border-slate-600 flex items-center justify-center text-slate-300 text-xs shrink-0 self-start">
                ▾
              </button>
            )}

            <div
              className={`px-3 py-2 rounded-2xl cursor-pointer select-none
                ${isOut
                  ? 'bg-emerald-900/60 border border-emerald-700/50 text-emerald-100 rounded-br-sm'
                  : 'bg-slate-800 border border-slate-700/50 text-slate-100 rounded-bl-sm'}
                ${['audio','document','location','contacts','sticker'].includes(type) ? 'min-w-[160px]' : ''}`}
              onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setActiveMenu(m.id) }}
              onClick={e => { if (activeMenu) { e.stopPropagation(); setActiveMenu(null) } }}
            >
              {renderContent()}
            </div>

            {/* Menu trigger button — right side for inbound */}
            {!isOut && (
              <button
                onClick={e => { e.stopPropagation(); setActiveMenu(activeMenu === m.id ? null : m.id) }}
                className="opacity-0 group-hover:opacity-100 transition-opacity mt-2 w-6 h-6 rounded-full bg-slate-700 hover:bg-slate-600 border border-slate-600 flex items-center justify-center text-slate-300 text-xs shrink-0 self-start">
                ▾
              </button>
            )}
          </div>

          {/* Reaction badges */}
          {reactions.length > 0 && (
            <div className="flex gap-0.5 mt-0.5">
              {reactions.map((r, i) => (
                <span key={i} className="text-sm bg-slate-800 border border-slate-700 rounded-full px-1.5 py-0.5">
                  {r}
                </span>
              ))}
            </div>
          )}

          {/* Timestamp + tick */}
          <div className={`flex items-center gap-1 mt-1 px-1 ${isOut ? 'flex-row-reverse' : ''}`}>
            <span className="text-[10px] text-slate-500">{fmt(m.created_at)}</span>
            {isOut && <Tick status={m.status} />}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">

      {/* ── LEFT: Conversation List ───────────────────────────── */}
      <aside className="w-72 xl:w-80 shrink-0 flex flex-col border-r border-slate-800 bg-slate-950">
        <div className="p-4 border-b border-slate-800 space-y-3">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold">Inbox</h1>
              <span className="text-xs font-semibold bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">{convos.length}</span>
            </div>
            {/* New Conversation button */}
            <button
              onClick={() => setShowNewConvo(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-colors"
              title="Start new conversation"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H6l-4 4V5z"/>
              </svg>
              New
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" viewBox="0 0 20 20" fill="none">
              <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              className="w-full bg-slate-800/60 border border-slate-700 rounded-lg py-2 pl-8 pr-3 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
              placeholder="Search conversations…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Status tabs */}
          <div className="flex gap-1">
            {['open','resolved','bot_handling'].map(s => (
              <button key={s} onClick={() => { setStatusFilter(s); setSelected(null) }}
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors
                  ${statusFilter === s ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'}`}>
                {s === 'bot_handling' ? 'Bot' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Convo list */}
        <div className="flex-1 overflow-y-auto">
          {convos.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-500">
              <span className="text-3xl opacity-30">💬</span>
              <p className="text-sm">No conversations</p>
              <button onClick={() => setShowNewConvo(true)}
                className="text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-900/20 border border-emerald-800/30 px-3 py-1.5 rounded-lg transition-colors">
                + Start a conversation
              </button>
            </div>
          )}
          {convos.map(c => (
            <div key={c.id} onClick={() => selectConvo(c)}
              className={`flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-slate-800/60 transition-colors
                ${selected?.id === c.id ? 'bg-slate-800 border-l-2 border-l-blue-500 pl-3.5' : 'hover:bg-slate-800/40'}`}>
              <Avatar name={c.wa_id} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className={`text-sm font-mono truncate ${c.unread_count ? 'font-semibold text-white' : 'text-slate-300'}`}>
                    +{c.wa_id}
                  </span>
                  <span className="text-[10px] text-slate-500 shrink-0 ml-2">{fmt(c.last_message_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs truncate ${c.unread_count ? 'text-slate-300' : 'text-slate-500'}`}>
                    {c.last_message_preview || '…'}
                  </span>
                  {c.unread_count > 0 && (
                    <span className="shrink-0 min-w-[18px] h-[18px] bg-emerald-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                      {c.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ── CENTER: Chat ─────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden border-r border-slate-800 min-w-0">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-4">
            <div className="text-5xl opacity-20">💬</div>
            <p className="text-base font-medium text-slate-400">Select a conversation</p>
            <p className="text-sm text-slate-500">or start a new one</p>
            <button onClick={() => setShowNewConvo(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors mt-2">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H6l-4 4V5z"/></svg>
              New Conversation
            </button>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-950/80 backdrop-blur shrink-0">
              <Avatar name={contact?.profile_name || selected.wa_id} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {contact?.profile_name || <span className="text-slate-400 font-normal">Unknown</span>}
                </p>
                <p className="text-xs text-slate-400 font-mono">+{selected.wa_id}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Window status */}
                {selected.window_expires_at && (
                  <span className={`hidden sm:flex items-center gap-1 text-xs px-2 py-1 rounded-md border
                    ${windowOpen ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/50' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                    ⏱ {windowOpen ? 'Window open' : 'Window closed'}
                  </span>
                )}
                {/* View contact button */}
                {contact && (
                  <button
                    onClick={() => navigate('/dashboard/contacts')}
                    className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="View contact"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/></svg>
                  </button>
                )}
                <select value={selected.status} onChange={e => updateStatus(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-1.5 outline-none cursor-pointer focus:border-blue-500 transition-colors">
                  {['open','resolved','bot_handling','spam'].map(s => (
                    <option key={s} value={s}>{{open:'Open',resolved:'Resolved',bot_handling:'Bot',spam:'Spam'}[s]}</option>
                  ))}
                </select>
                <button onClick={() => setShowRight(p => !p)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M4 5h12M4 10h12M4 15h7"/></svg>
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4" onClick={() => setActiveMenu(null)}>
              {hasMore && (
                <div className="flex justify-center mb-4">
                  <button onClick={async () => { const np = page+1; setPage(np); await loadMessages(selected.id, np, true) }}
                    disabled={loadingMsgs}
                    className="text-xs text-slate-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-1.5 rounded-full transition-colors disabled:opacity-50">
                    {loadingMsgs ? 'Loading…' : '↑ Load earlier'}
                  </button>
                </div>
              )}
              {messages.length === 0 && !loadingMsgs && (
                <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-600">
                  <p className="text-sm">No messages yet</p>
                  {!windowOpen && <p className="text-xs text-amber-500/70">Send a template to start the conversation</p>}
                </div>
              )}
              {messages.map(renderBubble)}
              <div ref={bottomRef} />
            </div>

            {/* Template picker */}
            {showTemplates && (
              <div className="border-t border-slate-800 bg-slate-900 max-h-52 flex flex-col shrink-0">
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Quick Templates</span>
                  <button onClick={() => setShowTemplates(false)} className="text-slate-500 hover:text-slate-300">✕</button>
                </div>
                <div className="overflow-y-auto">
                  {templates.length === 0 && <p className="text-xs text-slate-500 p-4 text-center">No approved templates</p>}
                  {templates.map(t => (
                    <div key={t.id} onClick={() => sendTemplate(t)}
                      className="px-4 py-2.5 cursor-pointer hover:bg-slate-800 border-b border-slate-800/60 transition-colors">
                      <p className="text-xs font-mono font-semibold text-blue-400">{t.name}</p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {t.components?.find(c => c.type === 'BODY')?.text?.slice(0, 80)}…
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reply preview bar */}
            {replyTo && (
              <div className="flex items-center gap-3 px-4 py-2.5 border-t border-slate-800 bg-slate-900/80">
                <div className="flex-1 border-l-2 border-blue-500 pl-3">
                  <p className="text-[10px] font-bold text-blue-400 mb-0.5">
                    Replying to {replyTo.direction === 'outbound' ? 'yourself' : contact?.profile_name || 'contact'}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {replyTo.content?.body || replyTo.content?.caption || '📎 Media'}
                  </p>
                </div>
                <button onClick={() => setReplyTo(null)}
                  className="text-slate-500 hover:text-slate-300 text-lg leading-none transition-colors">×</button>
              </div>
            )}

            {/* Composer */}
            <div className="flex items-end gap-2 px-4 py-3 border-t border-slate-800 bg-slate-950/80 shrink-0">
              <button onClick={() => setShowTplModal(true)}
                className="p-2 rounded-xl border bg-slate-800 border-slate-700 text-slate-400 hover:text-blue-400 hover:bg-blue-900/20 hover:border-blue-700/50 transition-colors shrink-0"
                title="Send Template">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M3 4h14v2H3zM3 8h10v2H3zM3 12h8v2H3z"/>
                </svg>
              </button>
              <button onClick={handleOpenFlowModal}
                className="p-2 rounded-xl border bg-slate-800 border-slate-700 text-slate-400 hover:text-emerald-400 hover:bg-emerald-900/20 hover:border-emerald-700/50 transition-colors shrink-0"
                title="Send Flow">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M3 5a1 1 0 000 2h11.586l-2.293 2.293a1 1 0 101.414 1.414l4-4a1 1 0 000-1.414l-4-4a1 1 0 10-1.414 1.414L14.586 4H3a1 1 0 00-1 1zm14 9a1 1 0 100-2H5.414l2.293-2.293a1 1 0 10-1.414-1.414l-4 4a1 1 0 000 1.414l4 4a1 1 0 101.414-1.414L5.414 15H17a1 1 0 001-1z" clipRule="evenodd"/>
                </svg>
              </button>
              <textarea ref={inputRef} rows={1} value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText() } }}
                onInput={e => { e.target.style.height='auto'; e.target.style.height=Math.min(e.target.scrollHeight,120)+'px' }}
                placeholder={!windowOpen && selected.window_expires_at ? 'Window closed — use a template ↑' : 'Type a message… (Enter to send)'}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500 resize-none transition-colors min-h-[40px] max-h-[120px] font-[inherit]"
              />
              <button onClick={sendText} disabled={!text.trim() || sending}
                className="p-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl transition-colors shrink-0 disabled:cursor-not-allowed">
                {sending ? (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity=".25"/>
                    <path d="M22 12A10 10 0 0012 2" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M2.5 10L17 2.5l-5 7.5 5 7.5L2.5 10z"/></svg>
                )}
              </button>
            </div>
          </>
        )}
      </main>

      {/* ── RIGHT: Contact Details ───────────────────────────── */}
      {selected && showRight && (
        <aside className="w-72 shrink-0 flex flex-col bg-slate-950 border-l border-slate-800 overflow-hidden">
          <div className="flex flex-col items-center gap-2 pt-6 pb-4 px-4 border-b border-slate-800">
            <Avatar name={contact?.profile_name || selected.wa_id} size="lg" />
            <p className="text-sm font-semibold text-center">{contact?.profile_name || <span className="text-slate-400">No name</span>}</p>
            <p className="text-xs text-slate-400 font-mono">+{selected.wa_id}</p>
            {contact && (
              <button
                onClick={() => navigate('/dashboard/contacts')}
                className="text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-lg transition-colors mt-1"
              >
                View in Contacts →
              </button>
            )}
            <div className="flex gap-0 mt-2 w-full border-t border-slate-800 pt-3">
              {['details','notes'].map(t => (
                <button key={t} onClick={() => setRightTab(t)}
                  className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors capitalize
                    ${rightTab === t ? 'bg-blue-600/20 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {rightTab === 'details' && (
              <>
                {/* Edit toggle */}
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Contact info</p>
                  <button onClick={() => setEditing(p => !p)} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                    {editing ? 'Cancel' : 'Edit'}
                  </button>
                </div>

                {editing ? (
                  <div className="space-y-2">
                    {[{label:'Name',key:'profile_name',p:'Full name'},{label:'Email',key:'email',p:'email@example.com'}].map(f => (
                      <div key={f.key}>
                        <label className="text-[10px] text-slate-500 block mb-1">{f.label}</label>
                        <input value={editForm[f.key]||''} onChange={e => setEditForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.p}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500 transition-colors" />
                      </div>
                    ))}
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">Tags (comma separated)</label>
                      <input
                        value={Array.isArray(editForm.tags) ? editForm.tags.join(', ') : editForm.tags || ''}
                        onChange={e => setEditForm(p => ({ ...p, tags: e.target.value }))}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500 transition-colors" />
                    </div>
                    <button onClick={saveContact} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium py-1.5 rounded-lg transition-colors">
                      Save changes
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {[
                      { label:'Phone',   value:`+${selected.wa_id}`, mono:true },
                      { label:'Email',   value:contact?.email||'—' },
                      { label:'Status',  value:contact?.status||'New', cls:'text-blue-400' },
                      { label:'Opted in',value:contact?.opted_in?'✓ Yes':'✗ No', cls:contact?.opted_in?'text-emerald-400':'text-slate-500' },
                      { label:'Added',   value:contact?.created_at ? fmt(contact.created_at) : '—' },
                    ].map(r => (
                      <div key={r.label} className="flex justify-between items-center py-1.5 border-b border-slate-800/60 last:border-0">
                        <span className="text-xs text-slate-500">{r.label}</span>
                        <span className={`text-xs text-right max-w-[140px] truncate ${r.cls||'text-slate-300'} ${r.mono?'font-mono':''}`}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tags */}
                {(contact?.tags||[]).length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {contact.tags.map(t => (
                        <span key={t} className="text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Assign */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Assign agent</p>
                  <select value={selected.assigned_agent||''} onChange={e => assignAgent(e.target.value||null)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2 outline-none cursor-pointer focus:border-blue-500 transition-colors appearance-none">
                    <option value="">Unassigned</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>

                {/* Actions */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Actions</p>
                  {selected.status === 'open' && (
                    <button onClick={() => updateStatus('resolved')}
                      className="w-full text-left text-xs py-2 px-3 bg-emerald-900/20 hover:bg-emerald-900/40 border border-emerald-800/40 text-emerald-400 rounded-lg transition-colors">
                      ✓ Mark as resolved
                    </button>
                  )}
                  {selected.status === 'resolved' && (
                    <button onClick={() => updateStatus('open')}
                      className="w-full text-left text-xs py-2 px-3 bg-blue-900/20 hover:bg-blue-900/40 border border-blue-800/40 text-blue-400 rounded-lg transition-colors">
                      ↩ Reopen
                    </button>
                  )}
                  <button onClick={() => updateStatus('spam')}
                    className="w-full text-left text-xs py-2 px-3 bg-red-900/10 hover:bg-red-900/20 border border-red-800/30 text-red-400 rounded-lg transition-colors">
                    🚫 Mark as spam
                  </button>
                </div>
              </>
            )}

            {rightTab === 'notes' && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Internal Notes</p>
                <textarea rows={6} placeholder="Add a private note…"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500 resize-none transition-colors font-[inherit] leading-relaxed mb-3" />
                <button className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium py-2 rounded-lg transition-colors">
                  Save note
                </button>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* New Conversation Modal */}
      {/* Message Info Modal */}
      {msgInfo && <MsgInfoModal m={msgInfo} onClose={() => setMsgInfo(null)}/>}

      {/* Global message menu overlay — renders outside chat scroll area */}
      {activeMenu && messages.find(m => m.id === activeMenu) && (() => {
        const m   = messages.find(x => x.id === activeMenu)
        const isOut = m.direction === 'outbound'
        return (
          <div className="fixed inset-0 z-[9998]" onClick={() => setActiveMenu(null)}>
            <div
              className={`fixed bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden w-56`}
              style={{
                bottom: 120,
                [isOut ? 'right' : 'left']: 80,
                zIndex: 9999,
              }}
              onClick={e => e.stopPropagation()}>
              {/* Quick emoji reactions */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800">
                {['👍','❤️','😂','😮','😢','🙏'].map(emoji => (
                  <button key={emoji}
                    onClick={async () => {
                      setActiveMenu(null)
                      try {
                        await api.post(`/conversations/${selected.id}/messages`, {
                          msg_type: 'reaction',
                          content:  { emoji, message_id: m.wa_message_id || m.id }
                        })
                      } catch {}
                    }}
                    className="text-xl hover:scale-125 transition-transform active:scale-95 cursor-pointer">
                    {emoji}
                  </button>
                ))}
                <span className="text-slate-400 text-lg">+</span>
              </div>
              {/* Actions */}
              {[
                { icon:'ℹ️',  label:'Message info', fn: () => { setMsgInfo(m); setActiveMenu(null) } },
                { icon:'↩️',  label:'Reply',         fn: () => { setReplyTo(m); setActiveMenu(null); setTimeout(()=>inputRef.current?.focus(),100) } },
                { icon:'📋',  label:'Copy',          fn: () => { navigator.clipboard.writeText(m.content?.body||m.content?.caption||''); setActiveMenu(null) }, show: !!(m.content?.body||m.content?.caption) },
                { icon:'⭐',  label: m.starred ? 'Unstar':'Star', fn: () => { setMessages(p=>p.map(x=>x.id===m.id?{...x,starred:!x.starred}:x)); setActiveMenu(null) } },
                { icon:'🗑️', label:'Delete',         fn: async () => { setActiveMenu(null); if(confirm('Delete?')) { try { await api.delete(`/conversations/${selected.id}/messages/${m.id}`); setMessages(p=>p.filter(x=>x.id!==m.id)) } catch(e){alert(e.response?.data?.detail||'Failed')} } } },
              ].map(a => (
                <button key={a.label} onClick={a.fn}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800 transition-colors text-left">
                  <span className="text-base w-5 text-center">{a.icon}</span>
                  <span className={`text-sm ${a.label==='Delete'?'text-red-400':'text-slate-300'}`}>{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Send Template Modal */}
      {showTplModal && selected && (
        <SendTemplateModal
          onClose={() => setShowTplModal(false)}
          onSend={handleSendTemplate}
        />
      )}

      {showFlowModal && selected && (
        <SendFlowModal
          flows={flows}
          onClose={() => setShowFlowModal(false)}
          onSend={handleSendFlow}
        />
      )}

      {showNewConvo && (
        <NewConvoModal
          initialPhone={navState?.wa_id || ''}
          onClose={() => { setShowNewConvo(false); window.history.replaceState({}, '') }}
          onCreated={handleNewConvoCreated}
        />
      )}
    </div>
  )
}