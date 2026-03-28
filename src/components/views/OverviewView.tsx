import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";
import { ArrowRight, Zap, Eye, Shield } from "lucide-react";
import demoFoodLr from "@/assets/demo-food-lr.jpg";
import demoFoodHr from "@/assets/demo-food-hr.jpg";

export function OverviewView() {
  return (
    <div className="space-y-8 p-6 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
          <span className="text-xs font-mono text-primary uppercase tracking-widest">Capstone Project</span>
        </div>
        <h1 className="text-4xl font-bold text-foreground leading-tight">
          Cooking Monitoring <br />
          <span className="text-gradient">Super Resolution Camera</span>
        </h1>
        <p className="text-muted-foreground max-w-2xl leading-relaxed">
          Hệ thống giám sát nấu ăn thông minh sử dụng AI Super Resolution trên NVIDIA Jetson Orin X. 
          Nâng cao chất lượng hình ảnh camera giám sát từ độ phân giải thấp lên cao trong thời gian thực, 
          giúp quan sát chi tiết quá trình chế biến thực phẩm.
        </p>
      </div>

      {/* 3 Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: Zap, title: "Model đã làm gì?", desc: "Sử dụng deep learning để upscale hình ảnh camera giám sát x4, giữ nguyên chi tiết và giảm nhiễu." },
          { icon: Eye, title: "Cải thiện ở đâu?", desc: "PSNR tăng 3.1dB, SSIM cải thiện 9% so với phương pháp truyền thống bicubic interpolation." },
          { icon: Shield, title: "Có đáng tin?", desc: "Kiểm chứng trên 10,000+ frames từ camera thực tế trong môi trường bếp công nghiệp." },
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
          <span className="text-xs font-mono text-primary uppercase tracking-wider">Benchmark Comparison</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left px-5 py-3 text-xs font-mono text-muted-foreground uppercase">Model</th>
                <th className="text-right px-5 py-3 text-xs font-mono text-muted-foreground uppercase">PSNR ↑</th>
                <th className="text-right px-5 py-3 text-xs font-mono text-muted-foreground uppercase">SSIM ↑</th>
                <th className="text-right px-5 py-3 text-xs font-mono text-muted-foreground uppercase">FPS</th>
                <th className="text-right px-5 py-3 text-xs font-mono text-muted-foreground uppercase">Params</th>
              </tr>
            </thead>
            <tbody>
              {[
                { model: "Bicubic", psnr: "28.1", ssim: "0.81", fps: "60", params: "0", highlight: false },
                { model: "ESRGAN", psnr: "30.5", ssim: "0.88", fps: "24", params: "16.7M", highlight: false },
                { model: "Real-ESRGAN", psnr: "31.2", ssim: "0.90", fps: "20", params: "16.7M", highlight: true },
                { model: "SwinIR", psnr: "31.8", ssim: "0.91", fps: "12", params: "11.8M", highlight: false },
                { model: "Ours (Optimized)", psnr: "31.3", ssim: "0.90", fps: "30", params: "5.2M", highlight: true },
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
        <h2 className="text-sm font-mono text-primary uppercase tracking-wider">Before / After Comparison</h2>
        <BeforeAfterSlider beforeSrc={demoFoodLr} afterSrc={demoFoodHr} beforeLabel="Bicubic (1280×720)" afterLabel="Super Resolution (2560×1440)" />
      </div>

      {/* About */}
      <div className="glass rounded-xl p-6 space-y-3">
        <h2 className="text-sm font-mono text-primary uppercase tracking-wider">About Us</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Đồ án tốt nghiệp — Nhóm nghiên cứu ứng dụng AI vào giám sát an toàn thực phẩm. 
          Sử dụng NVIDIA Jetson Orin X để triển khai mô hình Super Resolution trong thời gian thực, 
          phục vụ giám sát quy trình nấu ăn tại các bếp công nghiệp.
        </p>
        <div className="flex flex-wrap gap-2">
          {["PyTorch", "ONNX", "TensorRT", "Jetson Orin X", "CUDA", "OpenCV"].map(t => (
            <span key={t} className="px-2 py-1 rounded-md bg-secondary text-xs font-mono text-secondary-foreground">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
