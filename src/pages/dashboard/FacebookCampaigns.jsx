import { useState, useEffect } from 'react'
import api from '../../services/api'

const STATUS_STYLE = {
  ACTIVE: {
    background: 'rgba(63,185,80,.12)',
    border: '1px solid rgba(63,185,80,.3)',
    color: '#3fb950',
  },
  PAUSED: {
    background: 'rgba(139,148,158,.1)',
    border: '1px solid rgba(139,148,158,.25)',
    color: '#8b949e',
  },
}

function fmt(n) {
  if (n == null || n === '') return '—'
  const num = parseFloat(n)
  return isNaN(num) ? String(n) : num.toLocaleString()
}

function fmtSpend(n) {
  if (n == null || n === '') return '$0.00'
  return `$${parseFloat(n).toFixed(2)}`
}

function fmtCTR(n) {
  if (n == null || n === '') return '—'
  return `${parseFloat(n).toFixed(2)}%`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ children, style = {} }) {
  return (
    <div style={{
      background: '#161b22', border: '1px solid #21262d',
      borderRadius: '12px', padding: '16px', ...style,
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

function Spinner() {
  return <div style={{ color: '#8b949e', fontSize: '13px', padding: '8px 0' }}>Loading…</div>
}

function EmptyState({ icon, message, sub, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8b949e' }}>
      <div style={{ fontSize: '32px', marginBottom: '10px' }}>{icon}</div>
      <div style={{ fontSize: '14px', color: '#e6edf3', marginBottom: '6px' }}>{message}</div>
      {sub && <div style={{ fontSize: '13px', marginBottom: '16px' }}>{sub}</div>}
      {action}
    </div>
  )
}

function StatCell({ value }) {
  return (
    <td style={{ padding: '12px', color: '#e6edf3', fontSize: '13px' }}>{value}</td>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FacebookCampaigns() {
  const [status, setStatus]             = useState(null)
  const [accounts, setAccounts]         = useState([])
  const [selectedAccount, setSelAcc]    = useState(null)
  const [campaigns, setCampaigns]       = useState([])
  const [loadingAccounts, setLoadAccs]  = useState(false)
  const [loadingCampaigns, setLoadCamp] = useState(false)
  const [toggling, setToggling]         = useState({})  // campaign_id → bool
  const [error, setError]               = useState(null)
  const [needsOAuth, setNeedsOAuth]     = useState(false)

  useEffect(() => { fetchStatus() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchStatus() {
    try {
      const { data } = await api.get('/facebook/status')
      setStatus(data)
      if (data.connected) fetchAccounts()
    } catch {
      setStatus({ connected: false })
    }
  }

  async function fetchAccounts() {
    setLoadAccs(true)
    setError(null)
    setNeedsOAuth(false)
    try {
      const { data } = await api.get('/facebook/ad-accounts')
      if (data.permission_error) {
        setNeedsOAuth(data.needs_oauth)
        setError(data.needs_oauth
          ? null  // show the OAuth prompt card instead
          : 'Ad accounts permission denied. Check your system user token permissions.')
        setAccounts([])
      } else {
        setAccounts(data.ad_accounts || [])
      }
    } catch {
      setError('Failed to load ad accounts.')
    } finally {
      setLoadAccs(false)
    }
  }

  async function selectAccount(account) {
    setSelAcc(account)
    setCampaigns([])
    setLoadCamp(true)
    setError(null)
    try {
      const { data } = await api.get(`/facebook/ad-accounts/${account.id}/campaigns`)
      setCampaigns(data.campaigns || [])
    } catch {
      setError('Failed to load campaigns.')
    } finally {
      setLoadCamp(false)
    }
  }

  async function toggleStatus(campaign) {
    const newStatus = campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    setToggling(p => ({ ...p, [campaign.id]: true }))
    setError(null)
    try {
      await api.patch(`/facebook/campaigns/${campaign.id}/status`, { status: newStatus })
      setCampaigns(prev =>
        prev.map(c => c.id === campaign.id ? { ...c, status: newStatus } : c)
      )
    } catch {
      setError(`Failed to update campaign status.`)
    } finally {
      setToggling(p => ({ ...p, [campaign.id]: false }))
    }
  }

  if (status === null) {
    return <div style={{ padding: '40px', color: '#8b949e', fontSize: '14px' }}>Loading…</div>
  }

  return (
    <div style={{ padding: '24px', fontFamily: "'Inter',system-ui,sans-serif", color: '#e6edf3' }}>

      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '600', color: '#e6edf3', margin: '0 0 6px' }}>
          📣 Facebook Campaigns
        </h1>
        <p style={{ color: '#8b949e', fontSize: '13px', margin: 0 }}>
          View campaign performance stats and manage campaign status across your ad accounts.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{
          background: 'rgba(248,81,73,.08)', border: '1px solid rgba(248,81,73,.2)',
          color: '#f85149', borderRadius: '8px', padding: '10px 14px',
          marginBottom: '16px', fontSize: '13px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', color: '#f85149', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}
          >×</button>
        </div>
      )}

      {/* OAuth / Permissions prompt */}
      {needsOAuth && (
        <div style={{
          background: 'rgba(210,153,34,.08)', border: '1px solid rgba(210,153,34,.25)',
          borderRadius: '12px', padding: '16px 20px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
        }}>
          <div>
            <div style={{ fontWeight: '600', color: '#d29922', fontSize: '14px', marginBottom: '4px' }}>
              ⚠️ ads_read permission required
            </div>
            <div style={{ color: '#8b949e', fontSize: '13px' }}>
              The current token doesn't have permission to read ad accounts.
              Connect your personal Facebook account to use your own ads_read access.
            </div>
          </div>
          <a
            href="/dashboard/facebook-leads"
            style={{
              background: '#1877f2', color: '#fff', borderRadius: '8px',
              padding: '9px 18px', fontSize: '13px', fontWeight: '600',
              textDecoration: 'none', whiteSpace: 'nowrap',
            }}
          >
            f &nbsp;Connect Facebook Account
          </a>
        </div>
      )}

      {/* Not connected state */}
      {!status.connected ? (
        <SectionCard>
          <EmptyState
            icon="🔗"
            message="Facebook not connected"
            sub="Connect your account on the FB Leads page first."
            action={
              <a
                href="/dashboard/facebook-leads"
                style={{
                  background: '#388bfd', color: '#fff', borderRadius: '8px',
                  padding: '10px 22px', fontSize: '13px', fontWeight: '600',
                  textDecoration: 'none', display: 'inline-block',
                }}
              >
                Go to FB Leads →
              </a>
            }
          />
        </SectionCard>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '16px', alignItems: 'start' }}>

          {/* Left sidebar: Ad Accounts */}
          <SectionCard>
            <SectionLabel label="AD ACCOUNTS" count={accounts.length} />
            {loadingAccounts
              ? <Spinner />
              : accounts.length === 0
              ? <div style={{ color: '#8b949e', fontSize: '13px' }}>No ad accounts found.</div>
              : accounts.map(acc => {
                const active = selectedAccount?.id === acc.id
                return (
                  <button
                    key={acc.id}
                    onClick={() => selectAccount(acc)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '10px 12px', marginBottom: '4px',
                      background: active ? 'rgba(56,139,253,.1)' : 'transparent',
                      border: `1px solid ${active ? 'rgba(56,139,253,.3)' : 'transparent'}`,
                      borderRadius: '8px', cursor: 'pointer',
                      color: active ? '#388bfd' : '#e6edf3',
                      fontSize: '13px', fontFamily: 'inherit',
                    }}
                  >
                    <div style={{ fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {acc.name}
                    </div>
                    <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '2px' }}>
                      {acc.currency} · {acc.id}
                    </div>
                  </button>
                )
              })
            }
          </SectionCard>

          {/* Right: Campaigns table */}
          <SectionCard style={{ padding: '20px' }}>
            {!selectedAccount
              ? (
                <EmptyState icon="📊" message="Select an ad account to view campaigns." />
              )
              : (
                <>
                  {/* Header row */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: '16px', flexWrap: 'wrap', gap: '8px',
                  }}>
                    <div>
                      <div style={{ fontWeight: '600', color: '#e6edf3', fontSize: '15px' }}>
                        {selectedAccount.name}
                      </div>
                      <div style={{ color: '#8b949e', fontSize: '12px', marginTop: '2px' }}>
                        {campaigns.length} campaigns · last 30 days
                      </div>
                    </div>
                    <button
                      onClick={() => selectAccount(selectedAccount)}
                      style={{
                        background: 'none', border: '1px solid #21262d', color: '#8b949e',
                        borderRadius: '6px', padding: '6px 12px', cursor: 'pointer',
                        fontSize: '12px', fontFamily: 'inherit',
                      }}
                    >
                      ↻ Refresh
                    </button>
                  </div>

                  {loadingCampaigns
                    ? <Spinner />
                    : campaigns.length === 0
                    ? <EmptyState icon="📭" message="No campaigns found for this account." />
                    : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #21262d' }}>
                              {[
                                { label: 'Campaign', width: '220px' },
                                { label: 'Status',      width: '100px' },
                                { label: 'Impressions', width: '110px' },
                                { label: 'Clicks',      width: '80px'  },
                                { label: 'Spend',       width: '90px'  },
                                { label: 'CTR',         width: '70px'  },
                                { label: 'Action',      width: '110px' },
                              ].map(h => (
                                <th key={h.label} style={{
                                  textAlign: 'left', padding: '8px 12px',
                                  color: '#8b949e', fontWeight: '500', fontSize: '11px',
                                  textTransform: 'uppercase', letterSpacing: '.4px',
                                  whiteSpace: 'nowrap', width: h.width,
                                }}>
                                  {h.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {campaigns.map(camp => {
                              const ins = camp.insights?.data?.[0] || {}
                              const sc = STATUS_STYLE[camp.status] || STATUS_STYLE.PAUSED
                              const isBusy = !!toggling[camp.id]

                              return (
                                <tr key={camp.id} style={{ borderBottom: '1px solid rgba(33,38,45,.6)' }}>
                                  {/* Campaign name + objective */}
                                  <td style={{ padding: '12px', maxWidth: '220px' }}>
                                    <div style={{
                                      fontWeight: '500', color: '#e6edf3',
                                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                      {camp.name}
                                    </div>
                                    {camp.objective && (
                                      <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '2px' }}>
                                        {camp.objective.replace(/_/g, ' ')}
                                      </div>
                                    )}
                                  </td>

                                  {/* Status badge */}
                                  <td style={{ padding: '12px' }}>
                                    <span style={{
                                      ...sc,
                                      borderRadius: '20px', padding: '3px 10px',
                                      fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap',
                                    }}>
                                      {camp.status === 'ACTIVE' ? '▶ ACTIVE' : '⏸ PAUSED'}
                                    </span>
                                  </td>

                                  <StatCell value={fmt(ins.impressions)} />
                                  <StatCell value={fmt(ins.clicks)} />
                                  <StatCell value={fmtSpend(ins.spend)} />
                                  <StatCell value={fmtCTR(ins.ctr)} />

                                  {/* Pause / Activate toggle */}
                                  <td style={{ padding: '12px' }}>
                                    <button
                                      onClick={() => toggleStatus(camp)}
                                      disabled={isBusy}
                                      style={{
                                        background: camp.status === 'ACTIVE'
                                          ? 'rgba(248,81,73,.1)' : 'rgba(63,185,80,.1)',
                                        border: `1px solid ${camp.status === 'ACTIVE' ? 'rgba(248,81,73,.3)' : 'rgba(63,185,80,.3)'}`,
                                        color: camp.status === 'ACTIVE' ? '#f85149' : '#3fb950',
                                        borderRadius: '6px', padding: '6px 14px',
                                        cursor: isBusy ? 'not-allowed' : 'pointer',
                                        fontSize: '12px', fontWeight: '500',
                                        opacity: isBusy ? .5 : 1, whiteSpace: 'nowrap',
                                        fontFamily: 'inherit',
                                      }}
                                    >
                                      {isBusy
                                        ? '…'
                                        : camp.status === 'ACTIVE'
                                        ? '⏸ Pause'
                                        : '▶ Activate'
                                      }
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
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
