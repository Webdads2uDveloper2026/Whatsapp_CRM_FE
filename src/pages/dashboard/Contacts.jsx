import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import BulkAddContacts from "../../components/BulkAddContacts";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

const STATUSES = ["New", "Contacted", "Qualified", "Closed"];
const LIMIT = 20;

const STATUS_STYLES = {
  New: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Contacted: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Qualified: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Closed: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

const fmt = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString([], {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

const AVATAR_COLORS = [
  "bg-violet-600",
  "bg-cyan-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-blue-600",
  "bg-pink-600",
];

function Avatar({ name = "", size = "sm" }) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const color = AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
  const initials =
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "#";
  const sz = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-16 h-16 text-xl",
  }[size];
  return (
    <div
      className={`${sz} ${color} rounded-full flex items-center justify-center font-bold text-white shrink-0 select-none`}
    >
      {initials}
    </div>
  );
}

function Badge({ status }) {
  return (
    <span
      className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[status] || STATUS_STYLES.New}`}
    >
      {status || "New"}
    </span>
  );
}

// WhatsApp registration status — evidence-based (see backend wa_status service).
const WA_STATUS = {
  active:     { label: "On WhatsApp",       cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400", dot: "bg-emerald-400" },
  not_active: { label: "WhatsApp Not Active", cls: "bg-red-500/10 border-red-500/30 text-red-400",           dot: "bg-red-500" },
  unknown:    { label: "Unknown",            cls: "bg-slate-700/40 border-slate-600 text-slate-400",         dot: "bg-slate-500" },
};

function WaStatus({ status, profileName, showName = false }) {
  const s = WA_STATUS[status] || WA_STATUS.unknown;
  return (
    <span
      title={
        status === "active"
          ? `On WhatsApp${profileName ? ` — ${profileName}` : ""}`
          : status === "not_active"
            ? "This number is not registered on WhatsApp"
            : "WhatsApp status not known yet — confirmed once they message you or you message them"
      }
      className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.cls}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {showName && status === "active" && profileName ? profileName : s.label}
    </span>
  );
}

function Tag({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
      {label}
      {onRemove && (
        <button
          onClick={() => onRemove(label)}
          className="text-blue-300 hover:text-red-400 transition-colors leading-none"
        >
          &times;
        </button>
      )}
    </span>
  );
}

// ── Contact Modal ─────────────────────────────────────────────────────────────
function ContactModal({ contact, agents, onSave, onClose }) {
  const isEdit = !!contact?.id;
  const [form, setForm] = useState({
    wa_id: contact?.wa_id || "",
    profile_name: contact?.profile_name || "",
    email: contact?.email || "",
    tags: contact?.tags || [],
    status: contact?.status || "New",
    assigned_to: contact?.assigned_to || "",
    notes: contact?.notes || "",
    opted_in: contact?.opted_in || false,
  });
  const [tagInput, setTagInput] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) =>
    setForm((p) => ({ ...p, [k]: e.target?.value ?? e }));

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t))
      setForm((p) => ({ ...p, tags: [...p.tags, t] }));
    setTagInput("");
  };

  const validate = () => {
    const e = {};
    const clean = form.wa_id.replace(/[\s+\-()]/g, "");
    if (!clean) e.wa_id = "Phone number is required";
    else if (!/^\d{7,15}$/.test(clean))
      e.wa_id = "Enter digits only with country code (e.g. 919876543210)";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = { ...form, wa_id: form.wa_id.replace(/[\s+\-()]/g, "") };
      const { data } = isEdit
        ? await api.patch(`/contacts/${contact.id}`, payload)
        : await api.post("/contacts", payload);
      onSave(data);
      onClose();
    } catch (err) {
      setErrors({ submit: err.response?.data?.detail || "Save failed" });
    }
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 pb-0">
          <h2 className="text-base font-semibold">
            {isEdit ? "Edit Contact" : "Add Contact"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 text-xl leading-none transition-colors"
          >
            &times;
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          {errors.submit && (
            <div className="bg-red-900/20 border border-red-800/40 text-red-400 text-sm px-4 py-2.5 rounded-xl">
              {errors.submit}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Phone */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Phone number <span className="text-red-400">*</span>
              </label>
              <PhoneInput
                country="in"
                value={form.wa_id}
                disabled={isEdit}
                enableSearch
                searchPlaceholder="Search country..."
                onChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    wa_id: value,
                  }))
                }
                containerStyle={{
                  width: "100%",
                }}
                inputStyle={{
                  width: "100%",
                  height: "46px",
                  background: "#1e293b",
                  border: errors.wa_id
                    ? "1px solid #ef4444"
                    : "1px solid #334155",
                  color: "#fff",
                  borderRadius: "12px",
                  paddingLeft: "50px",
                  fontSize: "14px",
                }}
                buttonStyle={{
                  background: "#1e293b",
                  border: errors.wa_id
                    ? "1px solid #ef4444"
                    : "1px solid #334155",
                  borderTopLeftRadius: "12px",
                  borderBottomLeftRadius: "12px",
                }}
                dropdownStyle={{
                  background: "#0f172a",
                  color: "#fff",
                  border: "1px solid #334155",
                }}
              />
              {errors.wa_id && (
                <p className="text-xs text-red-400 mt-1">{errors.wa_id}</p>
              )}
              <p className="text-xs text-slate-500 mt-1">
                Country code + number, no + sign
              </p>
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Full name
              </label>
              <input
                value={form.profile_name}
                onChange={set("profile_name")}
                placeholder="John Doe"
                className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="john@example.com"
                className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Status
              </label>
              <select
                value={form.status}
                onChange={set("status")}
                className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 text-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none cursor-pointer transition-colors appearance-none"
              >
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Agent */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Assign agent
              </label>
              <select
                value={form.assigned_to}
                onChange={set("assigned_to")}
                className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 text-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none cursor-pointer transition-colors appearance-none"
              >
                <option value="">Unassigned</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Tags
              </label>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 space-y-2">
                {form.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {form.tags.map((t) => (
                      <Tag
                        key={t}
                        label={t}
                        onRemove={(t) =>
                          setForm((p) => ({
                            ...p,
                            tags: p.tags.filter((x) => x !== t),
                          }))
                        }
                      />
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="Type tag + Enter"
                    className="flex-1 bg-transparent text-xs text-slate-300 placeholder-slate-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors px-1"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={set("notes")}
                rows={3}
                placeholder="Internal notes…"
                className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none resize-none transition-colors font-[inherit]"
              />
            </div>

            {/* Opted in */}
            <div className="col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.opted_in}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, opted_in: e.target.checked }))
                  }
                  className="w-4 h-4 rounded accent-emerald-500"
                />
                <span className="text-sm text-slate-300">
                  Opted in for WhatsApp messages
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl transition-colors"
            >
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Contact Drawer ────────────────────────────────────────────────────────────
function ContactDrawer({ contact, agents, onUpdate, onClose, onOpenChat }) {
  const [editing, setEditing] = useState(false);
  return (
    <div
      className="fixed inset-0 bg-black/50 z-40 flex justify-end"
      onClick={onClose}
    >
      <div
        className="w-80 bg-slate-950 border-l border-slate-800 flex flex-col overflow-hidden animate-[slideIn_.2s_ease]"
        style={{ animation: "slideIn .2s ease" }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800">
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 text-sm transition-colors"
          >
            ←
          </button>
          <h3 className="flex-1 text-sm font-semibold">Contact details</h3>
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20 transition-colors"
          >
            Edit
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Hero */}
          <div className="flex items-center gap-4">
            <Avatar name={contact.profile_name || contact.wa_id} size="md" />
            <div>
              <p className="text-sm font-semibold">
                {contact.profile_name || (
                  <span className="text-slate-400">No name</span>
                )}
              </p>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                +{contact.wa_id}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge status={contact.status} />
                <WaStatus
                  status={contact.wa_status}
                  profileName={contact.profile_name}
                  showName
                />
              </div>
            </div>
          </div>

          {/* Open chat */}
          <button
            onClick={() => onOpenChat(contact)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-800/50 text-emerald-400 text-xs font-medium rounded-xl transition-colors"
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-3.5 h-3.5"
            >
              <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H6l-4 4V5z" />
            </svg>
            Open Chat
          </button>

          {/* Info */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
              Info
            </p>
            <div className="space-y-2">
              {[
                { label: "Phone", value: `+${contact.wa_id}`, mono: true },
                { label: "Email", value: contact.email || "—" },
                {
                  label: "Opted in",
                  value: contact.opted_in ? "✓ Yes" : "—",
                  cls: contact.opted_in ? "text-emerald-400" : "text-slate-500",
                },
                { label: "Added", value: fmt(contact.created_at) },
                {
                  label: "Agent",
                  value:
                    agents.find((a) => a.id === contact.assigned_to)?.name ||
                    "—",
                },
              ].map((r) => (
                <div
                  key={r.label}
                  className="flex justify-between items-center py-1.5 border-b border-slate-800/50 last:border-0"
                >
                  <span className="text-xs text-slate-500">{r.label}</span>
                  <span
                    className={`text-xs text-right max-w-[160px] truncate ${r.cls || "text-slate-300"} ${r.mono ? "font-mono" : ""}`}
                  >
                    {r.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Tags */}
          {(contact.tags || []).length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {contact.tags.map((t) => (
                  <Tag key={t} label={t} />
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {contact.notes && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                Notes
              </p>
              <p className="text-xs text-slate-300 bg-slate-800 rounded-xl px-3 py-2.5 leading-relaxed">
                {contact.notes}
              </p>
            </div>
          )}
        </div>

        {editing && (
          <ContactModal
            contact={contact}
            agents={agents}
            onSave={(u) => {
              onUpdate(u);
              setEditing(false);
            }}
            onClose={() => setEditing(false)}
          />
        )}
      </div>
    </div>
  );
}

// ── Main Contacts Page ────────────────────────────────────────────────────────
export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [filterAgent, setFilterAgent] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editContact, setEditContact] = useState(null);
  const [drawerContact, setDrawerContact] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");

  const load = useCallback(
    async (p = 1) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: p, limit: LIMIT });
        if (search) params.append("search", search);
        if (filterStatus) params.append("status", filterStatus);
        if (filterTag) params.append("tag", filterTag);
        if (filterAgent) params.append("assigned_to", filterAgent);
        const { data } = await api.get(`/contacts?${params}`);
        setContacts(data.contacts || []);
        setTotal(data.total || 0);
        setPage(p);
      } catch {}
      setLoading(false);
    },
    [search, filterStatus, filterTag, filterAgent],
  );

  useEffect(() => {
    load(1);
  }, [load]);
  useEffect(() => {
    api
      .get("/agents")
      .then((r) => setAgents(r.data || []))
      .catch(() => {});
  }, []);

  const allTags = [...new Set(contacts.flatMap((c) => c.tags || []))];
  const pages = Math.ceil(total / LIMIT);
  const selectAll = () =>
    selected.size === contacts.length
      ? setSelected(new Set())
      : setSelected(new Set(contacts.map((c) => c.id)));
  const toggleSel = (id) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };

  const deleteSelected = async () => {
    if (!confirm(`Delete ${selected.size} contacts?`)) return;
    try {
      await Promise.all(
        [...selected].map((id) => api.delete(`/contacts/${id}`)),
      );
      setSelected(new Set());
      load(1);
    } catch (e) {
      alert(e.response?.data?.detail || "Delete failed");
    }
  };

  const exportCSV = () => {
    const rows = [
      ["Name", "Phone", "Email", "Tags", "Status", "Opted In", "Added"],
      ...contacts.map((c) => [
        c.profile_name || "",
        c.wa_id,
        c.email || "",
        (c.tags || []).join(";"),
        c.status || "New",
        c.opted_in ? "Yes" : "No",
        fmt(c.created_at),
      ]),
    ];
    const blob = new Blob(
      [rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n")],
      { type: "text/csv" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "contacts.csv";
    a.click();
  };

  const openChat = (c) =>
    navigate("/dashboard/inbox", {
      state: { wa_id: c.wa_id, contact_id: c.id, contact_name: c.profile_name },
    });

  return (
    <div className="p-6 max-w-screen-xl font-sans text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Contacts</h1>
          <span className="text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-400 px-2.5 py-0.5 rounded-full">
            {total.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl transition-colors"
          >
            <svg
              viewBox="0 0 16 16"
              fill="currentColor"
              className="w-3.5 h-3.5"
            >
              <path d="M2 13h12v1.5H2zm6-1.5L4 7h3V2h2v5h3z" />
            </svg>
            Export
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl transition-colors"
          >
            <svg
              viewBox="0 0 16 16"
              fill="currentColor"
              className="w-3.5 h-3.5"
            >
              <path d="M2 13h12v1.5H2zm6-9.5L12 8H9v5H7V8H4z" />
            </svg>
            Import
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors"
          >
            + Add contact
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-900/60 border border-slate-800 rounded-2xl mb-4">
        <div className="relative flex-1 min-w-48">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500"
            viewBox="0 0 20 20"
            fill="none"
          >
            <circle
              cx="8.5"
              cy="8.5"
              r="5.5"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M13 13l3.5 3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <input
            className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-xl py-2 pl-9 pr-4 text-sm text-slate-200 placeholder-slate-500 outline-none transition-colors"
            placeholder="Search name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {[
          {
            value: filterStatus,
            set: setFilterStatus,
            opts: STATUSES,
            label: "All statuses",
          },
          {
            value: filterTag,
            set: setFilterTag,
            opts: allTags,
            label: "All tags",
          },
          {
            value: filterAgent,
            set: setFilterAgent,
            opts: agents.map((a) => ({ v: a.id, l: a.name })),
            label: "All agents",
          },
        ].map((f, i) => (
          <select
            key={i}
            value={f.value}
            onChange={(e) => f.set(e.target.value)}
            className="bg-slate-800 border border-slate-700 focus:border-blue-500 text-slate-300 text-sm rounded-xl px-3 py-2 outline-none cursor-pointer appearance-none transition-colors min-w-36"
          >
            <option value="">{f.label}</option>
            {f.opts.map((o) =>
              typeof o === "string" ? (
                <option key={o} value={o}>
                  {o}
                </option>
              ) : (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ),
            )}
          </select>
        ))}

        {(search || filterStatus || filterTag || filterAgent) && (
          <button
            onClick={() => {
              setSearch("");
              setFilterStatus("");
              setFilterTag("");
              setFilterAgent("");
            }}
            className="text-xs text-slate-400 hover:text-slate-200 bg-slate-800 border border-slate-700 px-3 py-2 rounded-xl transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-500/5 border border-blue-500/20 rounded-xl mb-4 text-sm">
          <span className="text-blue-400 font-medium">
            {selected.size} selected
          </span>
          <button
            onClick={deleteSelected}
            className="px-3 py-1 text-xs font-medium bg-red-900/20 hover:bg-red-900/40 border border-red-800/40 text-red-400 rounded-lg transition-colors"
          >
            Delete
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 border border-slate-700 rounded-lg transition-colors"
          >
            Deselect all
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/40">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={
                      selected.size === contacts.length && contacts.length > 0
                    }
                    onChange={selectAll}
                    className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
                  />
                </th>
                {[
                  "Contact",
                  "Phone",
                  "WhatsApp",
                  "Tags",
                  "Status",
                  "Opted In",
                  "Agent",
                  "Added",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading &&
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-800/60">
                    {[...Array(9)].map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div
                          className="h-4 bg-slate-800 rounded animate-pulse"
                          style={{
                            width: [
                              "32px",
                              "140px",
                              "100px",
                              "120px",
                              "60px",
                              "80px",
                              "80px",
                              "80px",
                              "60px",
                            ][j],
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}

              {!loading && contacts.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
                      <span className="text-4xl opacity-30">👥</span>
                      <p className="text-sm font-medium text-slate-400">
                        No contacts found
                      </p>
                      <button
                        onClick={() => setShowAdd(true)}
                        className="mt-1 px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors"
                      >
                        Add first contact
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                contacts.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setDrawerContact(c)}
                    className={`border-b border-slate-800/50 cursor-pointer transition-colors hover:bg-slate-800/40 last:border-0
                    ${selected.has(c.id) ? "bg-blue-500/5" : ""}`}
                  >
                    <td
                      className="px-4 py-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSel(c.id);
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        readOnly
                        className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={c.profile_name || c.wa_id} />
                        <div>
                          <p className="text-sm font-medium text-slate-200 leading-tight">
                            {c.profile_name || (
                              <span className="text-slate-500 italic text-xs">
                                No name
                              </span>
                            )}
                          </p>
                          {c.email && (
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {c.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-slate-400">
                        +{c.wa_id}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <WaStatus status={c.wa_status} profileName={c.profile_name} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[160px]">
                        {(c.tags || []).slice(0, 2).map((t) => (
                          <Tag key={t} label={t} />
                        ))}
                        {(c.tags || []).length > 2 && (
                          <span className="text-[11px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full">
                            +{c.tags.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge status={c.status || "New"} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium ${c.opted_in ? "text-emerald-400" : "text-slate-600"}`}
                      >
                        {c.opted_in ? "✓" : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500">
                        {agents.find((a) => a.id === c.assigned_to)?.name ||
                          "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500 whitespace-nowrap">
                        {fmt(c.created_at)}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openChat(c)}
                          className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-900/20 rounded-lg transition-colors"
                          title="Open chat"
                        >
                          <svg
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            className="w-3.5 h-3.5"
                          >
                            <path d="M1 4a2 2 0 012-2h10a2 2 0 012 2v6a2 2 0 01-2 2H5L1 15V4z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setEditContact(c)}
                          className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <svg
                            viewBox="0 0 16 16"
                            fill="currentColor"
                            className="w-3.5 h-3.5"
                          >
                            <path d="M11.5 2a1.5 1.5 0 012.12 2.12l-8 8-2.83.71.71-2.83 8-8z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <span className="text-xs text-slate-500">
            {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of{" "}
            {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 1}
              onClick={() => load(page - 1)}
              className="w-8 h-8 flex items-center justify-center text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-400 disabled:opacity-40 hover:bg-slate-700 transition-colors disabled:cursor-not-allowed"
            >
              ←
            </button>
            {(() => {
              // Windowed page numbers centred on the current page, so every page
              // is reachable by number even when there are hundreds of them.
              const span = 5;
              let start = Math.max(1, page - Math.floor(span / 2));
              let end = Math.min(pages, start + span - 1);
              start = Math.max(1, end - span + 1);
              const nums = [];
              for (let n = start; n <= end; n++) nums.push(n);
              const btn = (n, label = n) => (
                <button key={label} onClick={() => load(n)}
                  className={`min-w-8 h-8 px-1.5 flex items-center justify-center text-xs rounded-lg border transition-colors
                    ${page === n ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"}`}>
                  {label}
                </button>
              );
              return (
                <>
                  {start > 1 && <>{btn(1)}<span className="text-slate-600 px-0.5">…</span></>}
                  {nums.map(n => btn(n))}
                  {end < pages && <><span className="text-slate-600 px-0.5">…</span>{btn(pages)}</>}
                </>
              );
            })()}
            <button
              disabled={page === pages}
              onClick={() => load(page + 1)}
              className="w-8 h-8 flex items-center justify-center text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-400 disabled:opacity-40 hover:bg-slate-700 transition-colors disabled:cursor-not-allowed"
            >
              →
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {(showAdd || editContact) && (
        <ContactModal
          contact={editContact}
          agents={agents}
          onSave={() => {
            setEditContact(null);
            setShowAdd(false);
            load(page);
          }}
          onClose={() => {
            setEditContact(null);
            setShowAdd(false);
          }}
        />
      )}

      {drawerContact && (
        <ContactDrawer
          contact={drawerContact}
          agents={agents}
          onUpdate={(u) => {
            setContacts((p) => p.map((c) => (c.id === u.id ? u : c)));
            setDrawerContact(u);
          }}
          onClose={() => setDrawerContact(null)}
          onOpenChat={openChat}
        />
      )}

      {showImport && (
        <BulkAddContacts onClose={() => setShowImport(false)} onDone={() => load(1)} />
      )}
    </div>
  );
}
