import { useEffect, useState, useCallback } from 'react'
import { useNavigate }                      from 'react-router-dom'
import api                                  from '../../services/api'
import { useAuthStore }                     from '../../store/authStore'

// ─── styles ───────────────────────────────────────────────────────────────────
const S = {
  page:    { padding: '28px 32px', maxWidth: 820, fontFamily: "'Inter',system-ui,sans-serif", color: '#e6edf3' },
  heading: { fontSize: 20, fontWeight: 700, color: '#e6edf3', margin: '0 0 24px' },
  tabs:    { display: 'flex', gap: 4, borderBottom: '1px solid #21262d', marginBottom: 28 },
  tab:     { padding: '8px 16px', fontSize: 13, fontWeight: 500, border: 'none', background: 'none', cursor: 'pointer', borderRadius: '8px 8px 0 0', fontFamily: 'inherit', transition: 'all .15s', marginBottom: -1 },
  card:    { background: '#161b22', border: '1px solid #21262d', borderRadius: 14, padding: '24px 28px', marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: 600, color: '#e6edf3', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: 8 },
  label:   { display: 'block', fontSize: 12, fontWeight: 500, color: '#8b949e', marginBottom: 6 },
  input:   { width: '100%', background: '#1c2128', border: '1px solid #30363d', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#e6edf3', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  select:  { width: '100%', background: '#1c2128', border: '1px solid #30363d', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#e6edf3', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', appearance: 'none' },
  readVal: { padding: '10px 14px', fontSize: 13, color: '#8b949e', background: 'rgba(255,255,255,.02)', border: '1px solid #21262d', borderRadius: 10 },
  btn:     { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' },
  row:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #21262d' },
}

const onFocus = e => { e.target.style.borderColor = '#388bfd' }
const onBlur  = e => { e.target.style.borderColor = '#30363d' }

const TIMEZONES = [
  'UTC','Africa/Johannesburg','America/Chicago','America/Los_Angeles','America/New_York',
  'Asia/Dubai','Asia/Karachi','Asia/Kolkata','Asia/Singapore','Asia/Tokyo',
  'Australia/Sydney','Europe/Amsterdam','Europe/London','Europe/Paris',
]

// ─── main component ───────────────────────────────────────────────────────────
export default function Settings() {
  const navigate         = useNavigate()
  const [tab, setTab]    = useState('user')   // 'user' | 'account' | 'channels'
  const [profile, setProfile] = useState(null)
  const [saved, setSaved]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [disconnecting, setDisconnecting]     = useState(false)
  const [disconnectError, setDisconnectError] = useState('')
  const [webhookInfo, setWebhookInfo]         = useState(null)
  const [copied, setCopied]                   = useState('')
  const [registering, setRegistering]         = useState(false)
  const [registerResult, setRegisterResult]   = useState(null)
  const [phoneStatus, setPhoneStatus]         = useState(null)   // { phones, waba_id }
  const [phoneStatusLoading, setPhoneStatusLoading] = useState(false)
  const [phoneStatusError, setPhoneStatusError]     = useState('')
  const [registeringPhone, setRegisteringPhone]     = useState(false)
  const [registerPhoneError, setRegisterPhoneError] = useState('')

  // editable form state
  const [userForm,    setUserForm]    = useState({ business_name: '' })
  const [accountForm, setAccountForm] = useState({ website: '', industry: '', timezone: 'UTC' })

  // team tab state
  const [teamAgents, setTeamAgents]   = useState([])
  const [teamRoles, setTeamRoles]     = useState(null)
  const [teamCopied, setTeamCopied]   = useState(false)
  const { tenant } = useAuthStore()

  useEffect(() => {
    api.get('/auth/me').then(({ data }) => {
      setProfile(data)
      setUserForm({ business_name: data.business_name || '' })
      setAccountForm({
        website:  data.website  || '',
        industry: data.industry || '',
        timezone: data.timezone || 'UTC',
      })
    }).catch(() => {})
    api.get('/onboarding/webhook-info').then(({ data }) => setWebhookInfo(data)).catch(() => {})
    api.get('/agents').then(({ data }) => setTeamAgents(data || [])).catch(() => {})
    api.get('/roles').then(({ data }) => setTeamRoles(data)).catch(() => {})
    loadPhoneStatus()
  }, [])

  const loadPhoneStatus = async () => {
    setPhoneStatusLoading(true)
    setPhoneStatusError('')
    try {
      const { data } = await api.get('/onboarding/phone-status')
      setPhoneStatus(data)
    } catch (err) {
      setPhoneStatusError(err.response?.data?.detail || 'Could not fetch phone status from Meta.')
    } finally {
      setPhoneStatusLoading(false)
    }
  }

  const registerPhone = async () => {
    setRegisteringPhone(true)
    setRegisterPhoneError('')
    try {
      await api.post('/onboarding/register-phone')
      // Success — refresh the live status so the badge flips Pending → Connected
      await loadPhoneStatus()
    } catch (err) {
      const detail = err.response?.data?.detail
      if (detail && typeof detail === 'object') {
        setRegisterPhoneError(detail)   // { headline, hint, code, meta_message }
      } else {
        setRegisterPhoneError({ headline: detail || 'Phone registration failed. Please try again.', hint: '', code: null })
      }
    } finally {
      setRegisteringPhone(false)
    }
  }

  const registerWebhook = async () => {
    setRegistering(true)
    setRegisterResult(null)
    try {
      await api.post('/onboarding/register-webhook')
      setRegisterResult({ ok: true, msg: 'Webhook registered successfully with Meta.' })
      // Refresh webhook info to reflect any URL changes
      const { data } = await api.get('/onboarding/webhook-info')
      setWebhookInfo(data)
    } catch (err) {
      setRegisterResult({ ok: false, msg: err.response?.data?.detail || 'Registration failed.' })
    } finally {
      setRegistering(false)
    }
  }

  const copyToClipboard = useCallback((text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(''), 2000)
    })
  }, [])

  const save = async (payload) => {
    setSaving(true)
    setSaved('')
    try {
      await api.patch('/tenants/me', payload)
      // Refresh profile
      const { data } = await api.get('/auth/me')
      setProfile(data)
      setSaved('Saved successfully')
      setTimeout(() => setSaved(''), 3000)
    } catch {
      setSaved('error')
      setTimeout(() => setSaved(''), 4000)
    } finally {
      setSaving(false)
    }
  }

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect your WhatsApp Business Account? You will need to reconnect to send messages.')) return
    setDisconnecting(true)
    setDisconnectError('')
    try {
      await api.post('/onboarding/disconnect')
      const { data } = await api.get('/auth/me')
      setProfile(data)
    } catch (err) {
      setDisconnectError(err.response?.data?.detail || 'Disconnect failed. Please try again.')
    } finally {
      setDisconnecting(false)
    }
  }

  const TABS = [
    { id: 'user',     label: 'User Details'    },
    { id: 'account',  label: 'Account Details' },
    { id: 'channels', label: 'Channels'        },
    { id: 'team',     label: 'Team'            },
  ]

  return (
    <div style={S.page}>
      <h1 style={S.heading}>Settings</h1>

      {/* ── tabs ─────────────────────────────────────────────── */}
      <div style={S.tabs}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSaved('') }} style={{
            ...S.tab,
            color:        tab === t.id ? '#e6edf3' : '#7d8590',
            borderBottom: tab === t.id ? '2px solid #388bfd' : '2px solid transparent',
            fontWeight:   tab === t.id ? 600 : 400,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── User Details ──────────────────────────────────────── */}
      {tab === 'user' && (
        <form onSubmit={e => { e.preventDefault(); save(userForm) }}>
          <div style={S.card}>
            <p style={S.cardTitle}>👤 Profile</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={S.label}>Business Name</label>
                <input
                  value={userForm.business_name}
                  onChange={e => setUserForm(p => ({ ...p, business_name: e.target.value }))}
                  placeholder="Acme Corp"
                  style={S.input}
                  onFocus={onFocus} onBlur={onBlur}
                />
              </div>

              <div>
                <label style={S.label}>Email Address</label>
                <div style={S.readVal}>{profile?.email || '—'}</div>
                <span style={{ fontSize: 11, color: '#484f58', marginTop: 4, display: 'block' }}>
                  Contact support to change your email address.
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={S.label}>Plan</label>
                  <div style={S.readVal}>
                    <span style={{ color: '#3fb950', fontWeight: 600, textTransform: 'capitalize' }}>
                      {profile?.plan || 'Free'}
                    </span>
                  </div>
                </div>
                <div>
                  <label style={S.label}>Member Since</label>
                  <div style={S.readVal}>
                    {profile?.created_at
                      ? new Date(profile.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <SaveBar saving={saving} saved={saved} />
        </form>
      )}

      {/* ── Account Details ───────────────────────────────────── */}
      {tab === 'account' && (
        <form onSubmit={e => { e.preventDefault(); save(accountForm) }}>
          <div style={S.card}>
            <p style={S.cardTitle}>🏢 Business Info</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={S.label}>Website</label>
                <input
                  value={accountForm.website}
                  onChange={e => setAccountForm(p => ({ ...p, website: e.target.value }))}
                  placeholder="https://yoursite.com"
                  style={S.input}
                  onFocus={onFocus} onBlur={onBlur}
                />
              </div>
              <div>
                <label style={S.label}>Industry</label>
                <input
                  value={accountForm.industry}
                  onChange={e => setAccountForm(p => ({ ...p, industry: e.target.value }))}
                  placeholder="E-commerce, SaaS, Retail…"
                  style={S.input}
                  onFocus={onFocus} onBlur={onBlur}
                />
              </div>
              <div>
                <label style={S.label}>Timezone</label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={accountForm.timezone}
                    onChange={e => setAccountForm(p => ({ ...p, timezone: e.target.value }))}
                    style={S.select}
                    onFocus={onFocus} onBlur={onBlur}
                  >
                    {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#484f58', pointerEvents: 'none', fontSize: 11 }}>▼</span>
                </div>
              </div>
            </div>
          </div>

          <SaveBar saving={saving} saved={saved} />
        </form>
      )}

      {/* ── Team ──────────────────────────────────────────────── */}
      {tab === 'team' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Tenant ID card */}
          <div style={S.card}>
            <p style={S.cardTitle}>🔑 Your Tenant ID</p>
            <p style={{ fontSize: 13, color: '#7d8590', lineHeight: 1.7, margin: '0 0 16px' }}>
              Share this with your agents so they can log in at the Agent portal.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, background: '#0d1117', border: '1px solid #30363d', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#c9d1d9', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.id || tenant?.id || '—'}
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(profile?.id || tenant?.id || ''); setTeamCopied(true); setTimeout(() => setTeamCopied(false), 2000) }}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #30363d', background: teamCopied ? 'rgba(63,185,80,.1)' : '#1c2128', color: teamCopied ? '#3fb950' : '#8b949e', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {teamCopied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Team overview card */}
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={S.cardTitle}>👥 Team Overview</p>
                <p style={{ fontSize: 13, color: '#8b949e', margin: 0 }}>
                  {teamAgents.length} agents total &nbsp;·&nbsp;
                  {teamAgents.filter(a => a.is_active).length} active &nbsp;·&nbsp;
                  {teamAgents.filter(a => !a.is_active).length} inactive
                </p>
              </div>
              <button onClick={() => navigate('/dashboard/agents')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: '#1f6feb', color: '#fff' }}>
                Manage Team →
              </button>
            </div>
          </div>

          {/* Role permissions card */}
          <div style={S.card}>
            <p style={S.cardTitle}>🛡 Role Permissions</p>
            {teamRoles?.roles?.map(r => (
              <div key={r.role} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '12px 0', borderBottom: '1px solid #21262d' }}>
                <div style={{ width: 110, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 99, ...{ superadmin:{ background:'rgba(248,81,73,.1)', color:'#f85149', border:'1px solid rgba(248,81,73,.2)' }, manager:{ background:'rgba(56,139,253,.1)', color:'#388bfd', border:'1px solid rgba(56,139,253,.2)' }, agent:{ background:'rgba(139,148,158,.1)', color:'#8b949e', border:'1px solid rgba(139,148,158,.2)' } }[r.role] }}>{r.role}</span>
                </div>
                <div style={{ flex: 1 }}>
                  {r.role === 'superadmin'
                    ? <span style={{ fontSize: 12, color: '#8b949e', fontStyle: 'italic' }}>Full access (cannot be changed)</span>
                    : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {r.permissions.map(p => (
                          <span key={p} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,.04)', color: '#8b949e', border: '1px solid #21262d' }}>{p}</span>
                        ))}
                      </div>
                  }
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* ── Channels ──────────────────────────────────────────── */}
      {tab === 'channels' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── WhatsApp connection card ────────────────────────── */}
          <div style={S.card}>
            <p style={S.cardTitle}>
              <span style={{ fontSize: 18 }}>📱</span>
              WhatsApp Business
              {profile?.waba_connected
                ? <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#3fb950', background: 'rgba(63,185,80,.1)', border: '1px solid rgba(63,185,80,.2)', borderRadius: 6, padding: '3px 8px' }}>Connected</span>
                : <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#f85149', background: 'rgba(248,81,73,.1)', border: '1px solid rgba(248,81,73,.2)', borderRadius: 6, padding: '3px 8px' }}>Not connected</span>
              }
            </p>

            {profile?.waba_connected ? (
              <>
                {/* ── Live phone number status from Meta ── */}
                <PhoneStatusPanel
                  phones={phoneStatus?.phones}
                  wabaId={phoneStatus?.waba_id || profile?.waba_id}
                  activePhoneId={phoneStatus?.active_phone_number_id || profile?.phone_number_id}
                  loading={phoneStatusLoading}
                  error={phoneStatusError}
                  onRefresh={loadPhoneStatus}
                  onRegisterPhone={registerPhone}
                  registeringPhone={registeringPhone}
                  registerPhoneError={registerPhoneError}
                  isCoexistence={phoneStatus?.is_coexistence ?? profile?.is_coexistence ?? false}
                />

                {disconnectError && (
                  <div style={{ background: 'rgba(248,81,73,.08)', border: '1px solid rgba(248,81,73,.25)', borderRadius: 10, padding: '10px 14px', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: '#f85149' }}>⚠ {disconnectError}</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => navigate('/onboarding')} style={{ ...S.btn, background: '#1f6feb', color: '#fff' }}>
                    Reconnect / Change Number
                  </button>
                  <button onClick={handleDisconnect} disabled={disconnecting}
                    style={{ ...S.btn, background: 'rgba(248,81,73,.1)', color: '#f85149', border: '1px solid rgba(248,81,73,.25)' }}>
                    {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 13, color: '#7d8590', lineHeight: 1.7, margin: '0 0 20px' }}>
                  No WhatsApp Business Account is connected. Connect one to start sending and receiving messages.
                </p>
                <button onClick={() => navigate('/onboarding')} style={{ ...S.btn, background: '#25D366', color: '#0d1117', fontSize: 13 }}>
                  Connect WhatsApp →
                </button>
              </>
            )}
          </div>

          {/* ── Webhook setup card ──────────────────────────────── */}
          <div style={S.card}>
            <p style={S.cardTitle}>
              <span style={{ fontSize: 18 }}>🔗</span>
              Webhook Configuration
              {webhookInfo && (
                webhookInfo.is_localhost
                  ? <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#d29922', background: 'rgba(210,153,34,.1)', border: '1px solid rgba(210,153,34,.2)', borderRadius: 6, padding: '3px 8px' }}>Needs public URL</span>
                  : <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#3fb950', background: 'rgba(63,185,80,.1)', border: '1px solid rgba(63,185,80,.2)', borderRadius: 6, padding: '3px 8px' }}>URL configured</span>
              )}
            </p>

            <p style={{ fontSize: 13, color: '#7d8590', lineHeight: 1.7, margin: '0 0 20px' }}>
              WhatsApp uses webhooks to deliver incoming messages to your server in real time. You must paste the URL below into your Meta App Dashboard — Meta will call it every time a message arrives.
            </p>

            {/* localhost warning */}
            {webhookInfo?.is_localhost && (
              <div style={{ background: 'rgba(210,153,34,.08)', border: '1px solid rgba(210,153,34,.2)', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
                <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#d29922' }}>⚠ Your server is on localhost — Meta cannot reach it</p>
                <p style={{ margin: '0 0 10px', fontSize: 12, color: 'rgba(210,153,34,.85)', lineHeight: 1.6 }}>
                  To receive real messages during development, expose your local server with <strong>ngrok</strong>:
                </p>
                <CopyBlock
                  label="ngrok command"
                  value="ngrok http 8000"
                  copied={copied} onCopy={copyToClipboard} id="ngrok"
                  mono
                />
                <p style={{ margin: '10px 0 0', fontSize: 12, color: 'rgba(210,153,34,.7)', lineHeight: 1.5 }}>
                  ngrok will give you a URL like <code style={{ background: 'rgba(0,0,0,.3)', padding: '1px 5px', borderRadius: 4 }}>https://abc123.ngrok.io</code>. Add it to your backend <code style={{ background: 'rgba(0,0,0,.3)', padding: '1px 5px', borderRadius: 4 }}>.env</code> as <code style={{ background: 'rgba(0,0,0,.3)', padding: '1px 5px', borderRadius: 4 }}>WEBHOOK_BASE_URL=https://abc123.ngrok.io</code> and restart the server, then the URL below will update.
                </p>
              </div>
            )}

            {/* The two values they need to copy */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              <div>
                <label style={S.label}>Callback URL — paste this into Meta App Dashboard</label>
                <CopyBlock
                  label="Callback URL"
                  value={webhookInfo?.webhook_callback_url || 'Loading…'}
                  copied={copied} onCopy={copyToClipboard} id="url"
                />
              </div>
              <div>
                <label style={S.label}>Verify Token — paste this into Meta App Dashboard</label>
                <CopyBlock
                  label="Verify Token"
                  value={webhookInfo?.verify_token || 'Loading…'}
                  copied={copied} onCopy={copyToClipboard} id="token"
                />
              </div>
            </div>

            {/* Step-by-step instructions */}
            <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 12, padding: '16px 18px' }}>
              <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.06em' }}>Steps to configure in Meta App Dashboard</p>
              {[
                { n: 1, title: 'Open your Meta App',           desc: 'Go to developers.facebook.com → Your App' },
                { n: 2, title: 'Go to WhatsApp → Configuration', desc: 'Find the "Webhook" section on that page' },
                { n: 3, title: 'Click Edit (or Configure)',    desc: 'Paste the Callback URL and Verify Token from above' },
                { n: 4, title: 'Click Verify and Save',        desc: 'Meta will call your server to confirm it\'s reachable' },
                { n: 5, title: 'Subscribe to webhook fields',  desc: 'Turn on: messages, message_deliveries, message_reads, messaging_referrals' },
              ].map(s => (
                <div key={s.n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(56,139,253,.15)', border: '1px solid rgba(56,139,253,.25)', color: '#388bfd', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{s.n}</div>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#c9d1d9' }}>{s.title}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#7d8590', lineHeight: 1.5 }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* One-click register button */}
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #21262d' }}>
              <p style={{ margin: '0 0 10px', fontSize: 13, color: '#c9d1d9', fontWeight: 500 }}>
                Or register automatically — skips the Meta dashboard entirely
              </p>
              <p style={{ margin: '0 0 14px', fontSize: 12, color: '#7d8590', lineHeight: 1.5 }}>
                Calls the Meta Graph API directly to configure your webhook. Your server must be publicly reachable at the Callback URL above before clicking this.
              </p>

              {registerResult && (
                <div style={{
                  background: registerResult.ok ? 'rgba(63,185,80,.08)' : 'rgba(248,81,73,.08)',
                  border: `1px solid ${registerResult.ok ? 'rgba(63,185,80,.25)' : 'rgba(248,81,73,.25)'}`,
                  borderRadius: 10, padding: '10px 14px', marginBottom: 14,
                }}>
                  <span style={{ fontSize: 12, color: registerResult.ok ? '#3fb950' : '#f85149', fontWeight: 600 }}>
                    {registerResult.ok ? '✓ ' : '⚠ '}{registerResult.msg}
                  </span>
                </div>
              )}

              <button
                onClick={registerWebhook}
                disabled={registering || webhookInfo?.is_localhost}
                style={{
                  ...S.btn,
                  background: (registering || webhookInfo?.is_localhost) ? '#21262d' : '#1f6feb',
                  color:      (registering || webhookInfo?.is_localhost) ? '#484f58' : '#fff',
                  cursor:     (registering || webhookInfo?.is_localhost) ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                }}>
                {registering ? 'Registering with Meta…' : '⚡ Register Webhook with Meta'}
              </button>
              {webhookInfo?.is_localhost && (
                <p style={{ margin: '8px 0 0', fontSize: 11, color: '#484f58' }}>
                  Start ngrok and set WEBHOOK_BASE_URL in .env before registering.
                </p>
              )}
            </div>
          </div>

          {/* ── System user token card ──────────────────────────── */}
          <div style={S.card}>
            <p style={S.cardTitle}>
              <span style={{ fontSize: 18 }}>🔑</span>
              Permanent Access Token (System User)
              {webhookInfo && (
                webhookInfo.system_user_configured
                  ? <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#3fb950', background: 'rgba(63,185,80,.1)', border: '1px solid rgba(63,185,80,.2)', borderRadius: 6, padding: '3px 8px' }}>Configured ✓</span>
                  : <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#d29922', background: 'rgba(210,153,34,.1)', border: '1px solid rgba(210,153,34,.2)', borderRadius: 6, padding: '3px 8px' }}>Not configured</span>
              )}
            </p>

            <p style={{ fontSize: 13, color: '#7d8590', lineHeight: 1.7, margin: '0 0 16px' }}>
              Platforms like WATI never ask users to manage access tokens because they use a <strong style={{ color: '#c9d1d9' }}>System User token</strong> that belongs to the platform, not the customer. Once configured, every connected WABA uses this permanent token automatically — users just authorise via the Facebook popup and everything else is handled for them.
            </p>

            {!webhookInfo?.system_user_configured && (
              <div style={{ background: 'rgba(210,153,34,.06)', border: '1px solid rgba(210,153,34,.15)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#d29922' }}>Without this, stored tokens expire in 60 days and users need to reconnect</p>
                <p style={{ margin: 0, fontSize: 12, color: 'rgba(210,153,34,.8)', lineHeight: 1.5 }}>
                  Set up a system user once and token management becomes invisible to your customers.
                </p>
              </div>
            )}

            <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 12, padding: '16px 18px' }}>
              <p style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.06em' }}>One-time setup in Meta Business Manager</p>
              {[
                { n: 1, title: 'Open Meta Business Settings', desc: 'business.facebook.com → Settings → System users' },
                { n: 2, title: 'Create a System User',        desc: 'Name it e.g. "Platform Bot", role: Admin' },
                { n: 3, title: 'Add assets',                  desc: 'Add your WhatsApp Business Account (WABA) with "Manage" access' },
                { n: 4, title: 'Generate token',              desc: 'Click "Generate new token" → select your App → check: whatsapp_business_messaging, whatsapp_business_management → set Never expire' },
                { n: 5, title: 'Add to your .env',            desc: 'META_SYSTEM_USER_ID=... and META_SYSTEM_USER_TOKEN=... then restart the server' },
              ].map(s => (
                <div key={s.n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(56,139,253,.15)', border: '1px solid rgba(56,139,253,.25)', color: '#388bfd', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{s.n}</div>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#c9d1d9' }}>{s.title}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#7d8590', lineHeight: 1.5 }}>{s.desc}</p>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 14, borderTop: '1px solid #21262d', paddingTop: 14 }}>
                <label style={{ ...S.label, marginBottom: 8 }}>Add these two lines to your backend .env file:</label>
                <CopyBlock
                  label=".env entries"
                  value={'META_SYSTEM_USER_ID=your_system_user_id\nMETA_SYSTEM_USER_TOKEN=your_never_expiring_token'}
                  copied={copied} onCopy={copyToClipboard} id="env"
                  mono multiline
                />
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

// ─── Phone status panel ───────────────────────────────────────────────────────
function PhoneStatusPanel({ phones, wabaId, activePhoneId, loading, error, onRefresh, onRegisterPhone, registeringPhone, registerPhoneError, isCoexistence }) {
  const NAME_STATUS = {
    APPROVED:              { label: 'Approved',        color: '#3fb950' },
    PENDING_REVIEW:        { label: 'Pending review',  color: '#d29922' },
    DECLINED:              { label: 'Declined',        color: '#f85149' },
    NONE:                  { label: '—',               color: '#8b949e' },
    CERTIFICATE_PENDING:   { label: 'Cert pending',    color: '#d29922' },
    EXPIRED:               { label: 'Expired',         color: '#f85149' },
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {/* header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Phone Numbers
          </span>
          <span title={isCoexistence
              ? 'Coexistence — this number is also live in the WhatsApp Business App'
              : 'Cloud API — this number is managed entirely through the Cloud API'}
            style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
              textTransform: 'uppercase', letterSpacing: '.04em',
              background: isCoexistence ? 'rgba(31,111,235,.12)' : 'rgba(37,211,102,.12)',
              color:      isCoexistence ? '#589bff' : '#3fb950',
              border:     `1px solid ${isCoexistence ? 'rgba(31,111,235,.3)' : 'rgba(37,211,102,.3)'}`,
            }}>
            {isCoexistence ? '📱 Coexistence' : '☁ Cloud API'}
          </span>
        </span>
        <button onClick={onRefresh} disabled={loading} style={{
          background: 'none', border: '1px solid #30363d', borderRadius: 7, padding: '4px 10px',
          fontSize: 11, color: loading ? '#484f58' : '#8b949e', cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
        }}>
          {loading ? 'Refreshing…' : '↺ Refresh'}
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(248,81,73,.08)', border: '1px solid rgba(248,81,73,.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: '#f85149' }}>⚠ {error}</span>
        </div>
      )}

      {loading && !phones && (
        <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 12, padding: '20px', textAlign: 'center' }}>
          <span style={{ fontSize: 12, color: '#484f58' }}>Fetching live status from Meta…</span>
        </div>
      )}

      {phones && phones.length === 0 && (
        <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 12, padding: '16px 20px' }}>
          <span style={{ fontSize: 12, color: '#7d8590' }}>No phone numbers found on this WABA.</span>
        </div>
      )}

      {phones && phones.map(p => {
        const isActive = activePhoneId && p.id === activePhoneId
        return (
        <div key={p.id} style={{
          background:  '#0d1117',
          border:      `1px solid ${isActive ? 'rgba(37,211,102,.3)' : '#21262d'}`,
          borderRadius: 12, padding: '16px 20px', marginBottom: 10,
          opacity: isActive ? 1 : 0.55,
        }}>
          {/* Phone number + badges row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: isActive ? 'rgba(37,211,102,.1)' : 'rgba(255,255,255,.04)', border: `1px solid ${isActive ? 'rgba(37,211,102,.2)' : '#30363d'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                📱
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: isActive ? '#e6edf3' : '#7d8590', letterSpacing: '.01em' }}>
                    {p.phone_number || '—'}
                  </p>
                  {isActive && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: 'rgba(37,211,102,.15)', color: '#3fb950', border: '1px solid rgba(37,211,102,.3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                      Active
                    </span>
                  )}
                </div>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#7d8590' }}>
                  {p.verified_name || 'No display name'}
                  {!isActive && <span style={{ marginLeft: 6, color: '#484f58' }}>· Other number on WABA</span>}
                </p>
              </div>
            </div>
            {/* Status badge */}
            <span style={{
              fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 99,
              background: p.status_color + '18',
              color:      p.status_color,
              border:     `1px solid ${p.status_color}40`,
            }}>
              {p.status_label}
            </span>
          </div>

          {/* Detail rows */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
            <DetailRow label="Quality Rating" value={p.quality_label} color={p.quality_color} dot />
            <DetailRow label="Display Name"
              value={(NAME_STATUS[p.name_status] || NAME_STATUS['NONE']).label}
              color={(NAME_STATUS[p.name_status] || NAME_STATUS['NONE']).color}
            />
            <DetailRow label="Phone Number ID" value={p.id} mono />
            <DetailRow label="WABA ID"          value={wabaId} mono />
          </div>

          {/* Pending explanation + Register action */}
          {p.status === 'PENDING' && (
            <div style={{ marginTop: 12, background: 'rgba(210,153,34,.06)', border: '1px solid rgba(210,153,34,.15)', borderRadius: 8, padding: '9px 12px' }}>
              <p style={{ margin: 0, fontSize: 11, color: '#d29922', lineHeight: 1.6 }}>
                <strong>Pending</strong> — this number isn't registered for the Cloud API yet, so it can't send or receive messages. Click <strong>Register Phone</strong> to complete registration with Meta.
              </p>

              {isActive && (
                <>
                  <button onClick={onRegisterPhone} disabled={registeringPhone} style={{
                    marginTop: 10, background: registeringPhone ? 'rgba(210,153,34,.15)' : '#d29922',
                    color: registeringPhone ? '#d29922' : '#0d1117', border: 'none', borderRadius: 7,
                    padding: '7px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                    cursor: registeringPhone ? 'not-allowed' : 'pointer',
                  }}>
                    {registeringPhone ? 'Registering with Meta…' : '⚡ Register Phone'}
                  </button>

                  {registerPhoneError && (
                    <div style={{ marginTop: 10, background: 'rgba(248,81,73,.08)', border: '1px solid rgba(248,81,73,.2)', borderRadius: 8, padding: '10px 12px' }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#f85149', lineHeight: 1.5 }}>
                        ⚠ {registerPhoneError.headline}
                      </p>
                      {registerPhoneError.hint && (
                        <p style={{ margin: '5px 0 0', fontSize: 11, color: '#c9827e', lineHeight: 1.6 }}>
                          {registerPhoneError.hint}
                        </p>
                      )}
                      {registerPhoneError.code != null && (
                        <p style={{ margin: '7px 0 0', fontSize: 10, color: '#6e7681', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                          Meta error code {registerPhoneError.code}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          {p.status === 'FLAGGED' && (
            <div style={{ marginTop: 12, background: 'rgba(248,81,73,.06)', border: '1px solid rgba(248,81,73,.15)', borderRadius: 8, padding: '9px 12px' }}>
              <p style={{ margin: 0, fontSize: 11, color: '#f85149', lineHeight: 1.6 }}>
                <strong>Flagged</strong> — Your message quality has dropped. Review your messaging practices to avoid restrictions.
              </p>
            </div>
          )}
        </div>
        )
      })}
    </div>
  )
}

function DetailRow({ label, value, color, mono, dot }) {
  return (
    <div>
      <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: '#484f58' }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {dot && <div style={{ width: 8, height: 8, borderRadius: '50%', background: color || '#8b949e', flexShrink: 0 }} />}
        <span style={{ fontSize: 12, fontWeight: 600, color: color || '#e6edf3', fontFamily: mono ? 'monospace' : 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || '—'}
        </span>
      </div>
    </div>
  )
}

// ─── Copy block ───────────────────────────────────────────────────────────────
function CopyBlock({ value, id, copied, onCopy, mono, multiline }) {
  const isCopied = copied === id
  return (
    <div style={{ display: 'flex', alignItems: multiline ? 'flex-start' : 'center', gap: 8 }}>
      <div style={{
        flex: 1, background: '#0d1117', border: '1px solid #30363d', borderRadius: 8,
        padding: '9px 12px', fontSize: 12, color: '#c9d1d9',
        fontFamily: mono ? 'monospace' : 'inherit',
        whiteSpace: multiline ? 'pre' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {value}
      </div>
      <button
        onClick={() => onCopy(value, id)}
        style={{
          padding: '8px 12px', borderRadius: 8, border: '1px solid #30363d',
          background: isCopied ? 'rgba(63,185,80,.1)' : '#1c2128',
          color: isCopied ? '#3fb950' : '#8b949e',
          fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          whiteSpace: 'nowrap', flexShrink: 0, transition: 'all .15s',
        }}>
        {isCopied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  )
}

// ─── Save action bar ──────────────────────────────────────────────────────────
function SaveBar({ saving, saved }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, paddingTop: 4 }}>
      {saved === 'error' && (
        <span style={{ fontSize: 12, color: '#f85149' }}>⚠ Failed to save. Please try again.</span>
      )}
      {saved && saved !== 'error' && (
        <span style={{ fontSize: 12, color: '#3fb950' }}>✓ {saved}</span>
      )}
      <button
        type="submit"
        disabled={saving}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '9px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', background: saving ? '#21262d' : '#1f6feb',
          color: saving ? '#484f58' : '#fff', transition: 'all .15s',
        }}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  )
}
