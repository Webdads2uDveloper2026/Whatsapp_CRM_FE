import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'

const META_APP_ID = import.meta.env.VITE_META_APP_ID
const CONFIG_ID   = import.meta.env.VITE_META_CONFIG_ID

export default function Onboarding() {
  const [phase, setPhase]           = useState('idle')
  const [sdkReady, setSdkReady]     = useState(false)
  const [error, setError]           = useState('')
  const [showManual, setShowManual] = useState(false)
  const [connected, setConnected]   = useState(null)
  const [manual, setManual]         = useState({ waba_id:'', phone_number_id:'', access_token:'' })
  const sessionRef                  = useRef({ waba_id:'', phone_number_id:'' })
  const listenerRef                 = useRef(null)
  const navigate                    = useNavigate()

  // Check existing connection
  useEffect(() => {
    api.get('/onboarding/status').then(({ data }) => {
      if (data.status === 'active') setConnected(data)
    }).catch(() => {})
  }, [])

  // Load FB SDK
  useEffect(() => {
    if (window.FB) { setSdkReady(true); return }
    window.fbAsyncInit = () => {
      window.FB.init({ appId: META_APP_ID, cookie: true, xfbml: false, version: 'v22.0' })
      setSdkReady(true)
    }
    if (!document.getElementById('facebook-jssdk')) {
      const s = document.createElement('script')
      s.id = 'facebook-jssdk'
      s.src = 'https://connect.facebook.net/en_US/sdk.js'
      s.async = true
      document.head.appendChild(s)
    }
  }, [])

  useEffect(() => () => {
    if (listenerRef.current) window.removeEventListener('message', listenerRef.current)
  }, [])

  const handleConnect = () => {
    if (!sdkReady) { setError('Facebook SDK not ready yet.'); return }
    if (!CONFIG_ID) { setError('VITE_META_CONFIG_ID missing in .env'); return }

    setPhase('connecting'); setError('')
    sessionRef.current = { waba_id: '', phone_number_id: '' }

    if (listenerRef.current) window.removeEventListener('message', listenerRef.current)

    // Listen for WABA/Phone IDs from popup
    const listener = ev => {
      if (!ev.origin.includes('facebook.com')) return
      try {
        const d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data
        if (d.type === 'WA_EMBEDDED_SIGNUP') {
          if (d.event === 'FINISH' || d.event === 'FINISH_ONLY_WABA') {
            sessionRef.current.waba_id         = d.data?.waba_id         || ''
            sessionRef.current.phone_number_id = d.data?.phone_number_id || ''
          }
          if (d.event === 'CANCEL') { setPhase('idle'); setError('Signup cancelled. Try again.') }
          if (d.event === 'ERROR')  { setPhase('idle'); setError('Meta error: ' + (d.data?.error_message || '')) }
        }
      } catch {}
    }
    listenerRef.current = listener
    window.addEventListener('message', listener)

    // ── CRITICAL FIX: FB.login callback must NOT be async ──────────────
    // Facebook SDK does not support async callbacks — use regular function
    // and handle the async work inside with a separate async IIFE
    window.FB.login(function(response) {
      window.removeEventListener('message', listener)

      if (response.status === 'connected' && response.authResponse?.code) {
        const code           = response.authResponse.code
        const waba_id        = sessionRef.current.waba_id
        const phone_number_id = sessionRef.current.phone_number_id

        // Handle async work separately — do NOT make the callback itself async
        ;(async () => {
          try {
            const { data } = await api.post('/onboarding/embedded-signup', {
              code, waba_id, phone_number_id,
            })
            setConnected(data)
            setPhase('success')
          } catch (e) {
            setError((e.response?.data?.detail || 'Backend error') + ' — Use manual setup below.')
            setPhase('idle')
          }
        })()

      } else if (response.status === 'not_authorized') {
        setPhase('idle')
        setError('You did not authorize the app. Please try again.')
      } else {
        setPhase('idle')
        if (response.status !== 'unknown') {
          setError('Login cancelled or not completed.')
        }
      }
    }, {
      config_id:                      CONFIG_ID,
      response_type:                  'code',
      override_default_response_type: true,
      extras: {
        sessionInfoVersion: 3,
        featureType:        'whatsapp_business_app_onboard',
      },
    })
  }

  const handleManual = async e => {
    e.preventDefault(); setError('')
    try {
      const { data } = await api.post('/onboarding/connect-manual', manual)
      setConnected(data); setPhase('success')
    } catch (e) { setError(e.response?.data?.detail || 'Manual connection failed') }
  }

  // Already connected
  if (phase === 'success' || connected) {
    return (
      <div style={S.page}>
        <div style={S.successCard}>
          <div style={S.successIcon}>✓</div>
          <h2 style={S.h2}>WhatsApp Connected!</h2>
          <p style={S.sub}>Your account is linked and ready to use.</p>
          {connected?.phone_number && (
            <div style={S.phoneChip}>+{connected.phone_number}</div>
          )}
          <button onClick={() => navigate('/dashboard')} style={S.dashBtn}>
            Go to Dashboard →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={S.page}>
      <div style={S.card}>

        {/* Left */}
        <div style={S.left}>
          <div style={S.logoRow}>
            <div style={S.logoIcon}>W</div>
            <span style={S.logoText}>WhatsApp CRM</span>
          </div>
          <h2 style={S.leftH}>Connect WhatsApp Business</h2>
          <p style={S.leftP}>Meta's official signup flow links your WABA in under 2 minutes.</p>
          {[
            'Log in with your Facebook account',
            'Select or create a Meta Business Portfolio',
            'Create or select a WhatsApp Business Account',
            'Add and verify your phone number',
          ].map((s, i) => (
            <div key={i} style={S.step}>
              <div style={S.stepN}>{i+1}</div>
              <span style={S.stepT}>{s}</span>
            </div>
          ))}

          {/* Debug panel */}
          {import.meta.env.DEV && (
            <div style={S.debug}>
              <p style={S.debugT}>🔧 Debug</p>
              <p style={S.debugL}>APP_ID: {META_APP_ID || '❌ missing'}</p>
              <p style={S.debugL}>CONFIG_ID: {CONFIG_ID || '❌ missing'}</p>
              <p style={S.debugL}>SDK: {sdkReady ? '✅ ready' : '⏳ loading'}</p>
              <p style={S.debugL}>Protocol: {window.location.protocol}</p>
            </div>
          )}
        </div>

        {/* Right */}
        <div style={S.right}>
          {!showManual ? (
            <>
              <h1 style={S.h1}>Connect WhatsApp</h1>
              <p style={S.rightP}>Click the button below. A Facebook popup will open — complete all steps inside it.</p>

              {/* HTTPS warning */}
              {window.location.protocol === 'http:' && (
                <div style={S.warnBox}>
                  <p style={S.warnT}>⚠ HTTP Detected</p>
                  <p style={S.warnP}>
                    Facebook requires HTTPS. Since you're on <code>http://localhost</code>,
                    the popup may show a warning but should still work on localhost specifically.
                    If it doesn't work, use <strong>Manual Setup</strong> below.
                  </p>
                </div>
              )}

              {/* SDK status */}
              <div style={S.sdkRow}>
                <div style={{...S.dot, background: sdkReady ? '#3fb950' : '#d29922'}}/>
                <span style={S.sdkT}>{sdkReady ? '✓ Facebook SDK ready' : 'Loading SDK…'}</span>
              </div>

              {error && (
                <div style={S.errBox}>
                  <p style={S.errT}>⚠ {error}</p>
                </div>
              )}

              <button
                onClick={handleConnect}
                disabled={!sdkReady || phase === 'connecting'}
                style={{
                  ...S.fbBtn,
                  background: (!sdkReady || phase === 'connecting') ? '#21262d' : '#1877F2',
                  color:      (!sdkReady || phase === 'connecting') ? '#6e7681' : '#fff',
                  cursor:     (!sdkReady || phase === 'connecting') ? 'not-allowed' : 'pointer',
                }}>
                {phase === 'connecting' ? (
                  <span style={S.btnRow}>
                    <Spin/> Opening Facebook popup…
                  </span>
                ) : (
                  <span style={S.btnRow}>
                    <FbIco/> Continue with Facebook
                  </span>
                )}
              </button>

              <div style={S.permBox}>
                <p style={S.permT}>You'll authorize</p>
                {['Connect WhatsApp Business Account','Manage WABA and phone numbers','Send & receive messages via API'].map(p => (
                  <div key={p} style={S.permRow}><span style={S.permChk}>✓</span><span style={S.permL}>{p}</span></div>
                ))}
              </div>

              <div style={{textAlign:'center'}}>
                <button onClick={() => setShowManual(true)} style={S.manualLink}>
                  Or enter credentials manually →
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleManual} style={S.manualForm}>
              <h2 style={S.h2}>Manual Setup</h2>
              <p style={S.sub}>Enter your credentials from Meta Developer Dashboard.</p>

              {error && <div style={S.errBox}><p style={S.errT}>⚠ {error}</p></div>}

              {[
                { k:'waba_id',         l:'WABA ID',           p:'624519580627601', mono:true },
                { k:'phone_number_id', l:'Phone Number ID',   p:'578790305328460', mono:true },
                { k:'access_token',    l:'System User Token', p:'EAABwz…', type:'password' },
              ].map(f => (
                <div key={f.k} style={S.field}>
                  <label style={S.label}>{f.l}</label>
                  <input required type={f.type||'text'} value={manual[f.k]}
                    onChange={e => setManual(p=>({...p,[f.k]:e.target.value}))}
                    placeholder={f.p}
                    style={{...S.input, fontFamily: f.mono ? 'monospace' : 'inherit'}}/>
                </div>
              ))}
              <button type="submit" style={S.submitBtn}>Connect Manually</button>
              <button type="button" onClick={()=>{setShowManual(false);setError('')}} style={S.backBtn}>
                ← Back to Facebook signup
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function Spin() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      style={{animation:'spin .8s linear infinite',marginRight:8,flexShrink:0}}>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity=".25"/>
      <path d="M22 12A10 10 0 0012 2" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}
function FbIco() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white" style={{marginRight:10,flexShrink:0}}>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  )
}

const S = {
  page:       {minHeight:'100vh',background:'#0d1117',display:'flex',alignItems:'center',justifyContent:'center',padding:24,fontFamily:"'Inter',system-ui,sans-serif"},
  card:       {display:'flex',width:'100%',maxWidth:900,background:'#161b22',border:'1px solid #21262d',borderRadius:20,overflow:'hidden',minHeight:520},
  left:       {width:320,flexShrink:0,background:'#0d1117',borderRight:'1px solid #21262d',padding:'36px 28px',display:'flex',flexDirection:'column',gap:16},
  logoRow:    {display:'flex',alignItems:'center',gap:10},
  logoIcon:   {width:36,height:36,borderRadius:10,background:'linear-gradient(135deg,#25D366,#128C7E)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,color:'#fff',fontSize:18},
  logoText:   {fontSize:15,fontWeight:700,color:'#e6edf3'},
  leftH:      {fontSize:17,fontWeight:700,color:'#e6edf3',margin:0},
  leftP:      {fontSize:12,color:'#7d8590',lineHeight:1.7,margin:0},
  step:       {display:'flex',alignItems:'flex-start',gap:10},
  stepN:      {width:20,height:20,borderRadius:'50%',background:'rgba(56,139,253,.12)',border:'1px solid rgba(56,139,253,.2)',color:'#388bfd',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1},
  stepT:      {fontSize:12,color:'#8b949e',lineHeight:1.5},
  debug:      {marginTop:'auto',background:'rgba(210,153,34,.06)',border:'1px solid rgba(210,153,34,.2)',borderRadius:10,padding:10},
  debugT:     {fontSize:11,fontWeight:700,color:'#d29922',margin:'0 0 6px'},
  debugL:     {fontSize:10,color:'#8b949e',margin:'2px 0',fontFamily:'monospace'},
  right:      {flex:1,padding:'36px 32px',display:'flex',flexDirection:'column',gap:16},
  h1:         {fontSize:22,fontWeight:700,color:'#e6edf3',margin:0},
  h2:         {fontSize:18,fontWeight:700,color:'#e6edf3',margin:0},
  rightP:     {fontSize:13,color:'#7d8590',margin:0},
  sub:        {fontSize:13,color:'#7d8590',margin:0},
  warnBox:    {background:'rgba(210,153,34,.08)',border:'1px solid rgba(210,153,34,.3)',borderRadius:12,padding:'12px 14px'},
  warnT:      {fontSize:12,fontWeight:700,color:'#d29922',margin:'0 0 4px'},
  warnP:      {fontSize:11,color:'rgba(210,153,34,.8)',lineHeight:1.6,margin:0},
  sdkRow:     {display:'flex',alignItems:'center',gap:8,background:'#0d1117',border:'1px solid #21262d',borderRadius:10,padding:'9px 14px'},
  dot:        {width:8,height:8,borderRadius:'50%',flexShrink:0},
  sdkT:       {fontSize:12,color:'#8b949e'},
  errBox:     {background:'rgba(248,81,73,.08)',border:'1px solid rgba(248,81,73,.25)',borderRadius:12,padding:'10px 14px'},
  errT:       {fontSize:12,color:'#f85149',fontWeight:600,margin:0},
  fbBtn:      {width:'100%',padding:'14px 20px',borderRadius:12,border:'none',fontSize:15,fontWeight:700,fontFamily:'inherit',transition:'all .15s'},
  btnRow:     {display:'flex',alignItems:'center',justifyContent:'center'},
  permBox:    {background:'rgba(255,255,255,.02)',border:'1px solid #21262d',borderRadius:12,padding:'12px 14px'},
  permT:      {fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em',color:'#484f58',margin:'0 0 8px'},
  permRow:    {display:'flex',gap:8,marginBottom:5},
  permChk:    {color:'#3fb950',fontSize:12},
  permL:      {fontSize:12,color:'#7d8590'},
  manualLink: {background:'none',border:'none',color:'#7d8590',fontSize:12,cursor:'pointer',textDecoration:'underline',fontFamily:'inherit'},
  manualForm: {display:'flex',flexDirection:'column',gap:14},
  field:      {display:'flex',flexDirection:'column',gap:6},
  label:      {fontSize:12,fontWeight:500,color:'#7d8590'},
  input:      {background:'#0d1117',border:'1px solid #30363d',borderRadius:10,padding:'10px 14px',fontSize:13,color:'#e6edf3',outline:'none'},
  submitBtn:  {background:'#238636',color:'#fff',border:'none',borderRadius:10,padding:12,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'},
  backBtn:    {background:'none',border:'none',color:'#7d8590',fontSize:12,cursor:'pointer',textDecoration:'underline',fontFamily:'inherit'},
  successCard:{textAlign:'center',maxWidth:380},
  successIcon:{width:64,height:64,borderRadius:'50%',background:'rgba(37,211,102,.1)',border:'2px solid rgba(37,211,102,.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28,margin:'0 auto 20px',color:'#25D366'},
  phoneChip:  {fontFamily:'monospace',fontSize:15,color:'#25D366',background:'rgba(37,211,102,.08)',border:'1px solid rgba(37,211,102,.2)',borderRadius:10,padding:'8px 18px',display:'inline-block',marginBottom:16},
  dashBtn:    {background:'#238636',color:'#fff',border:'none',borderRadius:10,padding:'12px 28px',fontSize:14,fontWeight:700,cursor:'pointer',fontFamily:'inherit'},
}