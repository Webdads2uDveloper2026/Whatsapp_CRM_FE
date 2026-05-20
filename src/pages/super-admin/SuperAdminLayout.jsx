import { useState, useEffect } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { useSuperAdminStore } from '../../store/superAdminStore'
import image1 from '../../assets/webdadslogo.svg'
import image2 from '../../assets/webdadsicon.svg'

const NAV = [
  { to: '/super-admin',        emoji: '📊', label: 'Dashboard' },
  { to: '/super-admin/admins', emoji: '🏢', label: 'Admins'    },
  { to: '/super-admin/plans',  emoji: '💳', label: 'Plans'     },
]

export default function SuperAdminLayout() {
  const { superAdmin, logout, fetchMe } = useSuperAdminStore()
  const [collapsed, setCollapsed]       = useState(false)

  useEffect(() => { fetchMe() }, [])

  return (
    <div style={{ display:'flex', height:'100vh', background:'#0f1117', color:'#e6edf3', overflow:'hidden', fontFamily:"'Inter',system-ui,sans-serif" }}>

      {/* Sidebar */}
      <aside style={{ width:collapsed?'60px':'220px', flexShrink:0, display:'flex', flexDirection:'column', background:'#161b22', borderRight:'1px solid #21262d', transition:'width .2s', overflow:'hidden' }}>

        {/* Logo header */}
        <div style={{ display:'flex', alignItems:'center', gap:collapsed?0:'10px', justifyContent:collapsed?'center':'flex-start', padding:collapsed?'16px 0':'16px', height:'60px', borderBottom:'1px solid #21262d' }}>
          <div style={{ width:'32px', height:'32px', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <img src={image2} alt="Logo" style={{ width:'24px', height:'24px' }} />
          </div>
          {!collapsed && <img src={image1} alt="Logo" style={{ width:'100px', height:'32px' }} />}
          {!collapsed && (
            <button onClick={() => setCollapsed(true)} style={{ background:'none', border:'none', color:'#6e7681', cursor:'pointer', fontSize:'16px', padding:'2px 4px', marginLeft:'auto' }}>‹</button>
          )}
          {collapsed && (
            <button onClick={() => setCollapsed(false)} style={{ position:'absolute', left:'48px', background:'#161b22', border:'1px solid #21262d', borderRadius:'0 6px 6px 0', color:'#6e7681', cursor:'pointer', fontSize:'12px', padding:'4px 3px', top:'22px' }}>›</button>
          )}
        </div>

        {/* Portal badge */}
        {!collapsed && (
          <div style={{ padding:'10px 16px', borderBottom:'1px solid #21262d' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'6px', background:'rgba(248,81,73,.08)', border:'1px solid rgba(248,81,73,.2)', borderRadius:'8px', padding:'7px 10px' }}>
              <span style={{ fontSize:'13px' }}>⚡</span>
              <span style={{ fontSize:'11px', fontWeight:'700', color:'#f85149', letterSpacing:'.04em' }}>PLATFORM ADMIN</span>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex:1, padding:'8px 0', overflowY:'auto', overflowX:'hidden' }}>
          {NAV.map(({ to, emoji, label }) => (
            <NavLink key={to} to={to} end={to==='/super-admin'}
              style={({ isActive }) => ({
                display:'flex', alignItems:'center', gap:'10px',
                padding: collapsed?'10px 0':'9px 14px',
                justifyContent: collapsed?'center':'flex-start',
                margin:'1px 6px', borderRadius:'8px',
                color: isActive?'#f85149':'#8b949e',
                background: isActive?'rgba(248,81,73,.08)':'transparent',
                textDecoration:'none', fontSize:'13px', fontWeight: isActive?'500':'400',
                transition:'all .15s', borderLeft: isActive?'2px solid #f85149':'2px solid transparent',
              })}>
              <span style={{ fontSize:'15px', flexShrink:0 }}>{emoji}</span>
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Footer — super admin info + logout */}
        <div style={{ padding:'8px', borderTop:'1px solid #21262d' }}>
          {!collapsed && superAdmin && (
            <div style={{ padding:'8px 10px', marginBottom:'4px', borderRadius:'8px', background:'rgba(255,255,255,.03)' }}>
              <div style={{ fontSize:'12px', fontWeight:'600', color:'#e6edf3', marginBottom:'4px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {superAdmin.name}
              </div>
              <span style={{ fontSize:'10px', fontWeight:'700', padding:'2px 7px', borderRadius:'99px', background:'rgba(248,81,73,.1)', color:'#f85149', border:'1px solid rgba(248,81,73,.2)' }}>
                Super Admin
              </span>
            </div>
          )}
          <button onClick={logout}
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
