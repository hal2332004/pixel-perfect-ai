import { useState, useEffect } from "react";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { useLanguage } from "@/context/LanguageContext";
import { Cpu, Thermometer, Zap, HardDrive, AlertTriangle, CheckCircle } from "lucide-react";

interface Alert {
  id: string;
  type: "warning" | "error" | "info";
  message: string;
  time: string;
}

export function ControlPanelView() {
  const { messages } = useLanguage();
  const [gpu, setGpu] = useState(72);
  const [vram, setVram] = useState(6.8);
  const [temp, setTemp] = useState(68);
  const [power, setPower] = useState(28);
  const [activeModel, setActiveModel] = useState("Real-ESRGAN");

  const alerts: Alert[] = [
    { id: "1", type: "warning", message: messages.controlPanel.alerts.temperatureWarning, time: messages.controlPanel.alerts.minAgo2 },
    { id: "2", type: "info", message: messages.controlPanel.alerts.switchedInfo, time: messages.controlPanel.alerts.minAgo5 },
    { id: "3", type: "info", message: messages.controlPanel.alerts.startedInfo, time: messages.controlPanel.alerts.hourAgo1 },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setGpu(Math.floor(65 + Math.random() * 20));
      setVram(+(6.2 + Math.random() * 1.5).toFixed(1));
      setTemp(Math.floor(62 + Math.random() * 12));
      setPower(Math.floor(24 + Math.random() * 10));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const tempColor = temp > 75 ? "destructive" : temp > 65 ? "warning" : "success";
  const gpuColor = gpu > 85 ? "warning" : "primary";

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{messages.controlPanel.title}</h2>
        <StatusBadge status="online" label="Jetson Orin X" />
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label={messages.controlPanel.gpuUsage} value={gpu} unit="%" icon={<Cpu className="w-4 h-4" />} color={gpuColor} percentage={gpu} />
        <MetricCard label={messages.controlPanel.vram} value={vram} unit="/ 8 GB" icon={<HardDrive className="w-4 h-4" />} color="accent" percentage={(vram / 8) * 100} />
        <MetricCard label={messages.controlPanel.temperature} value={temp} unit="°C" icon={<Thermometer className="w-4 h-4" />} color={tempColor} percentage={(temp / 100) * 100} />
        <MetricCard label={messages.controlPanel.powerDraw} value={power} unit="W" icon={<Zap className="w-4 h-4" />} color="primary" percentage={(power / 40) * 100} />
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
