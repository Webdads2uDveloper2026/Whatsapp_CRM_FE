import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

/**
 * This page handles the redirect from Google OAuth.
 * Route: /auth/google/success
 * 
 * Google → Backend → Frontend (/auth/google/success?access_token=...&next=/dashboard)
 * This page reads the tokens, stores them, then redirects to the correct page.
 */
export default function GoogleCallback() {
  const [params]    = useSearchParams()
  const navigate    = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    const accessToken  = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const next         = params.get('next') || '/dashboard'
    const err          = params.get('error')

    if (err) {
      const messages = {
        google_cancelled:      'Google sign-in was cancelled.',
        google_token_failed:   'Failed to get Google token. Try again.',
        google_userinfo_failed:'Could not get Google account info.',
        google_no_email:       'No email returned from Google.',
      }
      setError(messages[err] || 'Google sign-in failed. Try again.')
      setTimeout(() => navigate('/login'), 3000)
      return
    }

    if (accessToken) {
      localStorage.setItem('access_token',  accessToken)
      if (refreshToken) localStorage.setItem('refresh_token', refreshToken)
      navigate(next)
    } else {
      setError('No token received. Try again.')
      setTimeout(() => navigate('/login'), 3000)
    }
  }, [])

  if (error) return (
    <div style={{ minHeight:'100vh', background:'#0d1117', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Inter',system-ui,sans-serif", color:'#e6edf3' }}>
      <div style={{ textAlign:'center' }}>
        <p style={{ fontSize:'16px', color:'#f85149', marginBottom:'8px' }}>⚠ {error}</p>
        <p style={{ fontSize:'13px', color:'#7d8590' }}>Redirecting to login…</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#0d1117', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Inter',system-ui,sans-serif", color:'#e6edf3' }}>
      <div style={{ textAlign:'center' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ animation:'spin .8s linear infinite', marginBottom:'16px' }}>
          <circle cx="12" cy="12" r="10" stroke="#388bfd" strokeWidth="3" strokeOpacity=".25"/>
          <path d="M22 12A10 10 0 0012 2" stroke="#388bfd" strokeWidth="3" strokeLinecap="round"/>
        </svg>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{ fontSize:'14px', color:'#7d8590' }}>Signing you in…</p>
      </div>
    </div>
  )
}