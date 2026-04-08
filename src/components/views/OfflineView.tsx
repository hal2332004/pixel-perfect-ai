import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { Upload, Video, Loader2, Clock3, Download, ExternalLink, Film } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { isAbortError } from "@/lib/isAbortError";

type JobStatus = "queued" | "running" | "done" | "failed" | "stopped";

const MODEL_OPTIONS = [
  "imdn_fp16",
  "imdn_int8",
  "rfdn_fp16",
  "rfdn_int8",
  "espcn_fp16",
  "espcn_int8",
] as const;

type OfflineResultItem = {
  id: string;
  requestId: string;
  jobId: string;
  name: string;
  model: string;
  frameSkip: number;
  createdAt: number;
  status: JobStatus;
  beforeSrc: string;
  outputVideoPath: string;
  afterSrc: string;
  processedFrames: number;
  totalFrames: number | null;
  fpsEstimate: number | null;
  elapsedMs: number | null;
  errorMessage: string | null;
};

const API_TIMEOUT_MS = 300000;
const POLL_INTERVAL_MS = 1200;
const OFFLINE_VIEW_STORAGE_KEY = "offline-video-view-state";

type PersistedOfflineViewState = {
  model: (typeof MODEL_OPTIONS)[number];
  frameSkip: number;
  results: OfflineResultItem[];
  activeResultId: string | null;
};

function loadPersistedState(): PersistedOfflineViewState {
  if (typeof window === "undefined") {
    return {
      model: "rfdn_fp16",
      frameSkip: 0,
      results: [],
      activeResultId: null,
    };
  }

  try {
    const raw = sessionStorage.getItem(OFFLINE_VIEW_STORAGE_KEY);
    if (!raw) {
      return {
        model: "rfdn_fp16",
        frameSkip: 0,
        results: [],
        activeResultId: null,
      };
    }

    const parsed = JSON.parse(raw) as Partial<PersistedOfflineViewState>;
    const model = MODEL_OPTIONS.includes(parsed.model as (typeof MODEL_OPTIONS)[number])
      ? (parsed.model as (typeof MODEL_OPTIONS)[number])
      : "rfdn_fp16";

    return {
      model,
      frameSkip: typeof parsed.frameSkip === "number" && parsed.frameSkip >= 0 ? parsed.frameSkip : 0,
      results: Array.isArray(parsed.results) ? parsed.results : [],
      activeResultId: typeof parsed.activeResultId === "string" ? parsed.activeResultId : null,
    };
  } catch {
    return {
      model: "rfdn_fp16",
      frameSkip: 0,
      results: [],
      activeResultId: null,
    };
  }
}

export function OfflineView() {
  const { messages } = useLanguage();
  const persistedState = useMemo(() => loadPersistedState(), []);
  const [model, setModel] = useState<(typeof MODEL_OPTIONS)[number]>(persistedState.model);
  const [frameSkip, setFrameSkip] = useState<number>(persistedState.frameSkip);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<OfflineResultItem[]>(persistedState.results);
  const [activeResultId, setActiveResultId] = useState<string | null>(persistedState.activeResultId);
  const [videoRenderError, setVideoRenderError] = useState<{ input: boolean; output: boolean }>({ input: false, output: false });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    const payload: PersistedOfflineViewState = {
      model,
      frameSkip,
      results,
      activeResultId,
    };
    sessionStorage.setItem(OFFLINE_VIEW_STORAGE_KEY, JSON.stringify(payload));
  }, [activeResultId, frameSkip, model, results]);

  const normalizeResultUrl = (path: string): string => {
    if (!srApiBase) {
      return path;
    }
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }

    let normalizedPath = path;
    if (normalizedPath.startsWith("/app/runtime/")) {
      normalizedPath = `/runtime/${normalizedPath.slice("/app/runtime/".length)}`;
    } else if (normalizedPath.startsWith("app/runtime/")) {
      normalizedPath = `/runtime/${normalizedPath.slice("app/runtime/".length)}`;
    }

    return `${srApiBase}${normalizedPath.startsWith("/") ? "" : "/"}${normalizedPath}`;
  };

  useEffect(() => {
    if (!srApiBase) {
      return;
    }

    setResults((prev) =>
      prev.map((item) => {
        const normalizedOutputPath = item.outputVideoPath.startsWith("/app/runtime/")
          ? `/runtime/${item.outputVideoPath.slice("/app/runtime/".length)}`
          : item.outputVideoPath;

        const normalizedAfterSrc = normalizedOutputPath
          ? normalizeResultUrl(normalizedOutputPath)
          : item.afterSrc.startsWith("blob:")
            ? ""
            : normalizeResultUrl(item.afterSrc);

        // blob URLs from previous page sessions are invalid after reload.
        const normalizedBeforeSrc = item.beforeSrc.startsWith("blob:") ? "" : item.beforeSrc;

        if (
          normalizedOutputPath === item.outputVideoPath &&
          normalizedAfterSrc === item.afterSrc &&
          normalizedBeforeSrc === item.beforeSrc
        ) {
          return item;
        }

        return {
          ...item,
          outputVideoPath: normalizedOutputPath,
          afterSrc: normalizedAfterSrc,
          beforeSrc: normalizedBeforeSrc,
        };
      }),
    );
  }, [srApiBase]);

  useEffect(() => {
    setVideoRenderError({ input: false, output: false });
  }, [activeResultId]);

  useEffect(() => {
    if (!srApiBase || !srApiKey) {
      return;
    }

    const runningJobs = results.filter((item) => item.status === "queued" || item.status === "running");
    if (runningJobs.length === 0) {
      return;
    }

    let isCancelled = false;

    const tick = async () => {
      await Promise.all(
        runningJobs.map(async (item) => {
          try {
            const response = await fetch(`${srApiBase}/jobs/${item.jobId}`, {
              method: "GET",
              headers: {
                "X-API-Key": srApiKey,
              },
            });

            if (response.status === 404) {
              if (isCancelled) {
                return;
              }
              setResults((prev) =>
                prev.map((candidate) =>
                  candidate.id === item.id
                    ? {
                        ...candidate,
                        status: candidate.afterSrc ? "done" : "failed",
                        errorMessage: candidate.afterSrc
                          ? "Job khong con trong bo nho backend (co the da restart), nhung output van co the su dung."
                          : "Job khong ton tai tren backend (co the da restart).",
                      }
                    : candidate,
                ),
              );
              return;
            }

            const body = await response.json();
            if (!response.ok || isCancelled) {
              return;
            }

            const nextStatus = String(body.status || "running") as JobStatus;
            const nextInputPath = String(body.input_video_path || "");
            const nextOutputPath = String(body.output_video_path || item.outputVideoPath || "");
            const nextInputUrl = nextInputPath ? normalizeResultUrl(nextInputPath) : item.beforeSrc;
            const nextOutputUrl = nextOutputPath ? normalizeResultUrl(nextOutputPath) : item.afterSrc;

            setResults((prev) =>
              prev.map((candidate) =>
                candidate.id === item.id
                  ? {
                      ...candidate,
                      status: nextStatus,
                      processedFrames: Number(body.processed_frames ?? candidate.processedFrames ?? 0),
                      totalFrames:
                        typeof body.total_frames === "number" && Number.isFinite(body.total_frames)
                          ? Number(body.total_frames)
                          : candidate.totalFrames,
                      fpsEstimate:
                        typeof body.fps_estimate === "number" && Number.isFinite(body.fps_estimate)
                          ? Number(body.fps_estimate)
                          : candidate.fpsEstimate,
                      elapsedMs:
                        typeof body.elapsed_ms === "number" && Number.isFinite(body.elapsed_ms)
                          ? Number(body.elapsed_ms)
                          : candidate.elapsedMs,
                      beforeSrc: nextInputUrl || candidate.beforeSrc,
                      outputVideoPath: nextOutputPath || candidate.outputVideoPath,
                      afterSrc: nextOutputUrl || candidate.afterSrc,
                      errorMessage: body.error_message ? String(body.error_message) : candidate.errorMessage,
                    }
                  : candidate,
              ),
            );
          } catch {
            // Ignore transient polling errors.
          }
        }),
      );
    };

    const timer = window.setInterval(tick, POLL_INTERVAL_MS);
    tick();

    return () => {
      isCancelled = true;
      window.clearInterval(timer);
    };
  }, [results, srApiBase, srApiKey]);

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleUploadVideo = async (file: File) => {
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
    let didTimeout = false;
    const timeoutId = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, API_TIMEOUT_MS);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("model", model);
      formData.append("frame_skip", String(Math.max(0, Math.floor(frameSkip))));
      formData.append("input_name", "lr");
      formData.append("output_name", "sr");

      const response = await fetch(`${srApiBase}/inference/video/upload`, {
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

      const inputVideoPath = String(body.input_video_path || "");
      const outputVideoPath = String(body.output_video_path || "");
      const nextItem: OfflineResultItem = {
        id: body.request_id || body.job_id,
        requestId: String(body.request_id || ""),
        jobId: String(body.job_id || ""),
        name: file.name,
        model,
        frameSkip: Math.max(0, Math.floor(frameSkip)),
        createdAt: Date.now(),
        status: (String(body.status || "queued") as JobStatus) || "queued",
        beforeSrc: inputVideoPath ? normalizeResultUrl(inputVideoPath) : previewUrl,
        outputVideoPath,
        afterSrc: outputVideoPath ? normalizeResultUrl(outputVideoPath) : "",
        processedFrames: 0,
        totalFrames: null,
        fpsEstimate: null,
        elapsedMs: null,
        errorMessage: null,
      };

      setResults((prev) => [nextItem, ...prev].slice(0, 20));
      setActiveResultId(nextItem.id);
      toast.success("Đã tạo job video", {
        description: `${nextItem.model} - frame_skip=${nextItem.frameSkip}`,
      });
    } catch (error) {
      if (didTimeout) {
        toast.error("Upload video thất bại", { description: "Request bị timeout" });
        return;
      }

      if (isAbortError(error)) {
        return;
      }

      const message = error instanceof Error ? error.message : "Không thể upload video";
      toast.error("Upload video thất bại", { description: message });
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
    await handleUploadVideo(file);
  };

  const handleDownloadResult = () => {
    if (!activeResult || activeResult.status !== "done" || !activeResult.afterSrc) {
      toast("Chưa có output để tải", {
        description: "Chờ job hoàn tất trước khi tải video SR.",
      });
      return;
    }

    const fileName = activeResult.outputVideoPath.split("/").pop() || `${activeResult.name.replace(/\.[^.]+$/, "")}_sr.mp4`;
    const anchor = document.createElement("a");
    anchor.href = activeResult.afterSrc;
    anchor.download = fileName;
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const openResultInNewTab = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const formatStatusLabel = (status: JobStatus): string => {
    if (status === "queued") return "Queued";
    if (status === "running") return messages.status.processing;
    if (status === "done") return "Done";
    if (status === "failed") return messages.status.error;
    return "Stopped";
  };

  const statusUi = (status: JobStatus): { container: string; dot: string; label: string } => {
    if (status === "done") {
      return {
        container: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
        dot: "bg-emerald-400",
        label: "",
      };
    }
    if (status === "failed") {
      return {
        container: "bg-red-500/15 text-red-400 border border-red-500/30",
        dot: "bg-red-400",
        label: "Loi",
      };
    }
    if (status === "stopped") {
      return {
        container: "bg-slate-500/15 text-slate-300 border border-slate-400/30",
        dot: "bg-slate-300",
        label: "Da dung",
      };
    }
    if (status === "running") {
      return {
        container: "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30",
        dot: "bg-cyan-300 animate-pulse",
        label: "Dang xu ly",
      };
    }
    return {
      container: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
      dot: "bg-amber-300 animate-pulse",
      label: "Dang cho",
    };
  };

  const formatElapsedLabel = (elapsedMs: number | null): string => {
    if (elapsedMs == null || !Number.isFinite(elapsedMs)) {
      return "--";
    }
    if (elapsedMs >= 1000) {
      return `${(elapsedMs / 1000).toFixed(2)} s`;
    }
    return `${elapsedMs.toFixed(1)} ms`;
  };

  const deriveElapsedMs = (item: OfflineResultItem): number | null => {
    if (item.elapsedMs != null && Number.isFinite(item.elapsedMs)) {
      return item.elapsedMs;
    }
    if (item.fpsEstimate != null && Number.isFinite(item.fpsEstimate) && item.fpsEstimate > 0 && item.processedFrames > 0) {
      return (item.processedFrames / item.fpsEstimate) * 1000;
    }
    return null;
  };

  const getProgressPercent = (item: OfflineResultItem): number => {
    if (item.status === "done") {
      return 100;
    }
    if (item.totalFrames && item.totalFrames > 0) {
      return Math.min(99, Math.round((item.processedFrames / item.totalFrames) * 100));
    }
    if (item.status === "running" && item.processedFrames > 0) {
      return Math.min(95, 5 + Math.floor(item.processedFrames % 90));
    }
    return item.status === "queued" ? 0 : 3;
  };

  return (
    <div className="h-full p-6">
      <div className="h-full grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4">
        <section className="space-y-4 min-h-0 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">{messages.offline.title}</h2>
            <div className="flex items-center gap-2">
              <select
                value={model}
                onChange={(event) => setModel(event.target.value as (typeof MODEL_OPTIONS)[number])}
                className="bg-secondary text-secondary-foreground text-xs font-mono px-3 py-1.5 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {MODEL_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <label className="text-xs text-muted-foreground">frame_skip</label>
              <input
                type="number"
                min={0}
                value={frameSkip}
                onChange={(event) => setFrameSkip(Math.max(0, Number(event.target.value || 0)))}
                className="w-20 bg-secondary text-secondary-foreground text-xs font-mono px-2 py-1.5 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={handlePickFile}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 disabled:opacity-60"
              >
                <Video className="w-3.5 h-3.5" />
                Chọn video
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/x-matroska,video/webm,video/x-msvideo"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <button
            onClick={handlePickFile}
            disabled={isLoading}
            className="glass rounded-xl border-2 border-dashed border-border/50 hover:border-primary/50 transition-colors p-5 flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> : <Upload className="w-5 h-5 text-muted-foreground" />}
            <span className="text-sm text-muted-foreground">
              {isLoading ? "Đang upload video..." : messages.offline.uploadHint}
            </span>
          </button>

          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="glass rounded-xl border border-border/60 overflow-hidden relative">
              <div className="absolute top-2 left-2 px-2 py-1 rounded bg-background/80 text-[10px] font-mono text-muted-foreground z-10">
                {messages.common.original}
              </div>
              {activeResult?.beforeSrc && !videoRenderError.input ? (
                <video
                  src={activeResult.beforeSrc}
                  controls
                  className="w-full h-full object-contain bg-black/40"
                  onError={() => setVideoRenderError((prev) => ({ ...prev, input: true }))}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-sm text-muted-foreground gap-2 px-4 text-center">
                  <span>
                    {!activeResult
                      ? "Chưa có video đầu vào"
                      : !activeResult.beforeSrc
                        ? "Khong co preview input cho job nay (du lieu cu hoac da reload trang)."
                        : "Khong render duoc video input tren trinh duyet (co the do codec)."}
                  </span>
                  {activeResult?.beforeSrc && (
                    <button
                      onClick={() => openResultInNewTab(activeResult.beforeSrc)}
                      className="text-xs px-2 py-1 rounded border border-border hover:bg-secondary/40"
                    >
                      Mo video input tab moi
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="glass rounded-xl border border-border/60 overflow-hidden relative">
              <div className="absolute top-2 left-2 px-2 py-1 rounded bg-primary/20 text-[10px] font-mono text-primary z-10">
                {messages.realtime.srOutput}
              </div>
              {activeResult?.afterSrc && activeResult.status === "done" && !videoRenderError.output ? (
                <video
                  src={activeResult.afterSrc}
                  controls
                  className="w-full h-full object-contain bg-black/40"
                  onError={() => setVideoRenderError((prev) => ({ ...prev, output: true }))}
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-sm text-muted-foreground gap-2 px-4 text-center">
                  <Film className="w-5 h-5" />
                  {activeResult && !videoRenderError.output ? (
                    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${statusUi(activeResult.status).container}`}>
                      {activeResult.status === "running" ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span className={`w-2 h-2 rounded-full ${statusUi(activeResult.status).dot}`} />
                      )}
                      <span>{activeResult.status === "done" ? formatElapsedLabel(deriveElapsedMs(activeResult)) : statusUi(activeResult.status).label}</span>
                    </div>
                  ) : (
                    <span>
                      {activeResult
                        ? "Khong render duoc video output tren trinh duyet."
                        : "Chưa có output video"}
                    </span>
                  )}
                  {activeResult && !videoRenderError.output && (
                    <p className="text-xs text-muted-foreground">
                      {activeResult.status === "running" || activeResult.status === "queued"
                        ? `Trang thai: ${formatStatusLabel(activeResult.status)}`
                        : `Da xu ly ${activeResult.processedFrames}${
                            activeResult.totalFrames ? `/${activeResult.totalFrames}` : ""
                          } frame`}
                    </p>
                  )}
                  {activeResult?.afterSrc && activeResult.status === "done" && (
                    <button
                      onClick={() => openResultInNewTab(activeResult.afterSrc)}
                      className="text-xs px-2 py-1 rounded border border-border hover:bg-secondary/40"
                    >
                      Mo video output tab moi
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePickFile}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Tạo job video
            </button>
            <button
              onClick={handleDownloadResult}
              disabled={!activeResult || activeResult.status !== "done"}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/30 bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors disabled:border-border disabled:bg-secondary/40 disabled:text-muted-foreground disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" /> {activeResult?.status === "done" ? "Tải video SR" : "Chưa có output"}
            </button>
            <span className="text-xs text-muted-foreground font-mono ml-auto">
              {activeResult
                ? `${activeResult.status === "done" ? formatElapsedLabel(deriveElapsedMs(activeResult)) : formatStatusLabel(activeResult.status)} | ${activeResult.processedFrames}${
                    activeResult.totalFrames ? `/${activeResult.totalFrames}` : ""
                  } frames`
                : "No job selected"}
            </span>
          </div>
        </section>

        <aside className="glass rounded-xl border border-border/60 min-h-0 flex flex-col">
          <div className="p-4 border-b border-border/60">
            <h3 className="text-sm font-semibold text-foreground">Lich su ket qua</h3>
            <p className="text-xs text-muted-foreground mt-1">Video jobs moi nhat se hien thi tai day.</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {results.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground text-center">
                Chua co job nao. Hay upload video de bat dau.
              </div>
            ) : (
              results.map((item) => {
                const progress = getProgressPercent(item);
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveResultId(item.id)}
                    className={`w-full text-left rounded-lg border p-2 transition-colors ${
                      activeResultId === item.id ? "border-primary bg-primary/10" : "border-border hover:bg-secondary/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {item.afterSrc && item.status === "done" ? (
                        <video
                          src={item.afterSrc}
                          className="w-14 h-10 rounded object-cover border border-border/70 cursor-pointer"
                          muted
                          onClick={(event) => {
                            event.stopPropagation();
                            openResultInNewTab(item.afterSrc);
                          }}
                        />
                      ) : (
                        <div className="w-14 h-10 rounded border border-border/70 bg-secondary/50 flex items-center justify-center">
                          <Video className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-foreground font-medium truncate">{item.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{item.model}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusUi(item.status).container}`}>
                        {item.status === "running" ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <span className={`w-1.5 h-1.5 rounded-full ${statusUi(item.status).dot}`} />
                        )}
                        {item.status === "done" ? formatElapsedLabel(deriveElapsedMs(item)) : statusUi(item.status).label}
                      </span>
                      {item.afterSrc && item.status === "done" && (
                        <ExternalLink
                          className="w-3.5 h-3.5 text-muted-foreground hover:text-primary"
                          onClick={(event) => {
                            event.stopPropagation();
                            openResultInNewTab(item.afterSrc);
                          }}
                        />
                      )}
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="w-3 h-3" />
                        {item.status === "done"
                          ? formatElapsedLabel(deriveElapsedMs(item))
                          : item.elapsedMs != null
                            ? `${item.elapsedMs.toFixed(1)} ms`
                            : formatStatusLabel(item.status)}
                      </span>
                      <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
