import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";
import { ArrowRight, Zap, Eye, Shield } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import demoFoodLr from "@/assets/demo-food-lr.jpg";
import demoFoodHr from "@/assets/demo-food-hr.jpg";

export function OverviewView() {
  const { messages } = useLanguage();

  return (
    <div className="space-y-8 p-6 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
          <span className="text-xs font-mono text-primary uppercase tracking-widest">{messages.overview.projectTag}</span>
        </div>
        <h1 className="text-4xl font-bold text-foreground leading-tight">
          {messages.overview.titleLine1} <br />
          <span className="text-gradient">{messages.overview.titleLine2}</span>
        </h1>
        <p className="text-muted-foreground max-w-2xl leading-relaxed">{messages.overview.description}</p>
      </div>

      {/* 3 Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: Zap, title: messages.overview.pillars.modelWhatTitle, desc: messages.overview.pillars.modelWhatDesc },
          { icon: Eye, title: messages.overview.pillars.improveWhereTitle, desc: messages.overview.pillars.improveWhereDesc },
          { icon: Shield, title: messages.overview.pillars.reliableTitle, desc: messages.overview.pillars.reliableDesc },
        ].map((item) => (
          <div key={item.title} className="glass rounded-xl p-5 space-y-3 hover:glow-primary transition-shadow duration-300">
            <item.icon className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground text-sm">{item.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Benchmark Table */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border/50 flex items-center gap-2">
          <span className="text-xs font-mono text-primary uppercase tracking-wider">{messages.overview.benchmarkTitle}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left px-5 py-3 text-xs font-mono text-muted-foreground uppercase">{messages.overview.tableHeaders.model}</th>
                <th className="text-right px-5 py-3 text-xs font-mono text-muted-foreground uppercase">{messages.overview.tableHeaders.psnr} ↑</th>
                <th className="text-right px-5 py-3 text-xs font-mono text-muted-foreground uppercase">{messages.overview.tableHeaders.ssim} ↑</th>
                <th className="text-right px-5 py-3 text-xs font-mono text-muted-foreground uppercase">{messages.overview.tableHeaders.fps}</th>
                <th className="text-right px-5 py-3 text-xs font-mono text-muted-foreground uppercase">{messages.overview.tableHeaders.params}</th>
              </tr>
            </thead>
            <tbody>
              {[
                { model: "ESPCNN", psnr: "29.7", ssim: "0.86", fps: "42", params: "0.14M", highlight: false },
                { model: "RFDM", psnr: "31.1", ssim: "0.90", fps: "28", params: "0.63M", highlight: true },
                { model: "IMDN", psnr: "31.4", ssim: "0.91", fps: "32", params: "0.72M", highlight: true },
              ].map((row) => (
                <tr key={row.model} className={row.highlight ? "bg-primary/5" : "hover:bg-secondary/30"}>
                  <td className="px-5 py-3 font-medium text-foreground flex items-center gap-2">
                    {row.highlight && <ArrowRight className="w-3 h-3 text-primary" />}
                    {row.model}
                  </td>
                  <td className="text-right px-5 py-3 font-mono text-foreground">{row.psnr}</td>
                  <td className="text-right px-5 py-3 font-mono text-foreground">{row.ssim}</td>
                  <td className="text-right px-5 py-3 font-mono text-primary">{row.fps}</td>
                  <td className="text-right px-5 py-3 font-mono text-muted-foreground">{row.params}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Before / After */}
      <div className="space-y-3">
        <h2 className="text-sm font-mono text-primary uppercase tracking-wider">{messages.overview.beforeAfterTitle}</h2>
        <BeforeAfterSlider
          beforeSrc={demoFoodLr}
          afterSrc={demoFoodHr}
          beforeLabel={`${messages.overview.slider.before} (1280×720)`}
          afterLabel={`${messages.overview.slider.after} (2560×1440)`}
        />
      </div>

      {/* About */}
      <div className="glass rounded-xl p-6 space-y-3">
        <h2 className="text-sm font-mono text-primary uppercase tracking-wider">{messages.overview.aboutTitle}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{messages.overview.aboutDescription}</p>
        <div className="flex flex-wrap gap-2">
          {["PyTorch", "ONNX", "TensorRT", "Jetson Orin X", "CUDA", "OpenCV"].map(t => (
            <span key={t} className="px-2 py-1 rounded-md bg-secondary text-xs font-mono text-secondary-foreground">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
