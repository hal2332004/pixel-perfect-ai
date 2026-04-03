import { useState } from "react";
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";
import { useLanguage } from "@/context/LanguageContext";
import { Upload, ZoomIn, Download } from "lucide-react";
import demoFoodLr from "@/assets/demo-food-lr.jpg";
import demoFoodHr from "@/assets/demo-food-hr.jpg";
import demoSushiLr from "@/assets/demo-sushi-lr.jpg";
import demoSushiHr from "@/assets/demo-sushi-hr.jpg";

const samples = [
  { id: "food", lr: demoFoodLr, hr: demoFoodHr },
  { id: "sushi", lr: demoSushiLr, hr: demoSushiHr },
] as const;

export function ImageView() {
  const { messages } = useLanguage();
  const [selectedId, setSelectedId] = useState<(typeof samples)[number]["id"]>("food");
  const [model, setModel] = useState("Real-ESRGAN");
  const [scale, setScale] = useState("x2");
  const selected = samples.find((item) => item.id === selectedId) || samples[0];

  const sampleNames = {
    food: messages.image.sampleFood,
    sushi: messages.image.sampleSushi,
  } as const;

  return (
    <div className="space-y-4 p-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{messages.image.title}</h2>
        <div className="flex items-center gap-2">
          <select value={model} onChange={e => setModel(e.target.value)}
            className="bg-secondary text-secondary-foreground text-xs font-mono px-3 py-1.5 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary">
            <option>Real-ESRGAN</option>
            <option>ESRGAN</option>
            <option>SwinIR</option>
          </select>
          <select value={scale} onChange={e => setScale(e.target.value)}
            className="bg-secondary text-secondary-foreground text-xs font-mono px-3 py-1.5 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary">
            <option>x2</option>
            <option>x4</option>
          </select>
        </div>
      </div>

      {/* Upload zone */}
      <div className="glass rounded-xl border-2 border-dashed border-border/50 hover:border-primary/50 transition-colors p-4 flex items-center justify-center gap-3 cursor-pointer">
        <Upload className="w-5 h-5 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{messages.image.uploadHint}</span>
      </div>

      {/* Sample thumbnails */}
      <div className="flex gap-2">
        {samples.map(s => (
          <button key={s.id} onClick={() => setSelectedId(s.id)}
            className={`glass rounded-lg overflow-hidden w-20 h-14 border-2 transition-all ${
              selectedId === s.id ? "border-primary glow-primary" : "border-transparent hover:border-border"
            }`}>
            <img src={s.lr} alt={sampleNames[s.id]} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>

      {/* Before/After Slider */}
      <div className="flex-1 min-h-0">
        <BeforeAfterSlider
          beforeSrc={selected.lr}
          afterSrc={selected.hr}
          beforeLabel={`Bicubic - ${sampleNames[selected.id]}`}
          afterLabel={`${model} ${scale}`}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
          <ZoomIn className="w-4 h-4" /> {messages.image.upscale}
        </button>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg glass text-foreground text-sm hover:bg-secondary/50 transition-colors">
          <Download className="w-4 h-4" /> {messages.image.download}
        </button>
        <span className="text-xs text-muted-foreground font-mono ml-auto">
          {messages.image.inputOutput}
        </span>
      </div>
    </div>
  );
}
