import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import image1 from '../../assets/webdadslogo.svg'
import image2 from '../../assets/webdadsicon.svg'

const NAV = [
  { to:'/dashboard',            emoji:'⊞', label:'Dashboard'   },
  { to:'/dashboard/inbox',      emoji:'💬', label:'Inbox'       },
  { to:'/dashboard/contacts',   emoji:'👥', label:'Contacts'    },
  { to:'/dashboard/broadcasts', emoji:'📢', label:'Broadcasts'  },
  { to:'/dashboard/templates',  emoji:'📋', label:'Templates'   },
  { to:'/dashboard/analytics',  emoji:'📊', label:'Analytics'   },
  { to:'/dashboard/automations',emoji:'⚡', label:'Automations' },
  { to:'/dashboard/flows',      emoji:'🔀', label:'Flows'       },
  { to:'/dashboard/agents',     emoji:'👤', label:'Agents'      },
  { to:'/dashboard/settings',   emoji:'⚙️', label:'Settings'    },
]

export default function Layout() {
  const { tenant, logout, fetchMe } = useAuthStore()
  const [collapsed, setCollapsed]   = useState(false)
  const navigate = useNavigate()
  useEffect(()=>{ fetchMe() },[])

  return (
    <div style={{ display:'flex', height:'100vh', background:'#0f1117', color:'#e6edf3', overflow:'hidden', fontFamily:"'Inter',system-ui,sans-serif" }}>

      {/* Sidebar */}
      <aside style={{ width:collapsed?'60px':'220px', flexShrink:0, display:'flex', flexDirection:'column', background:'#161b22', borderRight:'1px solid #21262d', transition:'width .2s', overflow:'hidden' }}>

        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:collapsed?0:'10px', justifyContent:collapsed?'center':'flex-start', padding:collapsed?'16px 0':'16px', height:'60px', borderBottom:'1px solid #21262d' }}>
          <div style={{ width:'32px', height:'32px', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', color:'#fff', fontSize:'14px', flexShrink:0 }}><img src={image2} alt="Logo" style={{ width:'24px', height:'24px' }} /></div>
          {/* {!collapsed && <span style={{ fontSize:'14px', fontWeight:'600', flex:1 }}>WA CRM</span>} */}
          {!collapsed && <img src={image1} alt="Logo" style={{ width:'100px', height:'32px' }}   /  >}
          {!collapsed && (
            <button onClick={()=>setCollapsed(true)} style={{ background:'none', border:'none', color:'#6e7681', cursor:'pointer', fontSize:'16px', padding:'2px 4px' }}>‹</button>
          )}
          {collapsed && (
            <button onClick={()=>setCollapsed(false)} style={{ position:'absolute', left:'48px', background:'#161b22', border:'1px solid #21262d', borderRadius:'0 6px 6px 0', color:'#6e7681', cursor:'pointer', fontSize:'12px', padding:'4px 3px', top:'22px' }}>›</button>
          )}
        </div>

        {/* Tenant info */}
        {!collapsed && tenant && (
          <div style={{ padding:'12px 16px', borderBottom:'1px solid #21262d', display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:'30px', height:'30px', borderRadius:'7px', background:'#8957e5', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', color:'#fff', fontSize:'12px', flexShrink:0 }}>
              {tenant.businessName?.[0]?.toUpperCase()||'T'}
            </div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:'12px', fontWeight:'600', color:'#e6edf3', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tenant.businessName}</div>
              <div style={{ fontSize:'11px', color: tenant.wabaConnected?'#3fb950':'#8b949e', marginTop:'2px', display:'flex', alignItems:'center', gap:'4px' }}>
                <span style={{ width:'6px', height:'6px', borderRadius:'50%', background: tenant.wabaConnected?'#3fb950':'#6e7681', display:'inline-block' }}/>
                {tenant.wabaConnected ? 'Connected' : 'Not connected'}
              </div>
            </div>
          </div>
        )}

        {/* Nav items */}
        <nav style={{ flex:1, padding:'8px 0', overflowY:'auto', overflowX:'hidden' }}>
          {NAV.map(({ to, emoji, label }) => (
            <NavLink key={to} to={to} end={to==='/dashboard'}
              style={({ isActive }) => ({
                display:'flex', alignItems:'center', gap:'10px',
                padding: collapsed?'10px 0':'9px 14px',
                justifyContent: collapsed?'center':'flex-start',
                margin:'1px 6px', borderRadius:'8px',
                color: isActive?'#388bfd':'#8b949e',
                background: isActive?'rgba(56,139,253,.1)':'transparent',
                textDecoration:'none', fontSize:'13px', fontWeight: isActive?'500':'400',
                transition:'all .15s', borderLeft: isActive?'2px solid #388bfd':'2px solid transparent',
              })}>
              <span style={{ fontSize:'15px', flexShrink:0 }}>{emoji}</span>
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding:'8px', borderTop:'1px solid #21262d' }}>
          {!collapsed && !tenant?.wabaConnected && (
            <button onClick={()=>navigate('/onboarding')}
              style={{ width:'100%', background:'rgba(210,153,34,.1)', border:'1px solid rgba(210,153,34,.2)', color:'#d29922', borderRadius:'8px', padding:'8px', fontSize:'12px', fontWeight:'600', cursor:'pointer', marginBottom:'6px', fontFamily:'inherit' }}>
              ⚡ Connect WhatsApp
            </button>
          )}
          <button onClick={logout}
            style={{ width:'100%', display:'flex', alignItems:'center', gap:'8px', justifyContent:collapsed?'center':'flex-start', padding:collapsed?'10px 0':'9px 12px', background:'none', border:'none', color:'#8b949e', cursor:'pointer', fontSize:'13px', borderRadius:'8px', fontFamily:'inherit' }}
            onMouseEnter={e=>{ e.currentTarget.style.color='#f85149'; e.currentTarget.style.background='rgba(248,81,73,.08)' }}
            onMouseLeave={e=>{ e.currentTarget.style.color='#8b949e'; e.currentTarget.style.background='none' }}>
            <span>↩</span>
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex:1, overflowY:'auto', overflowX:'hidden', minWidth:0 }}>
        <Outlet />
      </main>
    </div>
  )
}