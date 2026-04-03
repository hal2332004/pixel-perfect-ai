import { useState, useEffect } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { useLanguage } from "@/context/LanguageContext";
import { Upload, Play, Trash2 } from "lucide-react";
import demoKitchenLr from "@/assets/demo-kitchen-lr.jpg";
import demoKitchenHr from "@/assets/demo-kitchen-hr.jpg";

interface QueueItem {
  id: string;
  name: string;
  status: "processing" | "waiting" | "completed";
  progress: number;
}

export function OfflineView() {
  const { messages } = useLanguage();
  const [queue, setQueue] = useState<QueueItem[]>([
    { id: "1", name: "kitchen_cam_01.mp4", status: "processing", progress: 67 },
    { id: "2", name: "prep_area_02.mp4", status: "waiting", progress: 0 },
    { id: "3", name: "cooking_station.mp4", status: "waiting", progress: 0 },
    { id: "4", name: "plating_area.mp4", status: "completed", progress: 100 },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setQueue(q => q.map(item => 
        item.status === "processing" && item.progress < 100
          ? { ...item, progress: Math.min(item.progress + Math.random() * 2, 100) }
          : item
      ));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4 p-6 h-full flex flex-col">
      <h2 className="text-lg font-semibold text-foreground">{messages.offline.title}</h2>

      {/* Upload Area */}
      <div className="glass rounded-xl border-2 border-dashed border-border/50 hover:border-primary/50 transition-colors p-8 flex flex-col items-center gap-3 cursor-pointer">
        <Upload className="w-8 h-8 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{messages.offline.uploadHint}</span>
        <span className="text-xs text-muted-foreground font-mono">{messages.offline.uploadFormats}</span>
      </div>

      {/* Queue */}
      <div className="glass rounded-xl overflow-hidden flex-shrink-0">
        <div className="px-4 py-3 border-b border-border/50">
          <span className="text-xs font-mono text-primary uppercase tracking-wider">{messages.offline.processingQueue}</span>
        </div>
        <div className="divide-y divide-border/30">
          {queue.map(item => (
            <div key={item.id} className="px-4 py-3 flex items-center gap-4">
              <Play className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-foreground truncate">{item.name}</span>
                  <StatusBadge status={item.status} label={messages.status[item.status]} />
                </div>
                {item.status !== "waiting" && (
                  <div className="w-full h-1 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
              </div>
              <span className="text-xs font-mono text-muted-foreground w-10 text-right">
                {item.progress > 0 ? `${Math.round(item.progress)}%` : "—"}
              </span>
              <button className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 min-h-0">
        <div className="text-xs font-mono text-primary uppercase tracking-wider mb-2">{messages.offline.previewTitle} - kitchen_cam_01.mp4</div>
        <div className="grid grid-cols-2 gap-3 h-[calc(100%-24px)]">
          <div className="glass rounded-xl overflow-hidden relative">
            <div className="absolute top-2 left-2 px-2 py-1 rounded bg-background/80 text-[10px] font-mono text-muted-foreground z-10">{messages.common.original}</div>
            <img src={demoKitchenLr} alt={messages.common.original} className="w-full h-full object-cover" />
          </div>
          <div className="glass rounded-xl overflow-hidden relative">
            <div className="absolute top-2 left-2 px-2 py-1 rounded bg-primary/20 text-[10px] font-mono text-primary z-10">{messages.realtime.srOutput}</div>
            <img src={demoKitchenHr} alt="SR" className="w-full h-full object-cover" />
          </div>
        </div>
      </div>
    </div>
  );
}
