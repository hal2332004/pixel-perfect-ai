import { useEffect, useMemo, useRef, useState } from "react";
import { BeforeAfterSlider } from "@/components/BeforeAfterSlider";
import { useLanguage } from "@/context/LanguageContext";
import { Upload, ZoomIn, Download, Loader2, ImagePlus, Clock3 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import demoFoodLr from "@/assets/demo-food-lr.jpg";
import demoFoodHr from "@/assets/demo-food-hr.jpg";
import demoSushiLr from "@/assets/demo-sushi-lr.jpg";
import demoSushiHr from "@/assets/demo-sushi-hr.jpg";

const samples = [
  { id: "food", lr: demoFoodLr, hr: demoFoodHr },
  { id: "sushi", lr: demoSushiLr, hr: demoSushiHr },
] as const;

const MODEL_OPTIONS = [
  "imdn_fp16",
  "imdn_int8",
  "rfdn_fp16",
  "rfdn_int8",
  "espcn_fp16",
  "espcn_int8",
] as const;

type UploadResultItem = {
  id: string;
  name: string;
  model: string;
  createdAt: number;
  latencyMs: number;
  beforeSrc: string;
  afterSrc: string;
  widthIn: number;
  heightIn: number;
  widthOut: number;
  heightOut: number;
};

const API_TIMEOUT_MS = 120000;
const IMAGE_VIEW_STORAGE_KEY = "image-view-state";

type PersistedImageViewState = {
  selectedId: (typeof samples)[number]["id"] | null;
  model: (typeof MODEL_OPTIONS)[number];
  results: UploadResultItem[];
  activeResultId: string | null;
};

function loadPersistedState(): PersistedImageViewState {
  if (typeof window === "undefined") {
    return {
      selectedId: "food",
      model: "imdn_fp16",
      results: [],
      activeResultId: null,
    };
  }

  try {
    const raw = sessionStorage.getItem(IMAGE_VIEW_STORAGE_KEY);
    if (!raw) {
      return {
        selectedId: null,
      model: "imdn_fp16",
      results: [],
      activeResultId: null,
    };
  }

    const parsed = JSON.parse(raw) as Partial<PersistedImageViewState>;
    const selectedId = parsed.selectedId === "food" || parsed.selectedId === "sushi" ? parsed.selectedId : null;
    const model = MODEL_OPTIONS.includes(parsed.model as (typeof MODEL_OPTIONS)[number])
      ? (parsed.model as (typeof MODEL_OPTIONS)[number])
      : "imdn_fp16";

    return {
      selectedId,
      model,
      results: Array.isArray(parsed.results) ? parsed.results : [],
      activeResultId: typeof parsed.activeResultId === "string" ? parsed.activeResultId : null,
    };
  } catch {
    return {
      selectedId: null,
      model: "imdn_fp16",
      results: [],
      activeResultId: null,
    };
  }
}

export function ImageView() {
  const { messages } = useLanguage();
  const persistedState = useMemo(() => loadPersistedState(), []);
  const [selectedId, setSelectedId] = useState<(typeof samples)[number]["id"] | null>(persistedState.selectedId);
  const [model, setModel] = useState<(typeof MODEL_OPTIONS)[number]>(persistedState.model);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<UploadResultItem[]>(persistedState.results);
  const [activeResultId, setActiveResultId] = useState<string | null>(persistedState.activeResultId);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selected = samples.find((item) => item.id === selectedId) || null;

  const srApiBase = useMemo(
    () => import.meta.env.VITE_SR_API_URL?.trim().replace(/\/$/, "") || import.meta.env.VITE_HEALTH_API_URL?.trim().replace(/\/$/, ""),
    [],
  );

  const srApiKey = useMemo(
    () => import.meta.env.VITE_SR_API_KEY?.trim() || import.meta.env.VITE_HEALTH_API_KEY?.trim() || "",
    [],
  );

  const activeResult = useMemo(
    () => results.find((item) => item.id === activeResultId) ?? null,
    [activeResultId, results],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const payload: PersistedImageViewState = {
      selectedId,
      model,
      results,
      activeResultId,
    };
    sessionStorage.setItem(IMAGE_VIEW_STORAGE_KEY, JSON.stringify(payload));
  }, [activeResultId, model, results, selectedId]);

  const beforeSrc = activeResult?.beforeSrc || selected?.lr || "";
  const afterSrc = activeResult?.afterSrc || selected?.hr || "";
  const beforeLabel = activeResult
    ? `Input - ${activeResult.name}`
    : selected
      ? `Bicubic - ${selected.id}`
      : "Input";
  const afterLabel = activeResult
    ? `${activeResult.model} (${activeResult.widthOut}x${activeResult.heightOut})`
    : selected
      ? model
      : "Output";

  const normalizeResultImageUrl = (path: string): string => {
    if (!srApiBase) {
      return path;
    }
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }
    return `${srApiBase}${path.startsWith("/") ? "" : "/"}${path}`;
  };

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const runUploadInference = async (file: File) => {
    if (!srApiBase) {
      toast.error("Thiếu URL API", {
        description: "Hãy cấu hình VITE_SR_API_URL hoặc VITE_HEALTH_API_URL trong frontend .env",
      });
      return;
    }

    if (!srApiKey) {
      toast.error("Thiếu API key", {
        description: "Hãy cấu hình VITE_SR_API_KEY hoặc VITE_HEALTH_API_KEY trong frontend .env",
      });
      return;
    }

    setIsLoading(true);
    const previewUrl = URL.createObjectURL(file);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("model", model);
      formData.append("input_name", "lr");
      formData.append("output_name", "sr");

      const response = await fetch(`${srApiBase}/inference/image/upload`, {
        method: "POST",
        headers: {
          "X-API-Key": srApiKey,
        },
        body: formData,
        signal: controller.signal,
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.message || `HTTP ${response.status}`);
      }

      const nextItem: UploadResultItem = {
        id: body.request_id,
        name: file.name,
        model: body.model,
        createdAt: Date.now(),
        latencyMs: Number(body.latency_ms ?? 0),
        beforeSrc: previewUrl,
        afterSrc: normalizeResultImageUrl(String(body.output_image_path || "")),
        widthIn: Number(body.width_in ?? 0),
        heightIn: Number(body.height_in ?? 0),
        widthOut: Number(body.width_out ?? 0),
        heightOut: Number(body.height_out ?? 0),
      };

      setResults((prev) => [nextItem, ...prev].slice(0, 12));
      setActiveResultId(nextItem.id);
      setSelectedId(null);
      toast.success("Xử lý ảnh thành công", {
        description: `${nextItem.model} - ${nextItem.latencyMs.toFixed(1)} ms`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể xử lý ảnh";
      toast.error("Upload hoặc inference thất bại", { description: message });
    } finally {
      window.clearTimeout(timeoutId);
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    await runUploadInference(file);
  };

  const handleDownload = () => {
    if (!activeResult) {
      toast("Chưa có ảnh SR để tải", {
        description: "Upload một ảnh và bấm Upscale trước.",
      });
      return;
    }

    const fileExt = (() => {
      try {
        const url = new URL(activeResult.afterSrc, window.location.origin);
        const name = url.pathname.split("/").pop() || "sr-output.png";
        return name.includes(".") ? name : `${name}.png`;
      } catch {
        return "sr-output.png";
      }
    })();

    const anchor = document.createElement("a");
    anchor.href = activeResult.afterSrc;
    anchor.download = fileExt;
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    toast.success("Đã bắt đầu tải ảnh SR", {
      description: fileExt,
    });
  };

  const openResultInNewTab = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const sampleNames = {
    food: messages.image.sampleFood,
    sushi: messages.image.sampleSushi,
  } as const;

  const hasViewContent = Boolean(activeResult || selected);

  return (
    <div className="h-full p-6">
      <div className="h-full grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <section className="space-y-4 min-h-0 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">{messages.image.title}</h2>
            <div className="flex items-center gap-2">
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as (typeof MODEL_OPTIONS)[number])}
                className="bg-secondary text-secondary-foreground text-xs font-mono px-3 py-1.5 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {MODEL_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <button
                onClick={handlePickFile}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 disabled:opacity-60"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                Chọn ảnh
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/bmp"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <button
            onClick={handlePickFile}
            disabled={isLoading}
            className="glass rounded-xl border-2 border-dashed border-border/50 hover:border-primary/50 transition-colors p-4 flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> : <Upload className="w-5 h-5 text-muted-foreground" />}
            <span className="text-sm text-muted-foreground">
              {isLoading ? "Đang upload và xử lý..." : messages.image.uploadHint}
            </span>
          </button>

          <div className="flex gap-2">
            {samples.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setSelectedId(s.id);
                  setActiveResultId(null);
                }}
                className={`glass rounded-lg overflow-hidden w-20 h-14 border-2 transition-all ${
                  selectedId === s.id ? "border-primary glow-primary" : "border-transparent hover:border-border"
                }`}
              >
                <img src={s.lr} alt={sampleNames[s.id]} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0">
            {hasViewContent ? (
              <BeforeAfterSlider beforeSrc={beforeSrc} afterSrc={afterSrc} beforeLabel={beforeLabel} afterLabel={afterLabel} />
            ) : (
              <div className="h-full rounded-xl border border-dashed border-border/70 flex items-center justify-center text-sm text-muted-foreground">
                Chọn ảnh mẫu hoặc upload ảnh để hiển thị kết quả.
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePickFile}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ZoomIn className="w-4 h-4" />} {messages.image.upscale}
            </button>
            <button
              onClick={handleDownload}
              disabled={!activeResult}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/30 bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors disabled:border-border disabled:bg-secondary/40 disabled:text-muted-foreground disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" /> {activeResult ? "Tải ảnh SR" : "Chưa có ảnh để tải"}
            </button>
            <span className="text-xs text-muted-foreground font-mono ml-auto">
              {activeResult
                ? `${activeResult.widthIn}x${activeResult.heightIn} -> ${activeResult.widthOut}x${activeResult.heightOut}`
                : messages.image.inputOutput}
            </span>
          </div>
        </section>

        <aside className="glass rounded-xl border border-border/60 min-h-0 flex flex-col">
          <div className="p-4 border-b border-border/60">
            <h3 className="text-sm font-semibold text-foreground">Lich su ket qua</h3>
            <p className="text-xs text-muted-foreground mt-1">Anh SR moi nhat se hien thi tai day.</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {results.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground text-center">
                Chua co ket qua nao. Hay upload anh de bat dau.
              </div>
            ) : (
              results.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveResultId(item.id)}
                  className={`w-full text-left rounded-lg border p-2 transition-colors ${
                    activeResultId === item.id ? "border-primary bg-primary/10" : "border-border hover:bg-secondary/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <img
                      src={item.afterSrc}
                      alt={item.name}
                      title="Mo anh trong tab moi"
                      onClick={(event) => {
                        event.stopPropagation();
                        openResultInNewTab(item.afterSrc);
                      }}
                      className="w-14 h-10 rounded object-cover border border-border/70 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <p className="text-xs text-foreground font-medium truncate">{item.name}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{item.model}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="w-3 h-3" /> {item.latencyMs.toFixed(1)} ms
                    </span>
                    <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
