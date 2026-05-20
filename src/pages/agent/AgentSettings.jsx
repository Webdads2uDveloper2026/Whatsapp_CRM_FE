import { useState } from 'react'
import { useAgentStore } from '../../store/agentStore'
import agentApi from '../../services/agentApi'

const S = {
  page:    { padding:'28px 32px', maxWidth:'600px', fontFamily:"'Inter',system-ui,sans-serif", color:'#e6edf3' },
  heading: { fontSize:'20px', fontWeight:'700', color:'#e6edf3', margin:'0 0 24px' },
  tabs:    { display:'flex', gap:'4px', borderBottom:'1px solid #21262d', marginBottom:'24px' },
  tab:     { padding:'8px 16px', fontSize:'13px', fontWeight:'500', border:'none', background:'none', cursor:'pointer', borderRadius:'8px 8px 0 0', fontFamily:'inherit', transition:'all .15s', marginBottom:'-1px' },
  card:    { background:'#161b22', border:'1px solid #21262d', borderRadius:'14px', padding:'24px 28px', marginBottom:'16px' },
  label:   { display:'block', fontSize:'12px', fontWeight:'500', color:'#8b949e', marginBottom:'6px' },
  input:   { width:'100%', background:'#1c2128', border:'1px solid #30363d', borderRadius:'10px', padding:'10px 14px', fontSize:'13px', color:'#e6edf3', outline:'none', fontFamily:'inherit', boxSizing:'border-box' },
  btn:     { display:'inline-flex', alignItems:'center', gap:'6px', padding:'9px 20px', borderRadius:'10px', fontSize:'13px', fontWeight:'600', border:'none', cursor:'pointer', fontFamily:'inherit', transition:'all .15s' },
}

const onFocus = e => { e.target.style.borderColor = '#388bfd' }
const onBlur  = e => { e.target.style.borderColor = '#30363d' }

export default function AgentSettings() {
  const { agent, fetchAgentMe } = useAgentStore()
  const [tab, setTab] = useState('profile')

  // Profile
  const [name, setName]       = useState(agent?.name || '')
  const [profileMsg, setProfileMsg] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)

  // Security
  const [pwdForm, setPwdForm] = useState({ current_password:'', new_password:'' })
  const [pwdMsg, setPwdMsg]   = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)

  const saveProfile = async e => {
    e.preventDefault(); setProfileMsg(''); setProfileSaving(true)
    try {
      await agentApi.patch('/agents/me', { name })
      await fetchAgentMe()
      setProfileMsg('saved')
    } catch(e) { setProfileMsg(e.response?.data?.detail || 'Error saving') }
    setProfileSaving(false)
    setTimeout(() => setProfileMsg(''), 3000)
  }

  const changePassword = async e => {
    e.preventDefault(); setPwdMsg(''); setPwdSaving(true)
    try {
      await agentApi.post('/agents/me/change-password', pwdForm)
      setPwdMsg('saved')
      setPwdForm({ current_password:'', new_password:'' })
    } catch(e) { setPwdMsg(e.response?.data?.detail || 'Error changing password') }
    setPwdSaving(false)
    setTimeout(() => setPwdMsg(''), 3000)
  }

  return (
    <div style={S.page}>
      <h1 style={S.heading}>Settings</h1>

      <div style={S.tabs}>
        {[{ id:'profile', label:'Profile' }, { id:'security', label:'Security' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            ...S.tab,
            color:        tab === t.id ? '#e6edf3' : '#7d8590',
            borderBottom: tab === t.id ? '2px solid #388bfd' : '2px solid transparent',
            fontWeight:   tab === t.id ? 600 : 400,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <form onSubmit={saveProfile}>
          <div style={S.card}>
            <p style={{ fontSize:'14px', fontWeight:'600', color:'#e6edf3', margin:'0 0 20px' }}>👤 Profile</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              <div>
                <label style={S.label}>Full Name</label>
                <input type="text" required value={name}
                  onChange={e => setName(e.target.value)}
                  style={S.input} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label style={S.label}>Email Address</label>
                <div style={{ padding:'10px 14px', fontSize:'13px', color:'#8b949e', background:'rgba(255,255,255,.02)', border:'1px solid #21262d', borderRadius:'10px' }}>
                  {agent?.email || '—'}
                </div>
                <span style={{ fontSize:'11px', color:'#484f58', marginTop:'4px', display:'block' }}>Contact your admin to change your email.</span>
              </div>
              <div>
                <label style={S.label}>Role</label>
                <div style={{ padding:'10px 14px', fontSize:'13px', color:'#8b949e', background:'rgba(255,255,255,.02)', border:'1px solid #21262d', borderRadius:'10px', textTransform:'capitalize' }}>
                  {agent?.role || '—'}
                </div>
              </div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:'12px', paddingTop:'4px' }}>
            {profileMsg === 'saved' && <span style={{ fontSize:'12px', color:'#3fb950' }}>✓ Saved</span>}
            {profileMsg && profileMsg !== 'saved' && <span style={{ fontSize:'12px', color:'#f85149' }}>⚠ {profileMsg}</span>}
            <button type="submit" disabled={profileSaving}
              style={{ ...S.btn, background: profileSaving ? '#21262d' : '#1f6feb', color: profileSaving ? '#484f58' : '#fff', cursor: profileSaving ? 'not-allowed' : 'pointer' }}>
              {profileSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      {tab === 'security' && (
        <form onSubmit={changePassword}>
          <div style={S.card}>
            <p style={{ fontSize:'14px', fontWeight:'600', color:'#e6edf3', margin:'0 0 20px' }}>🔒 Change Password</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              <div>
                <label style={S.label}>Current Password</label>
                <input type="password" required value={pwdForm.current_password}
                  onChange={e => setPwdForm(p => ({ ...p, current_password: e.target.value }))}
                  placeholder="Your current password"
                  style={S.input} onFocus={onFocus} onBlur={onBlur} />
              </div>
              <div>
                <label style={S.label}>New Password</label>
                <input type="password" required minLength={8} value={pwdForm.new_password}
                  onChange={e => setPwdForm(p => ({ ...p, new_password: e.target.value }))}
                  placeholder="Min 8 characters"
                  style={S.input} onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:'12px', paddingTop:'4px' }}>
            {pwdMsg === 'saved' && <span style={{ fontSize:'12px', color:'#3fb950' }}>✓ Password changed</span>}
            {pwdMsg && pwdMsg !== 'saved' && <span style={{ fontSize:'12px', color:'#f85149' }}>⚠ {pwdMsg}</span>}
            <button type="submit" disabled={pwdSaving}
              style={{ ...S.btn, background: pwdSaving ? '#21262d' : '#1f6feb', color: pwdSaving ? '#484f58' : '#fff', cursor: pwdSaving ? 'not-allowed' : 'pointer' }}>
              {pwdSaving ? 'Changing…' : 'Change Password'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
