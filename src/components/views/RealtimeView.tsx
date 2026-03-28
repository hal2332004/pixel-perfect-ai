import { useState, useEffect } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { MetricCard } from "@/components/MetricCard";
import { Activity, Clock, Gauge } from "lucide-react";
import demoKitchenLr from "@/assets/demo-kitchen-lr.jpg";
import demoKitchenHr from "@/assets/demo-kitchen-hr.jpg";

export function RealtimeView() {
  const [fps, setFps] = useState(24);
  const [latency, setLatency] = useState(45);
  const [frames, setFrames] = useState(12847);

  useEffect(() => {
    const interval = setInterval(() => {
      setFps(Math.floor(22 + Math.random() * 6));
      setLatency(Math.floor(38 + Math.random() * 15));
      setFrames(f => f + Math.floor(Math.random() * 3));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4 p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">Realtime Stream</h2>
          <StatusBadge status="online" label="LIVE" />
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <span>Model: <span className="text-primary">Real-ESRGAN</span></span>
          <span className="text-border">|</span>
          <span>Scale: <span className="text-primary">x2</span></span>
        </div>
      </div>

      {/* Dual Feed */}
      <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
        {/* Original */}
        <div className="glass rounded-xl overflow-hidden relative flex flex-col">
          <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between">
            <span className="text-xs font-mono text-muted-foreground uppercase">Original Feed</span>
            <span className="text-[10px] font-mono text-muted-foreground">1280×720</span>
          </div>
          <div className="flex-1 relative">
            <img src={demoKitchenLr} alt="Original camera feed" className="w-full h-full object-cover" />
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-background/80 backdrop-blur-sm text-[10px] font-mono text-muted-foreground">
              CAM-01 | Kitchen Main
            </div>
            <div className="absolute inset-0 scanline pointer-events-none" />
          </div>
        </div>

        {/* SR Output */}
        <div className="glass rounded-xl overflow-hidden relative flex flex-col">
          <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between">
            <span className="text-xs font-mono text-primary uppercase">SR Output</span>
            <span className="text-[10px] font-mono text-primary">2560×1440</span>
          </div>
          <div className="flex-1 relative">
            <img src={demoKitchenHr} alt="Super resolution output" className="w-full h-full object-cover" />
            <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-primary/20 backdrop-blur-sm text-[10px] font-mono text-primary">
              SR × 2 | Real-ESRGAN
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="FPS" value={fps} icon={<Gauge className="w-4 h-4" />} color="primary" percentage={(fps / 30) * 100} />
        <MetricCard label="Latency" value={latency} unit="ms" icon={<Clock className="w-4 h-4" />} color={latency > 50 ? "warning" : "accent"} percentage={(latency / 100) * 100} />
        <MetricCard label="Frames" value={frames.toLocaleString()} icon={<Activity className="w-4 h-4" />} color="success" />
      </div>
    </div>
  );
}
