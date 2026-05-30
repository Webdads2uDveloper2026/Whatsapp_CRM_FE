/**
 * Flows.jsx — WhatsApp Flow Builder
 * src/pages/dashboard/Flows.jsx
 */
import { useState, useCallback, useEffect } from 'react'
import api from '../../services/api'
import FlowCanvas from './FlowCanvas'

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Meta WhatsApp Flows: all id fields must be letters + underscores only — no numbers
const uid = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz'
  let r = ''
  for (let i = 0; i < 8; i++) r += chars[Math.floor(Math.random() * chars.length)]
  return r
}
const fmt = iso => iso ? new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = ['SIGN_UP','SIGN_IN','APPOINTMENT_BOOKING','LEAD_GENERATION','CONTACT_US','CUSTOMER_SUPPORT','SURVEY','OTHER']

const COMP_DEFS = [
  { type:'text',     label:'Text',     icon:'📝', desc:'Display a text message' },
  { type:'input',    label:'Input',    icon:'✏️', desc:'Text / number / email field' },
  { type:'buttons',  label:'Buttons',  icon:'🔘', desc:'Up to 3 action buttons' },
  { type:'dropdown', label:'Dropdown', icon:'📋', desc:'Single-choice list' },
  { type:'media',    label:'Media',    icon:'🖼️', desc:'Image / video / document' },
  { type:'footer',   label:'Footer',   icon:'📄', desc:'Footer text + CTA button' },
]

const STATUS_CLS = {
  DRAFT:      'text-amber-400 bg-amber-400/10 border-amber-400/30',
  PUBLISHED:  'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  DEPRECATED: 'text-slate-500 bg-slate-800 border-slate-700',
  BLOCKED:    'text-red-400 bg-red-400/10 border-red-400/30',
  THROTTLED:  'text-orange-400 bg-orange-400/10 border-orange-400/30',
}

const CAT_CLS = {
  SIGN_UP:'text-blue-400 bg-blue-400/10', SIGN_IN:'text-cyan-400 bg-cyan-400/10',
  APPOINTMENT_BOOKING:'text-violet-400 bg-violet-400/10', LEAD_GENERATION:'text-pink-400 bg-pink-400/10',
  CONTACT_US:'text-emerald-400 bg-emerald-400/10', CUSTOMER_SUPPORT:'text-amber-400 bg-amber-400/10',
  SURVEY:'text-indigo-400 bg-indigo-400/10', OTHER:'text-slate-400 bg-slate-800',
}

// ─── Factory functions ────────────────────────────────────────────────────────
function mkComp(type) {
  const id = `c_${uid()}`
  const mkBtn = (label, action='COMPLETE') => ({ id:`b_${uid()}`, label, action, next_screen:'' })
  switch (type) {
    case 'text':     return { id, type, text:'' }
    case 'input':    return { id, type, label:'Your answer', input_type:'text', required:false, placeholder:'' }
    case 'buttons':  return { id, type, buttons:[mkBtn('Continue','NAVIGATE')] }
    case 'dropdown': return { id, type, label:'Choose an option', required:false, options:[{id:`o_${uid()}`,title:'Option 1'}] }
    case 'media':    return { id, type, media_type:'image', url:'', alt_text:'' }
    case 'footer':   return { id, type, footer_text:'', buttons:[mkBtn('Done','COMPLETE')] }
    default:         return { id, type }
  }
}

function mkScreen(title='New Screen') {
  return {
    id:`scr_${uid()}`, title, is_terminal:false,
    components:[
      { id:`c_${uid()}`, type:'text', text:'Enter your message here...' },
      { id:`c_${uid()}`, type:'buttons', buttons:[{ id:`b_${uid()}`, label:'Continue', action:'COMPLETE', next_screen:'' }] },
    ],
  }
}

// ─── Flow Templates ───────────────────────────────────────────────────────────
const FLOW_TEMPLATES = [
  {
    id: 'onboarding',
    name: 'Customer Onboarding',
    description: 'Welcome new customers and collect their details',
    category: 'SIGN_UP',
    icon: '👋',
    makeScreens: () => {
      const s1id = `scr_${uid()}`, s2id = `scr_${uid()}`, s3id = `scr_${uid()}`, s4id = `scr_${uid()}`
      return [
        { id:s1id, title:'Welcome', is_terminal:false, components:[
          { id:`c_${uid()}`, type:'text', text:'Welcome! 👋\n\nWe\'re excited to have you on board. Let\'s set up your account in just a few steps.' },
          { id:`c_${uid()}`, type:'buttons', buttons:[{ id:`b_${uid()}`, label:'Get Started', action:'NAVIGATE', next_screen:s2id }] },
        ]},
        { id:s2id, title:'Your Details', is_terminal:false, components:[
          { id:`c_${uid()}`, type:'text', text:'Please tell us a bit about yourself.' },
          { id:`c_${uid()}`, type:'input', label:'Full Name', input_type:'text', required:true, placeholder:'John Doe' },
          { id:`c_${uid()}`, type:'input', label:'Email Address', input_type:'email', required:true, placeholder:'john@example.com' },
          { id:`c_${uid()}`, type:'input', label:'Phone Number', input_type:'phone', required:false, placeholder:'+1 234 567 8900' },
          { id:`c_${uid()}`, type:'buttons', buttons:[{ id:`b_${uid()}`, label:'Continue', action:'NAVIGATE', next_screen:s3id }] },
        ]},
        { id:s3id, title:'Preferences', is_terminal:false, components:[
          { id:`c_${uid()}`, type:'text', text:'One last thing — how did you hear about us?' },
          { id:`c_${uid()}`, type:'dropdown', label:'How did you hear about us?', required:true, options:[
            { id:`o_${uid()}`, title:'Social Media' },
            { id:`o_${uid()}`, title:'Google Search' },
            { id:`o_${uid()}`, title:'Friend / Referral' },
            { id:`o_${uid()}`, title:'Advertisement' },
            { id:`o_${uid()}`, title:'Other' },
          ]},
          { id:`c_${uid()}`, type:'buttons', buttons:[{ id:`b_${uid()}`, label:'Submit', action:'NAVIGATE', next_screen:s4id }] },
        ]},
        { id:s4id, title:'All Done!', is_terminal:true, components:[
          { id:`c_${uid()}`, type:'text', text:'🎉 You\'re all set!\n\nThank you for completing your onboarding. Our team will be in touch shortly.' },
          { id:`c_${uid()}`, type:'footer', footer_text:'', buttons:[{ id:`b_${uid()}`, label:'Done', action:'COMPLETE', next_screen:'' }] },
        ]},
      ]
    },
  },
  {
    id: 'feedback',
    name: 'Feedback Survey',
    description: 'Collect customer satisfaction ratings and comments',
    category: 'SURVEY',
    icon: '⭐',
    makeScreens: () => {
      const s1id = `scr_${uid()}`, s2id = `scr_${uid()}`, s3id = `scr_${uid()}`, s4id = `scr_${uid()}`
      return [
        { id:s1id, title:'Introduction', is_terminal:false, components:[
          { id:`c_${uid()}`, type:'text', text:'We\'d love your feedback! 💬\n\nThis quick survey takes less than 2 minutes and helps us improve our service.' },
          { id:`c_${uid()}`, type:'buttons', buttons:[{ id:`b_${uid()}`, label:'Start Survey', action:'NAVIGATE', next_screen:s2id }] },
        ]},
        { id:s2id, title:'Rating', is_terminal:false, components:[
          { id:`c_${uid()}`, type:'text', text:'How would you rate your overall experience?' },
          { id:`c_${uid()}`, type:'dropdown', label:'Your Rating', required:true, options:[
            { id:`o_${uid()}`, title:'⭐⭐⭐⭐⭐  Excellent' },
            { id:`o_${uid()}`, title:'⭐⭐⭐⭐  Good' },
            { id:`o_${uid()}`, title:'⭐⭐⭐  Average' },
            { id:`o_${uid()}`, title:'⭐⭐  Poor' },
            { id:`o_${uid()}`, title:'⭐  Very Poor' },
          ]},
          { id:`c_${uid()}`, type:'buttons', buttons:[{ id:`b_${uid()}`, label:'Next', action:'NAVIGATE', next_screen:s3id }] },
        ]},
        { id:s3id, title:'Comments', is_terminal:false, components:[
          { id:`c_${uid()}`, type:'text', text:'Any additional comments? (optional)' },
          { id:`c_${uid()}`, type:'input', label:'Your Comments', input_type:'text', required:false, placeholder:'Tell us more...' },
          { id:`c_${uid()}`, type:'buttons', buttons:[{ id:`b_${uid()}`, label:'Submit Feedback', action:'NAVIGATE', next_screen:s4id }] },
        ]},
        { id:s4id, title:'Thank You', is_terminal:true, components:[
          { id:`c_${uid()}`, type:'text', text:'🙏 Thank you for your feedback!\n\nYour response has been recorded. We appreciate you taking the time to help us improve.' },
          { id:`c_${uid()}`, type:'footer', footer_text:'', buttons:[{ id:`b_${uid()}`, label:'Close', action:'COMPLETE', next_screen:'' }] },
        ]},
      ]
    },
  },
  {
    id: 'lead_capture',
    name: 'Lead Capture',
    description: 'Capture prospect information for your sales team',
    category: 'LEAD_GENERATION',
    icon: '🎯',
    makeScreens: () => {
      const s1id = `scr_${uid()}`, s2id = `scr_${uid()}`, s3id = `scr_${uid()}`
      return [
        { id:s1id, title:'Your Interest', is_terminal:false, components:[
          { id:`c_${uid()}`, type:'text', text:'Interested in our services? 🎯\n\nFill out this quick form and one of our specialists will reach out to you within 24 hours.' },
          { id:`c_${uid()}`, type:'dropdown', label:'I\'m interested in', required:true, options:[
            { id:`o_${uid()}`, title:'Product Demo' },
            { id:`o_${uid()}`, title:'Pricing Information' },
            { id:`o_${uid()}`, title:'Partnership Opportunity' },
            { id:`o_${uid()}`, title:'General Inquiry' },
          ]},
          { id:`c_${uid()}`, type:'buttons', buttons:[{ id:`b_${uid()}`, label:"I'm Interested", action:'NAVIGATE', next_screen:s2id }] },
        ]},
        { id:s2id, title:'Contact Info', is_terminal:false, components:[
          { id:`c_${uid()}`, type:'text', text:'How can we reach you?' },
          { id:`c_${uid()}`, type:'input', label:'Full Name', input_type:'text', required:true, placeholder:'Your name' },
          { id:`c_${uid()}`, type:'input', label:'Email Address', input_type:'email', required:true, placeholder:'your@email.com' },
          { id:`c_${uid()}`, type:'input', label:'Company Name', input_type:'text', required:false, placeholder:'Your company (optional)' },
          { id:`c_${uid()}`, type:'buttons', buttons:[{ id:`b_${uid()}`, label:'Submit', action:'NAVIGATE', next_screen:s3id }] },
        ]},
        { id:s3id, title:'All Done', is_terminal:true, components:[
          { id:`c_${uid()}`, type:'text', text:'✅ Great! We\'ve received your information.\n\nA member of our team will contact you within 24 hours. Keep an eye on your messages!' },
          { id:`c_${uid()}`, type:'footer', footer_text:'', buttons:[{ id:`b_${uid()}`, label:'Done', action:'COMPLETE', next_screen:'' }] },
        ]},
      ]
    },
  },
  {
    id: 'appointment',
    name: 'Appointment Booking',
    description: 'Let customers schedule appointments or consultations',
    category: 'APPOINTMENT_BOOKING',
    icon: '📅',
    makeScreens: () => {
      const s1id = `scr_${uid()}`, s2id = `scr_${uid()}`, s3id = `scr_${uid()}`
      return [
        { id:s1id, title:'Book Appointment', is_terminal:false, components:[
          { id:`c_${uid()}`, type:'text', text:'Book an appointment 📅\n\nChoose your preferred service and time slot. We\'ll confirm your booking right away!' },
          { id:`c_${uid()}`, type:'dropdown', label:'Service Type', required:true, options:[
            { id:`o_${uid()}`, title:'Consultation (30 min)' },
            { id:`o_${uid()}`, title:'Full Session (60 min)' },
            { id:`o_${uid()}`, title:'Follow-up (15 min)' },
          ]},
          { id:`c_${uid()}`, type:'dropdown', label:'Preferred Time Slot', required:true, options:[
            { id:`o_${uid()}`, title:'Morning (9am – 12pm)' },
            { id:`o_${uid()}`, title:'Afternoon (12pm – 5pm)' },
            { id:`o_${uid()}`, title:'Evening (5pm – 8pm)' },
          ]},
          { id:`c_${uid()}`, type:'buttons', buttons:[{ id:`b_${uid()}`, label:'Continue', action:'NAVIGATE', next_screen:s2id }] },
        ]},
        { id:s2id, title:'Your Info', is_terminal:false, components:[
          { id:`c_${uid()}`, type:'text', text:'Please provide your contact details for the booking.' },
          { id:`c_${uid()}`, type:'input', label:'Full Name', input_type:'text', required:true, placeholder:'Your name' },
          { id:`c_${uid()}`, type:'input', label:'Phone Number', input_type:'phone', required:true, placeholder:'+1 234 567 8900' },
          { id:`c_${uid()}`, type:'input', label:'Notes (optional)', input_type:'text', required:false, placeholder:'Any special requests...' },
          { id:`c_${uid()}`, type:'buttons', buttons:[{ id:`b_${uid()}`, label:'Confirm Booking', action:'NAVIGATE', next_screen:s3id }] },
        ]},
        { id:s3id, title:'Booking Confirmed', is_terminal:true, components:[
          { id:`c_${uid()}`, type:'text', text:'🎉 Your appointment is confirmed!\n\nWe\'ll send you a reminder 24 hours before your appointment. Thank you for booking with us!' },
          { id:`c_${uid()}`, type:'footer', footer_text:'', buttons:[{ id:`b_${uid()}`, label:'Done', action:'COMPLETE', next_screen:'' }] },
        ]},
      ]
    },
  },
  {
    id: 'support',
    name: 'Customer Support',
    description: 'Guide customers through common support issues',
    category: 'CUSTOMER_SUPPORT',
    icon: '🛟',
    makeScreens: () => {
      const s1id = `scr_${uid()}`, s2id = `scr_${uid()}`, s3id = `scr_${uid()}`
      return [
        { id:s1id, title:'Support Request', is_terminal:false, components:[
          { id:`c_${uid()}`, type:'text', text:'Hi there! 👋 How can we help you today?\n\nPlease select the category that best describes your issue.' },
          { id:`c_${uid()}`, type:'dropdown', label:'Issue Category', required:true, options:[
            { id:`o_${uid()}`, title:'Order / Delivery Issue' },
            { id:`o_${uid()}`, title:'Product / Service Question' },
            { id:`o_${uid()}`, title:'Billing / Payment' },
            { id:`o_${uid()}`, title:'Account Access' },
            { id:`o_${uid()}`, title:'Other' },
          ]},
          { id:`c_${uid()}`, type:'buttons', buttons:[{ id:`b_${uid()}`, label:'Continue', action:'NAVIGATE', next_screen:s2id }] },
        ]},
        { id:s2id, title:'Describe Your Issue', is_terminal:false, components:[
          { id:`c_${uid()}`, type:'text', text:'Please describe your issue so we can help you faster.' },
          { id:`c_${uid()}`, type:'input', label:'Your Name', input_type:'text', required:true, placeholder:'Full name' },
          { id:`c_${uid()}`, type:'input', label:'Order / Reference Number', input_type:'text', required:false, placeholder:'e.g. ORD-12345' },
          { id:`c_${uid()}`, type:'input', label:'Describe Your Issue', input_type:'text', required:true, placeholder:'Please be as specific as possible...' },
          { id:`c_${uid()}`, type:'buttons', buttons:[{ id:`b_${uid()}`, label:'Submit Request', action:'NAVIGATE', next_screen:s3id }] },
        ]},
        { id:s3id, title:'Request Submitted', is_terminal:true, components:[
          { id:`c_${uid()}`, type:'text', text:'✅ Support request submitted!\n\nOur support team will review your issue and get back to you within 2 business hours.' },
          { id:`c_${uid()}`, type:'footer', footer_text:'Avg response time: 2 hours', buttons:[{ id:`b_${uid()}`, label:'Done', action:'COMPLETE', next_screen:'' }] },
        ]},
      ]
    },
  },
]

// ─── Phone Preview ────────────────────────────────────────────────────────────
function PhonePreview({ screen }) {
  if (!screen) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
      <span className="text-4xl">📱</span>
      <p className="text-sm text-center">Select a screen<br/>to preview</p>
    </div>
  )

  return (
    <div className="flex flex-col items-center pt-4 px-3">
      {/* Phone frame */}
      <div className="relative w-[220px]">
        <div className="bg-[#111] rounded-[40px] p-[9px] shadow-2xl border-[3px] border-[#222]">
          {/* Notch */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-14 h-4 bg-[#111] rounded-full z-20" />
          {/* Screen */}
          <div className="bg-[#ece5dd] rounded-[33px] overflow-hidden">
            {/* WA top bar */}
            <div className="bg-[#075E54] px-3 pt-6 pb-2 flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-[10px] font-bold shrink-0">W</div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-[10px] font-semibold truncate">WhatsApp Business</p>
                <p className="text-white/50 text-[8px]">online</p>
              </div>
              <span className="text-white/50 text-[9px]">⋮</span>
            </div>

            {/* Chat area */}
            <div className="bg-[#f0e6d3] px-2.5 py-2 min-h-[320px] max-h-[320px] overflow-y-auto space-y-2">
              <div className="flex justify-center mb-1">
                <span className="text-[8px] text-slate-500 bg-black/10 px-2 py-0.5 rounded-full">Today</span>
              </div>

              {screen.components.map((comp) => {
                if (comp.type === 'text') return (
                  <div key={comp.id} className="max-w-[90%] bg-white rounded-xl rounded-tl-sm shadow-sm px-2.5 py-1.5">
                    <p className="text-[9.5px] text-slate-800 leading-relaxed whitespace-pre-wrap">{comp.text || <span className="text-slate-400 italic">Empty text...</span>}</p>
                    <p className="text-[7px] text-slate-400 text-right mt-0.5">09:41 ✓✓</p>
                  </div>
                )

                if (comp.type === 'input') return (
                  <div key={comp.id} className="bg-white rounded-xl px-2.5 py-2 shadow-sm max-w-[95%]">
                    <p className="text-[8px] text-slate-500 font-semibold mb-1">{comp.label}{comp.required && <span className="text-red-400">*</span>}</p>
                    <div className="bg-slate-100 rounded-lg px-2 py-1.5 border border-slate-200">
                      <p className="text-[8px] text-slate-400">{comp.placeholder || 'Enter here...'}</p>
                    </div>
                  </div>
                )

                if (comp.type === 'dropdown') return (
                  <div key={comp.id} className="bg-white rounded-xl px-2.5 py-2 shadow-sm max-w-[95%]">
                    <p className="text-[8px] text-slate-500 font-semibold mb-1">{comp.label}{comp.required && <span className="text-red-400">*</span>}</p>
                    <div className="bg-slate-100 rounded-lg px-2 py-1.5 border border-slate-200 flex items-center justify-between">
                      <p className="text-[8px] text-slate-400">Select option...</p>
                      <span className="text-[7px] text-slate-400">▼</span>
                    </div>
                    {comp.options?.slice(0,2).map(o => (
                      <p key={o.id} className="text-[7.5px] text-slate-600 py-0.5 pl-1 border-b border-slate-100 last:border-0">{o.title}</p>
                    ))}
                    {(comp.options?.length ?? 0) > 2 && <p className="text-[7px] text-slate-400 pl-1">+{comp.options.length-2} more</p>}
                  </div>
                )

                if (comp.type === 'media') return (
                  <div key={comp.id} className="bg-white rounded-xl overflow-hidden shadow-sm max-w-[90%]">
                    <div className="bg-slate-200 h-16 flex items-center justify-center">
                      <span className="text-2xl">{comp.media_type==='image'?'🖼️':comp.media_type==='video'?'🎬':'📎'}</span>
                    </div>
                    {comp.alt_text && <p className="text-[8px] text-slate-500 px-2 py-1">{comp.alt_text}</p>}
                  </div>
                )

                if (comp.type === 'footer') return (
                  <div key={comp.id} className="max-w-[95%]">
                    {comp.footer_text && <p className="text-[7.5px] text-slate-500 italic text-center mb-1">{comp.footer_text}</p>}
                    {comp.buttons?.map(btn => (
                      <div key={btn.id} className="bg-white rounded-xl border border-[#25D366]/40 px-2 py-1.5 text-center shadow-sm mb-1">
                        <span className="text-[8.5px] font-semibold text-[#25D366]">{btn.label}</span>
                      </div>
                    ))}
                  </div>
                )

                if (comp.type === 'buttons') return (
                  <div key={comp.id} className="space-y-1 max-w-[95%]">
                    {comp.buttons?.map(btn => (
                      <div key={btn.id} className="bg-white rounded-xl border border-[#25D366]/40 px-2 py-1.5 text-center shadow-sm">
                        <span className="text-[8.5px] font-semibold text-[#25D366]">{btn.label}</span>
                      </div>
                    ))}
                  </div>
                )

                return null
              })}
            </div>

            {/* Input bar */}
            <div className="bg-[#f0f0f0] px-2 py-1.5 flex items-center gap-1.5 border-t border-slate-200">
              <div className="flex-1 bg-white rounded-full px-2 py-1">
                <p className="text-[8px] text-slate-400">Message</p>
              </div>
              <div className="w-5 h-5 rounded-full bg-[#25D366] flex items-center justify-center">
                <span className="text-white text-[8px]">▶</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Screen label */}
      <div className="mt-3 text-center">
        <p className="text-xs font-semibold text-slate-300">{screen.title}</p>
        {screen.is_terminal && (
          <span className="text-[10px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full mt-1 inline-block">Terminal Screen</span>
        )}
      </div>
    </div>
  )
}

// ─── Component Editor ─────────────────────────────────────────────────────────
function ComponentEditor({ comp, screens, onUpdate, onDelete, onMoveUp, onMoveDown, isFirst, isLast }) {
  const [open, setOpen] = useState(false)

  const up = (key, val) => onUpdate({ ...comp, [key]: val })

  const compDef = COMP_DEFS.find(d => d.type === comp.type)

  // compact preview label
  const preview = () => {
    if (comp.type === 'text')     return comp.text ? comp.text.slice(0,60) + (comp.text.length>60?'…':'') : <em className="text-slate-500">Empty text</em>
    if (comp.type === 'input')    return `${comp.label} (${comp.input_type}${comp.required?' *':''})`
    if (comp.type === 'buttons')  return comp.buttons?.map(b=>b.label).join(' · ')
    if (comp.type === 'dropdown') return `${comp.label} · ${comp.options?.length||0} options`
    if (comp.type === 'media')    return `${comp.media_type} ${comp.url ? '— URL set' : '— no URL'}`
    if (comp.type === 'footer')   return comp.footer_text || comp.buttons?.[0]?.label || 'Footer'
    return comp.type
  }

  return (
    <div className="border border-slate-700/60 rounded-xl overflow-hidden transition-all">
      {/* Header row */}
      <div className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors ${open ? 'bg-slate-800' : 'bg-slate-800/40 hover:bg-slate-800/70'}`}
        onClick={() => setOpen(o => !o)}>
        <span className="text-sm shrink-0">{compDef?.icon}</span>
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wide">{compDef?.label}</span>
          <p className="text-[11px] text-slate-500 truncate mt-0.5">{preview()}</p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={onMoveUp}   disabled={isFirst} className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-20 rounded transition-colors text-xs">↑</button>
          <button onClick={onMoveDown} disabled={isLast}  className="p-1 text-slate-500 hover:text-slate-300 disabled:opacity-20 rounded transition-colors text-xs">↓</button>
          <button onClick={onDelete} className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors text-xs ml-1">🗑</button>
          <span className={`ml-1 text-xs text-slate-500 transition-transform ${open?'rotate-180':'rotate-0'}`}>▾</span>
        </div>
      </div>

      {/* Editor body */}
      {open && (
        <div className="bg-slate-900/50 px-3 py-3 space-y-3 border-t border-slate-700/50">

          {/* TEXT */}
          {comp.type === 'text' && (
            <div>
              <label className="label">Message text</label>
              <textarea rows={4} value={comp.text} onChange={e => up('text', e.target.value)}
                placeholder="Enter the message to display to the user..."
                className="input resize-none text-xs leading-relaxed" />
              <p className="text-[10px] text-slate-500 mt-1">{comp.text?.length||0} chars · Use line breaks freely</p>
            </div>
          )}

          {/* INPUT */}
          {comp.type === 'input' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Field label</label>
                  <input value={comp.label} onChange={e => up('label', e.target.value)} className="input text-xs" placeholder="Your Name" />
                </div>
                <div>
                  <label className="label">Input type</label>
                  <select value={comp.input_type} onChange={e => up('input_type', e.target.value)} className="input text-xs">
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="date">Date</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Placeholder</label>
                <input value={comp.placeholder||''} onChange={e => up('placeholder', e.target.value)} className="input text-xs" placeholder="Hint text shown inside field..." />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={comp.required||false} onChange={e => up('required', e.target.checked)} className="w-3.5 h-3.5 accent-blue-500" />
                <span className="text-xs text-slate-400">Required field</span>
              </label>
            </div>
          )}

          {/* BUTTONS */}
          {comp.type === 'buttons' && (
            <div className="space-y-2">
              {comp.buttons?.map((btn, bi) => (
                <div key={btn.id} className="border border-slate-700 rounded-lg p-2.5 space-y-2 bg-slate-800/30">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-bold shrink-0">BTN {bi+1}</span>
                    <input value={btn.label} onChange={e => up('buttons', comp.buttons.map((b,i)=>i===bi?{...b,label:e.target.value}:b))}
                      className="input text-xs flex-1" placeholder="Button label" />
                    {comp.buttons.length > 1 && (
                      <button onClick={() => up('buttons', comp.buttons.filter((_,i)=>i!==bi))} className="text-slate-500 hover:text-red-400 text-xs shrink-0">✕</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label">Action</label>
                      <select value={btn.action} onChange={e => up('buttons', comp.buttons.map((b,i)=>i===bi?{...b,action:e.target.value,next_screen:''}:b))} className="input text-xs">
                        <option value="NAVIGATE">Navigate to screen</option>
                        <option value="COMPLETE">Complete flow</option>
                      </select>
                    </div>
                    {btn.action === 'NAVIGATE' && (
                      <div>
                        <label className="label">Go to screen</label>
                        <select value={btn.next_screen||''} onChange={e => up('buttons', comp.buttons.map((b,i)=>i===bi?{...b,next_screen:e.target.value}:b))} className="input text-xs">
                          <option value="">— Select screen —</option>
                          {screens.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {(comp.buttons?.length||0) < 3 && (
                <button onClick={() => up('buttons', [...(comp.buttons||[]), { id:`b_${uid()}`, label:'Button', action:'COMPLETE', next_screen:'' }])}
                  className="w-full py-1.5 border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600 rounded-lg text-xs transition-colors">
                  + Add button (max 3)
                </button>
              )}
            </div>
          )}

          {/* DROPDOWN */}
          {comp.type === 'dropdown' && (
            <div className="space-y-2">
              <div>
                <label className="label">Question / label</label>
                <input value={comp.label||''} onChange={e => up('label', e.target.value)} className="input text-xs" placeholder="Choose an option" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={comp.required||false} onChange={e => up('required', e.target.checked)} className="w-3.5 h-3.5 accent-blue-500" />
                <span className="text-xs text-slate-400">Required</span>
              </label>
              <div className="space-y-1.5">
                <label className="label">Options</label>
                {comp.options?.map((opt, oi) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <input value={opt.title} onChange={e => up('options', comp.options.map((o,i)=>i===oi?{...o,title:e.target.value}:o))}
                      className="input text-xs flex-1" placeholder={`Option ${oi+1}`} />
                    {comp.options.length > 1 && (
                      <button onClick={() => up('options', comp.options.filter((_,i)=>i!==oi))} className="text-slate-500 hover:text-red-400 text-xs shrink-0">✕</button>
                    )}
                  </div>
                ))}
                <button onClick={() => up('options', [...(comp.options||[]), { id:`o_${uid()}`, title:`Option ${(comp.options?.length||0)+1}` }])}
                  className="w-full py-1.5 border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 text-xs rounded-lg transition-colors">
                  + Add option
                </button>
              </div>
            </div>
          )}

          {/* MEDIA */}
          {comp.type === 'media' && (
            <div className="space-y-2">
              <div>
                <label className="label">Media type</label>
                <div className="flex gap-2">
                  {['image','video','document'].map(mt => (
                    <button key={mt} onClick={() => up('media_type', mt)}
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors capitalize ${comp.media_type===mt?'bg-blue-600/20 border-blue-500/50 text-blue-300':'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                      {mt==='image'?'🖼️':mt==='video'?'🎬':'📎'} {mt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Media URL</label>
                <input value={comp.url||''} onChange={e => up('url', e.target.value)} className="input text-xs" placeholder="https://example.com/image.jpg" />
              </div>
              <div>
                <label className="label">Alt text / caption</label>
                <input value={comp.alt_text||''} onChange={e => up('alt_text', e.target.value)} className="input text-xs" placeholder="Describe the media..." />
              </div>
            </div>
          )}

          {/* FOOTER */}
          {comp.type === 'footer' && (
            <div className="space-y-2">
              <div>
                <label className="label">Footer text</label>
                <input value={comp.footer_text||''} onChange={e => up('footer_text', e.target.value)} className="input text-xs" placeholder="e.g. Need help? Just reply." />
              </div>
              {comp.buttons?.map((btn, bi) => (
                <div key={btn.id} className="space-y-2">
                  <div>
                    <label className="label">Button label</label>
                    <input value={btn.label} onChange={e => up('buttons', comp.buttons.map((b,i)=>i===bi?{...b,label:e.target.value}:b))} className="input text-xs" />
                  </div>
                  <div>
                    <label className="label">Button action</label>
                    <select value={btn.action} onChange={e => up('buttons', comp.buttons.map((b,i)=>i===bi?{...b,action:e.target.value}:b))} className="input text-xs">
                      <option value="COMPLETE">Complete flow</option>
                      <option value="NAVIGATE">Navigate to screen</option>
                    </select>
                  </div>
                  {btn.action==='NAVIGATE' && (
                    <div>
                      <label className="label">Go to screen</label>
                      <select value={btn.next_screen||''} onChange={e => up('buttons', comp.buttons.map((b,i)=>i===bi?{...b,next_screen:e.target.value}:b))} className="input text-xs">
                        <option value="">— Select screen —</option>
                        {screens.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  )
}

// ─── Validation ───────────────────────────────────────────────────────────────
function validateFlow(flow) {
  const errs = []
  if (!flow.name?.trim()) errs.push('Flow name is required')
  if (!flow.screens?.length) errs.push('Flow must have at least one screen')
  const screenIds = new Set((flow.screens || []).map(s => s.id))
  flow.screens?.forEach((scr, si) => {
    if (!scr.title?.trim()) errs.push(`Screen ${si+1} needs a title`)
    if (!scr.components?.length) errs.push(`Screen "${scr.title||si+1}" has no components`)
    scr.components?.forEach(comp => {
      const btns = comp.type === 'buttons' ? comp.buttons :
                   comp.type === 'footer'  ? comp.buttons : []
      btns?.forEach(btn => {
        if (btn.action === 'NAVIGATE' && !btn.next_screen) {
          errs.push(`Button "${btn.label}" in "${scr.title}" has no target screen`)
        }
        if (btn.action === 'NAVIGATE' && btn.next_screen && !screenIds.has(btn.next_screen)) {
          errs.push(`Button "${btn.label}" in "${scr.title}" points to a deleted screen — update or remove it`)
        }
      })
    })
  })
  return errs
}

// ─── Send-to-Contacts Modal ────────────────────────────────────────────────────
function SendToContactsModal({ flow, onClose, showToast }) {
  const [contacts, setContacts] = useState([])
  const [tags, setTags]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [loadErr, setLoadErr]   = useState('')
  const [sending, setSending]   = useState(false)
  const [mode, setMode]         = useState('contacts')
  const [selectedIds, setSelectedIds] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [search, setSearch]     = useState('')
  const [form, setForm] = useState({
    flow_cta: 'Open', flow_header: '', flow_body: 'Tap the button below to get started.', flow_footer: '',
  })

  const loadContacts = async (q = '') => {
    setLoading(true)
    setLoadErr('')
    try {
      // max limit is 100 — use backend search for filtering
      const params = q ? `?limit=100&search=${encodeURIComponent(q)}` : '?limit=100'
      const r = await api.get(`/contacts${params}`)
      const list = r.data?.contacts || []
      setContacts(list)
      if (!q) {
        const allTags = [...new Set(list.flatMap(c => c.tags || []))]
        setTags(allTags)
      }
    } catch (e) {
      setLoadErr('Failed to load contacts — ' + (e?.response?.data?.detail || e.message))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadContacts() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // debounced backend search
  useEffect(() => {
    const t = setTimeout(() => loadContacts(search), 300)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleId = id => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const toggleTag = t => setSelectedTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const handleSend = async () => {
    if (mode === 'contacts' && !selectedIds.length) { showToast('Select at least one contact', 'error'); return }
    if (mode === 'tags' && !selectedTags.length) { showToast('Select at least one tag', 'error'); return }
    if (!form.flow_body.trim()) { showToast('Body text is required', 'error'); return }
    setSending(true)
    try {
      const payload = {
        ...form,
        contact_ids: mode === 'contacts' ? selectedIds : [],
        tags:        mode === 'tags'     ? selectedTags : [],
        send_all:    mode === 'all',
        flow_screen: flow.screens?.[0]?.id || '',
      }
      const { data } = await api.post(`/flows/${flow.id}/send`, payload)
      if (data.sent > 0) {
        showToast(`Sent to ${data.sent} contact${data.sent !== 1 ? 's' : ''}${data.failed ? ` (${data.failed} failed)` : ''}`)
        onClose()
      } else {
        const firstErr = data.errors?.[0]?.error || 'Unknown error'
        showToast(`Send failed: ${firstErr}`, 'error')
      }
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Send failed', 'error')
    } finally {
      setSending(false)
    }
  }

  const iStyle = { width:'100%', background:'#0d1117', border:'1px solid #30363d', color:'#e6edf3', fontSize:12, borderRadius:8, padding:'8px 11px', outline:'2px solid transparent', outlineOffset:0, boxSizing:'border-box', fontFamily:'inherit', transition:'border-color .15s, outline .15s' }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:60, padding:16, backdropFilter:'blur(4px)' }} onClick={onClose}>
      <div style={{ background:'#161b22', border:'1px solid #30363d', borderRadius:20, width:'100%', maxWidth:520, maxHeight:'88vh', display:'flex', flexDirection:'column', boxShadow:'0 25px 50px rgba(0,0,0,.5)', overflow:'hidden' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #21262d', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div>
            <p style={{ fontSize:14, fontWeight:700, color:'#e6edf3' }}>🚀 Send Flow</p>
            <p style={{ fontSize:11, color:'#6e7681', marginTop:2 }}>{flow.name}</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#6e7681', cursor:'pointer', fontSize:20 }}>×</button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'16px 20px', display:'flex', flexDirection:'column', gap:14 }}>

          {/* Mode tabs */}
          <div style={{ display:'flex', background:'#0d1117', borderRadius:10, padding:3, gap:2 }}>
            {[['contacts','👥 Contacts'],['tags','🏷 By Tag'],['all','📣 All']].map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)}
                style={{ flex:1, padding:'6px 0', borderRadius:8, border:'none', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit', background: mode===m ? '#21262d' : 'transparent', color: mode===m ? '#e6edf3' : '#6e7681', transition:'all .15s' }}>
                {label}
              </button>
            ))}
          </div>

          {/* Contacts picker */}
          {mode === 'contacts' && (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search contacts…"
                style={{ ...iStyle, outline:'2px solid transparent', transition:'outline .15s' }}
                onFocus={e => e.target.style.outline='2px solid #388bfd'}
                onBlur={e => e.target.style.outline='2px solid transparent'}
              />
              <div style={{ maxHeight:180, overflowY:'auto', display:'flex', flexDirection:'column', gap:2, border:'1px solid #21262d', borderRadius:8, padding:4 }}>
                {loading
                  ? <p style={{ fontSize:12, color:'#6e7681', textAlign:'center', padding:'16px 0' }}>Loading…</p>
                  : loadErr
                  ? <p style={{ fontSize:12, color:'#f85149', padding:'8px', textAlign:'center' }}>{loadErr}</p>
                  : contacts.length === 0
                  ? <p style={{ fontSize:12, color:'#6e7681', textAlign:'center', padding:'16px 0' }}>
                      {search ? 'No contacts match your search' : 'No contacts found'}
                    </p>
                  : contacts.map(c => (
                    <label key={c.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:6, cursor:'pointer', background: selectedIds.includes(c.id) ? 'rgba(56,139,253,.1)' : 'transparent' }}>
                      <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleId(c.id)} style={{ accentColor:'#388bfd', flexShrink:0 }} />
                      <span style={{ fontSize:12, color:'#c9d1d9', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.profile_name || c.wa_id}</span>
                      <span style={{ fontSize:10, color:'#6e7681', flexShrink:0 }}>{c.wa_id}</span>
                    </label>
                  ))
                }
              </div>
              {selectedIds.length > 0 && <p style={{ fontSize:11, color:'#388bfd', fontWeight:600 }}>✓ {selectedIds.length} contact{selectedIds.length > 1 ? 's' : ''} selected</p>}
            </div>
          )}

          {/* Tags picker */}
          {mode === 'tags' && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {tags.length === 0 ? <p style={{ fontSize:12, color:'#6e7681' }}>No tags found</p> :
                tags.map(t => (
                  <button key={t} onClick={() => toggleTag(t)}
                    style={{ padding:'4px 10px', borderRadius:20, border:`1px solid ${selectedTags.includes(t) ? '#388bfd' : '#30363d'}`, background: selectedTags.includes(t) ? 'rgba(56,139,253,.15)' : 'transparent', color: selectedTags.includes(t) ? '#388bfd' : '#8b949e', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                    🏷 {t}
                  </button>
                ))
              }
            </div>
          )}

          {mode === 'all' && (
            <div style={{ background:'rgba(248,81,73,.06)', border:'1px solid rgba(248,81,73,.2)', borderRadius:10, padding:'10px 14px' }}>
              <p style={{ fontSize:12, color:'#f85149', fontWeight:600 }}>⚠ Send to ALL contacts</p>
              <p style={{ fontSize:11, color:'#8b949e', marginTop:4 }}>This will send the flow to every opted-in, unblocked contact. Use carefully.</p>
            </div>
          )}

          {/* Message fields */}
          <div style={{ borderTop:'1px solid #21262d', paddingTop:12, display:'flex', flexDirection:'column', gap:8 }}>
            <p style={{ fontSize:11, fontWeight:700, color:'#8b949e', textTransform:'uppercase', letterSpacing:'.05em' }}>Wrapper Message</p>
            {[['flow_cta','Button Text','Open'],['flow_header','Header (optional)',''],['flow_footer','Footer (optional)','']].map(([k, label, ph]) => (
              <div key={k}>
                <label style={{ fontSize:10, color:'#6e7681', display:'block', marginBottom:3 }}>{label}</label>
                <input value={form[k]} onChange={set(k)} placeholder={ph} style={iStyle}
                  onFocus={e => { e.target.style.borderColor='#388bfd'; e.target.style.outline='2px solid rgba(56,139,253,.3)' }}
                  onBlur={e => { e.target.style.borderColor='#30363d'; e.target.style.outline='2px solid transparent' }} />
              </div>
            ))}
            <div>
              <label style={{ fontSize:10, color:'#6e7681', display:'block', marginBottom:3 }}>Body Text *</label>
              <textarea value={form.flow_body} onChange={set('flow_body')} rows={2} style={{ ...iStyle, resize:'vertical' }}
                onFocus={e => { e.target.style.borderColor='#388bfd'; e.target.style.outline='2px solid rgba(56,139,253,.3)' }}
                onBlur={e => { e.target.style.borderColor='#30363d'; e.target.style.outline='2px solid transparent' }} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'12px 20px', borderTop:'1px solid #21262d', display:'flex', justifyContent:'flex-end', gap:8, flexShrink:0 }}>
          <button onClick={onClose} style={{ padding:'8px 16px', background:'transparent', border:'1px solid #30363d', color:'#8b949e', borderRadius:10, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Cancel</button>
          <button onClick={handleSend} disabled={sending}
            style={{ padding:'8px 18px', background: sending ? '#21262d' : 'linear-gradient(135deg,#22c55e,#0d9488)', border:'none', color:'white', borderRadius:10, fontSize:12, fontWeight:700, cursor: sending ? 'not-allowed' : 'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
            {sending ? 'Sending…' : '🚀 Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Flows() {
  const [flows, setFlows]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [activeFlowId, setActiveFlowId]       = useState(null)
  const [activeScreenId, setActiveScreenId]   = useState(null)
  const [showNewFlowModal, setShowNewFlowModal] = useState(false)
  const [newFlowForm, setNewFlowForm] = useState({ name:'', description:'', category:'OTHER' })
  const [saving, setSaving]         = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [toast, setToast]           = useState(null)
  const [validationErrors, setValidationErrors] = useState([])
  const [showValidation, setShowValidation] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [rightTab, setRightTab]       = useState('edit')
  const [showPanelAddMenu, setShowPanelAddMenu] = useState(false)
  const [showSendModal, setShowSendModal]       = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [previewUrl, setPreviewUrl]             = useState(null)
  const [publishError, setPublishError]         = useState(null)   // { title, detail, errors[] }
  const [syncing, setSyncing]                   = useState(false)
  const [syncResult, setSyncResult]             = useState(null)   // result from meta-sync-all
  const [quickPublishId, setQuickPublishId]     = useState(null)   // flowId being quick-published

  const activeFlow   = flows.find(f => f.id === activeFlowId) ?? null
  const activeScreen = activeFlow?.screens?.find(s => s.id === activeScreenId) ?? null

  const showToast = (msg, type='success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Load flows from API ───────────────────────────────────────────────────
  const loadFlows = useCallback(async () => {
    try {
      const { data } = await api.get('/flows')
      setFlows(data?.flows || [])
    } catch {
      showToast('Failed to load flows', 'error')
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadFlows() }, [loadFlows])

  // ── Fetch preview URL when a published flow with meta_flow_id is active ──
  useEffect(() => {
    setPreviewUrl(null)
    if (!activeFlowId) return
    const flow = flows.find(f => f.id === activeFlowId)
    if (!flow || flow.status !== 'PUBLISHED' || !flow.meta_flow_id) return
    api.get(`/flows/${activeFlowId}/preview`)
      .then(({ data }) => { if (data?.preview_url) setPreviewUrl(data.preview_url) })
      .catch(() => {})
  }, [activeFlowId, flows]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Flow-level mutations ──────────────────────────────────────────────────
  const updateActiveFlow = useCallback((changes) => {
    setFlows(prev => prev.map(f => f.id === activeFlowId ? { ...f, ...changes, updated_at: new Date().toISOString() } : f))
  }, [activeFlowId])

  const updateScreen = useCallback((screenId, updatedScreen) => {
    setFlows(prev => prev.map(f => {
      if (f.id !== activeFlowId) return f
      return { ...f, screens: f.screens.map(s => s.id===screenId ? updatedScreen : s), updated_at: new Date().toISOString() }
    }))
  }, [activeFlowId])

  const addScreen = () => {
    const scr = mkScreen(`Screen ${(activeFlow?.screens?.length||0)+1}`)
    setFlows(prev => prev.map(f => f.id===activeFlowId ? { ...f, screens:[...f.screens, scr] } : f))
    setActiveScreenId(scr.id)
    showToast('Screen added')
  }

  const deleteScreen = (screenId) => {
    if (activeFlow.screens.length <= 1) { showToast('Cannot delete the only screen', 'error'); return }
    if (!confirm('Delete this screen?')) return
    const remaining = activeFlow.screens.filter(s => s.id !== screenId)
    setFlows(prev => prev.map(f => f.id===activeFlowId ? { ...f, screens: remaining } : f))
    if (activeScreenId === screenId) setActiveScreenId(remaining[0]?.id ?? null)
    showToast('Screen deleted')
  }

  const addComponent = (screenId, type) => {
    const comp = mkComp(type)
    const scr  = activeFlow.screens.find(s => s.id===screenId)
    updateScreen(screenId, { ...scr, components:[...scr.components, comp] })
    showToast(`${type} component added`)
  }

  const updateComp = useCallback((screenId, compId, updatedComp) => {
    const scr = activeFlow?.screens.find(s => s.id===screenId)
    if (!scr) return
    updateScreen(screenId, { ...scr, components: scr.components.map(c => c.id===compId ? updatedComp : c) })
  }, [activeFlow, updateScreen])

  const deleteComp = useCallback((screenId, compId) => {
    const scr = activeFlow?.screens.find(s => s.id===screenId)
    if (!scr) return
    updateScreen(screenId, { ...scr, components: scr.components.filter(c => c.id !== compId) })
  }, [activeFlow, updateScreen])

  const moveComp = useCallback((screenId, compId, dir) => {
    const scr = activeFlow?.screens.find(s => s.id===screenId)
    if (!scr) return
    const comps = [...scr.components]
    const idx = comps.findIndex(c => c.id===compId)
    if (dir==='up' && idx>0) { [comps[idx-1],comps[idx]] = [comps[idx],comps[idx-1]] }
    if (dir==='dn' && idx<comps.length-1) { [comps[idx],comps[idx+1]] = [comps[idx+1],comps[idx]] }
    updateScreen(screenId, { ...scr, components: comps })
  }, [activeFlow, updateScreen])

  // ── Create flow ───────────────────────────────────────────────────────────
  const handleCreateFlow = async () => {
    if (!newFlowForm.name.trim()) return
    const screens = selectedTemplate ? selectedTemplate.makeScreens() : [mkScreen('Welcome')]
    try {
      const { data } = await api.post('/flows', {
        ...newFlowForm,
        screens,
      })
      await loadFlows()
      setActiveFlowId(data.id)
      setActiveScreenId(data.screens?.[0]?.id ?? screens[0].id)
      setShowNewFlowModal(false)
      setNewFlowForm({ name:'', description:'', category:'OTHER' })
      setSelectedTemplate(null)
      showToast('Flow created!')
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Failed to create flow', 'error')
    }
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const errs = validateFlow(activeFlow)
    if (errs.length) { setValidationErrors(errs); setShowValidation(true); return }
    // Auto-mark last screen as terminal if none are marked (matches backend behaviour)
    const screens = activeFlow.screens || []
    const hasTerminal = screens.some(s => s.is_terminal)
    const finalScreens = hasTerminal
      ? screens
      : screens.map((s, i) => i === screens.length - 1 ? { ...s, is_terminal: true } : s)
    setSaving(true)
    try {
      await api.patch(`/flows/${activeFlow.id}`, {
        name:        activeFlow.name,
        description: activeFlow.description,
        category:    activeFlow.category,
        screens:     finalScreens,
      })
      await loadFlows()
      showToast('Flow saved')
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Publish (from editor) ─────────────────────────────────────────────────
  const handlePublish = async () => {
    const errs = validateFlow(activeFlow)
    if (errs.length) { setValidationErrors(errs); setShowValidation(true); return }
    if (!confirm(`Publish "${activeFlow.name}"?\n\nThis will upload the flow to Meta and make it live on WhatsApp.`)) return
    setPublishing(true)
    setPublishError(null)
    // Auto-mark last screen as terminal if none are marked
    const pubScreens = (activeFlow.screens || [])
    const pubHasTerminal = pubScreens.some(s => s.is_terminal)
    const finalPubScreens = pubHasTerminal
      ? pubScreens
      : pubScreens.map((s, i) => i === pubScreens.length - 1 ? { ...s, is_terminal: true } : s)
    try {
      await api.patch(`/flows/${activeFlow.id}`, { screens: finalPubScreens, name: activeFlow.name, category: activeFlow.category })
      await api.post(`/flows/${activeFlow.id}/publish`)
      await loadFlows()
      showToast('Flow published on WhatsApp! 🎉')
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Publish failed'
      setPublishError({ title: `Failed to publish "${activeFlow.name}"`, detail, flowId: activeFlow.id })
    } finally {
      setPublishing(false)
    }
  }

  // ── Quick publish from list (no editor open) ──────────────────────────────
  const handleQuickPublish = async (flowId) => {
    const flow = flows.find(f => f.id === flowId)
    if (!flow) return
    const errs = validateFlow(flow)
    if (errs.length) {
      setPublishError({ title: `Cannot publish "${flow.name}"`, detail: 'Fix these validation errors first:', errors: errs })
      return
    }
    if (!confirm(`Publish "${flow.name}" to WhatsApp?`)) return
    setQuickPublishId(flowId)
    setPublishError(null)
    try {
      await api.post(`/flows/${flowId}/publish`)
      await loadFlows()
      showToast(`"${flow.name}" published! 🎉`)
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Publish failed'
      setPublishError({ title: `Failed to publish "${flow.name}"`, detail, flowId })
    } finally {
      setQuickPublishId(null)
    }
  }

  // ── Sync status from Meta ─────────────────────────────────────────────────
  const handleSyncFromMeta = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const { data } = await api.post('/flows/meta-sync-all')
      setSyncResult(data)
      await loadFlows()
      if (data.updated_locally > 0) showToast(`Synced ${data.updated_locally} flow status${data.updated_locally !== 1 ? 'es' : ''} from Meta`)
      else showToast('All flow statuses are up to date')
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Sync failed. Check your WhatsApp connection.', 'error')
    } finally {
      setSyncing(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDeleteFlow = async (flowId) => {
    const flow = flows.find(f => f.id===flowId)
    if (!confirm(`Delete "${flow?.name}"? This cannot be undone.`)) return
    try {
      await api.delete(`/flows/${flowId}`)
      if (activeFlowId === flowId) { setActiveFlowId(null); setActiveScreenId(null) }
      await loadFlows()
      showToast('Flow deleted')
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Delete failed', 'error')
    }
  }

  // ── Duplicate ─────────────────────────────────────────────────────────────
  const handleDuplicate = async () => {
    try {
      await api.post('/flows', {
        name:        `${activeFlow.name} (copy)`,
        description: activeFlow.description,
        category:    activeFlow.category,
        screens:     activeFlow.screens,
      })
      await loadFlows()
      showToast('Flow duplicated')
    } catch {
      showToast('Duplicate failed', 'error')
    }
  }

  const filteredFlows = flows.filter(f =>
    !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase()) || f.category.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // ── Select flow ───────────────────────────────────────────────────────────
  const selectFlow = (flowId) => {
    const f = flows.find(fl => fl.id===flowId)
    setActiveFlowId(flowId)
    setActiveScreenId(f?.screens?.[0]?.id ?? null)
    setValidationErrors([])
    setShowValidation(false)
  }

  return (
    <div style={{ display:'flex', height:'100vh', background:'#0f1117', color:'#e6edf3', overflow:'hidden', fontFamily:"'Inter',system-ui,sans-serif" }}>

      {/* ── LEFT PANEL: Flow List ──────────────────────────────────────────── */}
      <aside style={{ width:'260px', flexShrink:0, display:'flex', flexDirection:'column', background:'#0d1117', borderRight:'1px solid #21262d', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ padding:'16px', borderBottom:'1px solid #21262d' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
            <div>
              <h2 style={{ fontSize:'14px', fontWeight:'700', color:'#e6edf3' }}>Flows</h2>
              <p style={{ fontSize:'11px', color:'#6e7681', marginTop:'2px' }}>{flows.length} total</p>
            </div>
            <div style={{ display:'flex', gap:'6px' }}>
              <button onClick={handleSyncFromMeta} disabled={syncing} title="Sync status from Meta"
                style={{ background:'#21262d', border:'1px solid #30363d', color:'#8b949e', borderRadius:'10px', padding:'7px 10px', fontSize:'11px', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px', fontFamily:'inherit' }}>
                {syncing ? '⏳' : '🔄'}
              </button>
              <button onClick={() => setShowNewFlowModal(true)}
                style={{ background:'linear-gradient(135deg,#22c55e,#0d9488)', border:'none', color:'#fff', borderRadius:'10px', padding:'7px 12px', fontSize:'12px', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', gap:'5px', whiteSpace:'nowrap' }}>
                + New
              </button>
            </div>
          </div>
          {/* Search */}
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search flows..."
            style={{ width:'100%', background:'#161b22', border:'1px solid #30363d', color:'#e6edf3', fontSize:'12px', borderRadius:'8px', padding:'7px 10px', outline:'none', boxSizing:'border-box' }} />
        </div>

        {/* Flow list */}
        <div style={{ flex:1, overflowY:'auto', padding:'8px' }}>
          {loading && (
            <div style={{ textAlign:'center', padding:'32px 16px', color:'#6e7681' }}>
              <p style={{ fontSize:'11px' }}>Loading…</p>
            </div>
          )}
          {!loading && filteredFlows.length === 0 && (
            <div style={{ textAlign:'center', padding:'32px 16px', color:'#6e7681' }}>
              <p style={{ fontSize:'28px', opacity:.3 }}>🌊</p>
              <p style={{ fontSize:'12px', marginTop:'8px' }}>No flows yet</p>
            </div>
          )}
          {filteredFlows.map(flow => (
            <div key={flow.id}
              onClick={() => selectFlow(flow.id)}
              style={{
                padding:'12px', borderRadius:'12px', marginBottom:'4px', cursor:'pointer',
                background: activeFlowId===flow.id ? 'rgba(56,139,253,.12)' : 'transparent',
                border: `1px solid ${activeFlowId===flow.id ? 'rgba(56,139,253,.3)' : 'transparent'}`,
                transition:'all .15s',
              }}
              onMouseEnter={e=>{ if(activeFlowId!==flow.id) e.currentTarget.style.background='rgba(255,255,255,.03)' }}
              onMouseLeave={e=>{ if(activeFlowId!==flow.id) e.currentTarget.style.background='transparent' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'8px' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:'12px', fontWeight:'600', color: activeFlowId===flow.id?'#388bfd':'#e6edf3', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{flow.name}</p>
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'5px', flexWrap:'wrap' }}>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_CLS[flow.status]||STATUS_CLS.DRAFT}`}>{flow.status}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${CAT_CLS[flow.category]||CAT_CLS.OTHER}`}>{flow.category.replace(/_/g,' ')}</span>
                  </div>
                  <p style={{ fontSize:'10px', color:'#6e7681', marginTop:'4px' }}>v{flow.version} · {flow.screens?.length} screen{flow.screens?.length!==1?'s':''} · {fmt(flow.updated_at)}</p>
                </div>
                <div style={{ display:'flex', gap:'4px', flexShrink:0 }} onClick={e => e.stopPropagation()}>
                  {flow.status === 'DRAFT' && (
                    <button
                      disabled={quickPublishId === flow.id}
                      onClick={e => { e.stopPropagation(); handleQuickPublish(flow.id) }}
                      title="Publish to WhatsApp"
                      style={{ background:'none', border:'none', color:'#3fb950', cursor:'pointer', fontSize:'11px', padding:'2px 4px', borderRadius:'4px', opacity: quickPublishId === flow.id ? .5 : 1 }}
                      onMouseEnter={e=>e.currentTarget.style.background='rgba(63,185,80,.12)'}
                      onMouseLeave={e=>e.currentTarget.style.background='none'}>
                      {quickPublishId === flow.id ? '⏳' : '🚀'}
                    </button>
                  )}
                  <button onClick={e => { e.stopPropagation(); handleDeleteFlow(flow.id) }}
                    style={{ background:'none', border:'none', color:'#6e7681', cursor:'pointer', fontSize:'11px', padding:'2px', borderRadius:'4px' }}
                    onMouseEnter={e=>e.currentTarget.style.color='#f85149'}
                    onMouseLeave={e=>e.currentTarget.style.color='#6e7681'}>🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom info */}
        <div style={{ padding:'12px 16px', borderTop:'1px solid #21262d', fontSize:'10px', color:'#6e7681', lineHeight:'1.5' }}>
          <p>💡 Flows are interactive screens sent via WhatsApp Business API</p>
        </div>
      </aside>

      {/* ── CENTER PANEL: Builder ─────────────────────────────────────────── */}
      <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>

        {!activeFlow ? (
          /* Empty state */
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'16px', color:'#6e7681' }}>
            <div style={{ fontSize:'64px', opacity:.15 }}>🔀</div>
            <div style={{ textAlign:'center' }}>
              <p style={{ fontSize:'16px', fontWeight:'600', color:'#8b949e' }}>No flow selected</p>
              <p style={{ fontSize:'13px', marginTop:'6px' }}>Select a flow from the left or create a new one</p>
            </div>
            <button onClick={() => setShowNewFlowModal(true)}
              style={{ background:'linear-gradient(135deg,#22c55e,#0d9488)', border:'none', color:'#fff', borderRadius:'12px', padding:'10px 20px', fontSize:'13px', fontWeight:'600', cursor:'pointer', marginTop:'8px' }}>
              + Create New Flow
            </button>
          </div>
        ) : (
          <>
            {/* Flow header */}
            <div style={{ padding:'10px 20px 8px', borderBottom:'1px solid #21262d', flexShrink:0 }}>
              {/* Row 1 — name + status + actions */}
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                {/* Name */}
                <input
                  value={activeFlow.name}
                  onChange={e => updateActiveFlow({ name:e.target.value })}
                  style={{ background:'transparent', border:'none', borderBottom:'1px solid transparent', color:'#e6edf3', fontSize:15, fontWeight:700, outline:'none', paddingBottom:1, fontFamily:'inherit', minWidth:0, flex:'0 1 auto', maxWidth:200 }}
                  onFocus={e => e.target.style.borderBottomColor='#388bfd'}
                  onBlur={e => e.target.style.borderBottomColor='transparent'}
                />
                {/* Status badge */}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_CLS[activeFlow.status]||STATUS_CLS.DRAFT}`} style={{ flexShrink:0 }}>
                  {activeFlow.status}
                </span>
                {/* Category */}
                <select value={activeFlow.category} onChange={e => updateActiveFlow({ category:e.target.value })}
                  style={{ background:'#0d1117', border:'1px solid #30363d', color:'#8b949e', fontSize:11, borderRadius:8, padding:'3px 6px', cursor:'pointer', flexShrink:0 }}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
                </select>
                {/* version · screens */}
                <span style={{ fontSize:11, color:'#484f58', flexShrink:0 }}>v{activeFlow.version} · {activeFlow.screens?.length || 0} screens</span>

                {/* Spacer */}
                <div style={{ flex:1 }} />

                {/* Action buttons */}
                <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                  {previewUrl && (
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize:11, fontWeight:600, color:'#388bfd', background:'rgba(56,139,253,.08)', border:'1px solid rgba(56,139,253,.2)', borderRadius:8, padding:'5px 10px', textDecoration:'none', display:'inline-flex', alignItems:'center', gap:4, whiteSpace:'nowrap' }}>
                      🔍 Preview
                    </a>
                  )}
                  <button onClick={handleDuplicate}
                    style={{ background:'#161b22', border:'1px solid #30363d', color:'#8b949e', borderRadius:8, padding:'5px 10px', fontSize:11, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                    Copy
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    style={{ background:'#21262d', border:'1px solid #30363d', color:'#e6edf3', borderRadius:8, padding:'5px 12px', fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontFamily:'inherit', opacity:saving ? .7 : 1, whiteSpace:'nowrap' }}>
                    {saving
                      ? <><svg style={{width:11,height:11,animation:'spin 1s linear infinite'}} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity=".3"/><path d="M22 12A10 10 0 0012 2" stroke="white" strokeWidth="3" strokeLinecap="round"/></svg>Saving…</>
                      : '💾 Save'}
                  </button>
                  {activeFlow.status !== 'PUBLISHED' ? (
                    <button onClick={handlePublish} disabled={publishing}
                      style={{ background:'linear-gradient(135deg,#22c55e,#0d9488)', border:'none', color:'white', borderRadius:8, padding:'5px 14px', fontSize:12, fontWeight:700, cursor: publishing ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', gap:5, fontFamily:'inherit', opacity: publishing ? .7 : 1, whiteSpace:'nowrap' }}>
                      {publishing ? 'Publishing…' : '🚀 Publish'}
                    </button>
                  ) : (
                    <button onClick={() => setShowSendModal(true)}
                      style={{ background:'linear-gradient(135deg,#a371f7,#6e40c9)', border:'none', color:'white', borderRadius:8, padding:'5px 14px', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontFamily:'inherit', whiteSpace:'nowrap' }}>
                      📤 Send
                    </button>
                  )}
                </div>
              </div>

              {/* Row 2 — description */}
              <input
                value={activeFlow.description || ''}
                onChange={e => updateActiveFlow({ description:e.target.value })}
                placeholder="Add a description…"
                style={{ background:'transparent', border:'none', color:'#6e7681', fontSize:11, outline:'none', fontFamily:'inherit', width:'100%', marginTop:4 }}
              />
            </div>

            {/* Validation errors */}
            {showValidation && validationErrors.length > 0 && (
              <div style={{ margin:'12px 20px', background:'rgba(248,81,73,.08)', border:'1px solid rgba(248,81,73,.2)', borderRadius:'12px', padding:'12px 16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <p style={{ fontSize:'12px', fontWeight:'600', color:'#f85149' }}>⚠ Flow validation errors</p>
                  <button onClick={() => setShowValidation(false)} style={{ background:'none', border:'none', color:'#6e7681', cursor:'pointer', fontSize:'14px' }}>×</button>
                </div>
                <ul style={{ marginTop:'8px', paddingLeft:'16px', fontSize:'12px', color:'#ff7b72', lineHeight:'1.7' }}>
                  {validationErrors.map((e,i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}

            {/* ReactFlow Canvas */}
            <div style={{ flex:1, position:'relative', overflow:'hidden' }}>
              {activeFlow.screens?.length === 0 ? (
                <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'12px', padding:'32px', textAlign:'center' }}>
                  <span style={{ fontSize:'40px', opacity:.4 }}>🗂️</span>
                  <p style={{ fontSize:'13px', fontWeight:'600', color:'#e6edf3' }}>No screens yet</p>
                  <p style={{ fontSize:'12px', color:'#6e7681', maxWidth:'280px', lineHeight:'1.6' }}>
                    {activeFlow.description?.startsWith('Imported from Meta')
                      ? 'This flow was imported from Meta and has no local screen data. You can still send it (it\'s live on Meta), or add screens here to rebuild it locally.'
                      : 'Add your first screen to start building this flow.'}
                  </p>
                  <button onClick={addScreen}
                    style={{ marginTop:'4px', background:'linear-gradient(135deg,#388bfd,#1f6feb)', border:'none', color:'white', borderRadius:'10px', padding:'8px 18px', fontSize:'12px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit' }}>
                    + Add Screen
                  </button>
                </div>
              ) : (
                <FlowCanvas
                  flow={activeFlow}
                  onUpdateFlow={updateActiveFlow}
                  selectedScreenId={activeScreenId}
                  onSelectScreen={id => { setActiveScreenId(id); if (id) setRightTab('edit') }}
                  onAddScreen={addScreen}
                />
              )}
            </div>
          </>
        )}
      </main>

      {/* ── RIGHT PANEL: Editor + Preview ────────────────────────────────── */}
      <aside style={{ width:'320px', flexShrink:0, display:'flex', flexDirection:'column', background:'#0d1117', borderLeft:'1px solid #21262d', overflow:'hidden' }}>

        {/* Tab bar */}
        <div style={{ display:'flex', borderBottom:'1px solid #21262d', flexShrink:0 }}>
          {['edit','preview'].map(tab => (
            <button key={tab} onClick={() => setRightTab(tab)}
              style={{
                flex:1, padding:'11px 0', fontSize:'12px', fontWeight:'600', cursor:'pointer',
                background:'none', border:'none', borderBottom:`2px solid ${rightTab===tab ? '#388bfd' : 'transparent'}`,
                color: rightTab===tab ? '#388bfd' : '#6e7681', transition:'all .15s', fontFamily:'inherit',
                textTransform:'capitalize',
              }}>
              {tab === 'edit' ? '✏️ Edit' : '📱 Preview'}
            </button>
          ))}
        </div>

        {/* ── EDIT TAB ── */}
        {rightTab === 'edit' && (
          <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column' }}>
            {!activeScreen ? (
              <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'10px', color:'#484f58', padding:'32px 20px', textAlign:'center' }}>
                <span style={{ fontSize:'32px', opacity:.3 }}>👆</span>
                <p style={{ fontSize:'12px', color:'#6e7681' }}>Click a screen node on the canvas to edit it</p>
              </div>
            ) : (
              <div style={{ padding:'14px 14px 20px', display:'flex', flexDirection:'column', gap:'12px' }}>

                {/* Screen title */}
                <div>
                  <label className="label">Screen title</label>
                  <input
                    value={activeScreen.title}
                    onChange={e => updateScreen(activeScreenId, { ...activeScreen, title:e.target.value })}
                    className="input"
                    placeholder="Screen title"
                  />
                </div>

                {/* Terminal toggle */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'rgba(255,255,255,.03)', border:'1px solid #21262d', borderRadius:'10px' }}>
                  <div>
                    <p style={{ fontSize:'12px', fontWeight:'600', color:'#e6edf3' }}>Terminal screen</p>
                    <p style={{ fontSize:'10px', color:'#6e7681', marginTop:'2px' }}>Marks end of the flow</p>
                  </div>
                  <button
                    onClick={() => updateScreen(activeScreenId, { ...activeScreen, is_terminal:!activeScreen.is_terminal })}
                    style={{
                      width:'36px', height:'20px', borderRadius:'10px', border:'none', cursor:'pointer',
                      background: activeScreen.is_terminal ? '#3fb950' : '#30363d', transition:'background .2s', position:'relative', flexShrink:0,
                    }}>
                    <span style={{
                      position:'absolute', top:'2px', left: activeScreen.is_terminal ? '18px' : '2px',
                      width:'16px', height:'16px', borderRadius:'50%', background:'white', transition:'left .2s', display:'block',
                    }} />
                  </button>
                </div>

                {/* Delete screen */}
                <button onClick={() => deleteScreen(activeScreenId)}
                  style={{ padding:'6px 12px', background:'rgba(248,81,73,.08)', border:'1px solid rgba(248,81,73,.2)', color:'#f85149', borderRadius:'8px', fontSize:'11px', fontWeight:'600', cursor:'pointer', fontFamily:'inherit', textAlign:'center' }}>
                  🗑 Delete this screen
                </button>

                {/* Divider */}
                <div style={{ borderTop:'1px solid #21262d', marginTop:'2px' }} />

                {/* Components label */}
                <p style={{ fontSize:'11px', fontWeight:'700', color:'#8b949e', textTransform:'uppercase', letterSpacing:'.05em' }}>
                  Components ({activeScreen.components.length})
                </p>

                {/* Component editors */}
                <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                  {activeScreen.components.map((comp, ci) => (
                    <ComponentEditor
                      key={comp.id}
                      comp={comp}
                      screens={activeFlow.screens.filter(s => s.id !== activeScreenId)}
                      onUpdate={updated => updateComp(activeScreenId, comp.id, updated)}
                      onDelete={() => deleteComp(activeScreenId, comp.id)}
                      onMoveUp={() => moveComp(activeScreenId, comp.id,'up')}
                      onMoveDown={() => moveComp(activeScreenId, comp.id,'dn')}
                      isFirst={ci===0}
                      isLast={ci===activeScreen.components.length-1}
                    />
                  ))}
                </div>

                {/* Add component */}
                <div style={{ position:'relative' }}>
                  <button onClick={() => setShowPanelAddMenu(v => !v)}
                    style={{
                      width:'100%', padding:'8px', border:'1px dashed #30363d', borderRadius:'10px',
                      background:'transparent', color:'#6e7681', fontSize:'12px', fontWeight:'600', cursor:'pointer',
                      fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', transition:'all .15s',
                    }}
                    onMouseEnter={e=>{ e.currentTarget.style.borderColor='rgba(56,139,253,.4)'; e.currentTarget.style.color='#388bfd' }}
                    onMouseLeave={e=>{ e.currentTarget.style.borderColor='#30363d'; e.currentTarget.style.color='#6e7681' }}>
                    + Add Component
                  </button>
                  {showPanelAddMenu && (
                    <div style={{ position:'absolute', bottom:'calc(100% + 6px)', left:0, right:0, background:'#161b22', border:'1px solid #30363d', borderRadius:'12px', boxShadow:'0 8px 24px rgba(0,0,0,.5)', zIndex:20, padding:'8px', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'6px' }}>
                      {COMP_DEFS.map(def => (
                        <button key={def.type}
                          onClick={() => { addComponent(activeScreenId, def.type); setShowPanelAddMenu(false) }}
                          style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', padding:'8px 4px', borderRadius:'8px', background:'rgba(255,255,255,.03)', border:'1px solid #21262d', cursor:'pointer', transition:'background .15s', fontFamily:'inherit' }}
                          onMouseEnter={e=>e.currentTarget.style.background='rgba(56,139,253,.1)'}
                          onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.03)'}>
                          <span style={{ fontSize:'16px' }}>{def.icon}</span>
                          <span style={{ fontSize:'10px', color:'#c9d1d9', fontWeight:'600' }}>{def.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PREVIEW TAB ── */}
        {rightTab === 'preview' && (
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            {/* Screen navigation tabs */}
            {activeFlow && (
              <div style={{ display:'flex', gap:'4px', padding:'8px', borderBottom:'1px solid #21262d', overflowX:'auto', flexShrink:0 }}>
                {activeFlow.screens.map((scr, i) => (
                  <button key={scr.id} onClick={() => setActiveScreenId(scr.id)}
                    style={{
                      flexShrink:0, padding:'4px 9px', borderRadius:'8px', fontSize:'10px', fontWeight:'600',
                      cursor:'pointer', transition:'all .15s', border:'1px solid', fontFamily:'inherit',
                      background: activeScreenId===scr.id ? 'rgba(56,139,253,.15)' : 'transparent',
                      borderColor: activeScreenId===scr.id ? 'rgba(56,139,253,.4)' : '#21262d',
                      color: activeScreenId===scr.id ? '#388bfd' : '#6e7681',
                    }}>
                    {i+1}
                  </button>
                ))}
              </div>
            )}
            <div style={{ flex:1, overflowY:'auto' }}>
              <PhonePreview screen={activeScreen} />
            </div>
            {activeScreen && (
              <div style={{ padding:'10px 14px', borderTop:'1px solid #21262d', fontSize:'10px', color:'#6e7681', lineHeight:'1.6', flexShrink:0 }}>
                <p>Screen {(activeFlow?.screens?.findIndex(s=>s.id===activeScreenId)??-1)+1} of {activeFlow?.screens?.length}</p>
                <p>{activeScreen.components.length} component{activeScreen.components.length!==1?'s':''} · {activeScreen.is_terminal ? '🔚 Terminal' : '→ Has next steps'}</p>
              </div>
            )}
          </div>
        )}

      </aside>

      {/* ── NEW FLOW MODAL ────────────────────────────────────────────────── */}
      {showNewFlowModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:'16px', backdropFilter:'blur(4px)' }}
          onClick={() => { setShowNewFlowModal(false); setSelectedTemplate(null) }}>
          <div style={{ background:'#161b22', border:'1px solid #30363d', borderRadius:'20px', width:'100%', maxWidth:'520px', maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 25px 50px rgba(0,0,0,.5)', overflow:'hidden' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding:'20px 24px', borderBottom:'1px solid #21262d', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div>
                <h2 style={{ fontSize:'15px', fontWeight:'700', color:'#e6edf3' }}>Create New Flow</h2>
                <p style={{ fontSize:'11px', color:'#6e7681', marginTop:'2px' }}>Define an interactive WhatsApp experience</p>
              </div>
              <button onClick={() => { setShowNewFlowModal(false); setSelectedTemplate(null) }} style={{ background:'none', border:'none', color:'#6e7681', cursor:'pointer', fontSize:'18px' }}>×</button>
            </div>

            <div style={{ flex:1, overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:'16px' }}>

              {/* Template picker */}
              <div>
                <label className="label">Start from a template</label>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'8px', marginBottom:'4px' }}>
                  {FLOW_TEMPLATES.map(tpl => (
                    <button key={tpl.id} onClick={() => {
                      const isSame = selectedTemplate?.id === tpl.id
                      setSelectedTemplate(isSame ? null : tpl)
                      if (!isSame) setNewFlowForm(p => ({ ...p, name: p.name || tpl.name, description: p.description || tpl.description, category: tpl.category }))
                    }}
                      style={{
                        display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', borderRadius:'12px',
                        background: selectedTemplate?.id === tpl.id ? 'rgba(56,139,253,.12)' : 'rgba(255,255,255,.03)',
                        border:`1px solid ${selectedTemplate?.id === tpl.id ? 'rgba(56,139,253,.4)' : '#21262d'}`,
                        cursor:'pointer', textAlign:'left', fontFamily:'inherit', transition:'all .15s',
                      }}>
                      <span style={{ fontSize:'20px', flexShrink:0 }}>{tpl.icon}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:'11px', fontWeight:'700', color: selectedTemplate?.id === tpl.id ? '#388bfd' : '#e6edf3', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{tpl.name}</p>
                        <p style={{ fontSize:'10px', color:'#6e7681', marginTop:'2px', lineHeight:'1.3' }}>{tpl.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
                {selectedTemplate && (
                  <p style={{ fontSize:'10px', color:'#3fb950', marginTop:'4px' }}>
                    ✓ {selectedTemplate.name} — {selectedTemplate.makeScreens().length} pre-built screens will be added. Click again to deselect.
                  </p>
                )}
                {!selectedTemplate && (
                  <p style={{ fontSize:'10px', color:'#6e7681', marginTop:'4px' }}>Or skip templates and start with a blank screen.</p>
                )}
              </div>

              <div style={{ borderTop:'1px solid #21262d', paddingTop:'16px', display:'flex', flexDirection:'column', gap:'14px' }}>
                <div>
                  <label className="label">Flow name *</label>
                  <input value={newFlowForm.name} onChange={e => setNewFlowForm(p => ({...p, name:e.target.value}))}
                    placeholder="e.g. Customer Onboarding" className="input" autoFocus
                    onKeyDown={e => e.key==='Enter' && handleCreateFlow()} />
                </div>
                <div>
                  <label className="label">Description</label>
                  <input value={newFlowForm.description} onChange={e => setNewFlowForm(p => ({...p, description:e.target.value}))}
                    placeholder="What does this flow do?" className="input" />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select value={newFlowForm.category} onChange={e => setNewFlowForm(p => ({...p, category:e.target.value}))} className="input">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ padding:'16px 24px', borderTop:'1px solid #21262d', display:'flex', justifyContent:'flex-end', gap:'10px', flexShrink:0 }}>
              <button onClick={() => { setShowNewFlowModal(false); setSelectedTemplate(null) }}
                style={{ padding:'9px 18px', background:'transparent', border:'1px solid #30363d', color:'#8b949e', borderRadius:'10px', fontSize:'13px', cursor:'pointer', fontFamily:'inherit' }}>
                Cancel
              </button>
              <button onClick={handleCreateFlow} disabled={!newFlowForm.name.trim()}
                style={{ padding:'9px 20px', background:'linear-gradient(135deg,#22c55e,#0d9488)', border:'none', color:'white', borderRadius:'10px', fontSize:'13px', fontWeight:'700', cursor:newFlowForm.name.trim()?'pointer':'default', opacity:newFlowForm.name.trim()?1:.5, fontFamily:'inherit' }}>
                {selectedTemplate ? `✅ Create from Template` : '✅ Create Flow'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SEND TO CONTACTS MODAL ───────────────────────────────────────── */}
      {showSendModal && activeFlow && (
        <SendToContactsModal
          flow={activeFlow}
          onClose={() => setShowSendModal(false)}
          showToast={showToast}
        />
      )}

      {/* ── PUBLISH ERROR MODAL ──────────────────────────────────────────── */}
      {publishError && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:70, padding:16, backdropFilter:'blur(4px)' }}
          onClick={() => setPublishError(null)}>
          <div style={{ background:'#161b22', border:'1px solid rgba(248,81,73,.3)', borderRadius:16, width:'100%', maxWidth:440, boxShadow:'0 20px 40px rgba(0,0,0,.5)', overflow:'hidden' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #21262d', display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:18 }}>⚠️</span>
              <p style={{ fontSize:13, fontWeight:700, color:'#f85149', flex:1 }}>{publishError.title}</p>
              <button onClick={() => setPublishError(null)} style={{ background:'none', border:'none', color:'#6e7681', cursor:'pointer', fontSize:18 }}>×</button>
            </div>
            <div style={{ padding:'14px 20px 20px', display:'flex', flexDirection:'column', gap:10 }}>
              <p style={{ fontSize:12, color:'#ff7b72', lineHeight:1.6 }}>{publishError.detail}</p>
              {publishError.errors?.length > 0 && (
                <ul style={{ margin:0, paddingLeft:16, fontSize:12, color:'#ff7b72', lineHeight:1.8 }}>
                  {publishError.errors.map((e,i) => <li key={i}>{e}</li>)}
                </ul>
              )}
              {publishError.flowId && (
                <button
                  onClick={async () => {
                    if (!confirm('This will clear the stuck Meta flow ID and register a fresh one on Meta. Continue?')) return
                    try {
                      await api.post(`/flows/${publishError.flowId}/reset-meta-id`)
                      setPublishError(null)
                      showToast('Meta ID reset. Try publishing again.')
                    } catch (e) {
                      showToast(e?.response?.data?.detail || 'Reset failed', 'error')
                    }
                  }}
                  style={{ padding:'8px 14px', background:'rgba(248,81,73,.1)', border:'1px solid rgba(248,81,73,.3)', color:'#f85149', borderRadius:10, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}
                >
                  Reset & Re-register on Meta
                </button>
              )}
              <button onClick={() => setPublishError(null)}
                style={{ alignSelf:'flex-end', padding:'8px 20px', background:'#21262d', border:'1px solid #30363d', color:'#e6edf3', borderRadius:10, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SYNC RESULT BANNER ───────────────────────────────────────────── */}
      {syncResult?.not_imported?.length > 0 && (
        <div style={{ position:'fixed', bottom:70, left:'50%', transform:'translateX(-50%)', background:'#161b22', border:'1px solid rgba(56,139,253,.3)', borderRadius:14, padding:'12px 20px', boxShadow:'0 8px 24px rgba(0,0,0,.4)', zIndex:90, maxWidth:440, width:'calc(100% - 32px)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <p style={{ fontSize:12, fontWeight:700, color:'#388bfd' }}>📥 {syncResult.not_imported.length} Meta flow{syncResult.not_imported.length!==1?'s':''} not yet imported</p>
            <button onClick={() => setSyncResult(null)} style={{ background:'none', border:'none', color:'#6e7681', cursor:'pointer', fontSize:16 }}>×</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:120, overflowY:'auto' }}>
            {syncResult.not_imported.map(mf => (
              <div key={mf.meta_flow_id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                <span style={{ fontSize:11, color:'#c9d1d9', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{mf.name} <span style={{ color:'#6e7681' }}>({mf.status})</span></span>
                <button
                  onClick={async () => {
                    try {
                      await api.post(`/flows/import-meta/${mf.meta_flow_id}`)
                      await loadFlows()
                      setSyncResult(p => ({ ...p, not_imported: p.not_imported.filter(x => x.meta_flow_id !== mf.meta_flow_id) }))
                      showToast(`"${mf.name}" imported`)
                    } catch (err) {
                      showToast(err?.response?.data?.detail || 'Import failed', 'error')
                    }
                  }}
                  style={{ background:'rgba(56,139,253,.12)', border:'1px solid rgba(56,139,253,.25)', color:'#388bfd', borderRadius:8, padding:'3px 10px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                  Import
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TOAST ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)',
          background: toast.type==='error' ? '#2d1010' : '#0d2818',
          border: `1px solid ${toast.type==='error' ? 'rgba(248,81,73,.3)' : 'rgba(34,197,94,.3)'}`,
          color: toast.type==='error' ? '#f85149' : '#3fb950',
          padding:'10px 20px', borderRadius:'12px', fontSize:'13px', fontWeight:'600',
          boxShadow:'0 8px 24px rgba(0,0,0,.4)', zIndex:100, animation:'fadeIn .2s ease',
          display:'flex', alignItems:'center', gap:'8px',
        }}>
          <span>{toast.type==='error' ? '⚠' : '✓'}</span> {toast.msg}
        </div>
      )}

      <style>{`
        .label { display:block; font-size:11px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px; }
        .input { width:100%; background:#1e293b; border:1px solid #334155; color:#e2e8f0; font-size:13px; border-radius:10px; padding:8px 12px; outline:none; transition:border-color .15s; box-sizing:border-box; font-family:inherit; }
        .input:focus { border-color:#3b82f6; }
        .input option { background:#1e293b; }
        textarea.input { font-family:inherit; }
        @keyframes spin { to { transform:rotate(360deg) } }
        @keyframes fadeIn { from { opacity:0; transform:translate(-50%,8px) } to { opacity:1; transform:translate(-50%,0) } }
        details summary::-webkit-details-marker { display:none }
      `}</style>
    </div>
  )
}
