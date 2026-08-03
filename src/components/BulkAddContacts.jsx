import { useState, useRef } from 'react'
import api from '../services/api'

// Reusable "Bulk Add Contacts" modal — three ways to add contacts:
//   • Upload file   — .xlsx / .csv, parsed server-side   → /contacts/import-file
//   • Add rows      — a small Name + Phone + Tags table   → /contacts/bulk
//   • Paste numbers — raw phone numbers, no other details → /contacts/raw
// onDone() is called after a successful add so the caller can refresh its list.
export default function BulkAddContacts({ onClose, onDone }) {
  const [tab, setTab] = useState('rows')          // rows | file | paste
  const [file, setFile] = useState(null)
  const [rows, setRows] = useState([{ name: '', phone: '', tags: '' }, { name: '', phone: '', tags: '' }, { name: '', phone: '', tags: '' }])
  const [numbers, setNumbers] = useState('')
  const [tags, setTags] = useState('')
  const [optedIn, setOptedIn] = useState(false)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef()

  const tagList = s => (s || '').split(/[,;]/).map(t => t.trim()).filter(Boolean)

  const done = data => { setResult(data); onDone && onDone() }
  const fail = e => setResult({ error: e.response?.data?.detail || 'Failed to add contacts' })

  const importFile = async () => {
    if (!file) return
    setLoading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const { data } = await api.post('/contacts/import-file', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000 })
      done(data)
    } catch (e) { fail(e) }
    setLoading(false)
  }

  const addRows = async () => {
    const contacts = rows
      .filter(r => r.phone.trim())
      .map(r => ({ wa_id: r.phone.trim(), profile_name: r.name.trim(), tags: tagList(r.tags), opted_in: true }))
    if (!contacts.length) return
    setLoading(true)
    try {
      const { data } = await api.post('/contacts/bulk', { contacts }, { timeout: 180000 })
      done(data)
    } catch (e) { fail(e) }
    setLoading(false)
  }

  const addPaste = async () => {
    const nums = numbers.split(/[\n,;]+/).map(n => n.trim()).filter(Boolean)
    if (!nums.length) return
    setLoading(true)
    try {
      const { data } = await api.post('/contacts/raw', { numbers: nums, tags: tagList(tags), opted_in: optedIn }, { timeout: 180000 })
      done(data)
    } catch (e) { fail(e) }
    setLoading(false)
  }

  const rowsFilled = rows.filter(r => r.phone.trim()).length
  const pasteCount = numbers.split(/[\n,;]+/).map(n => n.trim()).filter(Boolean).length
  const setRow = (i, k, v) => setRows(rs => rs.map((r, j) => j === i ? { ...r, [k]: v } : r))
  const inp = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500'

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden text-slate-100" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-sm font-semibold">Bulk add contacts</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-xl leading-none">&times;</button>
        </div>

        {result ? (
          <div className="p-8 flex flex-col items-center gap-4 text-center">
            {result.error ? (
              <>
                <div className="w-14 h-14 rounded-full bg-red-900/20 border border-red-800/40 flex items-center justify-center text-2xl">✗</div>
                <h3 className="text-sm font-semibold text-red-400">Couldn’t add contacts</h3>
                <p className="text-xs text-slate-500">{result.error}</p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-emerald-900/20 border border-emerald-800/40 flex items-center justify-center text-2xl">✓</div>
                <h3 className="text-sm font-semibold">Import complete</h3>
                <div className="flex gap-6 mt-2">
                  {[
                    ['Added',      result.created,     'text-emerald-400'],
                    ['Duplicates', result.skipped,     'text-slate-400'],
                    ['Failed',     result.invalid ?? 0,'text-red-400'],
                    ['Total',      result.total,       'text-white'],
                  ].map(([l, v, c]) => (
                    <div key={l} className="flex flex-col items-center gap-1">
                      <span className={`text-2xl font-bold ${c}`}>{(v ?? 0).toLocaleString()}</span>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">{l}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 max-w-xs">
                  <b className="text-emerald-400">{(result.created ?? 0).toLocaleString()}</b> added successfully,
                  {' '}<b className="text-slate-300">{(result.skipped ?? 0).toLocaleString()}</b> already existed,
                  {' '}<b className="text-red-400">{(result.invalid ?? 0).toLocaleString()}</b> failed (invalid numbers).
                </p>
              </>
            )}
            <button onClick={onClose} className="mt-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-xl">Done</button>
          </div>
        ) : (
          <>
            <div className="flex gap-1 px-5 pt-4">
              {[['rows', 'Add rows'], ['file', 'Upload file'], ['paste', 'Paste numbers']].map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${tab === k ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>{label}</button>
              ))}
            </div>

            {/* Add rows (name + phone + tags) */}
            {tab === 'rows' && (
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-[1fr_1fr_0.8fr_auto] gap-2 text-[10px] uppercase tracking-wider text-slate-500 px-0.5">
                  <span>Name</span><span>Phone (with country code)</span><span>Tags</span><span></span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {rows.map((r, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_0.8fr_auto] gap-2 items-center">
                      <input value={r.name} onChange={e => setRow(i, 'name', e.target.value)} placeholder="John Doe" className={inp} />
                      <input value={r.phone} onChange={e => setRow(i, 'phone', e.target.value)} placeholder="919876543210" className={`${inp} font-mono`} />
                      <input value={r.tags} onChange={e => setRow(i, 'tags', e.target.value)} placeholder="vip" className={inp} />
                      <button onClick={() => setRows(rs => rs.length > 1 ? rs.filter((_, j) => j !== i) : rs)} className="text-slate-500 hover:text-red-400 text-lg leading-none px-1">×</button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setRows(rs => [...rs, { name: '', phone: '', tags: '' }])} className="text-xs text-blue-400 hover:text-blue-300">+ Add row</button>
                <div className="flex justify-end">
                  <button onClick={addRows} disabled={!rowsFilled || loading}
                    className="px-5 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl">
                    {loading ? 'Adding…' : `Add ${rowsFilled || ''} contact${rowsFilled === 1 ? '' : 's'}`}
                  </button>
                </div>
              </div>
            )}

            {/* Upload file */}
            {tab === 'file' && (
              <div className="p-5 space-y-4">
                <div onClick={() => fileRef.current.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer group">
                  <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={e => setFile(e.target.files[0] || null)} />
                  <div className="text-4xl">📂</div>
                  {file ? <p className="text-sm font-medium text-emerald-300">{file.name}</p>
                        : <p className="text-sm font-medium text-slate-300 group-hover:text-white">Click to upload Excel (.xlsx) or CSV</p>}
                  <p className="text-xs text-slate-500 text-center">First row = headers. Needs a <b>phone</b> column. Name, email, tags &amp; opt-in optional.</p>
                </div>
                <div className="flex justify-end">
                  <button onClick={importFile} disabled={!file || loading} className="px-5 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl">
                    {loading ? 'Importing…' : 'Import file'}
                  </button>
                </div>
              </div>
            )}

            {/* Paste numbers */}
            {tab === 'paste' && (
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">Phone numbers — one per line or comma-separated</label>
                  <textarea value={numbers} onChange={e => setNumbers(e.target.value)} rows={6} placeholder={'919876543210\n919812345678'}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 font-mono outline-none focus:border-blue-500 resize-none" />
                  <p className="text-[11px] text-slate-500 mt-1">{pasteCount} number{pasteCount === 1 ? '' : 's'} · invalid ones are skipped</p>
                </div>
                <input value={tags} onChange={e => setTags(e.target.value)} placeholder="Tags (optional), comma-separated"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500" />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={optedIn} onChange={e => setOptedIn(e.target.checked)} className="accent-blue-600" />
                  <span className="text-xs text-slate-300">Mark as WhatsApp opted-in <span className="text-slate-500">(optional)</span></span>
                </label>
                <div className="flex justify-end">
                  <button onClick={addPaste} disabled={!pasteCount || loading} className="px-5 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl">
                    {loading ? 'Adding…' : `Add ${pasteCount || ''} contact${pasteCount === 1 ? '' : 's'}`}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
