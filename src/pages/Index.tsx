import { useEffect, useMemo, useRef, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { OverviewView } from "@/components/views/OverviewView";
import { RealtimeView } from "@/components/views/RealtimeView";
import { OfflineView } from "@/components/views/OfflineView";
import { ImageView } from "@/components/views/ImageView";
import { ControlPanelView } from "@/components/views/ControlPanelView";
import { ModelArenaView } from "@/components/views/ModelArenaView";
import { toast } from "@/components/ui/sonner";
import { randomUUID } from "@/lib/uuid";
import { isAbortError } from "@/lib/isAbortError";
import { Wifi, WifiOff, ShieldAlert } from "lucide-react";

const views = [OverviewView, RealtimeView, OfflineView, ImageView, ControlPanelView, ModelArenaView];
const SESSION_KEY = "health-session-active";
const CONNECTION_ID_KEY = "health-connection-id";
const CLIENT_ID_KEY = "health-client-id";
const IMAGE_VIEW_STORAGE_KEY = "image-view-state";
const OFFLINE_VIEW_STORAGE_KEY = "offline-video-view-state";
const REALTIME_STREAM_JOB_ID_KEY = "realtime-stream-job-id";
const HEARTBEAT_INTERVAL_MS = 10_000;

type ConnectResponse = {
  connection_id?: string;
  message?: string;
};

type HeartbeatResponse = {
  alive?: boolean;
  message?: string;
};

type ConnectionStatusResponse = {
  is_connected?: boolean;
  connection_id?: string | null;
};

function withConnectPort(baseUrl: string): string {
  if (!baseUrl) {
    return "";
  }

  if (/:[0-9]+$/.test(baseUrl)) {
    return baseUrl.replace(/:[0-9]+$/, ":8001");
  }

  return `${baseUrl}:8001`;
}

function normalizeAbsoluteBaseUrl(rawUrl: string): string {
  const value = rawUrl.trim().replace(/\/$/, "");
  if (!value) {
    return "";
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith(":")) {
    if (typeof window === "undefined") {
      return "";
    }
    return `${window.location.protocol}//${window.location.hostname}${value}`;
  }

  if (value.startsWith("//")) {
    if (typeof window === "undefined") {
      return "";
    }
    return `${window.location.protocol}${value}`;
  }

  try {
    if (typeof window === "undefined") {
      return "";
    }
    return new URL(value, window.location.origin).origin;
  } catch {
    return "";
  }
}

function getInitialConnectionState(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return sessionStorage.getItem(SESSION_KEY) === "true" && Boolean(sessionStorage.getItem(CONNECTION_ID_KEY));
}

function getInitialConnectionId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return sessionStorage.getItem(CONNECTION_ID_KEY);
}

function getOrCreateClientId(): string {
  const existing = localStorage.getItem(CLIENT_ID_KEY);
  if (existing) {
    return existing;
  }

  const created = `web-ui-${randomUUID()}`;
  localStorage.setItem(CLIENT_ID_KEY, created);
  return created;
}

const Index = () => {
  const [activeMode, setActiveMode] = useState(0);
  const [isConnected, setIsConnected] = useState<boolean>(getInitialConnectionState);
  const [connectionId, setConnectionId] = useState<string | null>(getInitialConnectionId);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasConnectionError, setHasConnectionError] = useState(false);
  const ActiveView = views[activeMode];
  const heartbeatTimerRef = useRef<number | null>(null);
  const heartbeatFailCountRef = useRef(0);
  const heartbeatInFlightRef = useRef(false);

  const healthApiBase = useMemo(
    () => normalizeAbsoluteBaseUrl(import.meta.env.VITE_HEALTH_API_URL?.trim() || ""),
    [],
  );
  const connectApiBase = useMemo(
    () => normalizeAbsoluteBaseUrl(import.meta.env.VITE_CONNECT_API_URL?.trim() || "") || withConnectPort(healthApiBase),
    [healthApiBase],
  );

  const healthServerUrl = useMemo(
    () => normalizeAbsoluteBaseUrl(import.meta.env.VITE_HEALTH_SERVER_URL?.trim() || "") || healthApiBase,
    [],
  );
  const connectServerUrl = useMemo(
    () =>
      normalizeAbsoluteBaseUrl(import.meta.env.VITE_CONNECT_SERVER_URL?.trim() || "") ||
      connectApiBase ||
      withConnectPort(healthServerUrl),
    [connectApiBase, healthServerUrl],
  );

  const healthApiKey = useMemo(() => import.meta.env.VITE_HEALTH_API_KEY?.trim() || "", []);
  const connectApiKey = useMemo(() => import.meta.env.VITE_CONNECT_API_KEY?.trim() || healthApiKey, [healthApiKey]);

  const stopHeartbeat = () => {
    if (heartbeatTimerRef.current !== null) {
      window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    heartbeatInFlightRef.current = false;
    heartbeatFailCountRef.current = 0;
  };

  const clearConnectionState = () => {
    setIsConnected(false);
    setConnectionId(null);
    stopHeartbeat();
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(CONNECTION_ID_KEY);
  };

  const startHeartbeat = (currentConnectionId: string) => {
    stopHeartbeat();

    heartbeatTimerRef.current = window.setInterval(async () => {
      if (heartbeatInFlightRef.current) {
        return;
      }

      heartbeatInFlightRef.current = true;
      try {
        const response = await fetch(`${connectApiBase}/heartbeat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": connectApiKey,
          },
          body: JSON.stringify({ connection_id: currentConnectionId }),
        });

        const data = (await response.json()) as HeartbeatResponse;
        if (!response.ok || !data.alive) {
          heartbeatFailCountRef.current += 1;
          if (heartbeatFailCountRef.current >= 3) {
            clearConnectionState();
            setHasConnectionError(true);
            setActiveMode(0);
            sessionStorage.removeItem(IMAGE_VIEW_STORAGE_KEY);
            sessionStorage.removeItem(OFFLINE_VIEW_STORAGE_KEY);
            toast.error("Mất kết nối", {
              description: "Heartbeat thất bại nhiều lần. Vui lòng connect lại.",
            });
          }
          return;
        }

        heartbeatFailCountRef.current = 0;
      } catch {
        heartbeatFailCountRef.current += 1;
      } finally {
        heartbeatInFlightRef.current = false;
      }
    }, HEARTBEAT_INTERVAL_MS);
  };

  useEffect(() => {
    return () => {
      stopHeartbeat();
    };
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      if (!connectionId || !connectApiBase || !connectApiKey) {
        return;
      }

      try {
        const response = await fetch(`${connectApiBase}/connection/status`, {
          method: "GET",
          headers: {
            "X-API-Key": connectApiKey,
          },
        });

        if (!response.ok) {
          clearConnectionState();
          return;
        }

        const data = (await response.json()) as ConnectionStatusResponse;
        const alive = data.is_connected && data.connection_id === connectionId;
        if (!alive) {
          clearConnectionState();
          return;
        }

        setIsConnected(true);
        startHeartbeat(connectionId);
      } catch {
        clearConnectionState();
      }
    };

    restoreSession();
  }, [connectionId, connectApiBase, connectApiKey]);

  const handleConnect = async () => {
    if (isConnecting) {
      return;
    }

    if (!connectApiKey) {
      setHasConnectionError(true);
      toast.error("Thiếu API key", {
        description: "Hãy cấu hình VITE_CONNECT_API_KEY hoặc VITE_HEALTH_API_KEY trong file .env của frontend.",
      });
      return;
    }

    if (!connectApiBase) {
      setHasConnectionError(true);
      toast.error("Thiếu URL API", {
        description: "Hãy cấu hình VITE_CONNECT_API_URL hoặc VITE_HEALTH_API_URL trong file .env của frontend.",
      });
      return;
    }

    setIsConnecting(true);
    setHasConnectionError(false);

    const controller = new AbortController();
    let didTimeout = false;
    const timeoutId = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, 5000);

    try {
      const response = await fetch(`${connectApiBase}/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": connectApiKey,
        },
        body: JSON.stringify({
          client_id: getOrCreateClientId(),
          metadata: {
            app: "pixel-perfect-ai",
          },
        }),
        signal: controller.signal,
      });

      const data = (await response.json()) as ConnectResponse;

      if (data.message === "BUSY") {
        throw new Error("Server đang bận (BUSY). Có client khác đang giữ kết nối.");
      }

      if (!response.ok || !data.connection_id) {
        throw new Error(`Server trả về HTTP ${response.status}`);
      }

      setIsConnected(true);
      setConnectionId(data.connection_id);
      setHasConnectionError(false);
      sessionStorage.setItem(SESSION_KEY, "true");
      sessionStorage.setItem(CONNECTION_ID_KEY, data.connection_id);
      startHeartbeat(data.connection_id);
      toast.success("Connect thành công", {
        description: "Session đã được mở và heartbeat đang chạy nền.",
      });
    } catch (error) {
      clearConnectionState();
      setHasConnectionError(true);
      if (didTimeout) {
        toast.error("Connect thất bại", { description: "Request bị timeout" });
        return;
      }

      if (isAbortError(error)) {
        return;
      }

      const message = error instanceof Error ? error.message : "Không thể kết nối tới server";
      toast.error("Connect thất bại", {
        description: message,
      });
    } finally {
      window.clearTimeout(timeoutId);
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    const currentConnectionId = connectionId;
    stopHeartbeat();

    if (currentConnectionId && connectApiBase && connectApiKey) {
      try {
        await fetch(`${connectApiBase}/disconnect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": connectApiKey,
          },
          body: JSON.stringify({ connection_id: currentConnectionId }),
        });
      } catch {
        // Local state is still cleared to avoid blocked UI on transient network failures.
      }
    }

    if (healthApiBase && healthApiKey) {
      try {
        await fetch(`${healthApiBase}/inference/video/stream/stop-all`, {
          method: "POST",
          headers: {
            "X-API-Key": healthApiKey,
          },
        });
      } catch {
        // Best-effort stream stop on disconnect.
      }
    }

    clearConnectionState();
    setHasConnectionError(false);
    setActiveMode(0);
    sessionStorage.removeItem(IMAGE_VIEW_STORAGE_KEY);
    sessionStorage.removeItem(OFFLINE_VIEW_STORAGE_KEY);
    sessionStorage.removeItem(REALTIME_STREAM_JOB_ID_KEY);
    toast("Đã disconnect", {
      description: "Session hiện tại đã được xóa. Bạn có thể connect lại.",
    });
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <AppSidebar
        activeMode={activeMode}
        onModeChange={setActiveMode}
        isConnected={isConnected}
        isConnecting={isConnecting}
        hasConnectionError={hasConnectionError}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />
      <main className="flex-1 overflow-y-auto">
        {isConnected ? (
          <ActiveView />
        ) : (
          <section className="h-full p-6">
            <div className="h-full glass rounded-xl border border-border/50 flex items-center justify-center p-6">
              <div className="w-full max-w-lg text-center space-y-5">
                <div className="mx-auto w-12 h-12 rounded-full bg-secondary/70 border border-border flex items-center justify-center">
                  {hasConnectionError ? (
                    <ShieldAlert className="w-5 h-5 text-destructive" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold text-foreground">Chưa kết nối Jetson Health API</h2>
                  <p className="text-sm text-muted-foreground">
                    Nhấn Connect để xác thực với server và mở toàn bộ tab như Overview, Realtime Stream, Offline Processing...
                  </p>
                  <p className="text-xs font-mono text-muted-foreground">
                    Endpoint: {connectServerUrl ? `${connectServerUrl}/connect` : "Chưa cấu hình VITE_CONNECT_SERVER_URL"}
                  </p>
                </div>
                <div>
                  <button
                    onClick={handleConnect}
                    disabled={isConnecting}
                    className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Wifi className="w-4 h-4" />
                    {isConnecting ? "Đang kết nối..." : "Connect"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default Index;
