import { useEffect, useRef, useCallback } from "react";

const WS_BASE = import.meta.env.VITE_WS_URL || "ws://localhost:8000";

function getAuthToken() {
  return (
    localStorage.getItem("agent_access_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("sa_access_token")
  );
}

export function useInboxSocket(onMessage, enabled = true) {
  console.log("🚀 useInboxSocket Hook Loaded");

  const ws = useRef(null);
  const retry = useRef(0);
  const timer = useRef(null);
  const mounted = useRef(true);
  const cbRef = useRef(onMessage);

  useEffect(() => {
    cbRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    console.log("🔥 connect() called");

    if (!mounted.current) {
      console.log("❌ mounted = false");
      return;
    }

    if (!enabled) {
      console.log("❌ WebSocket disabled");
      return;
    }

    if (
      ws.current &&
      (ws.current.readyState === WebSocket.OPEN ||
        ws.current.readyState === WebSocket.CONNECTING)
    ) {
      console.log("⚠️ WS already connected");
      return;
    }

    const token = getAuthToken();

    console.log("🔑 Token Exists:", !!token);

    if (!token) {
      console.error("❌ No auth token found");
      return;
    }

    console.log("🌐 VITE_WS_URL =", import.meta.env.VITE_WS_URL);
    console.log("🌐 WS_BASE =", WS_BASE);

    const wsUrl = `${WS_BASE}/ws/inbox?token=${token}`;

    console.log("🔗 Connecting To:", wsUrl);

    try {
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log("✅ WS OPEN SUCCESS");

        retry.current = 0;

        console.log("ReadyState:", ws.current?.readyState);
      };

      ws.current.onmessage = (event) => {
        console.log("📩 RAW MESSAGE:", event.data);

        try {
          const data = JSON.parse(event.data);

          console.log("📦 Parsed Data:", data);

          if (data.type !== "ping" && data.type !== "connected") {
            cbRef.current?.(data);
          }
        } catch (err) {
          console.error("❌ JSON Parse Error:", err);
        }
      };

      ws.current.onerror = (error) => {
        console.error("🚨 WS ERROR:", error);
      };

      ws.current.onclose = (event) => {
        console.warn("🔌 WS CLOSED", {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });

        if (!mounted.current) return;

        if (event.code === 4001) {
          console.error("❌ Authentication Failed");
          return;
        }

        const delay = Math.min(1000 * 2 ** retry.current, 30000);

        console.log(`🔄 Reconnecting in ${delay}ms`);

        retry.current++;

        timer.current = setTimeout(() => {
          connect();
        }, delay);
      };
    } catch (err) {
      console.error("❌ WebSocket Creation Failed:", err);
    }
  }, [enabled]);

  useEffect(() => {
    console.log("🎯 WebSocket useEffect Started");

    mounted.current = true;

    connect();

    const onVisible = () => {
      console.log("👀 Visibility Change:", document.visibilityState);

      if (document.visibilityState !== "visible") {
        return;
      }

      if (!ws.current || ws.current.readyState === WebSocket.CLOSED) {
        console.log("♻️ Reconnecting Because Tab Active");

        clearTimeout(timer.current);

        retry.current = 0;

        connect();
      }
    };

    document.addEventListener("visibilitychange", onVisible);

    window.addEventListener("focus", onVisible);

    return () => {
      console.log("🧹 WebSocket Cleanup");

      mounted.current = false;

      clearTimeout(timer.current);

      document.removeEventListener("visibilitychange", onVisible);

      window.removeEventListener("focus", onVisible);

      if (ws.current) {
        console.log("🔌 Closing WebSocket");

        ws.current.close();
      }
    };
  }, [connect]);

  return {
    disconnect: () => {
      console.log("🛑 Manual Disconnect");

      mounted.current = false;

      if (ws.current) {
        ws.current.close();
      }
    },

    getStatus: () => {
      return ws.current?.readyState;
    },
  };
}
