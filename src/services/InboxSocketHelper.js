let ws = null;
let listeners = {}; // Store custom event listeners
let reconnectTimer = null;
let retryCount = 0;
let isIntentionalDisconnect = false;

// ✅ Smart URL detection to fix HTTPS / Build issues
const getBaseUrl = () => {
  let base = import.meta.env.VITE_WS_URL;
  if (!base) {
    // Auto-detect if running on Ngrok, HTTPS, etc.
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}`;
  }
  // Convert http(s) to ws(s) and remove accidental trailing slashes
  return base.replace(/^http/i, "ws").replace(/\/+$/, "");
};

function getAuthToken() {
  return (
    localStorage.getItem("agent_access_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("sa_access_token")
  );
}

const connectSocket = () => {
  // Return if already connected or connecting
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const token = getAuthToken();
  if (!token) {
    console.error("❌ No auth token found. Cannot connect WS.");
    return;
  }

  isIntentionalDisconnect = false;
  const wsUrl = `${getBaseUrl()}/ws/inbox?token=${token}`;
  
  console.log("🔗 Connecting To Native WS:", wsUrl);

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("✅ Native WS OPEN SUCCESS");
      retryCount = 0; // Reset retries on success
      triggerListeners('connect', ws);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type !== "ping" && data.type !== "connected") {
          triggerListeners('message', data);
        }
      } catch (err) {
        console.error("❌ JSON Parse Error:", err);
      }
    };

    ws.onerror = (error) => {
      console.error("🚨 WS ERROR:", error);
      triggerListeners('error', error);
    };

    ws.onclose = (event) => {
      console.warn(`🔌 WS CLOSED. Code: ${event.code}`);
      triggerListeners('disconnect', event);
      
      ws = null;

      // Stop reconnecting if we manually called disconnect()
      if (isIntentionalDisconnect) return;

      if (event.code === 4001) {
        console.error("❌ Authentication Failed");
        return;
      }

      // Exponential Backoff Reconnection
      const delay = Math.min(1000 * (2 ** retryCount), 30000);
      console.log(`🔄 Auto-Reconnecting in ${delay}ms...`);
      retryCount++;
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connectSocket, delay);
    };
  } catch (err) {
    console.error("❌ WebSocket Creation Failed:", err);
  }
};

// ✅ Wakes up the WebSocket if the browser put it to sleep
const handleVisibilityChange = () => {
  if (document.visibilityState === "visible") {
    if (!ws || ws.readyState === WebSocket.CLOSED) {
      console.log("👀 Tab focused: Waking up WebSocket...");
      retryCount = 0;
      connectSocket();
    }
  }
};

// Attach global listeners for visibility
if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("focus", handleVisibilityChange);
}

const triggerListeners = (event, data) => {
  if (listeners[event]) {
    listeners[event].forEach(callback => callback(data));
  }
};

const on = (event, callback) => {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(callback);
};

const off = (event, callback) => {
  if (!listeners[event]) return;
  if (callback) {
    listeners[event] = listeners[event].filter(cb => cb !== callback);
  } else {
    delete listeners[event];
  }
};

const emit = (event, data) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data)); 
  } else {
    console.warn("⚠️ Cannot emit, WS not open");
  }
};

const disconnect = () => {
  if (ws) {
    console.log("🛑 Manual Disconnect");
    isIntentionalDisconnect = true;
    clearTimeout(reconnectTimer);
    ws.close();
    ws = null;
  }
};

const getSocket = () => ws;

const InboxSocketHelper = {
  connectSocket,
  on,
  off,
  emit,
  disconnect,
  getSocket,
};

export default InboxSocketHelper;