import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import superAdminApi from '../../services/superAdminApi'

const STATUS_STYLE = {
  active:       { bg:'rgba(63,185,80,.1)',   color:'#3fb950', border:'rgba(63,185,80,.2)'   },
  trial:        { bg:'rgba(210,153,34,.1)',  color:'#d29922', border:'rgba(210,153,34,.2)'  },
  suspended:    { bg:'rgba(248,81,73,.1)',   color:'#f85149', border:'rgba(248,81,73,.2)'   },
  pending_waba: { bg:'rgba(139,148,158,.1)', color:'#8b949e', border:'rgba(139,148,158,.2)' },
  pending:      { bg:'rgba(139,148,158,.1)', color:'#8b949e', border:'rgba(139,148,158,.2)' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_STYLE[status] || STATUS_STYLE.pending
  return (
    <span style={{ fontSize:'11px', fontWeight:'600', padding:'3px 9px', borderRadius:'99px', background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}`, textTransform:'capitalize' }}>
      {status?.replace('_', ' ')}
    </span>
  )
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ background:'#161b22', border:`1px solid ${accent ? 'rgba(248,81,73,.2)' : '#21262d'}`, borderRadius:'14px', padding:'20px 24px' }}>
      <p style={{ fontSize:'12px', color:'#8b949e', margin:'0 0 8px', fontWeight:'500', textTransform:'uppercase', letterSpacing:'.04em' }}>{label}</p>
      <p style={{ fontSize:'32px', fontWeight:'700', color: accent ? '#f85149' : '#e6edf3', margin:0, lineHeight:1 }}>{value ?? '—'}</p>
      {sub && <p style={{ fontSize:'12px', color:'#8b949e', margin:'6px 0 0' }}>{sub}</p>}
    </div>
  )
}

export default function SADashboard() {
  const [stats, setStats]       = useState(null)
  const [tenants, setTenants]   = useState([])
  const [loading, setLoading]   = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      superAdminApi.get('/super-admin/stats'),
      superAdminApi.get('/super-admin/tenants'),
    ]).then(([s, t]) => {
      setStats(s.data)
      setTenants((t.data?.tenants || []).slice(-5).reverse())
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding:'28px 32px', maxWidth:'1100px', fontFamily:"'Inter',system-ui,sans-serif", color:'#e6edf3' }}>
      <div style={{ marginBottom:'28px' }}>
        <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#e6edf3', margin:'0 0 4px' }}>Platform Dashboard</h1>
        <p style={{ fontSize:'13px', color:'#8b949e', margin:0 }}>Overview of all admins, plans, and usage</p>
      </div>

      {/* Stats grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'14px', marginBottom:'28px' }}>
        <StatCard label="Total Admins"   value={stats?.tenants?.total}         sub="registered businesses" />
        <StatCard label="Active"         value={stats?.tenants?.active}         sub="on paid or activated plan" />
        <StatCard label="Trial"          value={stats?.tenants?.trial}          sub="free trial accounts" />
        <StatCard label="WhatsApp Live"  value={stats?.tenants?.waba_connected} sub="WABA connected" accent />
      </div>

      {/* Quick actions */}
      <div style={{ display:'flex', gap:'10px', marginBottom:'28px', flexWrap:'wrap' }}>
        <button onClick={() => navigate('/super-admin/admins')}
          style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'9px 18px', borderRadius:'10px', fontSize:'13px', fontWeight:'600', border:'none', cursor:'pointer', fontFamily:'inherit', background:'#f85149', color:'#fff' }}>
          + Create Admin
        </button>
        <button onClick={() => navigate('/super-admin/plans')}
          style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'9px 18px', borderRadius:'10px', fontSize:'13px', fontWeight:'600', border:'1px solid #30363d', cursor:'pointer', fontFamily:'inherit', background:'#21262d', color:'#c9d1d9' }}>
          + Manage Plans
        </button>
      </div>

      {/* Recent admins */}
      <div style={{ background:'#161b22', border:'1px solid #21262d', borderRadius:'14px', overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #21262d', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:'14px', fontWeight:'600' }}>Recent Admins</span>
          <button onClick={() => navigate('/super-admin/admins')}
            style={{ background:'none', border:'none', color:'#388bfd', fontSize:'12px', cursor:'pointer', fontFamily:'inherit', fontWeight:'500' }}>
            View all →
          </button>
        </div>
        {loading ? (
          <div style={{ padding:'40px', textAlign:'center', color:'#8b949e', fontSize:'13px' }}>Loading…</div>
        ) : tenants.length === 0 ? (
          <div style={{ padding:'40px', textAlign:'center', color:'#8b949e', fontSize:'13px' }}>No admins yet</div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                {['Business Name','Email','Plan','Status','WhatsApp','Joined'].map(h => (
                  <th key={h} style={{ padding:'10px 16px', fontSize:'11px', fontWeight:'600', color:'#7d8590', textAlign:'left', textTransform:'uppercase', letterSpacing:'.05em', borderBottom:'1px solid #21262d' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id}
                  onClick={() => navigate('/super-admin/admins')}
                  style={{ cursor:'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.02)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <td style={{ padding:'12px 16px', fontSize:'13px', fontWeight:'500' }}>{t.business_name}</td>
                  <td style={{ padding:'12px 16px', fontSize:'12px', color:'#8b949e' }}>{t.email}</td>
                  <td style={{ padding:'12px 16px', fontSize:'12px', color:'#8b949e' }}>{t.plan_name || 'Trial'}</td>
                  <td style={{ padding:'12px 16px' }}><StatusBadge status={t.status} /></td>
                  <td style={{ padding:'12px 16px' }}>
                    <span style={{ fontSize:'12px', color: t.waba_connected ? '#3fb950' : '#6e7681', fontWeight:'500' }}>
                      {t.waba_connected ? '✓ Connected' : '✗ Not set'}
                    </span>
                  </td>
                  <td style={{ padding:'12px 16px', fontSize:'12px', color:'#8b949e' }}>
                    {t.created_at ? new Date(t.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
