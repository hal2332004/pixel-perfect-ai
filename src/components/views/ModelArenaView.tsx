import { useState, useRef, useCallback } from "react";
import demoFoodLr from "@/assets/demo-food-lr.jpg";
import demoFoodHr from "@/assets/demo-food-hr.jpg";
import demoSushiLr from "@/assets/demo-sushi-lr.jpg";
import demoSushiHr from "@/assets/demo-sushi-hr.jpg";

export function ModelArenaView() {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const [modelA, setModelA] = useState("ESRGAN");
  const [modelB, setModelB] = useState("SwinIR");
  const [sample, setSample] = useState<"food" | "sushi">("food");

  // Use LR for model A (simulating a weaker model) and HR for model B
  const images = {
    food: { a: demoFoodLr, b: demoFoodHr },
    sushi: { a: demoSushiLr, b: demoSushiHr },
  };

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(Math.max(x, 0), 100));
  }, []);

  const handleMouseDown = () => { isDragging.current = true; };
  const handleMouseUp = () => { isDragging.current = false; };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging.current) updatePosition(e.clientX);
  };

  return (
    <div className="space-y-4 p-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Model Arena</h2>
        <div className="flex gap-2">
          <select value={sample} onChange={e => setSample(e.target.value as "food" | "sushi")}
            className="bg-secondary text-secondary-foreground text-xs font-mono px-3 py-1.5 rounded-lg border border-border">
            <option value="food">Phở Scene</option>
            <option value="sushi">Sushi Scene</option>
          </select>
        </div>
      </div>

      {/* Model selectors */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-lg p-3 flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-warning" />
          <select value={modelA} onChange={e => setModelA(e.target.value)}
            className="bg-transparent text-foreground text-sm font-mono focus:outline-none flex-1">
            <option>ESRGAN</option>
            <option>Bicubic</option>
            <option>Real-ESRGAN</option>
          </select>
          <span className="text-[10px] text-muted-foreground font-mono">PSNR: 30.5</span>
        </div>
        <div className="glass rounded-lg p-3 flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <select value={modelB} onChange={e => setModelB(e.target.value)}
            className="bg-transparent text-foreground text-sm font-mono focus:outline-none flex-1">
            <option>SwinIR</option>
            <option>Real-ESRGAN</option>
            <option>Ours (Optimized)</option>
          </select>
          <span className="text-[10px] text-muted-foreground font-mono">PSNR: 31.8</span>
        </div>
      </div>

      {/* Arena comparison */}
      <div
        ref={containerRef}
        className="flex-1 relative rounded-xl overflow-hidden glass cursor-col-resize select-none min-h-0"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Right side (Model B) */}
        <img src={images[sample].b} alt={modelB} className="absolute inset-0 w-full h-full object-cover" />

        {/* Left side (Model A) */}
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${position}%` }}>
          <img src={images[sample].a} alt={modelA} className="absolute inset-0 w-full h-full object-cover"
            style={{ width: `${containerRef.current?.offsetWidth || 800}px` }} />
        </div>

        {/* Slider */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-foreground/50 z-10" style={{ left: `${position}%` }}
          onMouseDown={handleMouseDown}>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-foreground/90 flex items-center justify-center">
            <span className="text-background text-xs font-bold">VS</span>
          </div>
        </div>

        {/* Labels */}
        <div className="absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-warning/20 backdrop-blur-sm border border-warning/30 z-20">
          <span className="text-xs font-mono text-warning">A: {modelA}</span>
        </div>
        <div className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-primary/20 backdrop-blur-sm border border-primary/30 z-20">
          <span className="text-xs font-mono text-primary">B: {modelB}</span>
        </div>
      </div>

      {/* Comparison table */}
      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left px-4 py-2 text-xs font-mono text-muted-foreground">Metric</th>
              <th className="text-center px-4 py-2 text-xs font-mono text-warning">{modelA}</th>
              <th className="text-center px-4 py-2 text-xs font-mono text-primary">{modelB}</th>
              <th className="text-center px-4 py-2 text-xs font-mono text-muted-foreground">Winner</th>
            </tr>
          </thead>
          <tbody>
            {[
              { metric: "PSNR", a: "30.5", b: "31.8", winner: "B" },
              { metric: "SSIM", a: "0.88", b: "0.91", winner: "B" },
              { metric: "FPS", a: "24", b: "12", winner: "A" },
              { metric: "Params", a: "16.7M", b: "11.8M", winner: "B" },
            ].map(row => (
              <tr key={row.metric} className="border-b border-border/20">
                <td className="px-4 py-2 text-foreground font-mono text-xs">{row.metric}</td>
                <td className={`text-center px-4 py-2 font-mono text-xs ${row.winner === "A" ? "text-warning font-bold" : "text-muted-foreground"}`}>{row.a}</td>
                <td className={`text-center px-4 py-2 font-mono text-xs ${row.winner === "B" ? "text-primary font-bold" : "text-muted-foreground"}`}>{row.b}</td>
                <td className={`text-center px-4 py-2 font-mono text-xs font-bold ${row.winner === "A" ? "text-warning" : "text-primary"}`}>{row.winner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
