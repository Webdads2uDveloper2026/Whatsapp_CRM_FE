import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../services/api";
import InboxSocketHelper from "../../services/InboxSocketHelper"
import SendTemplateModal from "./SendTemplateModal";
import SendFlowModal from "./SendFlowModal";
import { Mp3Encoder } from "@breezystack/lamejs";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

// WhatsApp registration status pill — evidence-based (see backend wa_status).
const WA_LABELS = {
  active:     { t: "On WhatsApp",     c: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", d: "bg-emerald-400" },
  not_active: { t: "Not on WhatsApp", c: "text-red-400 bg-red-500/10 border-red-500/30",             d: "bg-red-500" },
  unknown:    { t: "Unknown",         c: "text-slate-400 bg-slate-700/40 border-slate-600",           d: "bg-slate-500" },
};

function WaBadge({ status, className = "" }) {
  const s = WA_LABELS[status] || WA_LABELS.unknown;
  return (
    <span
      title={
        status === "active"
          ? "This number is on WhatsApp"
          : status === "not_active"
            ? "This number is not registered on WhatsApp"
            : "WhatsApp status not confirmed yet"
      }
      className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.c} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.d}`} />
      {s.t}
    </span>
  );
}

const TZ = "Asia/Kolkata";

const parseUTC = (iso) => {
  if (!iso) return null;
  const s = /[Z+]/.test(iso.slice(-6)) ? iso : iso + "Z";
  return new Date(s);
};

const fmt = (iso) => {
  const d = parseUTC(iso);
  if (!d || isNaN(d)) return "";
  const now = new Date();
  const toDay = (dt) =>
    new Date(dt.toLocaleString("en-US", { timeZone: TZ })).toDateString();
  const dDay = toDay(d);
  const nowDay = toDay(now);
  const yday = toDay(new Date(now - 86400000));
  if (dDay === nowDay)
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: TZ,
    });
  if (dDay === yday) return "Yesterday";
  const diff = Math.floor((now - d) / 86400000);
  if (diff < 7)
    return d.toLocaleDateString("en-IN", { weekday: "short", timeZone: TZ });
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: TZ,
  });
};

const fmtRecordTime = (secs) =>
  `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

const RECORDER_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function pickRecorderMimeType() {
  return (
    RECORDER_MIME_CANDIDATES.find((t) =>
      window.MediaRecorder?.isTypeSupported?.(t),
    ) || ""
  );
}

function floatTo16BitPCM(input) {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

async function recordingToMp3(blob) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  let audioBuffer;
  try {
    audioBuffer = await ctx.decodeAudioData(await blob.arrayBuffer());
  } finally {
    ctx.close();
  }

  const channels = Math.min(audioBuffer.numberOfChannels, 2);
  const sampleRate = audioBuffer.sampleRate;
  const left = floatTo16BitPCM(audioBuffer.getChannelData(0));
  const right =
    channels > 1 ? floatTo16BitPCM(audioBuffer.getChannelData(1)) : null;

  const encoder = new Mp3Encoder(channels, sampleRate, 128);
  const blockSize = 1152;
  const chunks = [];
  for (let i = 0; i < left.length; i += blockSize) {
    const l = left.subarray(i, i + blockSize);
    const r = right ? right.subarray(i, i + blockSize) : undefined;
    const buf = r ? encoder.encodeBuffer(l, r) : encoder.encodeBuffer(l);
    if (buf.length > 0) chunks.push(buf);
  }
  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(tail);

  return new Blob(chunks, { type: "audio/mpeg" });
}

const AVATAR_BG = [
  "bg-violet-600",
  "bg-cyan-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-blue-600",
  "bg-pink-600",
];

function avatarColor(s = "") {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_BG[Math.abs(h) % AVATAR_BG.length];
}

function Avatar({ name = "", size = "md" }) {
  const sz =
    {
      xs: "w-6 h-6 text-[10px]",
      sm: "w-7 h-7 text-xs",
      md: "w-9 h-9 text-sm",
      lg: "w-14 h-14 text-xl",
    }[size] || "w-9 h-9 text-sm";
  return (
    <div
      className={`${sz} ${avatarColor(name)} rounded-full flex items-center justify-center font-bold text-white shrink-0 select-none`}
    >
      {name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "?"}
    </div>
  );
}

function Tick({ status }) {
  if (status === "read")
    return <span className="text-blue-400 text-[11px]">✓✓</span>;
  if (status === "delivered")
    return <span className="text-slate-400 text-[11px]">✓✓</span>;
  if (status === "sent")
    return <span className="text-slate-500 text-[11px]">✓</span>;
  if (status === "failed")
    return <span className="text-red-400 text-[11px]">✗</span>;
  return null;
}

// Turn a Meta delivery error into a short, human message the user can act on.
function friendlyWaError(error) {
  if (!error) return "Delivery failed. Please try again.";
  const code = error.code;
  const detail = (error.details || error.message || error.title || "").toString();
  const BY_CODE = {
    131053: "This image format isn't supported by WhatsApp. Send a JPG or PNG (WebP isn't allowed for photos).",
    131047: "The 24-hour window is closed. Send an approved template to re-open the chat.",
    131026: "This number isn't a valid WhatsApp user.",
    131051: "Unsupported message type.",
    132000: "Template variables don't match the approved template.",
    132001: "Template not found or not approved.",
    133010: "Your WhatsApp number isn't registered with the Cloud API.",
    130472: "Too many messages sent to this number recently — try later.",
  };
  if (code && BY_CODE[code]) return BY_CODE[code];
  if (/webp/i.test(detail)) return BY_CODE[131053];
  return detail || "Delivery failed. Please try again.";
}

function useProxiedMediaUrl(mediaId) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setUrl(null);
    setError(false);
    if (!mediaId) return;
    let cancelled = false;
    let objectUrl = null;
    api
      .get(`/media/proxy?media_id=${encodeURIComponent(mediaId)}`, {
        responseType: "blob",
      })
      .then(({ data }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(data);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaId]);

  return { url, error };
}

function MediaImage({ c }) {
  const { url, error } = useProxiedMediaUrl(c.id || c.image?.id || c.url);
  return (
    <div>
      {url ? (
        <img
          src={url}
          alt={c.caption || "Image"}
          className="rounded-xl max-w-[220px] w-full object-cover cursor-pointer"
          style={{ maxHeight: 280, minHeight: 80, display: "block" }}
          onClick={() => window.open(url, "_blank")}
        />
      ) : (
        <div
          className="w-full max-w-[220px] bg-slate-700 rounded-xl flex items-center justify-center p-4"
          style={{ minHeight: 80 }}
        >
          <span className="text-3xl">{error ? "🖼️" : "⏳"}</span>
        </div>
      )}
      {c.caption && (
        <p className="text-[12px] text-slate-200 mt-1">{c.caption}</p>
      )}
    </div>
  );
}

function MediaVideo({ c }) {
  const { url, error } = useProxiedMediaUrl(c.id || c.video?.id || c.url);
  return (
    <div>
      {url ? (
        <video
          controls
          className="rounded-xl max-w-[220px] w-full"
          style={{ maxHeight: 280 }}
        >
          <source
            src={url}
            type={c.mime_type || c.video?.mime_type || "video/mp4"}
          />
        </video>
      ) : (
        <div
          className="w-full max-w-[220px] bg-slate-900 rounded-xl flex items-center justify-center p-4"
          style={{ minHeight: 100 }}
        >
          <span className="text-3xl">{error ? "🎥" : "⏳"}</span>
        </div>
      )}
      {c.caption && (
        <p className="text-[12px] text-slate-200 mt-1">{c.caption}</p>
      )}
    </div>
  );
}

function MediaAudio({ c }) {
  const { url, error } = useProxiedMediaUrl(c.id || c.audio?.id || c.url);
  const isVoice = c.voice ?? c.audio?.voice;
  return (
    <div className="min-w-[200px] max-w-[260px]">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-emerald-600/20 border border-emerald-600/30 flex items-center justify-center shrink-0">
          <span>{isVoice ? "🎤" : "🎵"}</span>
        </div>
        <span className="text-[11px] text-slate-400">
          {isVoice ? "Voice message" : "Audio"}
        </span>
      </div>
      {url ? (
        <audio controls style={{ width: "100%", height: 36 }}>
          <source
            src={url}
            type={c.mime_type || c.audio?.mime_type || "audio/ogg"}
          />
        </audio>
      ) : (
        <div className="flex items-center gap-0.5 h-5">
          {[3, 5, 4, 7, 5, 3, 6, 4, 5, 3, 4, 6].map((h, i) => (
            <div
              key={i}
              className="w-1 bg-slate-500 rounded-full"
              style={{ height: h * 3 }}
            />
          ))}
        </div>
      )}
      {error && (
        <p className="text-[10px] text-red-400 mt-1">Failed to load audio</p>
      )}
    </div>
  );
}

function MediaDocument({ c }) {
  const { url } = useProxiedMediaUrl(c.id || c.document?.id || c.url);
  return (
    <div className="flex items-center gap-3 bg-black/20 rounded-xl p-2.5 min-w-[180px] max-w-[240px]">
      <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
        <span className="text-lg">📄</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-slate-200 truncate">
          {c.filename || "Document"}
        </p>
        <p className="text-[10px] text-slate-400">
          {c.mime_type?.split("/")[1]?.toUpperCase() || "FILE"}
        </p>
        {c.caption && (
          <p className="text-[10px] text-slate-300 mt-0.5 truncate">
            {c.caption}
          </p>
        )}
        {url && (
          <a
            href={url}
            download={c.filename || "document"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-blue-400 hover:text-blue-300 mt-1 block"
          >
            ⬇ Download
          </a>
        )}
      </div>
    </div>
  );
}

function NewConvoModal({ onClose, onCreated }) {
  const [step, setStep] = useState("search");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [tplId, setTplId] = useState("");
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    api
      .get("/templates/local")
      .then((r) =>
        setTemplates(
          (r.data.templates || []).filter((t) => t.status === "APPROVED"),
        ),
      )
      .catch(() => {});
  }, []);

  const searchContact = async () => {
    const clean = phone.replace(/[\s+\-()]/g, "");
    if (!clean || clean.length < 7) {
      setError("Enter a valid phone number with country code");
      return;
    }
    setSearching(true);
    setError("");
    try {
      const { data } = await api.get(`/contacts?search=${clean}&limit=5`);
      const found = (data.contacts || []).find((c) => c.wa_id === clean);
      if (found) {
        setContact(found);
        setName(found.profile_name || "");
      } else {
        setContact(null);
        setName("");
      }
      setStep("confirm");
    } catch {
      setError("Search failed");
    }
    setSearching(false);
  };

  const startConversation = async () => {
    setStep("sending");
    setError("");
    const clean = phone.replace(/[\s+\-()]/g, "");
    try {
      let contactId = contact?.id;

      if (!contactId) {
        const { data } = await api.post("/contacts", {
          wa_id: clean,
          profile_name: name || clean,
          opted_in: true,
          status: "New",
        });
        contactId = data.id;
      }

      let convo = null;
      const { data: convos } = await api.get(
        `/conversations?search=${clean}&limit=10`,
      );
      const existing = (convos.conversations || []).find(
        (c) => c.wa_id === clean && c.status === "open",
      );

      if (existing) {
        convo = existing;
      } else {
        if (tplId) {
          const tpl = templates.find((t) => t.id === tplId);
          const { data: msg } = await api.post("/conversations/start", {
            wa_id: clean,
            contact_id: contactId,
            template_name: tpl?.name,
            template_language: tpl?.language || "en_US",
          });
          convo = msg.conversation;
        } else {
          const { data: msg } = await api.post("/conversations/start", {
            wa_id: clean,
            contact_id: contactId,
          });
          convo = msg.conversation;
        }
      }

      onCreated(convo, contactId);
      onClose();
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to start conversation");
      setStep("confirm");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-white">
              New Conversation
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Start a chat with any WhatsApp number
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white text-xl transition-colors leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-900/20 border border-red-800/40 text-red-400 text-xs px-3 py-2.5 rounded-xl">
              ⚠ {error}
            </div>
          )}

          {(step === "search" || step === "confirm") && (
            <div>
  <label className="block text-xs font-medium text-slate-400 mb-1.5">
    Phone number <span className="text-red-400">*</span>
  </label>

  <div className="flex gap-2">
    <PhoneInput
  country="in"
  value={phone}
  onChange={(value) => setPhone(value)}
  enableSearch
  searchPlaceholder="Search country..."
  containerStyle={{
    width: "100%",
  }}
  inputStyle={{
    width: "100%",
    height: "52px",
    background: "#1e293b",
    border: "1px solid #334155",
    color: "#fff",
    borderRadius: "14px",
    paddingLeft: "55px",
  }}
  buttonStyle={{
    background: "#1e293b",
    border: "1px solid #334155",
    borderTopLeftRadius: "14px",
    borderBottomLeftRadius: "14px",
  }}
/>

    {step === "search" && (
      <button
        onClick={searchContact}
        disabled={searching}
        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors shrink-0"
      >
        {searching ? "..." : "Search"}
      </button>
    )}
  </div>
</div>
          )}

          {step === "confirm" && (
            <>
              {contact ? (
                <div className="flex items-center gap-3 p-3 bg-emerald-900/20 border border-emerald-800/40 rounded-xl">
                  <Avatar
                    name={contact.profile_name || contact.wa_id}
                    size="sm"
                  />
                  <div>
                    <p className="text-xs font-semibold text-emerald-400">
                      ✓ Existing contact found
                    </p>
                    <p className="text-xs text-slate-300">
                      {contact.profile_name || "No name"} · +{contact.wa_id}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-900/15 border border-amber-800/30 rounded-xl">
                  <p className="text-xs font-semibold text-amber-400 mb-2">
                    New contact — will be created
                  </p>
                  <label className="block text-xs text-slate-400 mb-1">
                    Contact name (optional)
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter name"
                    className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 outline-none transition-colors"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Opening message template
                  <span className="text-slate-500 ml-1">
                    (required if no recent chat)
                  </span>
                </label>
                <select
                  value={tplId}
                  onChange={(e) => setTplId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 focus:border-blue-500 text-slate-300 text-xs rounded-xl px-3 py-2.5 outline-none appearance-none cursor-pointer transition-colors"
                >
                  <option value="">— No template / just open chat —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.language})
                    </option>
                  ))}
                </select>
                {templates.length === 0 && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    No approved templates. Go to Templates page to create one.
                  </p>
                )}
              </div>

              <button
                onClick={startConversation}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4"
                >
                  <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H6l-4 4V5z" />
                </svg>
                Start Conversation
              </button>
            </>
          )}

          {step === "sending" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <svg
                className="w-8 h-8 animate-spin text-blue-400"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeOpacity=".2"
                />
                <path
                  d="M22 12A10 10 0 0012 2"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              <p className="text-sm text-slate-400">Starting conversation…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Inbox() {
  const location = useLocation();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [convos, setConvos] = useState([]);
  const [convoTotal, setConvoTotal] = useState(0);
  const [convoPage, setConvoPage] = useState(1);
  const [loadingConvos, setLoadingConvos] = useState(false);
  const convoListRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [contact, setContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [agents, setAgents] = useState([]);
  const [rightTab, setRightTab] = useState("details");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [showNewConvo, setShowNewConvo] = useState(false);
  const [showTplModal, setShowTplModal] = useState(false);
  const [showFlowModal, setShowFlowModal] = useState(false);
  const [flows, setFlows] = useState([]);
  const [activeMenu, setActiveMenu] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [msgInfo, setMsgInfo] = useState(null);
  const [showRight, setShowRight] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);

  const bottomRef = useRef(null);
  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const selectedRef = useRef(null);
  const recorderRef = useRef(null);
  const recordChunksRef = useRef([]);
  const recordStreamRef = useRef(null);
  const recordTimerRef = useRef(null);

  const CONVO_PAGE_SIZE = 30;

  // Load a page of conversations. page 1 replaces the list; higher pages append,
  // which is what powers the infinite scroll below.
  const loadConvos = useCallback(
    async (pg = 1) => {
      setLoadingConvos(true);
      try {
        const p = new URLSearchParams({
          status: statusFilter,
          page: pg,
          limit: CONVO_PAGE_SIZE,
        });
        if (search) p.append("search", search);
        const { data } = await api.get(`/conversations?${p}`);
        const rows = data.conversations || [];
        setConvoTotal(data.total || 0);
        setConvoPage(pg);
        setConvos((prev) => {
          if (pg === 1) return rows;
          // De-dupe in case a new inbound message reordered pages between fetches
          const seen = new Set(prev.map((c) => c.id));
          return [...prev, ...rows.filter((c) => !seen.has(c.id))];
        });
      } catch {}
      setLoadingConvos(false);
    },
    [statusFilter, search],
  );

  // Reload from page 1 whenever the filter or search changes
  useEffect(() => {
    loadConvos(1);
  }, [loadConvos]);

  // Infinite scroll: fetch the next page as the list nears the bottom
  const onConvoScroll = useCallback(
    (e) => {
      const el = e.currentTarget;
      if (loadingConvos) return;
      if (convos.length >= convoTotal) return;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 120) {
        loadConvos(convoPage + 1);
      }
    },
    [loadingConvos, convos.length, convoTotal, convoPage, loadConvos],
  );

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const loadMessages = useCallback(async (cid, pg = 1, prepend = false) => {
    setLoadingMsgs(true);
    try {
      const { data } = await api.get(
        `/conversations/${cid}/messages?page=${pg}&limit=30`,
      );
      const msgs = data.messages || [];
      if (prepend) {
        const prev = chatRef.current?.scrollHeight || 0;
        setMessages((m) => [...msgs, ...m]);
        setTimeout(() => {
          if (chatRef.current)
            chatRef.current.scrollTop = chatRef.current.scrollHeight - prev;
        }, 60);
      } else {
        setMessages(msgs);
        setTimeout(
          () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
          80,
        );
      }
      setHasMore(msgs.length === 30);
    } catch {}
    setLoadingMsgs(false);
  }, []);

  const loadContact = useCallback(async (cid) => {
    try {
      const { data } = await api.get(`/contacts/${cid}`);
      setContact(data);
      setEditForm(data);
    } catch {}
  }, []);

  // Load the contact behind a conversation by phone number, when we don't have a
  // usable contact_id. Used as a fallback so the detail panel never shows a
  // different (or blank) record than the name in the list.
  const loadContactByWaId = useCallback(async (wa_id) => {
    try {
      const { data } = await api.get(
        `/contacts?search=${encodeURIComponent(wa_id)}&limit=5`,
      );
      const found = (data.contacts || []).find((c) => c.wa_id === wa_id);
      if (found) {
        setContact(found);
        setEditForm(found);
      }
    } catch {}
  }, []);

  const selectConvo = useCallback(
    async (c) => {
      setSelected(c);
      setPage(1);
      setShowTemplates(false);
      // Seed the panel from the conversation immediately so the name and WhatsApp
      // status render at once — the fetch below only refines it.
      setContact({
        id: c.contact_id || "",
        wa_id: c.wa_id,
        profile_name: c.profile_name && c.profile_name !== c.wa_id ? c.profile_name : "",
        wa_status: c.wa_status || "unknown",
      });
      await loadMessages(c.id, 1);
      if (c.contact_id) await loadContact(c.contact_id);
      else await loadContactByWaId(c.wa_id);
      setConvos((p) =>
        p.map((x) => (x.id === c.id ? { ...x, unread_count: 0 } : x)),
      );
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    [loadMessages, loadContact, loadContactByWaId],
  );

  useEffect(() => {
    const state = location.state;
    if (!state?.wa_id) return;

    window.history.replaceState({}, "");

    const openDirectly = async () => {
      const wa_id = state.wa_id;
      try {
        const { data } = await api.get(
          `/conversations?search=${wa_id}&limit=20`,
        );
        const match = (data.conversations || []).find((c) => c.wa_id === wa_id);

        if (match) {
          setConvos((prev) =>
            prev.find((c) => c.id === match.id) ? prev : [match, ...prev],
          );
          selectConvo(match);
          return;
        }
      } catch {}

      try {
        const { data } = await api.post("/conversations/start", {
          wa_id: wa_id,
          contact_id: state.contact_id || null,
        });

        const newConvo = data.conversation;
        if (newConvo) {
          setConvos((prev) => [newConvo, ...prev]);
          selectConvo(newConvo);
          if (state.contact_id) {
            loadContact(state.contact_id);
          }
        }
      } catch (e) {
        console.error("[Inbox] Failed to start conversation:", e);
      }
    };

    const timer = setTimeout(openDirectly, 300);
    return () => clearTimeout(timer);
  }, [location.state]);

  const navState = location.state;

  // ───────────────────────────────────────────────────────────────────────
  // ✅ SOCKET.IO INTEGRATION REPLACEMENT
  // ───────────────────────────────────────────────────────────────────────
  const onWsMessage = useCallback((ev) => {
    if (ev.type === "new_message") {
      const curSelected = selectedRef.current;

      setConvos((prev) => {
        const idx = prev.findIndex((c) => c.id === ev.conversation_id);
        if (idx === -1) {
          setTimeout(() => loadConvos(), 0);
          return prev;
        }
        const isOpen = curSelected?.id === ev.conversation_id;
        const updated = {
          ...prev[idx],
          last_message_at: ev.message?.created_at || new Date().toISOString(),
          unread_count: isOpen ? 0 : (prev[idx].unread_count || 0) + 1,
        };
        return [updated, ...prev.filter((_, i) => i !== idx)];
      });

      if (curSelected?.id === ev.conversation_id) {
        setMessages((p) => {
          const msgId = ev.message?.id;
          const waMsgId = ev.message?.wa_message_id;
          const exists = p.some(
            (m) =>
              (msgId && m.id === msgId) ||
              (waMsgId && m.wa_message_id === waMsgId) ||
              (waMsgId && m.content?.wa_message_id === waMsgId),
          );
          if (exists) return p;
          return [...p, ev.message];
        });
        setTimeout(
          () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
          60,
        );
      }
    }

    if (ev.type === "status_update") {
      setMessages((p) =>
        p.map((m) =>
          m.wa_message_id === ev.wa_message_id
            ? { ...m, status: ev.status, error: ev.error || m.error }
            : m,
        ),
      );
    }
  }, []);

  useEffect(() => {
    // 1. Connect Socket.IO
    InboxSocketHelper.connectSocket();

    // 2. Listen to the generic message event from the backend
    // NOTE: If your backend emits specific events like `socket.emit("new_message", data)`
    // then you should change "message" to "new_message" below.
    InboxSocketHelper.on("message", onWsMessage);

    // 3. Cleanup
    return () => {
      InboxSocketHelper.off("message", onWsMessage);
      // Optional: Drop connection when you fully leave the component
      // InboxSocketHelper.disconnect(); 
    };
  }, [onWsMessage]);
  // ───────────────────────────────────────────────────────────────────────

  useEffect(() => {
    api
      .get("/templates/local")
      .then((r) =>
        setTemplates(
          (r.data.templates || []).filter((t) => t.status === "APPROVED"),
        ),
      )
      .catch(() => {});
    api
      .get("/agents")
      .then((r) => setAgents(r.data || []))
      .catch(() => {});
  }, []);

  const handleFileAttachment = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    setUploadingMedia(true);
    try {
      const fileType = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
          ? "video"
          : file.type.startsWith("audio/")
            ? "audio"
            : "document";
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", fileType);
      const uploadRes = await api.post("/media/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const mediaId = uploadRes.data.id;
      const msgPayload = { msg_type: fileType, media_id: mediaId };
      if (fileType === "document") msgPayload.filename = file.name;
      await api.post(`/conversations/${selected.id}/messages`, msgPayload);
    } catch (err) {
      alert(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const stopRecordingTracks = () => {
    recordStreamRef.current?.getTracks().forEach((t) => t.stop());
    recordStreamRef.current = null;
    clearInterval(recordTimerRef.current);
    recordTimerRef.current = null;
  };

  const sendRecording = async (mimeType) => {
    if (!selected || !recordChunksRef.current.length) return;
    setUploadingMedia(true);
    try {
      const rawBlob = new Blob(recordChunksRef.current, { type: mimeType });
      const mp3Blob = await recordingToMp3(rawBlob);
      const file = new File([mp3Blob], "voice-note.mp3", {
        type: "audio/mpeg",
      });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "audio");
      const uploadRes = await api.post("/media/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await api.post(`/conversations/${selected.id}/messages`, {
        msg_type: "audio",
        media_id: uploadRes.data.id,
      });
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to send voice note");
    } finally {
      setUploadingMedia(false);
      recordChunksRef.current = [];
    }
  };

  const startRecording = async () => {
    if (!selected || isRecording) return;
    const mime = pickRecorderMimeType();
    if (!mime) {
      alert(
        "Your browser doesn't support recording audio — try an up-to-date Chrome, Edge, or Safari, or attach an existing audio file instead.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recordStreamRef.current = stream;
      recordChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data);
      };
      recorder.onstop = () =>
        sendRecording(recorder.mimeType || mime || "audio/webm");
      recorder.start();
      recorderRef.current = recorder;
      setRecordSecs(0);
      setIsRecording(true);
      recordTimerRef.current = setInterval(
        () => setRecordSecs((s) => s + 1),
        1000,
      );
    } catch {
      alert(
        "Microphone access denied — allow microphone permission to record voice notes",
      );
    }
  };

  const finishRecording = () => {
    if (!recorderRef.current) return;
    recorderRef.current.stop();
    stopRecordingTracks();
    setIsRecording(false);
    setRecordSecs(0);
    recorderRef.current = null;
  };

  const cancelRecording = () => {
    if (!recorderRef.current) return;
    recorderRef.current.onstop = null;
    recorderRef.current.stop();
    stopRecordingTracks();
    recordChunksRef.current = [];
    setIsRecording(false);
    setRecordSecs(0);
    recorderRef.current = null;
  };

  useEffect(() => () => cancelRecording(), []);

  const sendText = async (e) => {
    e?.preventDefault();
    if (!text.trim() || !selected || sending) return;
    setSending(true);
    const body = text;
    setText("");
    try {
      const payload = { msg_type: "text", content: { body } };
      if (replyTo?.wa_message_id)
        payload.reply_to_message_id = replyTo.wa_message_id;
      const { data } = await api.post(
        `/conversations/${selected.id}/messages`,
        payload,
      );
      setReplyTo(null);
      setMessages((p) => {
        const exists = p.some(
          (m) => m.id === data.id || m.wa_message_id === data.wa_message_id,
        );
        return exists ? p : [...p, data];
      });
      setTimeout(
        () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
        60,
      );
      loadConvos();
    } catch (e) {
      alert(e.response?.data?.detail || "Send failed");
      setText(body);
    }
    setSending(false);
  };

  const sendTemplate = async (tpl) => {
    setShowTplModal(true);
  };

  const handleSendTemplate = async (payload) => {
    if (!selected) return;
    const { data } = await api.post(
      `/conversations/${selected.id}/messages`,
      payload,
    );
    setMessages((p) => {
      const exists = p.some((m) => m.id === data.id);
      return exists ? p : [...p, data];
    });
    setShowTemplates(false);
    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      60,
    );
    loadConvos();
  };

  const handleOpenFlowModal = async () => {
    try {
      const { data } = await api.get("/flows");
      setFlows(data?.flows || data || []);
    } catch {
      setFlows([]);
    }
    setShowFlowModal(true);
  };

  const handleSendFlow = async (payload) => {
    if (!selected) return;
    const { data } = await api.post(
      `/conversations/${selected.id}/messages`,
      payload,
    );
    setMessages((p) => {
      const exists = p.some((m) => m.id === data.id);
      return exists ? p : [...p, data];
    });
    setTimeout(
      () => bottomRef.current?.scrollIntoView({ behavior: "smooth" }),
      60,
    );
    loadConvos();
  };

  const updateStatus = async (status) => {
    if (!selected) return;
    try {
      await api.patch(`/conversations/${selected.id}/status?status=${status}`);
      setSelected((p) => ({ ...p, status }));
      if (status !== statusFilter) {
        setConvos((p) => p.filter((c) => c.id !== selected.id));
        setSelected(null);
      } else
        setConvos((p) =>
          p.map((c) => (c.id === selected.id ? { ...c, status } : c)),
        );
    } catch {}
  };

  const assignAgent = async (agentId) => {
    if (!selected) return;
    try {
      await api.patch(
        `/conversations/${selected.id}/assign${agentId ? `?agent_id=${agentId}` : ""}`,
      );
      setSelected((p) => ({ ...p, assigned_agent: agentId }));
    } catch {}
  };

  const saveContact = async () => {
    if (!contact) return;
    try {
      const { data } = await api.patch(`/contacts/${contact.id}`, {
        profile_name: editForm.profile_name,
        email: editForm.email,
        tags:
          typeof editForm.tags === "string"
            ? editForm.tags
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
            : editForm.tags,
      });
      setContact(data);
      setEditForm(data);
      setEditing(false);
    } catch (e) {
      alert(e.response?.data?.detail || "Update failed");
    }
  };

  const handleNewConvoCreated = async (convo, contactId) => {
    loadConvos();
    if (convo) {
      await selectConvo(convo);
    }
    window.history.replaceState({}, "");
  };

  const windowOpen =
    selected?.window_expires_at &&
    new Date(selected.window_expires_at) > new Date();

  const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

  const MsgInfoModal = ({ m, onClose }) => (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xs shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-200">Message Info</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-xl"
          >
            ×
          </button>
        </div>
        {[
          {
            icon: "✓",
            label: "Sent",
            val: m.created_at ? fmt(m.created_at) : "—",
            c: "text-slate-400",
          },
          {
            icon: "✓✓",
            label: "Delivered",
            val: m.delivered_at
              ? fmt(m.delivered_at)
              : m.status === "delivered" || m.status === "read"
                ? "Yes"
                : "—",
            c: "text-slate-400",
          },
          {
            icon: "✓✓",
            label: "Read",
            val: m.read_at ? fmt(m.read_at) : m.status === "read" ? "Yes" : "—",
            c: "text-blue-400",
          },
          {
            icon: "🆔",
            label: "Message ID",
            val: (m.wa_message_id || m.id || "").slice(-12),
            c: "text-slate-500",
          },
          {
            icon: "📱",
            label: "Type",
            val: m.type || m.msg_type || "text",
            c: "text-slate-400",
          },
        ].map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm w-5 text-center">{r.icon}</span>
              <span className="text-xs text-slate-400">{r.label}</span>
            </div>
            <span className={`text-xs font-medium font-mono ${r.c}`}>
              {r.val}
            </span>
          </div>
        ))}
        {m.status === "failed" && m.error && (
          <div className="mt-3 p-2.5 rounded-lg bg-red-950/40 border border-red-900/50">
            <p className="text-[11px] font-bold text-red-400 mb-1">
              Delivery failed{m.error.code ? ` (#${m.error.code})` : ""}
            </p>
            <p className="text-[11px] text-red-300/90">
              {m.error.title || m.error.message}
            </p>
            {m.error.details && (
              <p className="text-[10px] text-red-300/70 mt-1">
                {m.error.details}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderBubble = (m) => {
    const isOut = m.direction === "outbound";
    const c = m.content || {};
    const type = c.type || m.type || m.msg_type || "text";

    if (type === "reaction") {
      return (
        <div
          key={m.id}
          className={`flex ${isOut ? "justify-end" : "justify-start"} mb-1`}
        >
          <div className="flex items-center gap-1.5 bg-slate-800/60 border border-slate-700/40 rounded-full px-3 py-1">
            <span className="text-lg">{c.emoji || "👍"}</span>
            <span className="text-[10px] text-slate-400">reacted</span>
            <span className="text-[10px] text-slate-500">
              {fmt(m.created_at)}
            </span>
          </div>
        </div>
      );
    }

    const renderContent = () => {
      switch (type) {
        case "text":
          return (
            <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words">
              {c.body || ""}
            </p>
          );
        case "image":
          return <MediaImage c={c} />;
        case "video":
          return <MediaVideo c={c} />;
        case "audio":
          return <MediaAudio c={c} />;
        case "document":
          return <MediaDocument c={c} />;
        case "sticker":
          return (
            <div className="flex flex-col items-center gap-1 p-1">
              <span className="text-5xl">{c.animated ? "✨" : "😊"}</span>
              <span className="text-[9px] text-slate-500">Sticker</span>
            </div>
          );
        case "location":
          return (
            <div className="min-w-[160px] max-w-[220px]">
              <div
                className="bg-slate-700 rounded-xl overflow-hidden mb-1.5 flex items-center justify-center"
                style={{ height: 80 }}
              >
                <div className="flex flex-col items-center gap-1 text-slate-400">
                  <span className="text-2xl">📍</span>
                  <span className="text-[10px]">{c.name || "Location"}</span>
                </div>
              </div>
              {c.address && (
                <p className="text-[11px] text-slate-300">{c.address}</p>
              )}
              {c.latitude && (
                <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                  {Number(c.latitude).toFixed(4)},{" "}
                  {Number(c.longitude).toFixed(4)}
                </p>
              )}
            </div>
          );
        case "contacts":
          return (
            <div className="flex items-center gap-2 min-w-[140px]">
              <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center shrink-0">
                👤
              </div>
              <div>
                <p className="text-[12px] font-medium text-slate-200">
                  {c.names || "Contact"}
                </p>
                <p className="text-[10px] text-slate-400">
                  {(c.contacts || []).length} contact
                  {(c.contacts || []).length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          );
        case "template":
          return (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[10px] font-bold text-blue-400 bg-blue-400/10 border border-blue-400/20 px-2 py-0.5 rounded-full uppercase tracking-wide">
                  📋 Template
                </span>
              </div>
              <p className="text-[12px] font-mono text-blue-300">
                {c.template_name || c.body || "Template"}
              </p>
              {c.language && (
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {c.language}
                </p>
              )}
            </div>
          );
        case "interactive":
        case "button":
          return (
            <div>
              <p className="text-[13.5px] whitespace-pre-wrap break-words">
                {c.body || ""}
              </p>
              {(c.button_reply?.title || c.list_reply?.title || c.payload) && (
                <div className="flex items-center gap-1 mt-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg px-2 py-1">
                  <span className="text-[11px] text-blue-300 font-medium">
                    🔘{" "}
                    {c.button_reply?.title || c.list_reply?.title || c.payload}
                  </span>
                </div>
              )}
            </div>
          );
        case "flow_response": {
          const entries = Object.entries(c.flow_data || {}).filter(
            ([k]) => k !== "flow_token",
          );
          return (
            <div className="min-w-[200px] max-w-[280px]">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[10px] font-bold text-purple-400 bg-purple-400/10 border border-purple-400/20 px-2 py-0.5 rounded-full uppercase tracking-wide">
                  📋 {c.flow_name || "Flow"} Response
                </span>
              </div>
              {entries.length > 0 ? (
                <div className="space-y-1">
                  {entries.map(([key, value]) => (
                    <div key={key} className="flex gap-2 text-[11px]">
                      <span className="text-slate-400 shrink-0 capitalize">
                        {key.replace(/_/g, " ")}:
                      </span>
                      <span className="text-slate-200 break-words">
                        {String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-slate-300">
                  {c.body || "Form submitted"}
                </p>
              )}
            </div>
          );
        }
        default:
          return (
            <p className="text-[13.5px] text-slate-300">
              {c.body || `[${type}]`}
            </p>
          );
      }
    };

    const reactions = m.reactions || [];

    return (
      <div
        key={m.id}
        className={`flex items-end gap-2 mb-2 group ${isOut ? "flex-row-reverse" : "flex-row"}`}
      >
        {!isOut && (
          <Avatar
            name={contact?.profile_name || selected?.wa_id || ""}
            size="sm"
          />
        )}

        <div
          className={`flex flex-col max-w-[68%] ${isOut ? "items-end" : "items-start"} relative`}
        >
          {m.reply_to && (
            <div
              className={`text-[11px] px-3 py-1.5 rounded-xl mb-1 border-l-2 bg-slate-800/60
              ${isOut ? "border-emerald-500 text-emerald-200/70" : "border-blue-500 text-slate-400"}`}
            >
              <p className="font-semibold text-[10px] mb-0.5">
                {m.reply_to.direction === "outbound"
                  ? "You"
                  : contact?.profile_name || "Contact"}
              </p>
              <p className="truncate max-w-[180px]">
                {m.reply_to.content?.body || "📎 Media"}
              </p>
            </div>
          )}

          {m.starred && (
            <span className="text-[10px] text-amber-400 mb-0.5">
              ⭐ Starred
            </span>
          )}

          <div className="relative flex items-start gap-1">
            {isOut && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenu(activeMenu === m.id ? null : m.id);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity mt-2 w-6 h-6 rounded-full bg-slate-700 hover:bg-slate-600 border border-slate-600 flex items-center justify-center text-slate-300 text-xs shrink-0 self-start"
              >
                ▾
              </button>
            )}

            <div
              className={`px-3 py-2 rounded-2xl cursor-pointer select-none
                ${
                  isOut
                    ? "bg-emerald-900/60 border border-emerald-700/50 text-emerald-100 rounded-br-sm"
                    : "bg-slate-800 border border-slate-700/50 text-slate-100 rounded-bl-sm"
                }
                ${["audio", "document", "location", "contacts", "sticker"].includes(type) ? "min-w-[160px]" : ""}`}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveMenu(m.id);
              }}
              onClick={(e) => {
                if (activeMenu) {
                  e.stopPropagation();
                  setActiveMenu(null);
                }
              }}
            >
              {renderContent()}
            </div>

            {!isOut && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenu(activeMenu === m.id ? null : m.id);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity mt-2 w-6 h-6 rounded-full bg-slate-700 hover:bg-slate-600 border border-slate-600 flex items-center justify-center text-slate-300 text-xs shrink-0 self-start"
              >
                ▾
              </button>
            )}
          </div>

          {reactions.length > 0 && (
            <div className="flex gap-0.5 mt-0.5">
              {reactions.map((r, i) => (
                <span
                  key={i}
                  className="text-sm bg-slate-800 border border-slate-700 rounded-full px-1.5 py-0.5"
                >
                  {r}
                </span>
              ))}
            </div>
          )}

          <div
            className={`flex items-center gap-1 mt-1 px-1 ${isOut ? "flex-row-reverse" : ""}`}
          >
            <span className="text-[10px] text-slate-500">
              {fmt(m.created_at)}
            </span>
            {isOut && <Tick status={m.status} />}
          </div>

          {/* Inline delivery-failure reason so the user sees why it failed */}
          {isOut && m.status === "failed" && (
            <div className="mt-1 px-2.5 py-1.5 rounded-lg bg-red-950/40 border border-red-900/50 max-w-full">
              <p className="text-[10px] font-semibold text-red-400">
                ⚠ Not delivered{m.error?.code ? ` (#${m.error.code})` : ""}
              </p>
              <p className="text-[10px] text-red-300/90 leading-snug">
                {friendlyWaError(m.error)}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <aside className="w-72 xl:w-80 shrink-0 flex flex-col border-r border-slate-800 bg-slate-950">
        <div className="p-4 border-b border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold">Inbox</h1>
              <span className="text-xs font-semibold bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                {convos.length}
              </span>
            </div>
            <button
              onClick={() => setShowNewConvo(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-colors"
              title="Start new conversation"
            >
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-3.5 h-3.5"
              >
                <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H6l-4 4V5z" />
              </svg>
              New
            </button>
          </div>

          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500"
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
              className="w-full bg-slate-800/60 border border-slate-700 rounded-lg py-2 pl-8 pr-3 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
              placeholder="Search conversations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-1">
            {["open", "resolved", "bot_handling"].map((s) => (
              <button
                key={s}
                onClick={() => {
                  setStatusFilter(s);
                  setSelected(null);
                }}
                className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors
                  ${statusFilter === s ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"}`}
              >
                {s === "bot_handling"
                  ? "Bot"
                  : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={convoListRef}
          onScroll={onConvoScroll}
          className="flex-1 overflow-y-auto"
        >
          {convos.length === 0 && !loadingConvos && (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-500">
              <span className="text-3xl opacity-30">💬</span>
              <p className="text-sm">No conversations</p>
              <button
                onClick={() => setShowNewConvo(true)}
                className="text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-900/20 border border-emerald-800/30 px-3 py-1.5 rounded-lg transition-colors"
              >
                + Start a conversation
              </button>
            </div>
          )}
          {convos.map((c) => (
            <div
              key={c.id}
              onClick={() => selectConvo(c)}
              className={`flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-slate-800/60 transition-colors
                ${selected?.id === c.id ? "bg-slate-800 border-l-2 border-l-blue-500 pl-3.5" : "hover:bg-slate-800/40"}`}
            >
              <Avatar name={c.profile_name || c.wa_id} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span
                    className={`text-sm truncate ${c.unread_count ? "font-semibold text-white" : "text-slate-200"}`}
                  >
                    {c.profile_name && c.profile_name !== c.wa_id
                      ? c.profile_name
                      : `+${c.wa_id}`}
                  </span>
                  <span className="text-[10px] text-slate-500 shrink-0 ml-2">
                    {fmt(c.last_message_at)}
                  </span>
                </div>
                {c.profile_name && c.profile_name !== c.wa_id && (
                  <div className="text-[11px] text-slate-500 font-mono truncate -mt-0.5 mb-0.5">
                    +{c.wa_id}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs truncate ${c.unread_count ? "text-slate-300" : "text-slate-500"}`}
                  >
                    {c.last_message_preview || "…"}
                  </span>
                  {c.unread_count > 0 && (
                    <span className="shrink-0 min-w-[18px] h-[18px] bg-emerald-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                      {c.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {loadingConvos && (
            <div className="py-3 text-center text-[11px] text-slate-500">
              Loading…
            </div>
          )}
          {!loadingConvos && convos.length > 0 && convos.length >= convoTotal && (
            <div className="py-3 text-center text-[10px] text-slate-600">
              {convoTotal} conversation{convoTotal === 1 ? "" : "s"}
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden border-r border-slate-800 min-w-0">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-4">
            <div className="text-5xl opacity-20">💬</div>
            <p className="text-base font-medium text-slate-400">
              Select a conversation
            </p>
            <p className="text-sm text-slate-500">or start a new one</p>
            <button
              onClick={() => setShowNewConvo(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors mt-2"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H6l-4 4V5z" />
              </svg>
              New Conversation
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-slate-950/80 backdrop-blur shrink-0">
              <Avatar name={contact?.profile_name || selected.profile_name || selected.wa_id} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {contact?.profile_name ||
                    (selected.profile_name && selected.profile_name !== selected.wa_id
                      ? selected.profile_name
                      : <span className="text-slate-400 font-normal">No name</span>)}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-slate-400 font-mono truncate">
                    +{selected.wa_id}
                  </p>
                  <WaBadge status={contact?.wa_status || selected.wa_status} />
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selected.window_expires_at && (
                  <span
                    className={`hidden sm:flex items-center gap-1 text-xs px-2 py-1 rounded-md border
                    ${windowOpen ? "bg-emerald-950/50 text-emerald-400 border-emerald-800/50" : "bg-slate-800 text-slate-500 border-slate-700"}`}
                  >
                    ⏱ {windowOpen ? "Window open" : "Window closed"}
                  </span>
                )}
                {contact && (
                  <button
                    onClick={() => navigate("/dashboard/contacts")}
                    className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="View contact"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-4 h-4"
                    >
                      <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                    </svg>
                  </button>
                )}
                <select
                  value={selected.status}
                  onChange={(e) => updateStatus(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-1.5 outline-none cursor-pointer focus:border-blue-500 transition-colors"
                >
                  {["open", "resolved", "bot_handling", "spam"].map((s) => (
                    <option key={s} value={s}>
                      {
                        {
                          open: "Open",
                          resolved: "Resolved",
                          bot_handling: "Bot",
                          spam: "Spam",
                        }[s]
                      }
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowRight((p) => !p)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path d="M4 5h12M4 10h12M4 15h7" />
                  </svg>
                </button>
              </div>
            </div>

            <div
              ref={chatRef}
              className="flex-1 overflow-y-auto px-4 py-4"
              onClick={() => setActiveMenu(null)}
            >
              {hasMore && (
                <div className="flex justify-center mb-4">
                  <button
                    onClick={async () => {
                      const np = page + 1;
                      setPage(np);
                      await loadMessages(selected.id, np, true);
                    }}
                    disabled={loadingMsgs}
                    className="text-xs text-slate-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-1.5 rounded-full transition-colors disabled:opacity-50"
                  >
                    {loadingMsgs ? "Loading…" : "↑ Load earlier"}
                  </button>
                </div>
              )}
              {messages.length === 0 && !loadingMsgs && (
                <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-600">
                  <p className="text-sm">No messages yet</p>
                  {!windowOpen && (
                    <p className="text-xs text-amber-500/70">
                      Send a template to start the conversation
                    </p>
                  )}
                </div>
              )}
              {messages.map(renderBubble)}
              <div ref={bottomRef} />
            </div>

            {showTemplates && (
              <div className="border-t border-slate-800 bg-slate-900 max-h-52 flex flex-col shrink-0">
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Quick Templates
                  </span>
                  <button
                    onClick={() => setShowTemplates(false)}
                    className="text-slate-500 hover:text-slate-300"
                  >
                    ✕
                  </button>
                </div>
                <div className="overflow-y-auto">
                  {templates.length === 0 && (
                    <p className="text-xs text-slate-500 p-4 text-center">
                      No approved templates
                    </p>
                  )}
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => sendTemplate(t)}
                      className="px-4 py-2.5 cursor-pointer hover:bg-slate-800 border-b border-slate-800/60 transition-colors"
                    >
                      <p className="text-xs font-mono font-semibold text-blue-400">
                        {t.name}
                      </p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {t.components
                          ?.find((c) => c.type === "BODY")
                          ?.text?.slice(0, 80)}
                        …
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {replyTo && (
              <div className="flex items-center gap-3 px-4 py-2.5 border-t border-slate-800 bg-slate-900/80">
                <div className="flex-1 border-l-2 border-blue-500 pl-3">
                  <p className="text-[10px] font-bold text-blue-400 mb-0.5">
                    Replying to{" "}
                    {replyTo.direction === "outbound"
                      ? "yourself"
                      : contact?.profile_name || "contact"}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {replyTo.content?.body ||
                      replyTo.content?.caption ||
                      "📎 Media"}
                  </p>
                </div>
                <button
                  onClick={() => setReplyTo(null)}
                  className="text-slate-500 hover:text-slate-300 text-lg leading-none transition-colors"
                >
                  ×
                </button>
              </div>
            )}

            <div className="flex items-end gap-2 px-4 py-3 border-t border-slate-800 bg-slate-950/80 shrink-0">
              {isRecording ? (
                <div className="flex-1 flex items-center gap-3 bg-slate-800 border border-rose-700/50 rounded-xl px-4 py-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
                  <span className="text-sm text-slate-200 font-mono">
                    {fmtRecordTime(recordSecs)}
                  </span>
                  <span className="text-xs text-slate-400 flex-1">
                    Recording voice note…
                  </span>
                  <button
                    onClick={cancelRecording}
                    title="Cancel"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-900/20 transition-colors"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-4 h-4"
                    >
                      <path
                        fillRule="evenodd"
                        d="M6 6h8v8H6V6z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={finishRecording}
                    title="Send voice note"
                    className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-900/20 transition-colors"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-4 h-4"
                    >
                      <path d="M2.5 10L17 2.5l-5 7.5 5 7.5L2.5 10z" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                    onChange={handleFileAttachment}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingMedia}
                    className="p-2 rounded-xl border bg-slate-800 border-slate-700 text-slate-400 hover:text-amber-400 hover:bg-amber-900/20 hover:border-amber-700/50 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Send image, video, audio or document"
                  >
                    {uploadingMedia ? (
                      <svg
                        className="w-4 h-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeOpacity=".25"
                        />
                        <path
                          d="M22 12A10 10 0 0012 2"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-4 h-4"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => setShowTplModal(true)}
                    className="p-2 rounded-xl border bg-slate-800 border-slate-700 text-slate-400 hover:text-blue-400 hover:bg-blue-900/20 hover:border-blue-700/50 transition-colors shrink-0"
                    title="Send Template"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-4 h-4"
                    >
                      <path d="M3 4h14v2H3zM3 8h10v2H3zM3 12h8v2H3z" />
                    </svg>
                  </button>
                  <button
                    onClick={handleOpenFlowModal}
                    className="p-2 rounded-xl border bg-slate-800 border-slate-700 text-slate-400 hover:text-emerald-400 hover:bg-emerald-900/20 hover:border-emerald-700/50 transition-colors shrink-0"
                    title="Send Flow"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-4 h-4"
                    >
                      <path
                        fillRule="evenodd"
                        d="M3 5a1 1 0 000 2h11.586l-2.293 2.293a1 1 0 101.414 1.414l4-4a1 1 0 000-1.414l-4-4a1 1 0 10-1.414 1.414L14.586 4H3a1 1 0 00-1 1zm14 9a1 1 0 100-2H5.414l2.293-2.293a1 1 0 10-1.414-1.414l-4 4a1 1 0 000 1.414l4 4a1 1 0 101.414-1.414L5.414 15H17a1 1 0 001-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendText();
                      }
                    }}
                    onInput={(e) => {
                      e.target.style.height = "auto";
                      e.target.style.height =
                        Math.min(e.target.scrollHeight, 120) + "px";
                    }}
                    placeholder={
                      !windowOpen && selected.window_expires_at
                        ? "Window closed — use a template ↑"
                        : "Type a message… (Enter to send)"
                    }
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500 resize-none transition-colors min-h-[40px] max-h-[120px] font-[inherit]"
                  />
                  {text.trim() ? (
                    <button
                      onClick={sendText}
                      disabled={sending}
                      className="p-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl transition-colors shrink-0 disabled:cursor-not-allowed"
                    >
                      {sending ? (
                        <svg
                          className="w-4 h-4 animate-spin"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeOpacity=".25"
                          />
                          <path
                            d="M22 12A10 10 0 0012 2"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                          />
                        </svg>
                      ) : (
                        <svg
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="w-4 h-4"
                        >
                          <path d="M2.5 10L17 2.5l-5 7.5 5 7.5L2.5 10z" />
                        </svg>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={startRecording}
                      disabled={uploadingMedia}
                      title="Record voice note"
                      className="p-2.5 bg-slate-800 hover:bg-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 hover:border-emerald-700/50 text-slate-400 hover:text-emerald-400 rounded-xl transition-colors shrink-0"
                    >
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-4 h-4"
                      >
                        <path d="M10 2a3 3 0 00-3 3v5a3 3 0 006 0V5a3 3 0 00-3-3z" />
                        <path d="M5.5 9.5a.5.5 0 00-1 0V10a5.5 5.5 0 0011 0v-.5a.5.5 0 00-1 0v.5a4.5 4.5 0 01-9 0v-.5z" />
                        <path d="M9.5 16.5v-1h1v1H12v1H8v-1h1.5z" />
                      </svg>
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </main>

      {selected && showRight && (
        <aside className="w-72 shrink-0 flex flex-col bg-slate-950 border-l border-slate-800 overflow-hidden">
          <div className="flex flex-col items-center gap-2 pt-6 pb-4 px-4 border-b border-slate-800">
            <Avatar name={contact?.profile_name || selected.wa_id} size="lg" />
            <p className="text-sm font-semibold text-center">
              {contact?.profile_name || (
                <span className="text-slate-400">No name</span>
              )}
            </p>
            <p className="text-xs text-slate-400 font-mono">
              +{selected.wa_id}
            </p>
            <WaBadge status={contact?.wa_status || selected.wa_status} className="mt-1" />
            {contact && (
              <button
                onClick={() => navigate("/dashboard/contacts")}
                className="text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-lg transition-colors mt-1"
              >
                View in Contacts →
              </button>
            )}
            <div className="flex gap-0 mt-2 w-full border-t border-slate-800 pt-3">
              {["details", "notes"].map((t) => (
                <button
                  key={t}
                  onClick={() => setRightTab(t)}
                  className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors capitalize
                    ${rightTab === t ? "bg-blue-600/20 text-blue-400" : "text-slate-500 hover:text-slate-300"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {rightTab === "details" && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Contact info
                  </p>
                  <button
                    onClick={() => setEditing((p) => !p)}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {editing ? "Cancel" : "Edit"}
                  </button>
                </div>

                {editing ? (
                  <div className="space-y-2">
                    {[
                      { label: "Name", key: "profile_name", p: "Full name" },
                      { label: "Email", key: "email", p: "email@example.com" },
                    ].map((f) => (
                      <div key={f.key}>
                        <label className="text-[10px] text-slate-500 block mb-1">
                          {f.label}
                        </label>
                        <input
                          value={editForm[f.key] || ""}
                          onChange={(e) =>
                            setEditForm((p) => ({
                              ...p,
                              [f.key]: e.target.value,
                            }))
                          }
                          placeholder={f.p}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500 transition-colors"
                        />
                      </div>
                    ))}
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">
                        Tags (comma separated)
                      </label>
                      <input
                        value={
                          Array.isArray(editForm.tags)
                            ? editForm.tags.join(", ")
                            : editForm.tags || ""
                        }
                        onChange={(e) =>
                          setEditForm((p) => ({ ...p, tags: e.target.value }))
                        }
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <button
                      onClick={saveContact}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium py-1.5 rounded-lg transition-colors"
                    >
                      Save changes
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {[
                      {
                        label: "Phone",
                        value: `+${selected.wa_id}`,
                        mono: true,
                      },
                      { label: "Email", value: contact?.email || "—" },
                      {
                        label: "Status",
                        value: contact?.status || "New",
                        cls: "text-blue-400",
                      },
                      {
                        label: "Opted in",
                        value: contact?.opted_in ? "✓ Yes" : "✗ No",
                        cls: contact?.opted_in
                          ? "text-emerald-400"
                          : "text-slate-500",
                      },
                      {
                        label: "Added",
                        value: contact?.created_at
                          ? fmt(contact.created_at)
                          : "—",
                      },
                    ].map((r) => (
                      <div
                        key={r.label}
                        className="flex justify-between items-center py-1.5 border-b border-slate-800/60 last:border-0"
                      >
                        <span className="text-xs text-slate-500">
                          {r.label}
                        </span>
                        <span
                          className={`text-xs text-right max-w-[140px] truncate ${r.cls || "text-slate-300"} ${r.mono ? "font-mono" : ""}`}
                        >
                          {r.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {(contact?.tags || []).length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                      Tags
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {contact.tags.map((t) => (
                        <span
                          key={t}
                          className="text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                    Assign agent
                  </p>
                  <select
                    value={selected.assigned_agent || ""}
                    onChange={(e) => assignAgent(e.target.value || null)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2 outline-none cursor-pointer focus:border-blue-500 transition-colors appearance-none"
                  >
                    <option value="">Unassigned</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Actions
                  </p>
                  {selected.status === "open" && (
                    <button
                      onClick={() => updateStatus("resolved")}
                      className="w-full text-left text-xs py-2 px-3 bg-emerald-900/20 hover:bg-emerald-900/40 border border-emerald-800/40 text-emerald-400 rounded-lg transition-colors"
                    >
                      ✓ Mark as resolved
                    </button>
                  )}
                  {selected.status === "resolved" && (
                    <button
                      onClick={() => updateStatus("open")}
                      className="w-full text-left text-xs py-2 px-3 bg-blue-900/20 hover:bg-blue-900/40 border border-blue-800/40 text-blue-400 rounded-lg transition-colors"
                    >
                      ↩ Reopen
                    </button>
                  )}
                  <button
                    onClick={() => updateStatus("spam")}
                    className="w-full text-left text-xs py-2 px-3 bg-red-900/10 hover:bg-red-900/20 border border-red-800/30 text-red-400 rounded-lg transition-colors"
                  >
                    🚫 Mark as spam
                  </button>
                </div>
              </>
            )}

            {rightTab === "notes" && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
                  Internal Notes
                </p>
                <textarea
                  rows={6}
                  placeholder="Add a private note…"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500 resize-none transition-colors font-[inherit] leading-relaxed mb-3"
                />
                <button className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium py-2 rounded-lg transition-colors">
                  Save note
                </button>
              </div>
            )}
          </div>
        </aside>
      )}

      {msgInfo && <MsgInfoModal m={msgInfo} onClose={() => setMsgInfo(null)} />}

      {activeMenu &&
        messages.find((m) => m.id === activeMenu) &&
        (() => {
          const m = messages.find((x) => x.id === activeMenu);
          const isOut = m.direction === "outbound";
          return (
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => setActiveMenu(null)}
            >
              <div
                className={`fixed bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden w-56`}
                style={{
                  bottom: 120,
                  [isOut ? "right" : "left"]: 80,
                  zIndex: 9999,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800">
                  {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={async () => {
                        setActiveMenu(null);
                        try {
                          await api.post(
                            `/conversations/${selected.id}/messages`,
                            {
                              msg_type: "reaction",
                              content: {
                                emoji,
                                message_id: m.wa_message_id || m.id,
                              },
                            },
                          );
                        } catch {}
                      }}
                      className="text-xl hover:scale-125 transition-transform active:scale-95 cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                  <span className="text-slate-400 text-lg">+</span>
                </div>
                {[
                  {
                    icon: "ℹ️",
                    label: "Message info",
                    fn: () => {
                      setMsgInfo(m);
                      setActiveMenu(null);
                    },
                  },
                  {
                    icon: "↩️",
                    label: "Reply",
                    fn: () => {
                      setReplyTo(m);
                      setActiveMenu(null);
                      setTimeout(() => inputRef.current?.focus(), 100);
                    },
                  },
                  {
                    icon: "📋",
                    label: "Copy",
                    fn: () => {
                      navigator.clipboard.writeText(
                        m.content?.body || m.content?.caption || "",
                      );
                      setActiveMenu(null);
                    },
                    show: !!(m.content?.body || m.content?.caption),
                  },
                  {
                    icon: "⭐",
                    label: m.starred ? "Unstar" : "Star",
                    fn: () => {
                      setMessages((p) =>
                        p.map((x) =>
                          x.id === m.id ? { ...x, starred: !x.starred } : x,
                        ),
                      );
                      setActiveMenu(null);
                    },
                  },
                  {
                    icon: "🗑️",
                    label: "Delete",
                    fn: async () => {
                      setActiveMenu(null);
                      if (confirm("Delete?")) {
                        try {
                          await api.delete(
                            `/conversations/${selected.id}/messages/${m.id}`,
                          );
                          setMessages((p) => p.filter((x) => x.id !== m.id));
                        } catch (e) {
                          alert(e.response?.data?.detail || "Failed");
                        }
                      }
                    },
                  },
                ].map((a) => (
                  <button
                    key={a.label}
                    onClick={a.fn}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800 transition-colors text-left"
                  >
                    <span className="text-base w-5 text-center">{a.icon}</span>
                    <span
                      className={`text-sm ${a.label === "Delete" ? "text-red-400" : "text-slate-300"}`}
                    >
                      {a.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

      {showTplModal && selected && (
        <SendTemplateModal
          onClose={() => setShowTplModal(false)}
          onSend={handleSendTemplate}
        />
      )}

      {showFlowModal && selected && (
        <SendFlowModal
          flows={flows}
          onClose={() => setShowFlowModal(false)}
          onSend={handleSendFlow}
        />
      )}

      {showNewConvo && (
        <NewConvoModal
          initialPhone={navState?.wa_id || ""}
          onClose={() => {
            setShowNewConvo(false);
            window.history.replaceState({}, "");
          }}
          onCreated={handleNewConvoCreated}
        />
      )}
    </div>
  );
}