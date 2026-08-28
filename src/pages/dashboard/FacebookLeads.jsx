import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../../services/api'
import { useInboxSocket } from '../../hooks/useInboxSocket'

// Map a webhook-pushed flattened lead → the shape the leads table renders.
function normalizePushedLead(l = {}, meta = {}) {
  return {
    id:           l.lead_id || l.id,
    lead_id:      l.lead_id || l.id,
    page_id:      String(l.page_id || meta.page_id || ''),
    form_id:      String(l.form_id || meta.form_id || ''),
    full_name:    l.full_name || l.name || '',
    phone_number: l.phone_number || l.phone || '',
    email:        l.email || '',
    campaign_name: l.campaign_name || '',
    created_time: l.created_time || new Date().toISOString(),
  }
}

const FB_APP_ID = '1544541559775814'
const FB_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_ads',
  'pages_manage_metadata',   // required to subscribe the Page to our leadgen webhook
  'leads_retrieval',
  'ads_management',
  'ads_read',
].join(',')

function buildOAuthUrl() {
  const redirectUri = encodeURIComponent(`${window.location.origin}/dashboard/facebook-leads`)
  return (
    `https://www.facebook.com/dialog/oauth` +
    `?client_id=${FB_APP_ID}` +
    `&redirect_uri=${redirectUri}` +
    `&scope=${FB_SCOPES}` +
    `&response_type=token`
  )
}

function parseHashToken(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  return params.get('access_token') || null
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return sameDay ? `Today ${time}` : `${fmtDate(iso)} ${time}`
}

function leadName(lead) {
  const name = lead.full_name || lead.name || lead.first_name
  if (!name) return '—'
  return `${lead.full_name || lead.first_name || ''} ${lead.last_name || ''}`.trim()
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ children, style = {} }) {
  return (
    <div style={{
      background: '#161b22',
      border: '1px solid #21262d',
      borderRadius: '12px',
      padding: '16px',
      ...style,
    }}>
      {children}
    </div>
  )
}

function SectionLabel({ label, count }) {
  return (
    <div style={{
      fontSize: '11px', fontWeight: '600', color: '#8b949e',
      textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: '12px',
    }}>
      {label}{count != null ? ` (${count})` : ''}
    </div>
  )
}

function ListButton({ item, selected, onClick, primary, secondary }) {
  const active = selected
  return (
    <button
      onClick={() => onClick(item)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '10px 12px', marginBottom: '4px',
        background: active ? 'rgba(56,139,253,.1)' : 'transparent',
        border: `1px solid ${active ? 'rgba(56,139,253,.3)' : 'transparent'}`,
        borderRadius: '8px', cursor: 'pointer',
        color: active ? '#388bfd' : '#e6edf3',
        fontSize: '13px', transition: 'all .15s',
      }}
    >
      <div style={{ fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {primary}
      </div>
      {secondary && (
        <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '2px' }}>
          {secondary}
        </div>
      )}
    </button>
  )
}

function Spinner() {
  return <div style={{ color: '#8b949e', fontSize: '13px', padding: '8px 0' }}>Loading…</div>
}

function EmptyState({ icon, message }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8b949e' }}>
      <div style={{ fontSize: '32px', marginBottom: '10px' }}>{icon}</div>
      <div style={{ fontSize: '13px' }}>{message}</div>
    </div>
  )
}

const btn = (variant = 'ghost') => ({
  background: variant === 'primary' ? 'rgba(56,139,253,.1)' : 'none',
  border: `1px solid ${variant === 'primary' ? 'rgba(56,139,253,.3)' : '#21262d'}`,
  color: variant === 'primary' ? '#388bfd' : '#8b949e',
  borderRadius: '6px', padding: '6px 12px', cursor: 'pointer',
  fontSize: '12px', fontFamily: 'inherit', fontWeight: '500',
})

function TabButton({ active, onClick, children, badge }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'rgba(56,139,253,.1)' : 'transparent',
        border: `1px solid ${active ? 'rgba(56,139,253,.3)' : '#21262d'}`,
        color: active ? '#388bfd' : '#8b949e',
        borderRadius: '8px', padding: '8px 16px', cursor: 'pointer',
        fontSize: '13px', fontWeight: '500', fontFamily: 'inherit',
        display: 'inline-flex', alignItems: 'center', gap: '7px',
      }}
    >
      {children}
      {badge > 0 && (
        <span style={{
          background: '#3fb950', color: '#0d1117', borderRadius: '10px',
          padding: '1px 7px', fontSize: '11px', fontWeight: '700',
        }}>{badge}</span>
      )}
    </button>
  )
}

/** Live/idle indicator for the webhook → WebSocket pipeline. */
function LiveDot({ live }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      fontSize: '12px', color: live ? '#3fb950' : '#8b949e',
    }}>
      <span style={{
        width: '7px', height: '7px', borderRadius: '50%',
        background: live ? '#3fb950' : '#6e7681',
        boxShadow: live ? '0 0 0 3px rgba(63,185,80,.15)' : 'none',
      }} />
      {live ? 'Live' : 'Offline'}
    </span>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FacebookLeads() {
  const [status, setStatus]       = useState(null)   // null = loading
  const [tab, setTab]             = useState('live') // 'live' | 'forms'
  const [pages, setPages]         = useState([])
  const [selectedPage, setSPage]  = useState(null)
  const [forms, setForms]         = useState([])
  const [selectedForm, setSForm]  = useState(null)
  const [leads, setLeads]         = useState([])
  const [loadingPages, setLoadingPages]   = useState(false)
  const [loadingForms, setLoadingForms]   = useState(false)
  const [loadingLeads, setLoadingLeads]   = useState(false)
  const [connecting, setConnecting]       = useState(false)
  const [importing, setImporting]         = useState({})   // lead_id → bool
  const [imported,  setImported]          = useState({})   // lead_id → bool
  const [error, setError]                 = useState(null)
  const [newIds, setNewIds]               = useState({})   // lead_id → true (brief highlight)

  // ── Live feed state (webhook-synced leads from our own DB) ──────────────────
  const [liveLeads, setLiveLeads]     = useState([])
  const [liveTotal, setLiveTotal]     = useState(0)
  const [loadingLive, setLoadingLive] = useState(false)
  const [syncing, setSyncing]         = useState(false)
  const [syncNote, setSyncNote]       = useState(null)
  const [rtStatus, setRtStatus]       = useState(null)
  const [wsLive, setWsLive]           = useState(false)
  const [unseen, setUnseen]           = useState(0)
  const [search, setSearch]           = useState('')
  const [pageFilter, setPageFilter]   = useState('')   // page_id or ''

  const tabRef        = useRef(tab)
  const pageFilterRef = useRef(pageFilter)
  useEffect(() => { tabRef.current = tab }, [tab])
  useEffect(() => { pageFilterRef.current = pageFilter }, [pageFilter])

  const flashNew = useCallback((id) => {
    if (!id) return
    setNewIds(prev => ({ ...prev, [id]: true }))
    setTimeout(() => {
      setNewIds(prev => { const next = { ...prev }; delete next[id]; return next })
    }, 6000)
  }, [])

  // ── Real-time: leads pushed by Meta's leadgen webhook (no manual refresh) ────
  const handleRealtimeLead = useCallback((data) => {
    if (!data) return
    if (data.type === 'connected') { setWsLive(true); return }
    if (data.type !== 'new_lead') return

    const fresh = normalizePushedLead(data.lead, data)
    if (!fresh.id) return

    // 1. Live feed — always updated, whatever the user is currently looking at.
    //    This is the whole point of the webhook: a lead that lands while another
    //    form is open must never be lost.
    const matchesFilter = !pageFilterRef.current || pageFilterRef.current === fresh.page_id
    if (matchesFilter) {
      setLiveLeads(prev =>
        prev.some(l => String(l.id) === String(fresh.id)) ? prev : [fresh, ...prev]
      )
      setLiveTotal(t => t + 1)
      flashNew(fresh.id)
    }
    if (tabRef.current !== 'live') setUnseen(u => u + 1)

    // 2. Sidebar form counter.
    setForms(prev => prev.map(f =>
      String(f.id) === String(data.form_id)
        ? { ...f, leads_count: (f.leads_count || 0) + 1 }
        : f
    ))

    // 3. If that exact form is open in the Browse tab, prepend there too.
    setSForm(curForm => {
      if (curForm && String(curForm.id) === String(data.form_id)) {
        setLeads(prev =>
          prev.some(l => String(l.id) === String(fresh.id)) ? prev : [fresh, ...prev]
        )
        flashNew(fresh.id)
      }
      return curForm   // no change to selection
    })
  }, [flashNew])

  // Only listen once the account is connected.
  const socket = useInboxSocket(handleRealtimeLead, !!status?.connected)

  // The hook returns a fresh object each render, so keep it in a ref — otherwise
  // the interval below would be torn down and rebuilt on every render.
  const socketRef = useRef(socket)
  socketRef.current = socket

  // Poll the socket's readyState so the header dot reflects reality (the hook
  // reconnects on its own; we just mirror its state).
  useEffect(() => {
    if (!status?.connected) return
    const read = () => setWsLive(socketRef.current?.getStatus?.() === WebSocket.OPEN)
    read()
    const t = setInterval(read, 2000)
    return () => clearInterval(t)
  }, [status?.connected])

  // Clear the unseen badge when the user opens the live tab.
  useEffect(() => { if (tab === 'live') setUnseen(0) }, [tab])

  // Check URL hash for OAuth token on mount
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('access_token=')) {
      const token = parseHashToken(hash)
      if (token) {
        window.history.replaceState(null, '', window.location.pathname)
        handleConnect(token)
        return
      }
    }
    fetchStatus()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reload the live feed whenever its filters change.
  useEffect(() => {
    if (!status?.connected) return
    const t = setTimeout(fetchLiveLeads, search ? 350 : 0)   // debounce typing
    return () => clearTimeout(t)
  }, [status?.connected, search, pageFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchStatus() {
    try {
      const { data } = await api.get('/facebook/status')
      setStatus(data)
      if (data.connected) {
        fetchPages()
        fetchRealtimeStatus()
      }
    } catch {
      setStatus({ connected: false })
    }
  }

  async function fetchRealtimeStatus() {
    try {
      const { data } = await api.get('/facebook/realtime-status')
      setRtStatus(data)
    } catch {
      setRtStatus(null)
    }
  }

  async function fetchLiveLeads() {
    setLoadingLive(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (search.trim()) params.set('q', search.trim())
      if (pageFilter) params.set('page_id', pageFilter)
      const { data } = await api.get(`/facebook/leads?${params}`)
      setLiveLeads(data.leads || [])
      setLiveTotal(data.total || 0)
    } catch {
      setError('Failed to load the live lead feed.')
    } finally {
      setLoadingLive(false)
    }
  }

  /** Backfill leads submitted before the webhook was live. */
  async function syncLeads() {
    setSyncing(true)
    setSyncNote(null)
    setError(null)
    try {
      const { data } = await api.post('/facebook/leads/sync')
      setSyncNote(
        data.note ||
        `Imported ${data.leads_new ?? 0} new lead(s) from ${data.forms_scanned ?? 0} form(s).`
      )
      await fetchLiveLeads()
      fetchRealtimeStatus()
    } catch (e) {
      setError(e?.response?.data?.detail || 'Lead sync failed.')
    } finally {
      setSyncing(false)
    }
  }

  async function handleConnect(token) {
    setConnecting(true)
    setError(null)
    try {
      await api.post('/facebook/connect', { user_access_token: token })
      await fetchStatus()
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.message || 'Unknown error'
      setError(`Connect failed: ${detail}`)
      setStatus({ connected: false })
    } finally {
      setConnecting(false)
    }
  }

  async function fetchPages() {
    setLoadingPages(true)
    setError(null)
    try {
      const { data } = await api.get('/facebook/pages')
      setPages(data.pages || [])
      // /facebook/pages also (re)subscribes each Page to the leadgen webhook,
      // so the realtime status may have just changed.
      fetchRealtimeStatus()
    } catch {
      setError('Failed to load Facebook Pages.')
    } finally {
      setLoadingPages(false)
    }
  }

  async function selectPage(page) {
    setSPage(page)
    setSForm(null)
    setLeads([])
    setForms([])
    setLoadingForms(true)
    setError(null)
    try {
      const { data } = await api.get(`/facebook/pages/${page.id}/lead-forms`)
      setForms(data.forms || [])
    } catch {
      setError('Failed to load Lead Ad Forms.')
    } finally {
      setLoadingForms(false)
    }
  }

  async function selectForm(form) {
    setSForm(form)
    setLeads([])
    setLoadingLeads(true)
    setError(null)
    try {
      const pageParam = selectedPage ? `?page_id=${selectedPage.id}` : ''
      const { data } = await api.get(`/facebook/lead-forms/${form.id}/leads${pageParam}`)
      setLeads(data.leads || [])
    } catch {
      setError('Failed to load leads.')
    } finally {
      setLoadingLeads(false)
    }
  }

  async function importLead(lead, formId) {
    const fid = formId || lead.form_id || selectedForm?.id
    if (!fid) {
      setError('Cannot import: this lead has no form id.')
      return
    }
    setImporting(p => ({ ...p, [lead.id]: true }))
    try {
      await api.post(`/facebook/lead-forms/${fid}/leads/${lead.id}/import`)
      setImported(p => ({ ...p, [lead.id]: true }))
    } catch {
      setError(`Failed to import lead.`)
    } finally {
      setImporting(p => ({ ...p, [lead.id]: false }))
    }
  }

  function ImportCell({ lead, formId }) {
    if (imported[lead.id]) {
      return (
        <span style={{ color: '#3fb950', fontSize: '12px', fontWeight: '500' }}>
          ✓ Imported
        </span>
      )
    }
    return (
      <button
        onClick={() => importLead(lead, formId)}
        disabled={importing[lead.id]}
        style={{
          ...btn('primary'), padding: '5px 14px', whiteSpace: 'nowrap',
          cursor: importing[lead.id] ? 'not-allowed' : 'pointer',
          opacity: importing[lead.id] ? .6 : 1,
        }}
      >
        {importing[lead.id] ? 'Importing…' : 'Import to CRM'}
      </button>
    )
  }

  function LeadRow({ lead, formId, extraCols = false }) {
    return (
      <tr style={{
        borderBottom: '1px solid rgba(33,38,45,.6)',
        background: newIds[lead.id] ? 'rgba(63,185,80,.10)' : 'transparent',
        transition: 'background 1s ease',
      }}>
        <td style={{ padding: '11px 12px', color: '#e6edf3', fontWeight: '500' }}>
          {newIds[lead.id] && (
            <span style={{
              display: 'inline-block', marginRight: '7px', padding: '1px 6px',
              fontSize: '10px', fontWeight: '600', color: '#3fb950',
              background: 'rgba(63,185,80,.15)', borderRadius: '4px',
              verticalAlign: 'middle',
            }}>NEW</span>
          )}
          {leadName(lead)}
        </td>
        <td style={{ padding: '11px 12px', color: '#e6edf3' }}>
          {lead.phone_number || lead.phone || '—'}
        </td>
        <td style={{ padding: '11px 12px', color: '#8b949e' }}>
          {lead.email || '—'}
        </td>
        {extraCols && (
          <td style={{ padding: '11px 12px', color: '#8b949e' }}>
            {lead.campaign_name || '—'}
          </td>
        )}
        <td style={{ padding: '11px 12px', color: '#8b949e', whiteSpace: 'nowrap' }}>
          {extraCols ? fmtDateTime(lead.created_time) : fmtDate(lead.created_time)}
        </td>
        <td style={{ padding: '11px 12px' }}>
          <ImportCell lead={lead} formId={formId} />
        </td>
      </tr>
    )
  }

  function LeadTable({ rows, formId, extraCols = false }) {
    const headers = extraCols
      ? ['Name', 'Phone', 'Email', 'Campaign', 'Received', 'Action']
      : ['Name', 'Phone', 'Email', 'Submitted', 'Action']
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #21262d' }}>
              {headers.map(h => (
                <th key={h} style={{
                  textAlign: 'left', padding: '8px 12px',
                  color: '#8b949e', fontWeight: '500', fontSize: '11px',
                  textTransform: 'uppercase', letterSpacing: '.4px', whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(lead => (
              <LeadRow key={lead.id} lead={lead} formId={formId} extraCols={extraCols} />
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (status === null) {
    return (
      <div style={{ padding: '40px', color: '#8b949e', fontSize: '14px' }}>Loading…</div>
    )
  }

  return (
    <div style={{ padding: '24px', fontFamily: "'Inter',system-ui,sans-serif", color: '#e6edf3' }}>

      {/* Page Header */}
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '600', color: '#e6edf3', margin: '0 0 6px' }}>
            🎯 Facebook Leads
          </h1>
          <p style={{ color: '#8b949e', fontSize: '13px', margin: 0 }}>
            Leads arrive here the moment they're submitted, pushed by Meta's leadgen webhook — no refresh needed.
          </p>
        </div>
        {status.connected && <LiveDot live={wsLive} />}
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          background: 'rgba(248,81,73,.08)', border: '1px solid rgba(248,81,73,.2)',
          color: '#f85149', borderRadius: '8px', padding: '10px 14px',
          marginBottom: '16px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#f85149', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Realtime not wired up — tell the user exactly what to do */}
      {status.connected && rtStatus && !rtStatus.ready && (
        <div style={{
          background: 'rgba(210,153,34,.08)', border: '1px solid rgba(210,153,34,.25)',
          color: '#d29922', borderRadius: '8px', padding: '10px 14px',
          marginBottom: '16px', fontSize: '13px',
        }}>
          <strong>Real-time delivery isn't active yet.</strong>{' '}
          {rtStatus.hint || 'No Page is subscribed to the leadgen webhook.'}
        </div>
      )}

      {/* Connection Card */}
      <SectionCard style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Facebook logo circle */}
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: '#1877f2', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '22px', fontWeight: '800', color: '#fff', flexShrink: 0,
            }}>
              f
            </div>
            <div>
              <div style={{ fontWeight: '600', color: '#e6edf3', fontSize: '14px' }}>Facebook Account</div>
              {status.connected
                ? (
                  <div style={{ fontSize: '12px', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '5px',
                    color: status.is_system_user ? '#d29922' : '#3fb950' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', display: 'inline-block',
                      background: status.is_system_user ? '#d29922' : '#3fb950' }} />
                    {status.is_system_user
                      ? 'Connected as System User — connect your account for full access'
                      : `Connected as ${status.fb_user_name}`}
                    {rtStatus && (
                      <span style={{ color: '#8b949e' }}>
                        · {rtStatus.subscriptions?.filter(s => s.subscribed).length || 0}/{rtStatus.pages_mapped || 0} pages subscribed to leadgen
                      </span>
                    )}
                  </div>
                )
                : (
                  <div style={{ color: '#8b949e', fontSize: '12px', marginTop: '3px' }}>Not connected</div>
                )
              }
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            {status.connected && !status.is_system_user && (
              <button
                onClick={fetchPages}
                disabled={loadingPages}
                style={{
                  ...btn('primary'), padding: '8px 18px', fontSize: '13px',
                  cursor: loadingPages ? 'not-allowed' : 'pointer', opacity: loadingPages ? .6 : 1,
                }}
              >
                ↻ Refresh Pages &amp; Resubscribe
              </button>
            )}
            <a
              href={connecting ? '#' : buildOAuthUrl()}
              style={{
                background: connecting ? '#333' : '#1877f2',
                color: '#fff', borderRadius: '8px', padding: '10px 22px',
                fontSize: '13px', fontWeight: '600', textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                pointerEvents: connecting ? 'none' : 'auto', opacity: connecting ? .6 : 1,
              }}
            >
              <span style={{ fontSize: '16px', fontWeight: '800' }}>f</span>
              {connecting ? 'Connecting…' : status.is_system_user ? 'Connect Your Facebook Account' : 'Reconnect'}
            </a>
          </div>
        </div>
      </SectionCard>

      {/* Main Content — shown when connected */}
      {status.connected && (
        <>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <TabButton active={tab === 'live'} onClick={() => setTab('live')} badge={unseen}>
              ⚡ Live Leads
            </TabButton>
            <TabButton active={tab === 'forms'} onClick={() => setTab('forms')}>
              📋 Browse by Form
            </TabButton>
          </div>

          {/* ── Live feed tab ───────────────────────────────────────────────── */}
          {tab === 'live' && (
            <SectionCard style={{ padding: '20px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '16px', flexWrap: 'wrap', gap: '10px',
              }}>
                <div>
                  <div style={{ fontWeight: '600', color: '#e6edf3', fontSize: '15px' }}>
                    Real-time lead feed
                  </div>
                  <div style={{ color: '#8b949e', fontSize: '12px', marginTop: '2px' }}>
                    {liveTotal} lead{liveTotal === 1 ? '' : 's'} captured
                    {rtStatus?.last_webhook_lead && (
                      <> · last webhook lead {fmtDateTime(rtStatus.last_webhook_lead.created_time)}</>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search name, phone, email…"
                    style={{
                      background: '#0d1117', border: '1px solid #21262d', color: '#e6edf3',
                      borderRadius: '6px', padding: '6px 10px', fontSize: '12px',
                      fontFamily: 'inherit', minWidth: '200px', outline: 'none',
                    }}
                  />
                  <select
                    value={pageFilter}
                    onChange={e => setPageFilter(e.target.value)}
                    style={{
                      background: '#0d1117', border: '1px solid #21262d', color: '#e6edf3',
                      borderRadius: '6px', padding: '6px 10px', fontSize: '12px', fontFamily: 'inherit',
                    }}
                  >
                    <option value="">All pages</option>
                    {pages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button onClick={fetchLiveLeads} style={btn()}>↻ Refresh</button>
                  <button
                    onClick={syncLeads}
                    disabled={syncing}
                    style={{ ...btn('primary'), cursor: syncing ? 'not-allowed' : 'pointer', opacity: syncing ? .6 : 1 }}
                    title="Import leads submitted before the webhook was connected"
                  >
                    {syncing ? 'Syncing…' : '⇩ Sync past leads'}
                  </button>
                </div>
              </div>

              {syncNote && (
                <div style={{
                  background: 'rgba(56,139,253,.08)', border: '1px solid rgba(56,139,253,.2)',
                  color: '#8b949e', borderRadius: '8px', padding: '9px 12px',
                  marginBottom: '14px', fontSize: '12px',
                }}>
                  {syncNote}
                </div>
              )}

              {loadingLive
                ? <Spinner />
                : liveLeads.length === 0
                ? (
                  <EmptyState
                    icon="📡"
                    message={
                      search || pageFilter
                        ? 'No leads match this filter.'
                        : 'No leads captured yet. New submissions appear here instantly — use “Sync past leads” to pull in older ones.'
                    }
                  />
                )
                : <LeadTable rows={liveLeads} extraCols />
              }
            </SectionCard>
          )}

          {/* ── Browse-by-form tab ──────────────────────────────────────────── */}
          {tab === 'forms' && (
            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '16px', alignItems: 'start' }}>

              {/* Left sidebar: Pages + Forms */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                {/* Pages list */}
                <SectionCard>
                  <SectionLabel label="PAGES" count={pages.length} />
                  {loadingPages
                    ? <Spinner />
                    : pages.length === 0
                    ? <div style={{ color: '#8b949e', fontSize: '13px' }}>No pages found.</div>
                    : pages.map(p => (
                      <ListButton
                        key={p.id}
                        item={p}
                        selected={selectedPage?.id === p.id}
                        onClick={selectPage}
                        primary={p.name}
                        secondary={p.category}
                      />
                    ))
                  }
                </SectionCard>

                {/* Lead Forms list — shown after page selected */}
                {selectedPage && (
                  <SectionCard>
                    <SectionLabel label="LEAD FORMS" count={forms.length} />
                    {loadingForms
                      ? <Spinner />
                      : forms.length === 0
                      ? <div style={{ color: '#8b949e', fontSize: '13px' }}>No lead forms on this page.</div>
                      : forms.map(f => (
                        <ListButton
                          key={f.id}
                          item={f}
                          selected={selectedForm?.id === f.id}
                          onClick={selectForm}
                          primary={f.name}
                          secondary={`${f.leads_count ?? 0} leads · ${f.status ?? ''}`}
                        />
                      ))
                    }
                  </SectionCard>
                )}
              </div>

              {/* Right panel: Leads table */}
              <SectionCard style={{ padding: '20px' }}>
                {!selectedForm
                  ? (
                    <EmptyState icon="📋" message="Select a page and lead form to view leads." />
                  )
                  : (
                    <>
                      {/* Form header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <div style={{ fontWeight: '600', color: '#e6edf3', fontSize: '15px' }}>
                            {selectedForm.name}
                          </div>
                          <div style={{ color: '#8b949e', fontSize: '12px', marginTop: '2px' }}>
                            {leads.length} leads
                          </div>
                        </div>
                        <button onClick={() => selectForm(selectedForm)} style={btn()}>
                          ↻ Refresh
                        </button>
                      </div>

                      {loadingLeads
                        ? <Spinner />
                        : leads.length === 0
                        ? <EmptyState icon="📭" message="No leads in this form yet." />
                        : <LeadTable rows={leads} formId={selectedForm.id} />
                      }
                    </>
                  )
                }
              </SectionCard>
            </div>
          )}
        </>
      )}
    </div>
  )
}
