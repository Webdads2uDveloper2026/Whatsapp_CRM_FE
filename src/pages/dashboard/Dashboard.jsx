import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import api from '../../services/api'

const CARDS = [
  { key:['contacts','total'],        label:'Total Contacts',  color:'#388bfd', bg:'rgba(56,139,253,.1)',  icon:'👥' },
  { key:['contacts','opted_in'],     label:'Opted In',        color:'#3fb950', bg:'rgba(63,185,80,.1)',   icon:'✅' },
  { key:['conversations','open'],    label:'Open Chats',      color:'#a371f7', bg:'rgba(163,113,247,.1)', icon:'💬' },
  { key:['messages','outbound'],     label:'Messages Sent',   color:'#79c0ff', bg:'rgba(121,192,255,.1)', icon:'📤' },
  { key:['messages','inbound'],      label:'Messages Received',color:'#8b949e',bg:'rgba(139,148,158,.1)', icon:'📥' },
  { key:['messages','delivery_rate'],label:'Delivery Rate',   color:'#3fb950', bg:'rgba(63,185,80,.1)',   icon:'📦', pct:true },
  { key:['messages','read_rate'],    label:'Read Rate',       color:'#d29922', bg:'rgba(210,153,34,.1)',  icon:'👁',  pct:true },
  { key:['messages','failed'],       label:'Failed',          color:'#f85149', bg:'rgba(248,81,73,.1)',   icon:'⚠️' },
]

const get = (obj, keys) => keys.reduce((o,k) => o?.[k], obj)

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [days, setDays]   = useState(7)
  const { tenant }        = useAuthStore()
  const navigate          = useNavigate()

  useEffect(() => {
    api.get(`/analytics/overview?days=${days}`).then(r=>setStats(r.data)).catch(()=>{})
  },[days])

  return (
    <div style={{ padding:'28px 32px', maxWidth:'1200px', fontFamily:"'Inter',system-ui,sans-serif", color:'#e6edf3' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'16px' }}>
        <div>
          <h1 style={{ fontSize:'20px', fontWeight:'700', color:'#e6edf3' }}>Dashboard</h1>
          <p style={{ fontSize:'13px', color:'#8b949e', marginTop:'3px' }}>
            {tenant?.businessName ? `Welcome back, ${tenant.businessName}` : 'Your WhatsApp activity overview'}
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          {!tenant?.wabaConnected && (
            <button onClick={()=>navigate('/onboarding')}
              style={{ display:'flex', alignItems:'center', gap:'6px', background:'rgba(210,153,34,.1)', border:'1px solid rgba(210,153,34,.2)', color:'#d29922', borderRadius:'10px', padding:'8px 14px', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>
              ⚡ Connect WhatsApp
            </button>
          )}
          <select value={days} onChange={e=>setDays(Number(e.target.value))}
            style={{ background:'#161b22', border:'1px solid #30363d', color:'#c9d1d9', borderRadius:'10px', padding:'8px 12px', fontSize:'13px', outline:'none', cursor:'pointer', fontFamily:'inherit' }}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Warning banner */}
      {tenant && !tenant.wabaConnected && (
        <div style={{ display:'flex', alignItems:'center', gap:'14px', background:'rgba(210,153,34,.08)', border:'1px solid rgba(210,153,34,.2)', borderRadius:'14px', padding:'16px 20px', marginBottom:'24px' }}>
          <span style={{ fontSize:'24px' }}>📱</span>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:'13px', fontWeight:'600', color:'#d29922' }}>WhatsApp not connected</p>
            <p style={{ fontSize:'12px', color:'rgba(210,153,34,.7)', marginTop:'2px' }}>Connect your WhatsApp Business Account to start sending and receiving messages.</p>
          </div>
          <button onClick={()=>navigate('/onboarding')}
            style={{ background:'#d29922', border:'none', color:'#000', borderRadius:'8px', padding:'8px 16px', fontSize:'12px', fontWeight:'700', cursor:'pointer', whiteSpace:'nowrap', fontFamily:'inherit' }}>
            Connect now
          </button>
        </div>
      )}

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'16px', marginBottom:'28px' }}>
        {CARDS.map(c => {
          const raw = stats ? get(stats, c.key) : null
          const val = raw !== null && raw !== undefined ? (c.pct ? `${raw}%` : raw) : null
          return (
            <div key={c.label} style={{ background:'#161b22', border:'1px solid #21262d', borderRadius:'14px', padding:'20px', transition:'border-color .15s' }}
              onMouseEnter={e=>e.currentTarget.style.borderColor='#30363d'}
              onMouseLeave={e=>e.currentTarget.style.borderColor='#21262d'}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
                <span style={{ fontSize:'22px' }}>{c.icon}</span>
                <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:c.color, opacity:.6 }} />
              </div>
              {val !== null ? (
                <p style={{ fontSize:'26px', fontWeight:'700', color:c.color, marginBottom:'4px', lineHeight:1.1 }}>{val}</p>
              ) : (
                <div style={{ height:'28px', background:'#21262d', borderRadius:'6px', marginBottom:'4px', animation:'pulse 1.5s infinite' }} />
              )}
              <p style={{ fontSize:'11px', fontWeight:'600', textTransform:'uppercase', letterSpacing:'.05em', color:'#8b949e' }}>{c.label}</p>
            </div>
          )
        })}
      </div>

      {/* Quick actions */}
      <h2 style={{ fontSize:'13px', fontWeight:'600', color:'#8b949e', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:'14px' }}>Quick Actions</h2>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'14px' }}>
        {[
          { to:'/dashboard/inbox',      icon:'💬', title:'Open Inbox',        desc:'View and reply to conversations',     grad:'rgba(56,139,253,.15)',  border:'rgba(56,139,253,.2)' },
          { to:'/dashboard/contacts',   icon:'👥', title:'Manage Contacts',   desc:'Add, edit and organise your leads',   grad:'rgba(163,113,247,.15)', border:'rgba(163,113,247,.2)' },
          { to:'/dashboard/broadcasts', icon:'📢', title:'Send Broadcast',    desc:'Reach all opted-in contacts at once', grad:'rgba(63,185,80,.15)',   border:'rgba(63,185,80,.2)' },
          { to:'/dashboard/templates',  icon:'📋', title:'Manage Templates',  desc:'Create and sync WhatsApp templates',  grad:'rgba(210,153,34,.15)',  border:'rgba(210,153,34,.2)' },
        ].map(q => (
          <button key={q.to} onClick={()=>navigate(q.to)}
            style={{ textAlign:'left', padding:'20px', background:`linear-gradient(135deg,${q.grad},transparent)`, border:`1px solid ${q.border}`, borderRadius:'14px', cursor:'pointer', transition:'all .15s', fontFamily:'inherit', color:'inherit' }}
            onMouseEnter={e=>{ e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.3)' }}
            onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='none' }}>
            <div style={{ fontSize:'28px', marginBottom:'12px' }}>{q.icon}</div>
            <p style={{ fontSize:'13px', fontWeight:'600', color:'#e6edf3', marginBottom:'4px' }}>{q.title}</p>
            <p style={{ fontSize:'12px', color:'#8b949e' }}>{q.desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
}