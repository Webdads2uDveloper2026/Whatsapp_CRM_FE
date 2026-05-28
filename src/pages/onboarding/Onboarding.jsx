/**
 * WhatsApp Business Onboarding Wizard
 *
 * Flow (Tech Provider — Meta Embedded Signup v3):
 *   Step 1 — Account confirmed  (auto-passed when user arrives)
 *   Step 2 — Connect WhatsApp   (Meta Embedded Signup popup)
 *   Step 2.5 — Processing       (live status while backend exchanges token + sets up WABA)
 *   Step 3 — Success            (dashboard redirect)
 *
 * Meta docs:
 *   https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate }                 from 'react-router-dom'
import api                             from '../../services/api'
import image1                          from '../../assets/webdadslogo.svg'
import image2                          from '../../assets/webdadsicon.svg'

const META_APP_ID = import.meta.env.VITE_META_APP_ID
const CONFIG_ID   = import.meta.env.VITE_META_CONFIG_ID

// Steps that run on the backend during embedded-signup — shown in the processing UI
const PROC_STEPS = [
  { id: 'token',    label: 'Exchanging Meta authorization code' },
  { id: 'waba',     label: 'Connecting WhatsApp Business Account' },
  { id: 'phone',    label: 'Fetching phone number details' },
  { id: 'webhooks', label: 'Setting up message webhooks' },
  { id: 'activate', label: 'Activating your account' },
]
// Delay (ms) at which each step becomes "active" during the animation
const PROC_DELAYS = [0, 1800, 3400, 5000, 6400]

// ─── helpers ───────────────────────────────────────────────────────────────
function Spinner({ color = '#fff', size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ animation: 'spin .8s linear infinite', flexShrink: 0 }}>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" strokeOpacity=".25" />
      <path d="M22 12A10 10 0 0012 2" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function CheckIcon({ size = 20, color = '#25D366' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill={color} fillOpacity=".12" stroke={color} strokeOpacity=".4" />
      <path d="M7 12.5l3.5 3.5 6.5-7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FbIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white" style={{ flexShrink: 0 }}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  )
}

// Status icon for each processing step
function ProcStepIcon({ status }) {
  if (status === 'done') return <CheckIcon size={18} />
  if (status === 'active') return <Spinner size={18} color="#388bfd" />
  if (status === 'error') {
    return (
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="11" fill="rgba(248,81,73,.12)" stroke="rgba(248,81,73,.4)" />
        <path d="M8 8l8 8M16 8l-8 8" stroke="#f85149" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }
  // pending
  return <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid #30363d', background: '#21262d', flexShrink: 0 }} />
}

// ─── step definitions ──────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Create Account',   short: 'Account' },
  { id: 2, label: 'Connect WhatsApp', short: 'Connect' },
  { id: 3, label: 'Ready to Go',      short: 'Done'    },
]

// ─── main component ────────────────────────────────────────────────────────
export default function Onboarding() {
  const [step, setStep]             = useState(1)
  const [sdkReady, setSdkReady]     = useState(false)
  const [sdkError, setSdkError]     = useState(false)    // SDK failed to load
  const [connecting, setConnecting] = useState(false)
  const [processing, setProcessing] = useState(false)    // backend call in-flight
  const [procSteps, setProcSteps]   = useState(
    PROC_STEPS.map(s => ({ ...s, status: 'pending' }))
  )
  const [procDone, setProcDone]     = useState(false)    // all steps done, before transitioning
  const [error, setError]           = useState('')
  const [showManual, setShowManual] = useState(false)
  const [result, setResult]         = useState(null)
  const [profile, setProfile]       = useState(null)
  const [manual, setManual]         = useState({ waba_id: '', phone_number_id: '', access_token: '' })
  const sessionRef                  = useRef({ waba_id: '', phone_number_id: '' })
  const listenerRef                 = useRef(null)
  const timeoutsRef                 = useRef([])         // animation timeout handles
  const navigate                    = useNavigate()

  // ── load tenant profile ──────────────────────────────────────────────────
  useEffect(() => {
    api.get('/auth/me').then(({ data }) => {
      setProfile({ business_name: data.business_name, email: data.email, status: data.status, waba_connected: data.waba_connected })
      if (data.status === 'active' && data.waba_connected) {
        setResult({ phone_number: data.phone_number, waba_id: data.waba_id, display_name: data.business_name })
        setStep(3)
      }
    }).catch(() => {})
  }, [])

  // ── load Facebook JS SDK ─────────────────────────────────────────────────
  useEffect(() => {
    if (window.FB) { setSdkReady(true); return }
    window.fbAsyncInit = () => {
      window.FB.init({ appId: META_APP_ID, cookie: true, xfbml: false, version: 'v22.0' })
      setSdkReady(true)
      setSdkError(false)
    }
    if (!document.getElementById('facebook-jssdk')) {
      const s   = document.createElement('script')
      s.id      = 'facebook-jssdk'
      s.src     = 'https://connect.facebook.net/en_US/sdk.js'
      s.async   = true
      s.onerror = () => setSdkError(true)
      document.head.appendChild(s)
    }
  }, [])

  // ── cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => () => {
    timeoutsRef.current.forEach(clearTimeout)
    if (listenerRef.current) window.removeEventListener('message', listenerRef.current)
  }, [])

  // ── start processing animation ───────────────────────────────────────────
  const startProcessing = () => {
    setProcessing(true)
    setProcDone(false)
    const initial = PROC_STEPS.map((s, i) => ({ ...s, status: i === 0 ? 'active' : 'pending' }))
    setProcSteps(initial)

    const handles = []
    PROC_DELAYS.forEach((delay, i) => {
      if (i === 0) return
      handles.push(setTimeout(() => {
        setProcSteps(prev => prev.map((ps, pi) => ({
          ...ps,
          status: pi < i ? 'done' : pi === i ? 'active' : ps.status,
        })))
      }, delay))
    })
    timeoutsRef.current = handles
  }

  const finishProcessing = (success, errMsg = '') => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
    if (success) {
      setProcSteps(PROC_STEPS.map(s => ({ ...s, status: 'done' })))
      setProcDone(true)
    } else {
      // Mark the currently-active step as failed
      setProcSteps(prev => {
        const activeIdx = prev.findIndex(s => s.status === 'active')
        const failAt    = activeIdx === -1 ? 0 : activeIdx
        return prev.map((s, i) => ({
          ...s,
          status: i < failAt ? 'done' : i === failAt ? 'error' : 'pending',
        }))
      })
      setError(errMsg)
    }
    setConnecting(false)
  }

  // ── retry SDK load ───────────────────────────────────────────────────────
  const retrySdk = () => {
    setSdkError(false)
    const existing = document.getElementById('facebook-jssdk')
    if (existing) existing.remove()

    window.fbAsyncInit = () => {
      window.FB.init({ appId: META_APP_ID, cookie: true, xfbml: false, version: 'v22.0' })
      setSdkReady(true)
      setSdkError(false)
    }
    const s   = document.createElement('script')
    s.id      = 'facebook-jssdk'
    s.src     = 'https://connect.facebook.net/en_US/sdk.js'
    s.async   = true
    s.onerror = () => setSdkError(true)
    document.head.appendChild(s)
  }

  // ── reset to connect step (retry after processing error) ────────────────
  const resetToConnect = () => {
    setProcessing(false)
    setProcDone(false)
    setError('')
    setConnecting(false)
    setProcSteps(PROC_STEPS.map(s => ({ ...s, status: 'pending' })))
  }

  // ── Meta Embedded Signup ─────────────────────────────────────────────────
  const handleFacebookConnect = () => {
    if (!sdkReady)    { setError('Facebook SDK not loaded yet. Please wait a moment.'); return }
    if (!CONFIG_ID)   { setError('Configuration error: VITE_META_CONFIG_ID is missing.'); return }
    if (!META_APP_ID) { setError('Configuration error: VITE_META_APP_ID is missing.'); return }

    setConnecting(true)
    setError('')
    sessionRef.current = { waba_id: '', phone_number_id: '' }

    if (listenerRef.current) window.removeEventListener('message', listenerRef.current)

    // Listen for WA_EMBEDDED_SIGNUP postMessage from Meta popup.
    // This fires BEFORE the FB.login callback and carries waba_id + phone_number_id.
    // Origin must be validated strictly per Meta docs — never use .includes().
    const ALLOWED_ORIGINS = new Set(['https://www.facebook.com', 'https://web.facebook.com'])
    const listener = ev => {
      if (!ALLOWED_ORIGINS.has(ev.origin)) return
      try {
        const d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data
        if (d.type !== 'WA_EMBEDDED_SIGNUP') return

        if (d.event === 'FINISH') {
          // Full signup: both WABA and phone number created/selected
          sessionRef.current.waba_id         = d.data?.waba_id         || ''
          sessionRef.current.phone_number_id = d.data?.phone_number_id || ''
        }
        if (d.event === 'FINISH_ONLY_WABA') {
          // WABA created/selected but phone number not added yet — backend will still
          // discover the phone via /{waba_id}/phone_numbers API call
          sessionRef.current.waba_id         = d.data?.waba_id || ''
          sessionRef.current.phone_number_id = ''
        }
        if (d.event === 'CANCEL') {
          setConnecting(false)
          const step = d.data?.current_step ? ` (step: ${d.data.current_step})` : ''
          setError(`Setup was cancelled${step}. You can try again whenever you're ready.`)
        }
        if (d.event === 'ERROR') {
          setConnecting(false)
          setError('Meta returned an error: ' + (d.data?.error_message || 'unknown'))
        }
      } catch (_) { /* ignore non-JSON postMessages */ }
    }
    listenerRef.current = listener
    window.addEventListener('message', listener)

    // FB.login must be called synchronously (Meta SDK limitation — no async/await here)
    window.FB.login(function (response) {
      window.removeEventListener('message', listener)
      listenerRef.current = null

      if (response.status === 'connected' && response.authResponse?.code) {
        const code            = response.authResponse.code
        const waba_id         = sessionRef.current.waba_id
        const phone_number_id = sessionRef.current.phone_number_id

        startProcessing()

        ;(async () => {
          try {
            const { data } = await api.post('/onboarding/embedded-signup', {
              code,
              waba_id,
              phone_number_id,
            })
            finishProcessing(true)
            // Brief pause so user sees all steps turn green before navigating
            await new Promise(r => setTimeout(r, 900))
            setResult(data)
            setStep(3)
            setProcessing(false)
          } catch (err) {
            const msg = (err.response?.data?.detail || 'Backend error during connection.') +
              ' — Try the manual setup below.'
            finishProcessing(false, msg)
          }
        })()
      } else if (response.status === 'not_authorized') {
        setConnecting(false)
        setError('Permission denied. Please allow all required permissions and try again.')
      } else {
        setConnecting(false)
        // 'unknown' usually means the user closed the popup — don't show an error
        if (response.status !== 'unknown') {
          setError('Facebook login was not completed. Please try again.')
        }
      }
    }, {
      config_id:                      CONFIG_ID,
      response_type:                  'code',
      override_default_response_type: true,
      extras: {
        sessionInfoVersion: 3,   // matches Session Info Version in Meta Embedded Signup Builder
        featureType:        '',  // must be empty string — "None" in Meta Builder
        setup:              {},  // reserved for pre-fill; empty = standard flow
      },
    })
  }

  // ── manual connect ───────────────────────────────────────────────────────
  const handleManual = async e => {
    e.preventDefault()
    setError('')
    setConnecting(true)
    startProcessing()
    try {
      const { data } = await api.post('/onboarding/connect-manual', manual)
      finishProcessing(true)
      await new Promise(r => setTimeout(r, 900))
      setResult(data)
      setStep(3)
      setProcessing(false)
    } catch (err) {
      finishProcessing(false, err.response?.data?.detail || 'Manual connection failed. Check your credentials.')
    }
  }

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      {/* ── top bar ─────────────────────────────────────────── */}
      <div style={S.topBar}>
        <div style={S.logo}>
          <img src={image2} alt="" style={{ width: 28, height: 28 }} />
          <img src={image1} alt="Logo" style={{ width: 90, height: 28 }} />
        </div>
        <StepBar current={step} />
        <div style={{ width: 160 }} />
      </div>

      {/* ── content ─────────────────────────────────────────── */}
      <div style={S.content}>
        {step === 1 && (
          <StepAccount
            profile={profile}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && !processing && (
          <StepConnect
            sdkReady={sdkReady}
            sdkError={sdkError}
            connecting={connecting}
            error={error}
            showManual={showManual}
            manual={manual}
            setManual={setManual}
            setShowManual={setShowManual}
            setError={setError}
            onFacebook={handleFacebookConnect}
            onManual={handleManual}
            onRetrySdk={retrySdk}
          />
        )}
        {step === 2 && processing && (
          <StepProcessing
            steps={procSteps}
            done={procDone}
            error={error}
            onRetry={resetToConnect}
            onManual={() => { resetToConnect(); setShowManual(true) }}
          />
        )}
        {step === 3 && (
          <StepSuccess
            result={result}
            onDashboard={() => navigate('/dashboard')}
          />
        )}
      </div>
    </div>
  )
}

// ─── Step bar ─────────────────────────────────────────────────────────────
function StepBar({ current }) {
  return (
    <div style={S.stepBar}>
      {STEPS.map((s, i) => {
        const done   = current > s.id
        const active = current === s.id
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                ...S.stepDot,
                background: done ? '#25D366' : active ? '#388bfd' : '#21262d',
                border: `2px solid ${done ? '#25D366' : active ? '#388bfd' : '#30363d'}`,
              }}>
                {done
                  ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  : <span style={{ fontSize: 10, fontWeight: 700, color: active ? '#fff' : '#484f58' }}>{s.id}</span>
                }
              </div>
              <span style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? '#e6edf3' : done ? '#3fb950' : '#484f58' }}>
                {s.short}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ width: 40, height: 1, background: current > s.id ? '#25D366' : '#21262d', margin: '0 10px' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step 1: Account Confirmed ────────────────────────────────────────────
function StepAccount({ profile, onNext }) {
  return (
    <div style={S.card}>
      <div style={S.cardLeft}>
        <div style={S.stepLabel}>Step 1 of 3</div>
        <h2 style={S.cardTitle}>Account Created</h2>
        <p style={S.cardDesc}>
          Your account is set up. Next, you'll connect your WhatsApp Business Number so you can start messaging customers.
        </p>
        <div style={S.featureList}>
          {[
            { icon: '💬', text: 'Shared inbox for your whole team' },
            { icon: '📢', text: 'Broadcast campaigns to thousands' },
            { icon: '🤖', text: 'Smart automations & chatbots' },
            { icon: '📊', text: 'Real-time delivery analytics' },
          ].map(f => (
            <div key={f.text} style={S.featureRow}>
              <span style={S.featureIcon}>{f.icon}</span>
              <span style={S.featureText}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={S.cardRight}>
        <div style={S.successBadge}>
          <CheckIcon size={36} />
          <div>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#e6edf3' }}>Account ready</p>
            <p style={{ margin: 0, fontSize: 12, color: '#7d8590' }}>Credentials saved securely</p>
          </div>
        </div>

        {profile && (
          <div style={S.profileBox}>
            <Row label="Business" value={profile.business_name || '—'} />
            <Row label="Email"    value={profile.email         || '—'} />
            <Row label="Plan"     value="Free Trial (14 days)" green />
          </div>
        )}

        <div style={S.infoBox}>
          <span style={S.infoIcon}>ℹ</span>
          <p style={S.infoText}>
            In the next step, a Facebook popup will open. Sign in with the Facebook account that manages your WhatsApp Business.
          </p>
        </div>

        <button onClick={onNext} style={S.primaryBtn}>
          Continue to Connect WhatsApp →
        </button>
      </div>
    </div>
  )
}

// ─── Step 2: Connect WhatsApp ─────────────────────────────────────────────
function StepConnect({ sdkReady, sdkError, connecting, error, showManual, manual, setManual, setShowManual, setError, onFacebook, onManual, onRetrySdk }) {
  return (
    <div style={S.card}>
      <div style={S.cardLeft}>
        <div style={S.stepLabel}>Step 2 of 3</div>
        <h2 style={S.cardTitle}>Connect WhatsApp Business</h2>
        <p style={S.cardDesc}>
          Use Meta's official Embedded Signup to link your WhatsApp Business Account. The process takes under 2 minutes.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          {[
            { n: 1, t: 'Log in with Facebook',      d: 'Use the Facebook account that owns your Business' },
            { n: 2, t: 'Select Business Portfolio',  d: 'Choose or create your Meta Business' },
            { n: 3, t: 'Select WhatsApp Account',    d: 'Pick existing WABA or create a new one' },
            { n: 4, t: 'Verify phone number',        d: 'Add and confirm the number to use' },
          ].map(s => (
            <div key={s.n} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={S.numBadge}>{s.n}</div>
              <div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#c9d1d9' }}>{s.t}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#7d8590', lineHeight: 1.5 }}>{s.d}</p>
              </div>
            </div>
          ))}
        </div>

        {import.meta.env.DEV && (
          <div style={S.debugBox}>
            <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: '#d29922' }}>🔧 Debug</p>
            <p style={S.debugLine}>APP_ID: {META_APP_ID || '❌ missing'}</p>
            <p style={S.debugLine}>CFG_ID: {CONFIG_ID   || '❌ missing'}</p>
            <p style={S.debugLine}>SDK:    {sdkReady ? '✅' : sdkError ? '❌' : '⏳'}</p>
          </div>
        )}
      </div>

      <div style={S.cardRight}>
        {!showManual ? (
          <>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#e6edf3' }}>
              Connect with Facebook
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: '#7d8590', lineHeight: 1.6 }}>
              Click the button below — a secure Facebook popup will open to authorize your WhatsApp Business Account.
            </p>

            {/* SDK status indicator */}
            {!sdkError ? (
              <div style={S.sdkStatus}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: sdkReady ? '#3fb950' : '#d29922', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#8b949e' }}>
                  {sdkReady ? 'Facebook SDK ready' : 'Loading Facebook SDK…'}
                </span>
              </div>
            ) : (
              /* SDK failed to load — show retry */
              <div style={S.warnBox}>
                <b style={{ color: '#d29922', fontSize: 12 }}>⚠ Facebook SDK failed to load</b>
                <p style={{ margin: '4px 0 6px', fontSize: 11, color: 'rgba(210,153,34,.85)', lineHeight: 1.5 }}>
                  This can happen with ad-blockers or network issues. Try disabling your ad-blocker or use manual setup.
                </p>
                <button onClick={onRetrySdk} style={{ ...S.linkBtn, color: '#d29922', textDecoration: 'underline' }}>
                  Retry SDK load
                </button>
              </div>
            )}

            {/* HTTPS warning on non-localhost http */}
            {window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && (
              <div style={S.warnBox}>
                <b style={{ color: '#d29922', fontSize: 12 }}>⚠ HTTPS Required</b>
                <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(210,153,34,.85)', lineHeight: 1.5 }}>
                  Meta Embedded Signup requires HTTPS in production. Use manual setup below if this is blocking you.
                </p>
              </div>
            )}

            {error && (
              <div style={S.errorBox}>
                <span style={{ fontSize: 13, color: '#f85149', fontWeight: 600 }}>⚠ {error}</span>
              </div>
            )}

            <button
              onClick={onFacebook}
              disabled={!sdkReady || connecting || sdkError}
              style={{
                ...S.fbBtn,
                background: (!sdkReady || connecting || sdkError) ? '#21262d' : '#1877F2',
                color:      (!sdkReady || connecting || sdkError) ? '#6e7681' : '#fff',
                cursor:     (!sdkReady || connecting || sdkError) ? 'not-allowed' : 'pointer',
              }}>
              {connecting
                ? <><Spinner size={16} /><span style={{ marginLeft: 10 }}>Opening Facebook…</span></>
                : <><FbIcon /><span style={{ marginLeft: 10 }}>Continue with Facebook</span></>
              }
            </button>

            <div style={S.permBox}>
              <p style={S.permTitle}>Permissions you'll grant</p>
              {[
                'Manage your WhatsApp Business Account',
                'Access phone numbers & templates',
                'Send & receive messages via API',
                'View analytics & delivery reports',
              ].map(p => (
                <div key={p} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 5 }}>
                  <span style={{ color: '#3fb950', fontSize: 12, lineHeight: 1.4 }}>✓</span>
                  <span style={{ fontSize: 12, color: '#7d8590', lineHeight: 1.4 }}>{p}</span>
                </div>
              ))}
            </div>

            <div style={{ textAlign: 'center' }}>
              <button onClick={() => { setShowManual(true); setError('') }} style={S.linkBtn}>
                Prefer to enter credentials manually →
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={onManual} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#e6edf3' }}>Manual Setup</h3>
            <p style={{ margin: 0, fontSize: 12, color: '#7d8590', lineHeight: 1.6 }}>
              Enter credentials from your{' '}
              <a href="https://business.facebook.com/settings/whatsapp-business-accounts" target="_blank" rel="noopener noreferrer"
                style={{ color: '#388bfd', textDecoration: 'none' }}>
                Meta Business Manager
              </a>.
            </p>

            {error && (
              <div style={S.errorBox}>
                <span style={{ fontSize: 13, color: '#f85149', fontWeight: 600 }}>⚠ {error}</span>
              </div>
            )}

            {[
              { k: 'waba_id',         label: 'WhatsApp Business Account ID', placeholder: 'e.g. 624519580627601', mono: true },
              { k: 'phone_number_id', label: 'Phone Number ID',              placeholder: 'e.g. 578790305328460', mono: true },
              { k: 'access_token',    label: 'System User Access Token',     placeholder: 'EAABwz…',              type: 'password' },
            ].map(f => (
              <div key={f.k}>
                <label style={S.fieldLabel}>{f.label}</label>
                <input
                  required
                  type={f.type || 'text'}
                  value={manual[f.k]}
                  onChange={e => setManual(p => ({ ...p, [f.k]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{ ...S.fieldInput, fontFamily: f.mono ? 'monospace' : 'inherit' }}
                />
              </div>
            ))}

            <button type="submit" disabled={connecting} style={{ ...S.primaryBtn, marginTop: 4 }}>
              {connecting ? <><Spinner size={16} /><span style={{ marginLeft: 8 }}>Connecting…</span></> : 'Connect Manually'}
            </button>
            <button type="button" onClick={() => { setShowManual(false); setError('') }} style={S.linkBtn}>
              ← Back to Facebook signup
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Step 2.5: Processing ─────────────────────────────────────────────────
function StepProcessing({ steps, done, error, onRetry, onManual }) {
  const hasFailed = steps.some(s => s.status === 'error')

  return (
    <div style={{ ...S.card, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ maxWidth: 480, width: '100%', padding: '48px 40px', textAlign: 'center' }}>

        {/* Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          {hasFailed ? (
            <div style={{ ...S.bigCheck, background: 'rgba(248,81,73,.1)', border: '2px solid rgba(248,81,73,.25)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M18 6L6 18" stroke="#f85149" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          ) : done ? (
            <div style={S.bigCheck}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="#25D366" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          ) : (
            <div style={{ ...S.bigCheck, background: 'rgba(56,139,253,.08)', border: '2px solid rgba(56,139,253,.2)' }}>
              <Spinner size={40} color="#388bfd" />
            </div>
          )}
        </div>

        {/* Heading */}
        <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: '#e6edf3' }}>
          {hasFailed ? 'Connection Failed' : done ? 'Connected!' : 'Setting Up WhatsApp…'}
        </h2>
        <p style={{ margin: '0 0 32px', fontSize: 13, color: '#7d8590', lineHeight: 1.6 }}>
          {hasFailed
            ? 'Something went wrong during setup. You can try again or use manual credentials.'
            : done
            ? 'All steps completed. Redirecting you now…'
            : 'Please wait while we connect your WhatsApp Business Account.'}
        </p>

        {/* Step list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24, textAlign: 'left' }}>
          {steps.map(s => (
            <div key={s.id} style={{
              display:      'flex',
              alignItems:   'center',
              gap:          12,
              padding:      '10px 14px',
              borderRadius: 10,
              background:   s.status === 'active' ? 'rgba(56,139,253,.06)'
                          : s.status === 'done'   ? 'rgba(37,211,102,.04)'
                          : s.status === 'error'  ? 'rgba(248,81,73,.06)'
                          : 'rgba(255,255,255,.02)',
              border: `1px solid ${
                s.status === 'active' ? 'rgba(56,139,253,.2)'
                : s.status === 'done'   ? 'rgba(37,211,102,.15)'
                : s.status === 'error'  ? 'rgba(248,81,73,.2)'
                : '#21262d'
              }`,
              transition: 'all .3s ease',
            }}>
              <ProcStepIcon status={s.status} />
              <span style={{
                fontSize:   13,
                fontWeight: s.status === 'active' ? 600 : 400,
                color:      s.status === 'done'   ? '#3fb950'
                          : s.status === 'active' ? '#c9d1d9'
                          : s.status === 'error'  ? '#f85149'
                          : '#484f58',
                flex: 1,
              }}>
                {s.label}
              </span>
              {s.status === 'done' && (
                <span style={{ fontSize: 11, color: '#3fb950', fontWeight: 600 }}>Done</span>
              )}
              {s.status === 'error' && (
                <span style={{ fontSize: 11, color: '#f85149', fontWeight: 600 }}>Failed</span>
              )}
            </div>
          ))}
        </div>

        {/* Error detail */}
        {hasFailed && error && (
          <div style={{ ...S.errorBox, marginBottom: 20, textAlign: 'left' }}>
            <span style={{ fontSize: 12, color: '#f85149' }}>{error}</span>
          </div>
        )}

        {/* Actions on failure */}
        {hasFailed && (
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={onRetry} style={{ ...S.primaryBtn, flex: 1, background: '#388bfd' }}>
              Try Again with Facebook
            </button>
            <button onClick={onManual} style={{ ...S.primaryBtn, flex: 1, background: '#21262d', color: '#c9d1d9' }}>
              Manual Setup
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Step 3: Success ──────────────────────────────────────────────────────
function StepSuccess({ result, onDashboard }) {
  return (
    <div style={{ ...S.card, justifyContent: 'center', alignItems: 'center', gap: 0 }}>
      <div style={{ maxWidth: 460, textAlign: 'center', padding: '40px 32px' }}>
        <div style={S.bigCheck}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#25D366" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#e6edf3', margin: '20px 0 10px' }}>
          WhatsApp Connected!
        </h1>
        <p style={{ fontSize: 14, color: '#7d8590', lineHeight: 1.7, marginBottom: 28 }}>
          Your WhatsApp Business Account is now linked. You can start sending messages, creating templates, and setting up automations.
        </p>

        {result && (
          <div style={S.resultBox}>
            {result.phone_number && (
              <div style={S.resultRow}>
                <span style={S.resultLabel}>Phone Number</span>
                <span style={S.resultValue}>+{result.phone_number.replace(/[^0-9]/g, '')}</span>
              </div>
            )}
            {result.waba_id && (
              <div style={S.resultRow}>
                <span style={S.resultLabel}>WABA ID</span>
                <span style={{ ...S.resultValue, fontFamily: 'monospace', fontSize: 12 }}>{result.waba_id}</span>
              </div>
            )}
            {result.display_name && (
              <div style={{ ...S.resultRow, borderBottom: 'none' }}>
                <span style={S.resultLabel}>Account Name</span>
                <span style={S.resultValue}>{result.display_name}</span>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
          {[
            { icon: '📝', text: 'Create your first message template' },
            { icon: '👥', text: 'Import or add contacts' },
            { icon: '📢', text: 'Launch a broadcast campaign' },
          ].map(item => (
            <div key={item.text} style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(255,255,255,.03)', border: '1px solid #21262d', borderRadius: 10, padding: '10px 14px' }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ fontSize: 13, color: '#c9d1d9' }}>{item.text}</span>
            </div>
          ))}
        </div>

        <button onClick={onDashboard} style={{ ...S.primaryBtn, fontSize: 15, padding: '14px 36px' }}>
          Go to Dashboard →
        </button>
      </div>
    </div>
  )
}

// ─── small helpers ────────────────────────────────────────────────────────
function Row({ label, value, green }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #21262d' }}>
      <span style={{ fontSize: 12, color: '#7d8590' }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: green ? '#3fb950' : '#e6edf3' }}>{value}</span>
    </div>
  )
}

// ─── styles ───────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight:     '100vh',
    background:    '#0d1117',
    display:       'flex',
    flexDirection: 'column',
    fontFamily:    "'Inter',system-ui,sans-serif",
  },
  topBar: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '16px 40px',
    borderBottom:   '1px solid #21262d',
    background:     '#0d1117',
  },
  logo: {
    display:    'flex',
    alignItems: 'center',
    gap:        10,
    width:      160,
  },
  stepBar: {
    display:    'flex',
    alignItems: 'center',
    gap:        0,
  },
  stepDot: {
    width:          22,
    height:         22,
    borderRadius:   '50%',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
  },
  content: {
    flex:           1,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '32px 24px',
  },
  card: {
    display:       'flex',
    width:         '100%',
    maxWidth:      920,
    background:    '#161b22',
    border:        '1px solid #21262d',
    borderRadius:  20,
    overflow:      'hidden',
    minHeight:     540,
  },
  cardLeft: {
    width:           300,
    flexShrink:      0,
    background:      '#0d1117',
    borderRight:     '1px solid #21262d',
    padding:         '36px 28px',
    display:         'flex',
    flexDirection:   'column',
    gap:             14,
  },
  cardRight: {
    flex:          1,
    padding:       '36px 36px',
    display:       'flex',
    flexDirection: 'column',
    gap:           16,
    overflowY:     'auto',
  },
  stepLabel: {
    fontSize:      11,
    fontWeight:    600,
    textTransform: 'uppercase',
    letterSpacing: '.08em',
    color:         '#388bfd',
  },
  cardTitle: {
    fontSize:   20,
    fontWeight: 700,
    color:      '#e6edf3',
    margin:     0,
  },
  cardDesc: {
    fontSize:   13,
    color:      '#7d8590',
    lineHeight: 1.7,
    margin:     0,
  },
  featureList: {
    display:       'flex',
    flexDirection: 'column',
    gap:           10,
    marginTop:     4,
  },
  featureRow: {
    display:    'flex',
    gap:        10,
    alignItems: 'center',
  },
  featureIcon: {
    width:          28,
    height:         28,
    borderRadius:   7,
    background:     'rgba(56,139,253,.08)',
    border:         '1px solid rgba(56,139,253,.12)',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    fontSize:       13,
    flexShrink:     0,
  },
  featureText: {
    fontSize: 12,
    color:    '#8b949e',
  },
  debugBox: {
    marginTop:    'auto',
    background:   'rgba(210,153,34,.06)',
    border:       '1px solid rgba(210,153,34,.15)',
    borderRadius: 8,
    padding:      '8px 10px',
  },
  debugLine: {
    fontSize:   10,
    color:      '#8b949e',
    margin:     '2px 0',
    fontFamily: 'monospace',
  },
  successBadge: {
    display:      'flex',
    alignItems:   'center',
    gap:          14,
    background:   'rgba(37,211,102,.06)',
    border:       '1px solid rgba(37,211,102,.15)',
    borderRadius: 14,
    padding:      '16px 20px',
  },
  profileBox: {
    background:   'rgba(255,255,255,.02)',
    border:       '1px solid #21262d',
    borderRadius: 12,
    padding:      '12px 16px',
  },
  infoBox: {
    display:      'flex',
    gap:          10,
    background:   'rgba(56,139,253,.06)',
    border:       '1px solid rgba(56,139,253,.15)',
    borderRadius: 12,
    padding:      '12px 14px',
  },
  infoIcon: {
    color:      '#388bfd',
    fontSize:   14,
    lineHeight: 1.5,
    flexShrink: 0,
  },
  infoText: {
    fontSize:   12,
    color:      'rgba(139,184,253,.85)',
    lineHeight: 1.6,
    margin:     0,
  },
  primaryBtn: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
    background:     '#25D366',
    color:          '#0d1117',
    border:         'none',
    borderRadius:   12,
    padding:        '13px 20px',
    fontSize:       14,
    fontWeight:     700,
    cursor:         'pointer',
    fontFamily:     'inherit',
    width:          '100%',
  },
  sdkStatus: {
    display:      'flex',
    alignItems:   'center',
    gap:          8,
    background:   '#0d1117',
    border:       '1px solid #21262d',
    borderRadius: 10,
    padding:      '9px 14px',
  },
  warnBox: {
    background:   'rgba(210,153,34,.08)',
    border:       '1px solid rgba(210,153,34,.25)',
    borderRadius: 10,
    padding:      '10px 14px',
  },
  errorBox: {
    background:   'rgba(248,81,73,.08)',
    border:       '1px solid rgba(248,81,73,.25)',
    borderRadius: 10,
    padding:      '10px 14px',
  },
  fbBtn: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    width:          '100%',
    padding:        '14px 20px',
    borderRadius:   12,
    border:         'none',
    fontSize:       14,
    fontWeight:     700,
    fontFamily:     'inherit',
    transition:     'opacity .15s',
  },
  permBox: {
    background:   'rgba(255,255,255,.02)',
    border:       '1px solid #21262d',
    borderRadius: 12,
    padding:      '12px 14px',
  },
  permTitle: {
    fontSize:      10,
    fontWeight:    600,
    textTransform: 'uppercase',
    letterSpacing: '.06em',
    color:         '#484f58',
    margin:        '0 0 8px',
  },
  linkBtn: {
    background:     'none',
    border:         'none',
    color:          '#7d8590',
    fontSize:       12,
    cursor:         'pointer',
    textDecoration: 'underline',
    fontFamily:     'inherit',
  },
  numBadge: {
    width:          22,
    height:         22,
    borderRadius:   '50%',
    background:     'rgba(56,139,253,.1)',
    border:         '1px solid rgba(56,139,253,.2)',
    color:          '#388bfd',
    fontSize:       11,
    fontWeight:     700,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
    marginTop:      1,
  },
  fieldLabel: {
    display:      'block',
    fontSize:     12,
    fontWeight:   500,
    color:        '#7d8590',
    marginBottom: 6,
  },
  fieldInput: {
    width:        '100%',
    background:   '#0d1117',
    border:       '1px solid #30363d',
    borderRadius: 10,
    padding:      '10px 14px',
    fontSize:     13,
    color:        '#e6edf3',
    outline:      'none',
    boxSizing:    'border-box',
  },
  bigCheck: {
    width:          88,
    height:         88,
    borderRadius:   '50%',
    background:     'rgba(37,211,102,.1)',
    border:         '2px solid rgba(37,211,102,.25)',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    margin:         '0 auto',
  },
  resultBox: {
    background:   '#0d1117',
    border:       '1px solid #21262d',
    borderRadius: 14,
    padding:      '4px 20px',
    marginBottom: 20,
    textAlign:    'left',
  },
  resultRow: {
    display:        'flex',
    justifyContent: 'space-between',
    alignItems:     'center',
    padding:        '10px 0',
    borderBottom:   '1px solid #21262d',
  },
  resultLabel: {
    fontSize: 12,
    color:    '#7d8590',
  },
  resultValue: {
    fontSize:   13,
    fontWeight: 600,
    color:      '#e6edf3',
  },
}
