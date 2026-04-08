import { useEffect, useRef, useState } from "react";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useLanguage } from "@/context/LanguageContext";
import { isAbortError } from "@/lib/isAbortError";
import { Cpu, Thermometer, Zap, HardDrive, AlertTriangle, CheckCircle } from "lucide-react";

const CONTROL_PANEL_TIMEOUT_MS = 60000;
const CONTROL_PANEL_POLL_MS = 5000;
const CONTROL_PANEL_RETRY_MS = 12000;

interface Alert {
  id: string;
  type: "warning" | "error" | "info";
  message: string;
  time: string;
}

export function ControlPanelView() {
  const { messages } = useLanguage();
  const [gpu, setGpu] = useState<number | null>(null);
  const [vram, setVram] = useState<number | null>(null);
  const [vramTotal, setVramTotal] = useState<number>(8);
  const [temp, setTemp] = useState<number | null>(null);
  const [power, setPower] = useState<number | null>(null);
  const [maxPower, setMaxPower] = useState(40);
  const [activeModel, setActiveModel] = useState("Real-ESRGAN");
  const [pollError, setPollError] = useState<string | null>(null);
  const [lastSource, setLastSource] = useState<"tegrastats" | "fallback" | null>(null);
  const pollInFlightRef = useRef(false);

  const inferredHealthApiBase =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.hostname}:9000`
      : "";
  const healthApiBase = import.meta.env.VITE_HEALTH_API_URL?.trim().replace(/\/$/, "") || inferredHealthApiBase;
  const healthApiKey = import.meta.env.VITE_HEALTH_API_KEY?.trim() || "";

  const alerts: Alert[] = [
    { id: "1", type: "warning", message: messages.controlPanel.alerts.temperatureWarning, time: messages.controlPanel.alerts.minAgo2 },
    { id: "2", type: "info", message: messages.controlPanel.alerts.switchedInfo, time: messages.controlPanel.alerts.minAgo5 },
    { id: "3", type: "info", message: messages.controlPanel.alerts.startedInfo, time: messages.controlPanel.alerts.hourAgo1 },
  ];

  useEffect(() => {
    if (!healthApiKey) {
      setPollError("Thiếu VITE_HEALTH_API_KEY");
      return;
    }

    let isActive = true;
    let timerId: number | null = null;
    let activeController: AbortController | null = null;

    const scheduleNext = (delayMs: number) => {
      if (!isActive) {
        return;
      }
      timerId = window.setTimeout(() => {
        void fetchMetrics();
      }, delayMs);
    };

    const fetchMetrics = async () => {
      if (pollInFlightRef.current) {
        return;
      }

      pollInFlightRef.current = true;
      const controller = new AbortController();
      activeController = controller;
      let didTimeout = false;
      const timeoutId = window.setTimeout(() => {
        didTimeout = true;
        controller.abort();
      }, CONTROL_PANEL_TIMEOUT_MS);

      try {
        const response = await fetch(`${healthApiBase}/control-panel/metrics`, {
          method: "GET",
          headers: {
            "X-API-Key": healthApiKey,
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = (await response.json()) as {
          gpu_percent?: number | null;
          vram_used_gb?: number | null;
          vram_total_gb?: number | null;
          temp_c?: number | null;
          power_w?: number | null;
          max_power_w?: number | null;
          active_model?: string | null;
          source?: "tegrastats" | "fallback";
        };

        if (!isActive) {
          return;
        }

        setPollError(null);
        if (data.source) {
          setLastSource(data.source);
        }

        if (typeof data.gpu_percent === "number") {
          setGpu(Math.max(0, Math.min(100, Math.round(data.gpu_percent))));
        } else {
          setGpu(null);
        }
        if (typeof data.vram_used_gb === "number") {
          setVram(+data.vram_used_gb.toFixed(1));
        } else {
          setVram(null);
        }
        if (typeof data.vram_total_gb === "number" && data.vram_total_gb > 0) {
          setVramTotal(+data.vram_total_gb.toFixed(1));
        }
        if (typeof data.temp_c === "number") {
          setTemp(Math.round(data.temp_c));
        } else {
          setTemp(null);
        }
        if (typeof data.power_w === "number") {
          setPower(+data.power_w.toFixed(1));
        } else {
          setPower(null);
        }
        if (typeof data.max_power_w === "number" && data.max_power_w > 0) {
          setMaxPower(+data.max_power_w.toFixed(1));
        }
        if (typeof data.active_model === "string" && data.active_model.trim()) {
          setActiveModel(data.active_model);
        }

        scheduleNext(CONTROL_PANEL_POLL_MS);
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (didTimeout) {
          setPollError("Request timed out");
          scheduleNext(CONTROL_PANEL_RETRY_MS);
          return;
        }

        if (isAbortError(error)) {
          return;
        }

        const message = error instanceof Error ? error.message : "Unknown polling error";
        setPollError(message);
        console.error("Control panel polling failed", {
          endpoint: `${healthApiBase}/control-panel/metrics`,
          message,
        });
        scheduleNext(CONTROL_PANEL_RETRY_MS);
      } finally {
        window.clearTimeout(timeoutId);
        pollInFlightRef.current = false;
        if (activeController === controller) {
          activeController = null;
        }
      }
    };

    void fetchMetrics();

    return () => {
      isActive = false;
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
      if (activeController) {
        activeController.abort();
      }
      pollInFlightRef.current = false;
    };
  }, [healthApiBase, healthApiKey]);

  const tempColor = (temp ?? 0) > 75 ? "destructive" : (temp ?? 0) > 65 ? "warning" : "success";
  const gpuColor = (gpu ?? 0) > 85 ? "warning" : "primary";

  const gpuValue = gpu ?? "N/A";
  const vramValue = vram ?? "N/A";
  const tempValue = temp ?? "N/A";
  const powerValue = power ?? "N/A";

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{messages.controlPanel.title}</h2>
        <StatusBadge status="online" label="Jetson Orin X" />
      </div>

      <div className="text-xs font-mono text-muted-foreground">
        Endpoint: {healthApiBase}/control-panel/metrics
      </div>
      {lastSource === "fallback" && (
        <div className="text-xs text-warning">Khong doc duoc tegrastats, backend dang tra fallback.</div>
      )}
      {pollError && <div className="text-xs text-destructive">Polling error: {pollError}</div>}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label={messages.controlPanel.gpuUsage} value={gpuValue} unit={gpu === null ? "" : "%"} icon={<Cpu className="w-4 h-4" />} color={gpuColor} percentage={typeof gpu === "number" ? gpu : undefined} />
        <MetricCard label={messages.controlPanel.vram} value={vramValue} unit={typeof vram === "number" ? `/ ${vramTotal} GB` : ""} icon={<HardDrive className="w-4 h-4" />} color="accent" percentage={typeof vram === "number" && vramTotal > 0 ? (vram / vramTotal) * 100 : undefined} />
        <MetricCard label={messages.controlPanel.temperature} value={tempValue} unit={temp === null ? "" : "°C"} icon={<Thermometer className="w-4 h-4" />} color={tempColor} percentage={typeof temp === "number" ? temp : undefined} />
        <MetricCard label={messages.controlPanel.powerDraw} value={powerValue} unit={power === null ? "" : "W"} icon={<Zap className="w-4 h-4" />} color="primary" percentage={typeof power === "number" && maxPower > 0 ? (power / maxPower) * 100 : undefined} />
      </div>

      {/* Model Switching */}
      <div className="glass rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-mono text-primary uppercase tracking-wider">{messages.controlPanel.activeModel}</h3>
        <div className="grid grid-cols-3 gap-2">
          {["Real-ESRGAN", "ESRGAN", "SwinIR"].map(m => (
            <button
              key={m}
              onClick={() => setActiveModel(m)}
              className={`px-4 py-3 rounded-lg text-sm font-mono transition-all ${
                activeModel === m
                  ? "bg-primary/15 text-primary border border-primary/30 glow-primary"
                  : "glass text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{messages.controlPanel.autoSwitchHint}</p>
      </div>

      {/* Alerts */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border/50 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <span className="text-xs font-mono text-primary uppercase tracking-wider">{messages.controlPanel.systemAlerts}</span>
        </div>
        <div className="divide-y divide-border/30">
          {alerts.map(a => (
            <div key={a.id} className="px-5 py-3 flex items-start gap-3">
              {a.type === "warning" ? (
                <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="text-sm text-foreground">{a.message}</p>
                <span className="text-[10px] text-muted-foreground font-mono">{a.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
