import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAgentStore } from '../../store/agentStore'
import image1 from '../../assets/zylo-logo-white.png'

const ALL_NAV = [
  { to:'/agent',             emoji:'⊞', label:'Overview',    permission: null          },
  { to:'/agent/inbox',       emoji:'💬', label:'Inbox',       permission: 'inbox'       },
  { to:'/agent/contacts',    emoji:'👥', label:'Contacts',    permission: 'contacts'    },
  { to:'/agent/broadcasts',  emoji:'📢', label:'Broadcasts',  permission: 'broadcasts'  },
  { to:'/agent/templates',   emoji:'📋', label:'Templates',   permission: 'templates'   },
  { to:'/agent/analytics',   emoji:'📊', label:'Analytics',   permission: 'analytics'   },
  { to:'/agent/automations', emoji:'⚡', label:'Automations', permission: 'automations' },
  { to:'/agent/flows',       emoji:'🔀', label:'Flows',       permission: 'automations' },
  { to:'/agent/team',        emoji:'👤', label:'Team',        permission: 'agents'      },
  { to:'/agent/settings',    emoji:'⚙️', label:'Settings',   permission: 'settings'    },
]

const ROLE_COLORS = {
  superadmin: { bg:'rgba(248,81,73,.1)',   color:'#f85149', border:'rgba(248,81,73,.2)'  },
  manager:    { bg:'rgba(56,139,253,.1)',   color:'#388bfd', border:'rgba(56,139,253,.2)' },
  agent:      { bg:'rgba(139,148,158,.1)', color:'#8b949e', border:'rgba(139,148,158,.2)'},
}

function RoleBadge({ role }) {
  const cfg = ROLE_COLORS[role] || ROLE_COLORS.agent
  return (
    <span style={{ fontSize:'10px', fontWeight:'600', padding:'2px 7px', borderRadius:'99px', background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}` }}>
      {role}
    </span>
  )
}

export default function AgentLayout() {
  const { agent, logoutAgent, fetchAgentMe, hasPermission } = useAgentStore()
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { fetchAgentMe() }, [])

  const visibleNav = ALL_NAV.filter(item =>
    item.permission === null || hasPermission(item.permission)
  )

  return (
    <div style={{ display:'flex', height:'100vh', background:'#0f1117', color:'#e6edf3', overflow:'hidden', fontFamily:"'Inter',system-ui,sans-serif" }}>

      {/* Sidebar */}
      <aside style={{ width:collapsed?'60px':'220px', flexShrink:0, display:'flex', flexDirection:'column', background:'#161b22', borderRight:'1px solid #21262d', transition:'width .2s', overflow:'hidden' }}>

        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:collapsed?0:'10px', justifyContent:collapsed?'center':'flex-start', padding:collapsed?'16px 0':'16px', height:'60px', borderBottom:'1px solid #21262d' }}>
          {!collapsed && <img src={image1} alt="Logo" style={{ width:'auto', height:'32px' }} />}
          {!collapsed && (
            <button onClick={() => setCollapsed(true)} style={{ background:'none', border:'none', color:'#6e7681', cursor:'pointer', fontSize:'16px', padding:'2px 4px', marginLeft:'auto' }}>‹</button>
          )}
          {collapsed && (
            <button onClick={() => setCollapsed(false)} style={{ position:'absolute', left:'48px', background:'#161b22', border:'1px solid #21262d', borderRadius:'0 6px 6px 0', color:'#6e7681', cursor:'pointer', fontSize:'12px', padding:'4px 3px', top:'22px' }}>›</button>
          )}
        </div>

        {/* Agent info */}
        {!collapsed && agent && (
          <div style={{ padding:'12px 16px', borderBottom:'1px solid #21262d', display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ width:'30px', height:'30px', borderRadius:'50%', background:'linear-gradient(135deg,#8957e5,#388bfd)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'700', color:'#fff', fontSize:'12px', flexShrink:0 }}>
              {agent.avatar_initials || agent.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div style={{ minWidth:0, flex:1 }}>
              <div style={{ fontSize:'12px', fontWeight:'600', color:'#e6edf3', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{agent.name}</div>
              <div style={{ marginTop:'3px' }}><RoleBadge role={agent.role} /></div>
            </div>
          </div>
        )}

        {/* Nav items */}
        <nav style={{ flex:1, padding:'8px 0', overflowY:'auto', overflowX:'hidden' }}>
          {visibleNav.map(({ to, emoji, label }) => (
            <NavLink key={to} to={to} end={to==='/agent'}
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
          <button onClick={logoutAgent}
            style={{ width:'100%', display:'flex', alignItems:'center', gap:'8px', justifyContent:collapsed?'center':'flex-start', padding:collapsed?'10px 0':'9px 12px', background:'none', border:'none', color:'#8b949e', cursor:'pointer', fontSize:'13px', borderRadius:'8px', fontFamily:'inherit' }}
            onMouseEnter={e => { e.currentTarget.style.color='#f85149'; e.currentTarget.style.background='rgba(248,81,73,.08)' }}
            onMouseLeave={e => { e.currentTarget.style.color='#8b949e'; e.currentTarget.style.background='none' }}>
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
