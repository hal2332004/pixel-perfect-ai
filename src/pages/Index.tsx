import { useMemo, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { OverviewView } from "@/components/views/OverviewView";
import { RealtimeView } from "@/components/views/RealtimeView";
import { OfflineView } from "@/components/views/OfflineView";
import { ImageView } from "@/components/views/ImageView";
import { ControlPanelView } from "@/components/views/ControlPanelView";
import { ModelArenaView } from "@/components/views/ModelArenaView";
import { toast } from "@/components/ui/sonner";
import { Wifi, WifiOff, ShieldAlert } from "lucide-react";

const views = [OverviewView, RealtimeView, OfflineView, ImageView, ControlPanelView, ModelArenaView];
const SESSION_KEY = "health-session-active";

function getInitialConnectionState(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return sessionStorage.getItem(SESSION_KEY) === "true";
}

const Index = () => {
  const [activeMode, setActiveMode] = useState(0);
  const [isConnected, setIsConnected] = useState<boolean>(getInitialConnectionState);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasConnectionError, setHasConnectionError] = useState(false);
  const ActiveView = views[activeMode];

  const healthApiBase = useMemo(() => import.meta.env.VITE_HEALTH_API_URL?.trim().replace(/\/$/, "") || "", []);

  const healthServerUrl = useMemo(
    () => import.meta.env.VITE_HEALTH_SERVER_URL?.trim().replace(/\/$/, "") || "",
    [],
  );

  const healthApiKey = useMemo(() => import.meta.env.VITE_HEALTH_API_KEY?.trim() || "", []);

  const handleConnect = async () => {
    if (isConnecting) {
      return;
    }

    if (!healthApiKey) {
      setHasConnectionError(true);
      toast.error("Thiếu API key", {
        description: "Hãy cấu hình VITE_HEALTH_API_KEY trong file .env của frontend.",
      });
      return;
    }

    if (!healthApiBase) {
      setHasConnectionError(true);
      toast.error("Thiếu URL API", {
        description: "Hãy cấu hình VITE_HEALTH_API_URL trong file .env của frontend.",
      });
      return;
    }

    setIsConnecting(true);
    setHasConnectionError(false);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${healthApiBase}/health`, {
        method: "GET",
        headers: {
          "X-API-Key": healthApiKey,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Server trả về HTTP ${response.status}`);
      }

      setIsConnected(true);
      setHasConnectionError(false);
      sessionStorage.setItem(SESSION_KEY, "true");
      toast.success("Connect thành công", {
        description: "Session đã được mở. Các tab chức năng đã sẵn sàng.",
      });
    } catch (error) {
      setIsConnected(false);
      setHasConnectionError(true);
      sessionStorage.removeItem(SESSION_KEY);
      const message = error instanceof Error ? error.message : "Không thể kết nối tới server";
      toast.error("Connect thất bại", {
        description: message,
      });
    } finally {
      window.clearTimeout(timeoutId);
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setHasConnectionError(false);
    setActiveMode(0);
    sessionStorage.removeItem(SESSION_KEY);
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
                    Endpoint: {healthServerUrl ? `${healthServerUrl}/health` : "Chưa cấu hình VITE_HEALTH_SERVER_URL"}
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
