import { useState, useEffect, useRef, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import api from '../../services/api'

// ── Constants ──────────────────────────────────────────────────────────────────
const C = {
  green:  '#3fb950', blue:   '#388bfd', red:    '#f85149',
  yellow: '#e3b341', amber:  '#EF9F27', teal:   '#1D9E75',
  bg:     '#0f1117', card:   '#161b22', border: '#30363d',
  text:   '#e6edf3', muted:  '#8b949e', card2:  '#21262d',
  purple: '#8957e5',
}
const PIE_COLORS = [C.blue, C.green, C.yellow, C.red, C.amber, C.teal, C.muted]

const NAV_ITEMS = [
  { id: 'dashboard',  emoji: '📊', label: 'Dashboard Summary' },
  { id: 'leads',      emoji: '🎯', label: 'Leads Report' },
  { id: 'contacts',   emoji: '👥', label: 'Contacts Report' },
  { id: 'messages',   emoji: '💬', label: 'Messages Report' },
  { id: 'inbox',      emoji: '📥', label: 'Inbox Report' },
  { id: 'broadcasts', emoji: '📣', label: 'Broadcasts Report' },
]

const DAY_OPTS = [
  { label: 'Today', value: 1 },
  { label: '7 Days', value: 7 },
  { label: '30 Days', value: 30 },
  { label: '90 Days', value: 90 },
]

const EXPORT_TYPE = {
  dashboard: 'leads', leads: 'leads', contacts: 'contacts',
  messages: 'messages', inbox: 'inbox', broadcasts: 'broadcasts',
}

// ── Tiny helpers ───────────────────────────────────────────────────────────────
const fmtNum = n => (n == null ? '—' : n.toLocaleString())
const fmtPct = n => (n == null ? '—' : `${n}%`)
const fmtTime = iso => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
const fmtDate = iso => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
}
const dirArrow = v => v == null ? '' : v >= 0 ? `↑${v}%` : `↓${Math.abs(v)}%`
const dirColor = v => v == null ? C.muted : v >= 0 ? C.green : C.red

// ── ChartTooltip ───────────────────────────────────────────────────────────────
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1c2128', border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
      <p style={{ color: C.muted, marginBottom: 4, fontWeight: 600 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: '2px 0' }}>{p.name}: <strong>{p.value?.toLocaleString()}</strong></p>
      ))}
    </div>
  )
}

// ── StatCard ───────────────────────────────────────────────────────────────────
function StatCard({ icon, title, value, sub, subColor, border }) {
  return (
    <div style={{
      background: C.card, border: `1px solid ${border || C.border}`,
      borderRadius: 10, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>{title}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: C.text, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: subColor || C.muted }}>{sub}</div>}
    </div>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function Skeleton({ h = 24, w = '100%', radius = 6 }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: C.card2, animation: 'pulse 1.5s ease-in-out infinite',
    }} />
  )
}

function SectionSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {[...Array(4)].map((_, i) => <Skeleton key={i} h={96} />)}
      </div>
      <Skeleton h={260} />
      <Skeleton h={220} />
    </div>
  )
}

// ── SortableTable ──────────────────────────────────────────────────────────────
function SortableTable({ columns, rows, emptyMsg = 'No data for this period', pageSize = 10, rowStyle }) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage]       = useState(0)

  const handleSort = key => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc'); setPage(0) }
  }

  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey]
        const cmp = av == null ? 1 : bv == null ? -1 : typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))
        return sortDir === 'asc' ? cmp : -cmp
      })
    : rows

  const totalPages = Math.ceil(sorted.length / pageSize)
  const visible = sorted.slice(page * pageSize, (page + 1) * pageSize)

  return (
    <div>
      <div style={{ overflowX: 'auto', borderRadius: 8, border: `1px solid ${C.border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.card2 }}>
              {columns.map(col => (
                <th key={col.key} onClick={() => handleSort(col.key)}
                  style={{
                    padding: '10px 14px', textAlign: 'left', color: C.muted,
                    fontWeight: 600, fontSize: 12, cursor: 'pointer', userSelect: 'none',
                    borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
                  }}>
                  {col.label}
                  {sortKey === col.key && <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr><td colSpan={columns.length} style={{ padding: '24px', textAlign: 'center', color: C.muted }}>{emptyMsg}</td></tr>
            ) : visible.map((row, i) => (
              <tr key={i}
                style={{ background: rowStyle ? rowStyle(row) : i % 2 === 0 ? C.card : 'rgba(33,38,45,0.5)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56,139,253,0.07)' }}
                onMouseLeave={e => { e.currentTarget.style.background = rowStyle ? rowStyle(row) : i % 2 === 0 ? C.card : 'rgba(33,38,45,0.5)' }}>
                {columns.map(col => (
                  <td key={col.key} style={{ padding: '9px 14px', borderBottom: `1px solid rgba(48,54,61,0.5)`, color: C.text, verticalAlign: 'middle' }}>
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 12, color: C.muted }}>Page {page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            style={{ ...btnSm, opacity: page === 0 ? 0.4 : 1 }}>‹</button>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            style={{ ...btnSm, opacity: page >= totalPages - 1 ? 0.4 : 1 }}>›</button>
        </div>
      )}
    </div>
  )
}

const btnSm = {
  background: C.card2, border: `1px solid ${C.border}`, color: C.text,
  borderRadius: 5, padding: '3px 9px', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
}

// ── Funnel ─────────────────────────────────────────────────────────────────────
function Funnel({ steps }) {
  const max = steps[0]?.count || 1
  const colors = [C.blue, C.teal, C.green, C.yellow]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 140, textAlign: 'right', fontSize: 12, color: C.muted, flexShrink: 0 }}>{s.label}</div>
          <div style={{ flex: 1, background: C.card2, borderRadius: 4, height: 28, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.round(s.count / max * 100)}%`, height: '100%',
              background: colors[i % colors.length], borderRadius: 4,
              display: 'flex', alignItems: 'center', paddingLeft: 10,
              minWidth: s.count > 0 ? 60 : 0, transition: 'width .4s',
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
                {fmtNum(s.count)}
              </span>
            </div>
          </div>
          <div style={{ width: 48, fontSize: 12, color: C.muted, textAlign: 'right', flexShrink: 0 }}>
            {s.count > 0 && steps[0].count > 0 ? `${Math.round(s.count / steps[0].count * 100)}%` : ''}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Alert row ──────────────────────────────────────────────────────────────────
function AlertRow({ alert, onAction }) {
  const cfg = {
    danger:  { color: C.red,    bg: 'rgba(248,81,73,0.1)',   icon: '🔴' },
    warning: { color: C.amber,  bg: 'rgba(239,159,39,0.1)',  icon: '🟡' },
    info:    { color: C.blue,   bg: 'rgba(56,139,253,0.1)',  icon: '🔵' },
  }[alert.type] || { color: C.muted, bg: C.card2, icon: 'ℹ️' }

  return (
    <div style={{
      background: cfg.bg, border: `1px solid ${cfg.color}30`,
      borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>{cfg.icon}</span>
        <span style={{ fontSize: 13, color: C.text }}>{alert.message}</span>
      </div>
      <button onClick={() => onAction(alert.action)}
        style={{ background: cfg.color + '20', border: `1px solid ${cfg.color}40`, color: cfg.color, borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', flexShrink: 0 }}>
        View →
      </button>
    </div>
  )
}

// ── Badge ──────────────────────────────────────────────────────────────────────
function Badge({ status }) {
  const map = {
    completed: { bg: 'rgba(63,185,80,.15)', color: C.green },
    running:   { bg: 'rgba(56,139,253,.15)', color: C.blue },
    queued:    { bg: 'rgba(56,139,253,.15)', color: C.blue },
    failed:    { bg: 'rgba(248,81,73,.15)', color: C.red },
    draft:     { bg: 'rgba(139,148,158,.15)', color: C.muted },
    open:      { bg: 'rgba(239,159,39,.15)', color: C.amber },
    resolved:  { bg: 'rgba(29,158,117,.15)', color: C.teal },
    bot_handling: { bg: 'rgba(137,87,229,.15)', color: C.purple },
    spam:      { bg: 'rgba(248,81,73,.15)', color: C.red },
    no_chat:   { bg: 'rgba(139,148,158,.15)', color: C.muted },
  }
  const s = map[status] || map.draft
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>
      {status?.replace('_', ' ')}
    </span>
  )
}

// ── Card wrapper ───────────────────────────────────────────────────────────────
function Card({ title, children, action }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
      {title && (
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{title}</span>
          {action}
        </div>
      )}
      <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
  )
}

// ── Section: Dashboard ─────────────────────────────────────────────────────────
function DashboardSection({ data, onNav }) {
  if (!data) return <SectionSkeleton />
  const { today = {}, period = {}, alerts = [], comparison = {}, messages_by_day = [], contacts_by_day = [] } = data
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.text }}>{greeting}! Here's your business overview</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted }}>Period: last {period.days} days</p>
      </div>

      {/* Today cards */}
      <div>
        <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Today</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          <StatCard icon="📩" title="Messages Received" value={fmtNum(today.messages_received)} sub={`${fmtNum(today.messages_sent)} sent`} />
          <StatCard icon="👥" title="New Contacts"      value={fmtNum(today.new_contacts)}      sub={`${fmtNum(today.conversations_opened)} chats opened`} />
          <StatCard icon="🎯" title="New Leads"         value={fmtNum(today.new_leads)}         sub="Facebook leads" subColor={C.yellow} border={today.new_leads > 0 ? C.yellow + '40' : undefined} />
          <StatCard icon="💬" title="Open Chats"        value={fmtNum(today.unread_count)}      sub={`${today.conversations_resolved ?? 0} resolved today`} subColor={C.teal} />
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Attention Required</h3>
          {alerts.map((a, i) => (
            <AlertRow key={i} alert={a} onAction={action => {
              if (action === 'view_inbox') onNav('inbox')
              else if (action === 'view_leads') onNav('leads')
              else if (action === 'view_failed') onNav('messages')
            }} />
          ))}
        </div>
      )}

      {/* Period stats */}
      <div>
        <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Period Overview</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          <StatCard icon="📊" title="Total Messages"   value={fmtNum(period.total_messages)}       sub={`Delivery: ${fmtPct(period.delivery_rate)}`}  subColor={C.green} />
          <StatCard icon="📖" title="Read Rate"         value={fmtPct(period.read_rate)}            sub={`Response: ${fmtPct(period.response_rate)}`}  subColor={C.blue}  />
          <StatCard icon="⏱"  title="Avg Response"     value={`${period.avg_response_time_mins ?? 0}m`} sub="first reply time" />
          <StatCard icon="🎯" title="New Leads"         value={fmtNum(period.new_leads)}            sub={`${fmtNum(period.new_contacts)} new contacts`} subColor={C.yellow} />
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title="Messages — Sent vs Received">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={messages_by_day} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={v => v?.slice(5)} />
              <YAxis tick={{ fill: C.muted, fontSize: 10 }} />
              <Tooltip content={<ChartTip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="sent"     name="Sent"     stroke={C.blue}  strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="received" name="Received" stroke={C.green} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card title="New Contacts &amp; Leads by Day">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={contacts_by_day} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={v => v?.slice(5)} />
              <YAxis tick={{ fill: C.muted, fontSize: 10 }} />
              <Tooltip content={<ChartTip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="contacts" name="Contacts" fill={C.blue}   radius={[3, 3, 0, 0]} />
              <Bar dataKey="leads"    name="Leads"    fill={C.yellow} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Comparison */}
      <Card title="vs Previous Period">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          {[
            { label: 'Contacts', val: comparison.contacts_vs_last_period },
            { label: 'Messages', val: comparison.messages_vs_last_period },
            { label: 'Leads',    val: comparison.leads_vs_last_period },
          ].map(({ label, val }) => (
            <div key={label} style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: dirColor(val) }}>{dirArrow(val)}</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ── Section: Leads ─────────────────────────────────────────────────────────────
function LeadsSection({ data }) {
  if (!data) return <SectionSkeleton />
  const { summary = {}, funnel = {}, by_day = [], not_contacted_list = [], recent_leads = [] } = data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <StatCard icon="🎯" title="Total Leads"      value={fmtNum(summary.total_leads)}      sub={`${fmtNum(summary.new_this_period)} this period`} subColor={C.yellow} border={C.yellow + '30'} />
        <StatCard icon="📞" title="Contacted"         value={fmtNum(summary.contacted)}        sub={`Contact rate: ${fmtPct(summary.contact_rate)}`} subColor={C.green} />
        <StatCard icon="⏳" title="Not Contacted"     value={fmtNum(summary.not_contacted)}    sub="need follow-up" subColor={C.red} border={summary.not_contacted > 0 ? C.red + '30' : undefined} />
        <StatCard icon="⚡" title="Avg Response"      value={`${summary.avg_first_response_mins ?? 0}m`} sub="time to first contact" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title="Conversion Funnel">
          <Funnel steps={[
            { label: 'Total Leads',   count: funnel.total_leads   ?? 0 },
            { label: 'Opened Chat',   count: funnel.opened_chat   ?? 0 },
            { label: 'Replied Back',  count: funnel.replied_back  ?? 0 },
            { label: 'Resolved',      count: funnel.resolved      ?? 0 },
          ]} />
        </Card>
        <Card title="New Leads by Day">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={by_day} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={v => v?.slice(5)} />
              <YAxis tick={{ fill: C.muted, fontSize: 10 }} />
              <Tooltip content={<ChartTip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="new_leads"  name="New Leads"  fill={C.yellow} radius={[3, 3, 0, 0]} />
              <Bar dataKey="contacted"  name="Contacted"  fill={C.green}  radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {not_contacted_list.length > 0 && (
        <Card title="⚠️ These leads need your attention!">
          <SortableTable
            columns={[
              { key: 'name',               label: 'Name' },
              { key: 'phone',              label: 'Phone' },
              { key: 'email',              label: 'Email' },
              { key: 'imported_at',        label: 'Imported', render: v => fmtDate(v) },
              { key: 'hours_since_import', label: 'Hours Waiting', render: v => `${v}h` },
              { key: 'tags',               label: 'Tags', render: v => v?.join(', ') },
            ]}
            rows={not_contacted_list}
            rowStyle={row => row.hours_since_import > 6 ? 'rgba(248,81,73,0.07)' : undefined}
          />
        </Card>
      )}

      <Card title="Recent Leads">
        <SortableTable
          columns={[
            { key: 'name',               label: 'Name' },
            { key: 'phone',              label: 'Phone' },
            { key: 'response_time_mins', label: 'Response Time', render: v => v != null ? `${v}m` : '—' },
            { key: 'chat_status',        label: 'Chat Status', render: v => <Badge status={v} /> },
            { key: 'tags',               label: 'Tags', render: v => v?.join(', ') },
          ]}
          rows={recent_leads}
        />
      </Card>
    </div>
  )
}

// ── Section: Contacts ──────────────────────────────────────────────────────────
function ContactsSection({ data }) {
  if (!data) return <SectionSkeleton />
  const { summary = {}, by_day = [], by_tag = [], most_active = [], inactive_contacts = [] } = data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <StatCard icon="👥" title="Total Contacts"   value={fmtNum(summary.total_contacts)}   sub={`+${fmtNum(summary.new_this_period)} this period`} subColor={C.green} />
        <StatCard icon="✅" title="Opted In Rate"    value={fmtPct(summary.opted_in_rate)}    sub={`${fmtNum(summary.opted_in)} / ${fmtNum(summary.total_contacts)}`} subColor={C.teal} />
        <StatCard icon="🎯" title="Facebook Leads"   value={fmtNum(summary.facebook_leads)}   sub="tagged facebook-lead" subColor={C.yellow} />
        <StatCard icon="💤" title="Inactive"         value={fmtNum(summary.inactive_contacts)} sub="not seen in 30 days" subColor={C.muted} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title="Contact Growth by Day">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={by_day} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={v => v?.slice(5)} />
              <YAxis tick={{ fill: C.muted, fontSize: 10 }} />
              <Tooltip content={<ChartTip />} />
              <Line type="monotone" dataKey="new_contacts" name="New Contacts" stroke={C.blue} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Contacts by Tag">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={by_tag} layout="vertical" margin={{ top: 4, right: 30, bottom: 0, left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
              <XAxis type="number" tick={{ fill: C.muted, fontSize: 10 }} />
              <YAxis type="category" dataKey="tag" tick={{ fill: C.muted, fontSize: 11 }} width={60} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="count" name="Contacts" fill={C.blue} radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title="Most Active Contacts">
          <SortableTable
            columns={[
              { key: 'name',           label: 'Name' },
              { key: 'phone',          label: 'Phone' },
              { key: 'total_messages', label: 'Messages', render: v => fmtNum(v) },
              { key: 'last_seen',      label: 'Last Seen', render: v => fmtDate(v) },
            ]}
            rows={most_active}
            pageSize={5}
          />
        </Card>
        <Card title="Inactive Contacts (30+ days)">
          <SortableTable
            columns={[
              { key: 'name',          label: 'Name' },
              { key: 'phone',         label: 'Phone' },
              { key: 'last_seen',     label: 'Last Seen', render: v => fmtDate(v) },
              { key: 'days_inactive', label: 'Days Inactive', render: v => `${v}d` },
            ]}
            rows={inactive_contacts}
            pageSize={5}
          />
        </Card>
      </div>
    </div>
  )
}

// ── Section: Messages ──────────────────────────────────────────────────────────
function MessagesSection({ data }) {
  if (!data) return <SectionSkeleton />
  const { summary = {}, by_type = [], by_day = [], by_hour = [], peak_hour, peak_day, failed_list = [] } = data
  const peakHourIdx = by_hour.findIndex(h => h.label === peak_hour)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <StatCard icon="📤" title="Total Sent"     value={fmtNum(summary.total_sent)}      sub={`${fmtNum(summary.avg_daily_sent)}/day avg`} />
        <StatCard icon="✅" title="Delivery Rate"  value={fmtPct(summary.delivery_rate)}   sub={`${fmtNum(summary.delivered)} delivered`} subColor={C.green} border={C.green + '30'} />
        <StatCard icon="👁" title="Read Rate"       value={fmtPct(summary.read_rate)}       sub={`${fmtNum(summary.read)} read`} subColor={C.blue} />
        <StatCard icon="❌" title="Failed"          value={fmtNum(summary.failed)}          sub={`${fmtPct(summary.failed_rate)} of sent`} subColor={C.red} border={summary.failed > 0 ? C.red + '30' : undefined} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title="Sent vs Received by Day">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={by_day} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={v => v?.slice(5)} />
              <YAxis tick={{ fill: C.muted, fontSize: 10 }} />
              <Tooltip content={<ChartTip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="sent"     name="Sent"     stroke={C.blue}  strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="received" name="Received" stroke={C.green} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="failed"   name="Failed"   stroke={C.red}   strokeWidth={1} strokeDasharray="4 2" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Message Types Breakdown">
          {by_type.length === 0
            ? <p style={{ color: C.muted, fontSize: 13 }}>No data for this period</p>
            : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie data={by_type} dataKey="sent" nameKey="type" cx="50%" cy="50%"
                      innerRadius={45} outerRadius={75} paddingAngle={3}>
                      {by_type.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ background: '#1c2128', border: `1px solid ${C.border}`, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1 }}>
                  {by_type.map((t, i) => {
                    const total = by_type.reduce((a, x) => a + x.sent, 0)
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: C.muted, flex: 1 }}>{t.type}</span>
                        <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{fmtNum(t.sent)}</span>
                        <span style={{ fontSize: 11, color: C.muted }}>{total > 0 ? `${Math.round(t.sent / total * 100)}%` : ''}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          }
        </Card>
      </div>

      <Card title={`Customer Activity by Hour${peak_hour ? ` — Peak: ${peak_hour}` : ''}`}>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={by_hour} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
            <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 9 }} interval={1} />
            <YAxis tick={{ fill: C.muted, fontSize: 10 }} />
            <Tooltip content={<ChartTip />} />
            <Bar dataKey="count" name="Messages">
              {by_hour.map((_, i) => (
                <Cell key={i} fill={i === peakHourIdx ? C.yellow : C.blue} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {peak_day && <p style={{ fontSize: 12, color: C.muted, margin: '8px 0 0' }}>Busiest day: <strong style={{ color: C.text }}>{peak_day}</strong></p>}
      </Card>

      {failed_list.length > 0 && (
        <Card title="⚠️ Failed Messages">
          <SortableTable
            columns={[
              { key: 'contact_name', label: 'Contact' },
              { key: 'phone',        label: 'Phone' },
              { key: 'msg_type',     label: 'Type' },
              { key: 'failed_at',    label: 'Failed At', render: v => fmtTime(v) },
            ]}
            rows={failed_list}
            rowStyle={() => 'rgba(248,81,73,0.06)'}
          />
        </Card>
      )}
    </div>
  )
}

// ── Section: Inbox ─────────────────────────────────────────────────────────────
function InboxSection({ data }) {
  if (!data) return <SectionSkeleton />
  const { summary = {}, by_status = [], by_day = [], peak_hours = [], overdue_conversations = [], busiest_day } = data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <StatCard icon="💬" title="Total Chats"      value={fmtNum(summary.total_conversations)} sub={`${fmtPct(summary.resolution_rate)} resolved`} />
        <StatCard icon="🟡" title="Open Now"          value={fmtNum(summary.open)}               sub={`${fmtNum(summary.bot_handling)} bot handling`} subColor={C.amber} border={summary.open > 0 ? C.amber + '30' : undefined} />
        <StatCard icon="⏱"  title="Avg Resolution"   value={`${summary.avg_resolution_hrs ?? 0}h`} sub={`First reply: ${summary.avg_first_response_mins ?? 0}m`} subColor={C.teal} />
        <StatCard icon="🚨" title="Overdue"           value={fmtNum(summary.overdue_24hrs)}      sub={`${fmtNum(summary.overdue_48hrs)} > 48h`} subColor={C.red} border={summary.overdue_24hrs > 0 ? C.red + '30' : undefined} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Card title="Conversations by Status">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <ResponsiveContainer width="50%" height={180}>
              <PieChart>
                <Pie data={by_status} dataKey="count" nameKey="status" cx="50%" cy="50%"
                  innerRadius={45} outerRadius={75} paddingAngle={3}>
                  {by_status.map((s, i) => {
                    const colors = { open: C.amber, resolved: C.teal, bot_handling: C.purple, spam: C.red }
                    return <Cell key={i} fill={colors[s.status] || PIE_COLORS[i]} />
                  })}
                </Pie>
                <Tooltip contentStyle={{ background: '#1c2128', border: `1px solid ${C.border}`, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1 }}>
              {by_status.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Badge status={s.status} />
                  <span style={{ fontSize: 13, color: C.text, fontWeight: 600, marginLeft: 'auto' }}>{fmtNum(s.count)}</span>
                  <span style={{ fontSize: 12, color: C.muted }}>{fmtPct(s.percentage)}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card title={`Opened vs Resolved${busiest_day ? ` — Busiest: ${busiest_day}` : ''}`}>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={by_day} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 10 }} tickFormatter={v => v?.slice(5)} />
              <YAxis tick={{ fill: C.muted, fontSize: 10 }} />
              <Tooltip content={<ChartTip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="opened"   name="Opened"   stroke={C.amber} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="resolved" name="Resolved" stroke={C.teal}  strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {peak_hours.length > 0 && (
        <Card title="Busiest Hours">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={peak_hours} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 11 }} />
              <YAxis tick={{ fill: C.muted, fontSize: 10 }} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="conversations" name="Conversations" fill={C.blue} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {overdue_conversations.length > 0 && (
        <Card title="⚠️ These customers are waiting too long!">
          <SortableTable
            columns={[
              { key: 'contact_name',    label: 'Contact' },
              { key: 'phone',           label: 'Phone' },
              { key: 'last_message',    label: 'Last Message', render: v => <span style={{ color: C.muted, fontStyle: 'italic', fontSize: 12 }}>{v?.slice(0, 50)}{v?.length > 50 ? '…' : ''}</span> },
              { key: 'last_message_time', label: 'Time', render: v => fmtTime(v) },
              { key: 'hours_waiting',   label: 'Waiting', render: v => v != null ? `${v}h` : '—' },
              { key: 'status',          label: 'Status', render: v => <Badge status={v} /> },
            ]}
            rows={overdue_conversations}
            rowStyle={row => row.hours_waiting > 48 ? 'rgba(248,81,73,0.08)' : 'rgba(239,159,39,0.05)'}
          />
        </Card>
      )}
    </div>
  )
}

// ── Section: Broadcasts ────────────────────────────────────────────────────────
function BroadcastsSection({ data }) {
  if (!data) return <SectionSkeleton />
  const { summary = {}, broadcasts = [] } = data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <StatCard icon="📣" title="Total Broadcasts"  value={fmtNum(summary.total_broadcasts)} sub={`${summary.completed} completed`} subColor={C.green} />
        <StatCard icon="📨" title="Total Sent"         value={fmtNum(summary.total_recipients)} sub="total recipients" />
        <StatCard icon="✅" title="Avg Success Rate"   value={fmtPct(summary.avg_success_rate)} sub={summary.best_performing ? `Best: ${summary.best_performing}` : ''} subColor={C.green} border={C.green + '30'} />
        <StatCard icon="❌" title="Failed Broadcasts"  value={fmtNum(summary.failed)}           sub={`${fmtNum(summary.total_failed)} messages failed`} subColor={summary.failed > 0 ? C.red : C.muted} border={summary.failed > 0 ? C.red + '30' : undefined} />
      </div>

      {broadcasts.length > 0 && (
        <Card title="Success Rate by Broadcast">
          <ResponsiveContainer width="100%" height={Math.max(160, broadcasts.length * 36)}>
            <BarChart data={broadcasts} layout="vertical" margin={{ top: 4, right: 50, bottom: 0, left: 110 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: C.muted, fontSize: 10 }} unit="%" />
              <YAxis type="category" dataKey="name" tick={{ fill: C.muted, fontSize: 11 }} width={110}
                tickFormatter={v => v?.length > 16 ? v.slice(0, 16) + '…' : v} />
              <Tooltip formatter={v => [`${v}%`, 'Success Rate']} contentStyle={{ background: '#1c2128', border: `1px solid ${C.border}`, fontSize: 12 }} />
              <Bar dataKey="success_rate" name="Success Rate" radius={[0, 4, 4, 0]}>
                {broadcasts.map((b, i) => (
                  <Cell key={i} fill={b.name === summary.best_performing ? C.green : C.blue} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card title="All Broadcasts">
        <SortableTable
          columns={[
            { key: 'name',         label: 'Name' },
            { key: 'status',       label: 'Status', render: v => <Badge status={v} /> },
            { key: 'total_count',  label: 'Total',   render: v => fmtNum(v) },
            { key: 'sent_count',   label: 'Sent',    render: (v, row) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, background: C.card2, borderRadius: 3, height: 6, minWidth: 60 }}>
                  <div style={{ width: `${row.total_count > 0 ? Math.round(v / row.total_count * 100) : 0}%`, background: C.blue, height: '100%', borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 12 }}>{fmtNum(v)}</span>
              </div>
            )},
            { key: 'failed_count', label: 'Failed',  render: (v, row) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, background: C.card2, borderRadius: 3, height: 6, minWidth: 60 }}>
                  <div style={{ width: `${row.total_count > 0 ? Math.round(v / row.total_count * 100) : 0}%`, background: C.red, height: '100%', borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 12, color: v > 0 ? C.red : C.text }}>{fmtNum(v)}</span>
              </div>
            )},
            { key: 'success_rate', label: 'Success %', render: v => <span style={{ color: v >= 90 ? C.green : v >= 70 ? C.amber : C.red }}>{fmtPct(v)}</span> },
            { key: 'created_at',   label: 'Date', render: v => fmtDate(v) },
          ]}
          rows={broadcasts}
        />
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function Reports() {
  const [section,     setSection]     = useState('dashboard')
  const [days,        setDays]        = useState(30)
  const [sectionData, setSectionData] = useState({})
  const [loading,     setLoading]     = useState({})
  const [lastUpdated, setLastUpdated] = useState(null)
  const [exporting,   setExporting]   = useState(false)
  const cacheRef = useRef({})

  const loadSection = useCallback(async (sec, d, force = false) => {
    const key = `${sec}-${d}`
    const cached = cacheRef.current[key]
    if (!force && cached && Date.now() - cached.ts < 5 * 60 * 1000) {
      setSectionData(prev => ({ ...prev, [sec]: cached.data }))
      return
    }
    setLoading(prev => ({ ...prev, [sec]: true }))
    try {
      const endpoints = {
        dashboard:  `/reports/dashboard-summary?days=${d}`,
        leads:      `/reports/leads?days=${d}`,
        contacts:   `/reports/contacts?days=${d}`,
        messages:   `/reports/messages?days=${d}`,
        inbox:      `/reports/inbox?days=${d}`,
        broadcasts: `/reports/broadcasts?days=${d}`,
      }
      const res = await api.get(endpoints[sec])
      cacheRef.current[key] = { data: res.data, ts: Date.now() }
      setSectionData(prev => ({ ...prev, [sec]: res.data }))
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Reports fetch error:', err)
    } finally {
      setLoading(prev => ({ ...prev, [sec]: false }))
    }
  }, [])

  useEffect(() => { loadSection(section, days) }, [section, days, loadSection])

  const handleExport = async () => {
    setExporting(true)
    try {
      const rtype = EXPORT_TYPE[section] || 'leads'
      const res = await api.get(`/reports/export?report_type=${rtype}&days=${days}`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${rtype}_report.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export error:', err)
    } finally {
      setExporting(false)
    }
  }

  const data     = sectionData[section]
  const isLoading = loading[section]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg, overflow: 'hidden', fontFamily: "'Inter',system-ui,sans-serif" }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
        .rep-nav-item:hover { background: rgba(56,139,253,0.08) !important; color: #388bfd !important; }
        .rep-day-btn:hover  { background: rgba(56,139,253,0.15) !important; border-color: #388bfd !important; }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16,
        padding: '12px 20px', borderBottom: `1px solid ${C.border}`,
        background: C.card,
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.text }}>Reports & Analytics</h1>
          {lastUpdated && (
            <p style={{ margin: 0, fontSize: 11, color: C.muted }}>
              Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        {/* Date range */}
        <div style={{ display: 'flex', gap: 4 }}>
          {DAY_OPTS.map(opt => (
            <button key={opt.value} className="rep-day-btn" onClick={() => setDays(opt.value)}
              style={{
                background: days === opt.value ? 'rgba(56,139,253,0.15)' : 'transparent',
                border: `1px solid ${days === opt.value ? C.blue : C.border}`,
                color: days === opt.value ? C.blue : C.muted,
                borderRadius: 6, padding: '5px 12px', cursor: 'pointer',
                fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
              }}>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => loadSection(section, days, true)} disabled={isLoading}
            style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', opacity: isLoading ? 0.6 : 1 }}>
            {isLoading ? '⏳' : '↻'} Refresh
          </button>
          <button onClick={handleExport} disabled={exporting}
            style={{ background: C.blue, border: 'none', color: '#fff', borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', opacity: exporting ? 0.7 : 1 }}>
            {exporting ? 'Exporting…' : '↓ Export CSV'}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left nav */}
        <div style={{ width: 210, flexShrink: 0, borderRight: `1px solid ${C.border}`, background: C.card, overflowY: 'auto', padding: '12px 0' }}>
          {NAV_ITEMS.map(item => (
            <button key={item.id} className="rep-nav-item" onClick={() => setSection(item.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 16px', background: section === item.id ? 'rgba(56,139,253,0.12)' : 'transparent',
                border: 'none', borderLeft: `2px solid ${section === item.id ? C.blue : 'transparent'}`,
                color: section === item.id ? C.blue : C.muted,
                cursor: 'pointer', fontSize: 13, fontWeight: section === item.id ? 600 : 400,
                fontFamily: 'inherit', textAlign: 'left', transition: 'all .15s',
              }}>
              <span style={{ fontSize: 16 }}>{item.emoji}</span>
              <span>{item.label}</span>
              {loading[item.id] && <span style={{ marginLeft: 'auto', fontSize: 10, color: C.muted }}>⏳</span>}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {isLoading && !data ? (
            <SectionSkeleton />
          ) : section === 'dashboard'  ? <DashboardSection  data={data} onNav={setSection} />
            : section === 'leads'      ? <LeadsSection      data={data} />
            : section === 'contacts'   ? <ContactsSection   data={data} />
            : section === 'messages'   ? <MessagesSection   data={data} />
            : section === 'inbox'      ? <InboxSection      data={data} />
            : section === 'broadcasts' ? <BroadcastsSection data={data} />
            : null
          }
        </div>
      </div>
    </div>
  )
}
