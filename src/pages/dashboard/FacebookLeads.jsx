import { useState, useEffect } from 'react'
import api from '../../services/api'

const FB_APP_ID = '1544541559775814'
const FB_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_ads',
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FacebookLeads() {
  const [status, setStatus]       = useState(null)   // null = loading
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

  async function fetchStatus() {
    try {
      const { data } = await api.get('/facebook/status')
      setStatus(data)
      if (data.connected) fetchPages()
    } catch {
      setStatus({ connected: false })
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

  async function importLead(lead) {
    setImporting(p => ({ ...p, [lead.id]: true }))
    try {
      await api.post(`/facebook/lead-forms/${selectedForm.id}/leads/${lead.id}/import`)
      setImported(p => ({ ...p, [lead.id]: true }))
    } catch {
      setError(`Failed to import lead.`)
    } finally {
      setImporting(p => ({ ...p, [lead.id]: false }))
    }
  }

  if (status === null) {
    return (
      <div style={{ padding: '40px', color: '#8b949e', fontSize: '14px' }}>Loading…</div>
    )
  }

  return (
    <div style={{ padding: '24px', fontFamily: "'Inter',system-ui,sans-serif", color: '#e6edf3' }}>

      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '600', color: '#e6edf3', margin: '0 0 6px' }}>
          🎯 Facebook Leads
        </h1>
        <p style={{ color: '#8b949e', fontSize: '13px', margin: 0 }}>
          Connect your Facebook account to retrieve Lead Ad form submissions and import them to your CRM.
        </p>
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

      {/* Connection Card */}
      <SectionCard style={{ marginBottom: '24px' }}>
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
                  </div>
                )
                : (
                  <div style={{ color: '#8b949e', fontSize: '12px', marginTop: '3px' }}>Not connected</div>
                )
              }
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {status.connected && !status.is_system_user && (
              <button
                onClick={fetchPages}
                disabled={loadingPages}
                style={{
                  background: 'rgba(56,139,253,.1)', border: '1px solid rgba(56,139,253,.3)',
                  color: '#388bfd', borderRadius: '8px', padding: '8px 18px',
                  fontSize: '13px', cursor: loadingPages ? 'not-allowed' : 'pointer',
                  fontWeight: '500', opacity: loadingPages ? .6 : 1, fontFamily: 'inherit',
                }}
              >
                ↻ Refresh Pages
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
                    <button
                      onClick={() => selectForm(selectedForm)}
                      style={{
                        background: 'none', border: '1px solid #21262d', color: '#8b949e',
                        borderRadius: '6px', padding: '6px 12px', cursor: 'pointer',
                        fontSize: '12px', fontFamily: 'inherit',
                      }}
                    >
                      ↻ Refresh
                    </button>
                  </div>

                  {loadingLeads
                    ? <Spinner />
                    : leads.length === 0
                    ? <EmptyState icon="📭" message="No leads in this form yet." />
                    : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #21262d' }}>
                              {['Name', 'Phone', 'Email', 'Submitted', 'Action'].map(h => (
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
                            {leads.map(lead => (
                              <tr key={lead.id} style={{ borderBottom: '1px solid rgba(33,38,45,.6)' }}>
                                <td style={{ padding: '11px 12px', color: '#e6edf3', fontWeight: '500' }}>
                                  {lead.full_name || lead.name || lead.first_name
                                    ? `${lead.full_name || lead.first_name || ''} ${lead.last_name || ''}`.trim()
                                    : '—'
                                  }
                                </td>
                                <td style={{ padding: '11px 12px', color: '#e6edf3' }}>
                                  {lead.phone_number || lead.phone || '—'}
                                </td>
                                <td style={{ padding: '11px 12px', color: '#8b949e' }}>
                                  {lead.email || '—'}
                                </td>
                                <td style={{ padding: '11px 12px', color: '#8b949e', whiteSpace: 'nowrap' }}>
                                  {fmtDate(lead.created_time)}
                                </td>
                                <td style={{ padding: '11px 12px' }}>
                                  {imported[lead.id]
                                    ? (
                                      <span style={{ color: '#3fb950', fontSize: '12px', fontWeight: '500' }}>
                                        ✓ Imported
                                      </span>
                                    )
                                    : (
                                      <button
                                        onClick={() => importLead(lead)}
                                        disabled={importing[lead.id]}
                                        style={{
                                          background: 'rgba(56,139,253,.1)',
                                          border: '1px solid rgba(56,139,253,.3)',
                                          color: '#388bfd', borderRadius: '6px',
                                          padding: '5px 14px', cursor: importing[lead.id] ? 'not-allowed' : 'pointer',
                                          fontSize: '12px', fontWeight: '500', whiteSpace: 'nowrap',
                                          opacity: importing[lead.id] ? .6 : 1, fontFamily: 'inherit',
                                        }}
                                      >
                                        {importing[lead.id] ? 'Importing…' : 'Import to CRM'}
                                      </button>
                                    )
                                  }
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  }
                </>
              )
            }
          </SectionCard>
        </div>
      )}
    </div>
  )
}
