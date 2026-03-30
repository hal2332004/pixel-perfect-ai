import { useState, useEffect } from "react";
import { 
  Home, Video, Upload, Image, Cpu, Swords, 
  ChevronLeft, ChevronRight, Activity, Sun, Moon, PlugZap, PowerOff
} from "lucide-react";
import { cn } from "@/lib/utils";

const modes = [
  { id: 0, label: "Overview", icon: Home },
  { id: 1, label: "Realtime Stream", icon: Video },
  { id: 2, label: "Offline Processing", icon: Upload },
  { id: 3, label: "Image to Image", icon: Image },
  { id: 4, label: "Control Panel", icon: Cpu },
  { id: 5, label: "Model Arena", icon: Swords },
];

interface AppSidebarProps {
  activeMode: number;
  onModeChange: (mode: number) => void;
  isConnected: boolean;
  isConnecting: boolean;
  hasConnectionError: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function AppSidebar({
  activeMode,
  onModeChange,
  isConnected,
  isConnecting,
  hasConnectionError,
  onConnect,
  onDisconnect,
}: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark") ||
        (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches) ||
        localStorage.getItem("theme") === "dark";
    }
    return true;
  });

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  return (
    <div className={cn(
      "flex flex-col h-screen glass-strong transition-all duration-300 border-r border-border/50",
      collapsed ? "w-16" : "w-60"
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 p-4 border-b border-border/50">
        <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
          <Activity className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-foreground tracking-tight">AI Monitor</h1>
            <p className="text-[10px] text-muted-foreground font-mono">JETSON ORIN X</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {!isConnected && !collapsed && (
          <div className="px-3 py-4 rounded-lg border border-dashed border-border/70 bg-secondary/20">
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Connection Required</p>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Nhấn Connect để mở các tab giám sát và xử lý dữ liệu.
            </p>
          </div>
        )}
        {isConnected && modes.map((mode) => {
          const Icon = mode.icon;
          const isActive = activeMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => onModeChange(mode.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary glow-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <Icon className={cn("w-4 h-4 flex-shrink-0", isActive && "text-primary")} />
              {!collapsed && <span className="truncate">{mode.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Status */}
      {!collapsed && (
        <div className="p-4 border-t border-border/50">
          <div className="mb-3">
            {!isConnected ? (
              <button
                onClick={onConnect}
                disabled={isConnecting}
                className={cn(
                  "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200",
                  "border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
                  "disabled:opacity-60 disabled:cursor-not-allowed"
                )}
              >
                <PlugZap className="w-3.5 h-3.5" />
                {isConnecting ? "Connecting..." : "Connect"}
              </button>
            ) : (
              <button
                onClick={onDisconnect}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
              >
                <PowerOff className="w-3.5 h-3.5" />
                Disconnect
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                isConnected && "bg-success animate-pulse-glow",
                isConnecting && "bg-warning animate-pulse",
                !isConnected && !isConnecting && !hasConnectionError && "bg-muted-foreground",
                hasConnectionError && "bg-destructive animate-pulse"
              )}
            />
            <span className="text-xs text-muted-foreground font-mono">
              {isConnected ? "Connected" : isConnecting ? "Connecting" : hasConnectionError ? "Connect Failed" : "Disconnected"}
            </span>
          </div>
        </div>
      )}

      {/* Theme toggle + Collapse */}
      <div className="border-t border-border/50">
        <button
          onClick={() => setDark(!dark)}
          className="w-full flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          {dark ? <Sun className="w-4 h-4 mx-auto flex-shrink-0" /> : <Moon className="w-4 h-4 mx-auto flex-shrink-0" />}
          {!collapsed && <span className="text-xs">{dark ? "Light Mode" : "Dark Mode"}</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full p-3 border-t border-border/50 text-muted-foreground hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4 mx-auto" /> : <ChevronLeft className="w-4 h-4 mx-auto" />}
        </button>
      </div>
    </div>
  );
}
