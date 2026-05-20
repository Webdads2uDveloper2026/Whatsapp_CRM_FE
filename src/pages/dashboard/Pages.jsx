import { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import api from '../../services/api'

// Shared styles
const S = {
  page:    { padding:'28px 32px', maxWidth:'1200px', fontFamily:"'Inter',system-ui,sans-serif", color:'#e6edf3' },
  hdr:     { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'14px' },
  h1:      { fontSize:'20px', fontWeight:'700', color:'#e6edf3' },
  badge:   { background:'#21262d', border:'1px solid #30363d', color:'#8b949e', fontSize:'12px', fontWeight:'600', padding:'2px 8px', borderRadius:'99px' },
  btn:     { display:'inline-flex', alignItems:'center', gap:'6px', padding:'8px 16px', borderRadius:'10px', fontSize:'12px', fontWeight:'600', border:'none', cursor:'pointer', fontFamily:'inherit', transition:'all .15s' },
  input:   { width:'100%', background:'#1c2128', border:'1px solid #30363d', borderRadius:'10px', padding:'10px 14px', fontSize:'13px', color:'#e6edf3', outline:'none', fontFamily:'inherit' },
  label:   { display:'block', fontSize:'12px', fontWeight:'500', color:'#8b949e', marginBottom:'6px' },
  card:    { background:'#161b22', border:'1px solid #21262d', borderRadius:'14px' },
  table:   { width:'100%', borderCollapse:'collapse' },
  th:      { padding:'11px 16px', textAlign:'left', fontSize:'11px', fontWeight:'600', textTransform:'uppercase', letterSpacing:'.06em', color:'#8b949e', background:'rgba(255,255,255,.02)', borderBottom:'1px solid #21262d' },
  td:      { padding:'13px 16px', fontSize:'13px', color:'#c9d1d9', borderBottom:'1px solid #21262d' },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'20px', backdropFilter:'blur(3px)' },
  modal:   { background:'#161b22', border:'1px solid #30363d', borderRadius:'16px', width:'100%', maxWidth:'480px', padding:'28px', boxShadow:'0 24px 64px rgba(0,0,0,.6)', maxHeight:'90vh', overflowY:'auto' },
  mh:      { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px' },
  mclose:  { background:'none', border:'none', color:'#8b949e', fontSize:'20px', cursor:'pointer', lineHeight:1, fontFamily:'inherit' },
  mfoot:   { display:'flex', justifyContent:'flex-end', gap:'10px', paddingTop:'16px', borderTop:'1px solid #21262d', marginTop:'20px' },
}

const statusBadge = (status, map) => {
  const cfg = map[status] || map.default || { bg:'rgba(139,148,158,.1)', color:'#8b949e', border:'rgba(139,148,158,.2)' }
  return <span style={{ fontSize:'11px', fontWeight:'600', padding:'3px 9px', borderRadius:'99px', background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}` }}>{status}</span>
}

// ── Analytics ─────────────────────────────────────────────────────────────────
export function Analytics() {
  const [stats,setStats]=useState(null)
  const [days,setDays]=useState(7)
  useEffect(()=>{ api.get(`/analytics/overview?days=${days}`).then(r=>setStats(r.data)).catch(()=>{}) },[days])

  const rows=[
    {l:'Total Contacts',  v:stats?.contacts?.total,                   c:'#388bfd'},
    {l:'Opted In',        v:stats?.contacts?.opted_in,                 c:'#3fb950'},
    {l:'Open Chats',      v:stats?.conversations?.open,                c:'#a371f7'},
    {l:'Messages Sent',   v:stats?.messages?.outbound,                 c:'#79c0ff'},
    {l:'Messages Received',v:stats?.messages?.inbound,                 c:'#8b949e'},
    {l:'Failed',          v:stats?.messages?.failed,                   c:'#f85149'},
    {l:'Delivery Rate',   v:stats?`${stats.messages?.delivery_rate}%`:null, c:'#3fb950'},
    {l:'Read Rate',       v:stats?`${stats.messages?.read_rate}%`:null,     c:'#d29922'},
  ]

  return (
    <div style={S.page}>
      <div style={S.hdr}>
        <h1 style={S.h1}>Analytics</h1>
        <select value={days} onChange={e=>setDays(Number(e.target.value))}
          style={{background:'#161b22',border:'1px solid #30363d',color:'#c9d1d9',borderRadius:'10px',padding:'8px 12px',fontSize:'13px',outline:'none',cursor:'pointer',fontFamily:'inherit'}}>
          <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
        </select>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:'16px'}}>
        {rows.map(r=>(
          <div key={r.l} style={{background:'#161b22',border:'1px solid #21262d',borderRadius:'14px',padding:'20px'}}>
            {r.v!==null&&r.v!==undefined
              ? <p style={{fontSize:'26px',fontWeight:'700',color:r.c,marginBottom:'6px',lineHeight:1.1}}>{r.v??'—'}</p>
              : <div style={{height:'28px',background:'#21262d',borderRadius:'6px',marginBottom:'6px'}}/>}
            <p style={{fontSize:'11px',fontWeight:'600',textTransform:'uppercase',letterSpacing:'.05em',color:'#8b949e'}}>{r.l}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Templates ─────────────────────────────────────────────────────────────────
export function Templates() {
  const [templates,setTemplates]=useState([])
  const [syncing,setSyncing]=useState(false)
  const [show,setShow]=useState(false)
  const [form,setForm]=useState({name:'',category:'MARKETING',language:'en_US',body_text:'',header_text:'',footer_text:'',body_example:''})

  const load=()=>api.get('/templates/local').then(r=>setTemplates(r.data.templates||[])).catch(()=>{})
  useEffect(()=>{load()},[])

  const sync=async()=>{ setSyncing(true); try{await api.post('/templates/sync');load()}catch(e){alert(e.response?.data?.detail||'Sync failed')} setSyncing(false) }

  const create=async e=>{
    e.preventDefault()
    const comps=[]
    if(form.header_text) comps.push({type:'HEADER',format:'TEXT',text:form.header_text})
    const body={type:'BODY',text:form.body_text}
    if(form.body_example) body.example={body_text:[form.body_example.split(',').map(v=>v.trim())]}
    comps.push(body)
    if(form.footer_text) comps.push({type:'FOOTER',text:form.footer_text})
    try{await api.post('/templates',{name:form.name,category:form.category,language:form.language,components:comps});setShow(false);load()}
    catch(e){alert(e.response?.data?.detail||'Create failed')}
  }

  const ST={APPROVED:{bg:'rgba(63,185,80,.1)',color:'#3fb950',border:'rgba(63,185,80,.2)'},PENDING:{bg:'rgba(210,153,34,.1)',color:'#d29922',border:'rgba(210,153,34,.2)'},REJECTED:{bg:'rgba(248,81,73,.1)',color:'#f85149',border:'rgba(248,81,73,.2)'},PAUSED:{bg:'rgba(139,148,158,.1)',color:'#8b949e',border:'rgba(139,148,158,.2)'}}

  return (
    <div style={S.page}>
      <div style={S.hdr}>
        <h1 style={S.h1}>Templates</h1>
        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={sync} disabled={syncing} style={{...S.btn,background:'#21262d',color:'#c9d1d9',border:'1px solid #30363d',opacity:syncing?.5:1}}>
            {syncing?'↺ Syncing…':'↺ Sync from Meta'}
          </button>
          <button onClick={()=>setShow(true)} style={{...S.btn,background:'#1f6feb',color:'#fff'}}>+ Create Template</button>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:'16px'}}>
        {templates.length===0&&(
          <div style={{gridColumn:'1/-1',background:'#161b22',border:'1px solid #21262d',borderRadius:'14px',padding:'48px',textAlign:'center',color:'#8b949e'}}>
            <p style={{fontSize:'36px',marginBottom:'12px',opacity:.3}}>📋</p>
            <p style={{fontSize:'13px'}}>No templates yet. Sync from Meta or create one.</p>
          </div>
        )}
        {templates.map(t=>(
          <div key={t.id} style={{background:'#161b22',border:'1px solid #21262d',borderRadius:'14px',padding:'18px',transition:'border-color .15s'}}
            onMouseEnter={e=>e.currentTarget.style.borderColor='#30363d'} onMouseLeave={e=>e.currentTarget.style.borderColor='#21262d'}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px',marginBottom:'6px'}}>
              <span style={{fontSize:'13px',fontFamily:'monospace',fontWeight:'600',color:'#e6edf3',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.name}</span>
              {statusBadge(t.status,ST)}
            </div>
            <p style={{fontSize:'11px',color:'#8b949e',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:'10px'}}>{t.category} · {t.language}</p>
            {t.components?.find(c=>c.type==='BODY')&&(
              <p style={{fontSize:'12px',color:'#8b949e',borderLeft:'2px solid #30363d',paddingLeft:'10px',lineHeight:1.5,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>
                {t.components.find(c=>c.type==='BODY').text}
              </p>
            )}
          </div>
        ))}
      </div>

      {show&&(
        <div style={S.overlay} onClick={()=>setShow(false)}>
          <div style={S.modal} onClick={e=>e.stopPropagation()}>
            <div style={S.mh}><h2 style={{fontSize:'16px',fontWeight:'600'}}>Create Template</h2><button onClick={()=>setShow(false)} style={S.mclose}>×</button></div>
            <form onSubmit={create} style={{display:'flex',flexDirection:'column',gap:'14px'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px'}}>
                <div style={{gridColumn:'1/3'}}>
                  <label style={S.label}>Template name</label>
                  <input required value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="order_confirm" style={S.input}
                    onFocus={e=>e.target.style.borderColor='#388bfd'} onBlur={e=>e.target.style.borderColor='#30363d'} />
                </div>
                <div>
                  <label style={S.label}>Language</label>
                  <input value={form.language} onChange={e=>setForm(p=>({...p,language:e.target.value}))} style={S.input}
                    onFocus={e=>e.target.style.borderColor='#388bfd'} onBlur={e=>e.target.style.borderColor='#30363d'} />
                </div>
              </div>
              <div>
                <label style={S.label}>Category</label>
                <select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}
                  style={{...S.input,cursor:'pointer',appearance:'none'}}>
                  <option>MARKETING</option><option>UTILITY</option><option>AUTHENTICATION</option>
                </select>
              </div>
              {[{k:'header_text',l:'Header (optional)',p:'Hello {{1}}'},{k:'footer_text',l:'Footer (optional)',p:'Reply STOP to opt out'},{k:'body_example',l:'Example values (comma separated)',p:'John, ORD-123'}].map(f=>(
                <div key={f.k}>
                  <label style={S.label}>{f.l}</label>
                  <input value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.p} style={S.input}
                    onFocus={e=>e.target.style.borderColor='#388bfd'} onBlur={e=>e.target.style.borderColor='#30363d'} />
                </div>
              ))}
              <div>
                <label style={S.label}>Body text <span style={{color:'#f85149'}}>*</span></label>
                <textarea required rows={4} value={form.body_text} onChange={e=>setForm(p=>({...p,body_text:e.target.value}))}
                  placeholder="Hi {{1}}, your order #{{2}} is confirmed."
                  style={{...S.input,resize:'vertical',minHeight:'80px'}}
                  onFocus={e=>e.target.style.borderColor='#388bfd'} onBlur={e=>e.target.style.borderColor='#30363d'} />
              </div>
              <div style={S.mfoot}>
                <button type="button" onClick={()=>setShow(false)} style={{...S.btn,background:'#21262d',color:'#c9d1d9',border:'1px solid #30363d'}}>Cancel</button>
                <button type="submit" style={{...S.btn,background:'#1f6feb',color:'#fff'}}>Submit for approval</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Broadcasts ────────────────────────────────────────────────────────────────
export function Broadcasts() {
  const [broadcasts,setBroadcasts]=useState([])
  const [total,setTotal]=useState(0)
  const [show,setShow]=useState(false)
  const [form,setForm]=useState({name:'',template_name:'',template_language:'en_US',audience_type:'all',audience_tags:''})

  const load=()=>api.get('/broadcasts').then(r=>{setBroadcasts(r.data.broadcasts||[]);setTotal(r.data.total||0)}).catch(()=>{})
  useEffect(()=>{load()},[])

  const create=async e=>{
    e.preventDefault()
    try{await api.post('/broadcasts',{...form,audience_tags:form.audience_tags.split(',').map(t=>t.trim()).filter(Boolean)});setShow(false);load()}
    catch(e){alert(e.response?.data?.detail||'Error')}
  }
  const send=async id=>{
    if(!confirm('Send this broadcast now?')) return
    try{await api.post(`/broadcasts/${id}/send`);load()}catch(e){alert(e.response?.data?.detail||'Error')}
  }

  const ST={draft:{bg:'rgba(139,148,158,.1)',color:'#8b949e',border:'rgba(139,148,158,.2)'},queued:{bg:'rgba(56,139,253,.1)',color:'#388bfd',border:'rgba(56,139,253,.2)'},running:{bg:'rgba(210,153,34,.1)',color:'#d29922',border:'rgba(210,153,34,.2)'},completed:{bg:'rgba(63,185,80,.1)',color:'#3fb950',border:'rgba(63,185,80,.2)'},failed:{bg:'rgba(248,81,73,.1)',color:'#f85149',border:'rgba(248,81,73,.2)'},cancelled:{bg:'rgba(139,148,158,.1)',color:'#8b949e',border:'rgba(139,148,158,.2)'}}

  return (
    <div style={S.page}>
      <div style={S.hdr}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <h1 style={S.h1}>Broadcasts</h1>
          <span style={S.badge}>{total}</span>
        </div>
        <button onClick={()=>setShow(true)} style={{...S.btn,background:'#1f6feb',color:'#fff'}}>+ New Broadcast</button>
      </div>
      <div style={S.card}>
        <table style={S.table}>
          <thead><tr>{['Name','Template','Status','Recipients','Sent',''].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {broadcasts.length===0&&<tr><td colSpan={6}>
              <div style={{textAlign:'center',padding:'48px',color:'#8b949e'}}>
                <p style={{fontSize:'32px',marginBottom:'10px',opacity:.3}}>📢</p>
                <p style={{fontSize:'13px'}}>No broadcasts yet</p>
              </div>
            </td></tr>}
            {broadcasts.map(b=>(
              <tr key={b.id} style={{transition:'background .12s'}}
                onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,.02)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <td style={S.td}><span style={{fontWeight:'500',color:'#e6edf3'}}>{b.name}</span></td>
                <td style={S.td}><span style={{fontFamily:'monospace',fontSize:'12px',color:'#8b949e'}}>{b.template_name}</span></td>
                <td style={S.td}>{statusBadge(b.status,ST)}</td>
                <td style={S.td}>{b.total_recipients||'—'}</td>
                <td style={S.td}>{b.sent_count||'—'}</td>
                <td style={S.td}>
                  {b.status==='draft'&&<button onClick={()=>send(b.id)} style={{...S.btn,padding:'5px 12px',background:'rgba(63,185,80,.1)',color:'#3fb950',border:'1px solid rgba(63,185,80,.2)'}}>Send now</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {show&&(
        <div style={S.overlay} onClick={()=>setShow(false)}>
          <div style={{...S.modal,maxWidth:'440px'}} onClick={e=>e.stopPropagation()}>
            <div style={S.mh}><h2 style={{fontSize:'16px',fontWeight:'600'}}>New Broadcast</h2><button onClick={()=>setShow(false)} style={S.mclose}>×</button></div>
            <form onSubmit={create} style={{display:'flex',flexDirection:'column',gap:'14px'}}>
              {[{k:'name',l:'Campaign name',p:'Black Friday Promo'},{k:'template_name',l:'Template name',p:'promo_oct_2024'},{k:'template_language',l:'Language',p:'en_US'}].map(f=>(
                <div key={f.k}>
                  <label style={S.label}>{f.l}</label>
                  <input required value={form[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.p} style={S.input}
                    onFocus={e=>e.target.style.borderColor='#388bfd'} onBlur={e=>e.target.style.borderColor='#30363d'} />
                </div>
              ))}
              <div>
                <label style={S.label}>Audience</label>
                <select value={form.audience_type} onChange={e=>setForm(p=>({...p,audience_type:e.target.value}))} style={{...S.input,cursor:'pointer',appearance:'none'}}>
                  <option value="all">All opted-in contacts</option><option value="tag">Filter by tag</option>
                </select>
              </div>
              {form.audience_type==='tag'&&<div>
                <label style={S.label}>Tags (comma separated)</label>
                <input value={form.audience_tags} onChange={e=>setForm(p=>({...p,audience_tags:e.target.value}))} placeholder="vip, premium" style={S.input}
                  onFocus={e=>e.target.style.borderColor='#388bfd'} onBlur={e=>e.target.style.borderColor='#30363d'} />
              </div>}
              <div style={S.mfoot}>
                <button type="button" onClick={()=>setShow(false)} style={{...S.btn,background:'#21262d',color:'#c9d1d9',border:'1px solid #30363d'}}>Cancel</button>
                <button type="submit" style={{...S.btn,background:'#1f6feb',color:'#fff'}}>Create Draft</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Automations ───────────────────────────────────────────────────────────────
export function Automations() {
  const [items,setItems]=useState([])
  useEffect(()=>{ api.get('/automations').then(r=>setItems(r.data||[])).catch(()=>{}) },[])
  const toggle=async id=>{
    try{ await api.post(`/automations/${id}/toggle`); setItems(p=>p.map(a=>a.id===id?{...a,status:a.status==='active'?'paused':'active'}:a)) }catch{}
  }
  return (
    <div style={S.page}>
      <div style={S.hdr}><h1 style={S.h1}>Automations</h1></div>
      <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
        {items.length===0&&<div style={{...S.card,padding:'48px',textAlign:'center',color:'#8b949e'}}><p style={{fontSize:'32px',marginBottom:'10px',opacity:.3}}>⚡</p><p style={{fontSize:'13px'}}>No automations yet</p></div>}
        {items.map(a=>(
          <div key={a.id} style={{...S.card,display:'flex',alignItems:'center',gap:'14px',padding:'16px 18px',transition:'border-color .15s'}}
            onMouseEnter={e=>e.currentTarget.style.borderColor='#30363d'} onMouseLeave={e=>e.currentTarget.style.borderColor='#21262d'}>
            <div style={{width:'4px',height:'36px',borderRadius:'2px',background:a.status==='active'?'#3fb950':'#6e7681',flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <p style={{fontSize:'13px',fontWeight:'500',color:'#e6edf3',marginBottom:'3px'}}>{a.name}</p>
              <p style={{fontSize:'12px',color:'#8b949e'}}>Trigger: <span style={{color:'#c9d1d9'}}>{a.trigger_type}</span> · Action: <span style={{color:'#c9d1d9'}}>{a.action_type}</span> · Runs: <span style={{color:'#c9d1d9'}}>{a.run_count}</span></p>
            </div>
            <button onClick={()=>toggle(a.id)}
              style={{...S.btn, padding:'6px 14px', background:a.status==='active'?'#21262d':'rgba(63,185,80,.1)', color:a.status==='active'?'#8b949e':'#3fb950', border:`1px solid ${a.status==='active'?'#30363d':'rgba(63,185,80,.2)'}`}}>
              {a.status==='active'?'Pause':'Activate'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Agents ────────────────────────────────────────────────────────────────────
export function Agents() {
  const { tenant } = useAuthStore()
  const [agents,    setAgents]   = useState([])
  const [loading,   setLoading]  = useState(true)
  const [show,      setShow]     = useState(false)
  const [editAgent, setEditAgent]= useState(null)
  const [form,      setForm]     = useState({ name:'', email:'', password:'', role:'agent' })
  const [saving,    setSaving]   = useState(false)
  const [error,     setError]    = useState('')
  const [copied,    setCopied]   = useState(false)

  console.log('Tenant info:', tenant) // Debugging line to check tenant data
  console.log('Agents data:', agents) // Debugging line to check agents data
  const load = () => {
    setLoading(true)
    api.get('/agents').then(r => setAgents(r.data || [])).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const openAdd = () => { setForm({ name:'', email:'', password:'', role:'agent' }); setError(''); setEditAgent(null); setShow(true) }
  const openEdit = a => { setForm({ name: a.name, email: a.email, password:'', role: a.role }); setError(''); setEditAgent(a); setShow(true) }
  const closeModal = () => { setShow(false); setEditAgent(null); setError('') }

  const submit = async e => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      if (editAgent) {
        const payload = { name: form.name, role: form.role }
        if (form.password) payload.password = form.password
        await api.patch(`/agents/${editAgent.id}`, payload)
      } else {
        await api.post('/agents', form)
      }
      closeModal(); load()
    } catch (e) { setError(e.response?.data?.detail || 'Something went wrong') }
    finally { setSaving(false) }
  }

  const toggleActive = async a => {
    try { await api.post(`/agents/${a.id}/${a.is_active ? 'deactivate' : 'activate'}`); load() } catch {}
  }

  const deleteAgent = async a => {
    if (!window.confirm(`Remove ${a.name}? This cannot be undone.`)) return
    try { await api.delete(`/agents/${a.id}`); load() } catch {}
  }

  const copyTenantId = () => {
    navigator.clipboard.writeText(agents.map((item)=>{
      if(item.tenant_id){
        return item.tenant_id
      }
    }) || '')
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const ROLE_C = {
    superadmin: { bg:'rgba(248,81,73,.1)',   color:'#f85149', border:'rgba(248,81,73,.2)'  },
    manager:    { bg:'rgba(56,139,253,.1)',   color:'#388bfd', border:'rgba(56,139,253,.2)' },
    agent:      { bg:'rgba(139,148,158,.1)', color:'#8b949e', border:'rgba(139,148,158,.2)'},
  }
  const RoleBadge = ({ role }) => {
    const c = ROLE_C[role] || ROLE_C.agent
    return <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:99, background:c.bg, color:c.color, border:`1px solid ${c.border}` }}>
      {role === 'superadmin' ? 'Super Admin' : role === 'manager' ? 'Manager' : 'Agent'}
    </span>
  }

  return (
    <div style={S.page}>
      <div style={S.hdr}>
        <div>
          <h1 style={S.h1}>Agents</h1>
          <p style={{ fontSize:13, color:'#8b949e', marginTop:4 }}>{agents.length} team member{agents.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openAdd} style={{ ...S.btn, background:'#1f6feb', color:'#fff' }}>+ Add Agent</button>
      </div>

      {/* Tenant ID card */}
      <div style={{ background:'rgba(56,139,253,.06)', border:'1px solid rgba(56,139,253,.2)', borderRadius:12, padding:'12px 18px', marginBottom:24, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize:11, color:'#8b949e', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:3 }}>Tenant ID — Share with agents for login</div>
          <div style={{ fontSize:13, fontFamily:'monospace', color:'#e6edf3', wordBreak:'break-all' }}>{agents.map((itemid) => {
            if(itemid.tenant_id){
              return itemid.tenant_id
            }
          }) || '—'}</div>
        </div>
        <button onClick={copyTenantId} style={{ ...S.btn, background: copied ? '#238636' : '#21262d', color: copied ? '#fff' : '#e6edf3', border:'1px solid #30363d', fontSize:12 }}>
          {copied ? '✓ Copied' : 'Copy ID'}
        </button>
      </div>

      {/* Table */}
      <div style={S.card}>
        {loading ? (
          <div style={{ padding:'48px', textAlign:'center', color:'#8b949e', fontSize:13 }}>Loading...</div>
        ) : agents.length === 0 ? (
          <div style={{ padding:'64px', textAlign:'center', color:'#8b949e' }}>
            <div style={{ fontSize:40, marginBottom:12, opacity:.3 }}>👤</div>
            <div style={{ fontSize:14, marginBottom:6 }}>No agents yet</div>
            <div style={{ fontSize:12 }}>Click "+ Add Agent" to invite your first team member</div>
          </div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>{['Agent','Email','Role','Status','Actions'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {agents.map(a => (
                <tr key={a.id}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,.02)'}
                  onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                  <td style={S.td}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:34, height:34, borderRadius:'50%', flexShrink:0, background:'linear-gradient(135deg,#8957e5,#388bfd)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff' }}>
                        {a.avatar_initials || a.name?.[0]?.toUpperCase() || 'A'}
                      </div>
                      <span style={{ fontWeight:500, color:'#e6edf3' }}>{a.name}</span>
                    </div>
                  </td>
                  <td style={{ ...S.td, color:'#8b949e' }}>{a.email}</td>
                  <td style={S.td}><RoleBadge role={a.role} /></td>
                  <td style={S.td}>
                    <span style={{ fontSize:13, color: a.is_active ? '#3fb950' : '#8b949e' }}>
                      {a.is_active ? '● Active' : '● Inactive'}
                    </span>
                  </td>
                  <td style={S.td}>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => openEdit(a)} style={{ ...S.btn, background:'#21262d', color:'#e6edf3', border:'1px solid #30363d', padding:'5px 12px', fontSize:12 }}>Edit</button>
                      <button onClick={() => toggleActive(a)}
                        style={{ ...S.btn, padding:'5px 12px', fontSize:12, border:'1px solid',
                                 background:  a.is_active ? 'rgba(210,153,34,.1)' : 'rgba(63,185,80,.1)',
                                 color:       a.is_active ? '#d29922' : '#3fb950',
                                 borderColor: a.is_active ? 'rgba(210,153,34,.25)' : 'rgba(63,185,80,.25)' }}>
                        {a.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => deleteAgent(a)} style={{ ...S.btn, background:'rgba(248,81,73,.1)', color:'#f85149', border:'1px solid rgba(248,81,73,.2)', padding:'5px 12px', fontSize:12 }}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Modal */}
      {show && (
        <div style={S.overlay} onClick={closeModal}>
          <div style={{ ...S.modal, maxWidth:440 }} onClick={e => e.stopPropagation()}>
            <div style={S.mh}>
              <h2 style={{ fontSize:16, fontWeight:600 }}>{editAgent ? 'Edit Agent' : 'Add Agent'}</h2>
              <button onClick={closeModal} style={S.mclose}>×</button>
            </div>
            {error && <div style={{ background:'rgba(248,81,73,.1)', border:'1px solid rgba(248,81,73,.3)', borderRadius:8, padding:'10px 14px', fontSize:12, color:'#f85149', marginBottom:14 }}>{error}</div>}
            <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={S.label}>Full Name</label>
                <input required type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Jane Smith" style={S.input} onFocus={e => e.target.style.borderColor='#388bfd'} onBlur={e => e.target.style.borderColor='#30363d'} />
              </div>
              <div>
                <label style={S.label}>Email</label>
                <input required type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="jane@company.com" readOnly={!!editAgent}
                  style={{ ...S.input, opacity: editAgent ? 0.6 : 1, cursor: editAgent ? 'not-allowed' : 'text' }}
                  onFocus={editAgent ? undefined : e => e.target.style.borderColor='#388bfd'}
                  onBlur={editAgent ? undefined : e => e.target.style.borderColor='#30363d'} />
              </div>
              <div>
                <label style={S.label}>{editAgent ? 'New Password (leave blank to keep current)' : 'Password'}</label>
                <input required={!editAgent} type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder={editAgent ? 'Leave blank to keep current' : 'Min 8 characters'}
                  style={S.input} onFocus={e => e.target.style.borderColor='#388bfd'} onBlur={e => e.target.style.borderColor='#30363d'} />
              </div>
              <div>
                <label style={S.label}>Role</label>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} style={{ ...S.input, cursor:'pointer', appearance:'none' }}>
                  <option value="agent">Agent — Inbox and Contacts only</option>
                  <option value="manager">Manager — Broadcasts, Templates, Analytics access</option>
                </select>
                <div style={{ fontSize:11, color:'#8b949e', marginTop:6 }}>
                  {form.role === 'agent' ? '✅ Inbox  ✅ Contacts  ❌ Broadcasts  ❌ Templates  ❌ Analytics' : '✅ Inbox  ✅ Contacts  ✅ Broadcasts  ✅ Templates  ✅ Analytics'}
                </div>
              </div>
              <div style={S.mfoot}>
                <button type="button" onClick={closeModal} style={{ ...S.btn, background:'#21262d', color:'#c9d1d9', border:'1px solid #30363d' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ ...S.btn, background: saving ? '#21262d' : '#1f6feb', color: saving ? '#8b949e' : '#fff', cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Saving…' : editAgent ? 'Save Changes' : 'Add Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Settings ──────────────────────────────────────────────────────────────────
export function Settings() {
  const { tenant } = useAuthStore()
  const [form,setForm] = useState({business_name:'',website:'',industry:'',timezone:'UTC'})
  const [saved,setSaved] = useState(false)
  useEffect(()=>{ if(tenant) setForm(p=>({...p,business_name:tenant.businessName||''})) },[tenant])
  const save=async e=>{
    e.preventDefault()
    try{ await api.patch('/tenants/me',form); setSaved(true); setTimeout(()=>setSaved(false),3000) }catch{}
  }
  return (
    <div style={S.page}>
      <h1 style={{...S.h1,marginBottom:'24px'}}>Settings</h1>
      <div style={{maxWidth:'560px'}}>
        <div style={{...S.card,padding:'24px'}}>
          <h2 style={{fontSize:'14px',fontWeight:'600',marginBottom:'20px',color:'#e6edf3'}}>Business Profile</h2>
          <form onSubmit={save} style={{display:'flex',flexDirection:'column',gap:'16px'}}>
            {[{k:'business_name',l:'Business name',p:'Acme Corp'},{k:'website',l:'Website',p:'https://acme.com'},{k:'industry',l:'Industry',p:'E-commerce'}].map(f=>(
              <div key={f.k}>
                <label style={S.label}>{f.l}</label>
                <input value={form[f.k]||''} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.p} style={S.input}
                  onFocus={e=>e.target.style.borderColor='#388bfd'} onBlur={e=>e.target.style.borderColor='#30363d'} />
              </div>
            ))}
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:'6px'}}>
              {saved&&<span style={{fontSize:'12px',color:'#3fb950'}}>✓ Saved successfully</span>}
              <button type="submit" style={{...S.btn,background:'#1f6feb',color:'#fff',marginLeft:'auto'}}>Save changes</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}