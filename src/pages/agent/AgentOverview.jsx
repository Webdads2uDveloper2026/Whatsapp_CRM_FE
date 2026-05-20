import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAgentStore } from '../../store/agentStore'
import agentApi from '../../services/agentApi'

const PERM_COLORS = {
  inbox:       { bg:'rgba(56,139,253,.08)',  color:'#388bfd',  border:'rgba(56,139,253,.2)'  },
  contacts:    { bg:'rgba(63,185,80,.08)',   color:'#3fb950',  border:'rgba(63,185,80,.2)'   },
  broadcasts:  { bg:'rgba(210,153,34,.08)',  color:'#d29922',  border:'rgba(210,153,34,.2)'  },
  templates:   { bg:'rgba(137,87,229,.08)',  color:'#8957e5',  border:'rgba(137,87,229,.2)'  },
  automations: { bg:'rgba(248,81,73,.08)',   color:'#f85149',  border:'rgba(248,81,73,.2)'   },
  analytics:   { bg:'rgba(56,139,253,.08)',  color:'#388bfd',  border:'rgba(56,139,253,.2)'  },
  settings:    { bg:'rgba(139,148,158,.08)', color:'#8b949e',  border:'rgba(139,148,158,.2)' },
  agents:      { bg:'rgba(248,81,73,.08)',   color:'#f85149',  border:'rgba(248,81,73,.2)'   },
}

const ROLE_COLORS = {
  superadmin: { bg:'rgba(248,81,73,.1)',   color:'#f85149', border:'rgba(248,81,73,.2)'  },
  manager:    { bg:'rgba(56,139,253,.1)',   color:'#388bfd', border:'rgba(56,139,253,.2)' },
  agent:      { bg:'rgba(139,148,158,.1)', color:'#8b949e', border:'rgba(139,148,158,.2)'},
}

export default function AgentOverview() {
  const { agent, isSuperAdmin } = useAgentStore()
  const [agentCount, setAgentCount] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (isSuperAdmin()) {
      agentApi.get('/agents').then(r => setAgentCount(r.data?.length ?? 0)).catch(() => {})
    }
  }, [])

  const roleColor = ROLE_COLORS[agent?.role] || ROLE_COLORS.agent

  return (
    <div style={{ padding:'28px 32px', maxWidth:'900px', fontFamily:"'Inter',system-ui,sans-serif", color:'#e6edf3' }}>
      {/* Header */}
      <div style={{ marginBottom:'28px' }}>
        <h1 style={{ fontSize:'22px', fontWeight:'700', color:'#e6edf3', marginBottom:'6px' }}>
          Welcome back, {agent?.name || 'Agent'}
        </h1>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <span style={{ fontSize:'13px', color:'#8b949e' }}>Signed in as</span>
          <span style={{ fontSize:'11px', fontWeight:'600', padding:'3px 9px', borderRadius:'99px', background:roleColor.bg, color:roleColor.color, border:`1px solid ${roleColor.border}` }}>
            {agent?.role}
          </span>
        </div>
      </div>

      {/* Stats row for superadmin */}
      {isSuperAdmin() && agentCount !== null && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'14px', marginBottom:'28px' }}>
          <div style={{ background:'#161b22', border:'1px solid #21262d', borderRadius:'14px', padding:'20px 24px' }}>
            <p style={{ fontSize:'12px', color:'#8b949e', margin:'0 0 8px', fontWeight:'500' }}>Total Agents</p>
            <p style={{ fontSize:'28px', fontWeight:'700', color:'#e6edf3', margin:0 }}>{agentCount}</p>
          </div>
          <div style={{ background:'#161b22', border:'1px solid rgba(56,139,253,.25)', borderRadius:'14px', padding:'20px 24px', cursor:'pointer' }}
            onClick={() => navigate('/agent/team')}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#388bfd'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(56,139,253,.25)'}>
            <p style={{ fontSize:'12px', color:'#388bfd', margin:'0 0 8px', fontWeight:'500' }}>Team Management</p>
            <p style={{ fontSize:'13px', color:'#8b949e', margin:0 }}>Manage agents & permissions →</p>
          </div>
        </div>
      )}

      {/* Your permissions */}
      <div style={{ background:'#161b22', border:'1px solid #21262d', borderRadius:'14px', padding:'24px 28px' }}>
        <p style={{ fontSize:'14px', fontWeight:'600', color:'#e6edf3', margin:'0 0 16px' }}>Your Permissions</p>
        {agent?.permissions?.length === 0 ? (
          <p style={{ fontSize:'13px', color:'#8b949e' }}>No permissions assigned.</p>
        ) : (
          <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
            {(agent?.permissions || []).map(perm => {
              const cfg = PERM_COLORS[perm] || PERM_COLORS.settings
              return (
                <span key={perm} style={{ fontSize:'12px', fontWeight:'500', padding:'5px 12px', borderRadius:'8px', background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}` }}>
                  {perm}
                </span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
