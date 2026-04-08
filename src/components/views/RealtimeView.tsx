import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { MetricCard } from "@/components/MetricCard";
import { useLanguage } from "@/context/LanguageContext";
import { Activity, Camera, Clock, Gauge, Loader2, Pause, Play } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { isAbortError } from "@/lib/isAbortError";

type StreamJobStatus = "queued" | "running" | "done" | "failed" | "stopped";

const MODEL_OPTIONS = [
  "imdn_fp16",
  "imdn_int8",
  "rfdn_fp16",
  "rfdn_int8",
  "espcn_fp16",
  "espcn_int8",
] as const;

type StreamStartResponse = {
  request_id?: string;
  job_id?: string;
  status?: StreamJobStatus;
  frame_skip?: number;
  input_url?: string | null;
  output_url?: string | null;
  message?: string;
};

type StreamStatusResponse = {
  request_id?: string;
  job_id?: string;
  status?: StreamJobStatus;
  model?: string;
  frame_skip?: number;
  processed_frames?: number;
  fps_estimate?: number | null;
  elapsed_ms?: number | null;
  input_url?: string | null;
  output_url?: string | null;
  error_message?: string | null;
  details?: {
    camera_fps?: number | null;
  } | null;
  message?: string;
};

const API_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 1_200;

function normalizeApiBase(url: string): string {
  return url.trim().replace(/\/$/, "");
}

function statusToBadge(status: StreamJobStatus | null): "online" | "processing" | "waiting" | "error" | "completed" {
  if (!status) {
    return "waiting";
  }
  if (status === "queued") {
    return "waiting";
  }
  if (status === "running") {
    return "processing";
  }
  if (status === "failed") {
    return "error";
  }
  return "completed";
}

export function RealtimeView() {
  const { messages } = useLanguage();

  const srApiBase = useMemo(
    () =>
      normalizeApiBase(import.meta.env.VITE_SR_API_URL?.trim() || "") ||
      normalizeApiBase(import.meta.env.VITE_HEALTH_API_URL?.trim() || ""),
    [],
  );

  const srApiKey = useMemo(
    () => import.meta.env.VITE_SR_API_KEY?.trim() || import.meta.env.VITE_HEALTH_API_KEY?.trim() || "",
    [],
  );

  const [model, setModel] = useState<(typeof MODEL_OPTIONS)[number]>("imdn_fp16");
  const [frameSkip, setFrameSkip] = useState<number>(0);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<StreamJobStatus | null>(null);
  const [inputUrl, setInputUrl] = useState<string | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [processedFrames, setProcessedFrames] = useState(0);
  const [cameraFps, setCameraFps] = useState<number | null>(null);
  const [fpsEstimate, setFpsEstimate] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inputPreviewTransport, setInputPreviewTransport] = useState<"mjpg" | "jpg">("mjpg");

  const [previewTick, setPreviewTick] = useState(0);

  const pollTimerRef = useRef<number | null>(null);
  const pollInFlightRef = useRef(false);
  const pollAbortRef = useRef<AbortController | null>(null);
  const startAbortRef = useRef<AbortController | null>(null);
  const stopAbortRef = useRef<AbortController | null>(null);

  const canStart = Boolean(srApiBase) && Boolean(srApiKey) && !isStarting && !isStopping && jobStatus !== "running";
  const canStop = Boolean(srApiBase) && Boolean(srApiKey) && !isStarting && !isStopping && Boolean(jobId) && jobStatus === "running";

  const stopClientRequests = useCallback((abortStopRequest: boolean = false) => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    if (pollAbortRef.current) {
      pollAbortRef.current.abort();
      pollAbortRef.current = null;
    }

    if (startAbortRef.current) {
      startAbortRef.current.abort();
      startAbortRef.current = null;
    }

    if (abortStopRequest && stopAbortRef.current) {
      stopAbortRef.current.abort();
      stopAbortRef.current = null;
    }

    pollInFlightRef.current = false;
  }, []);

  const pollStatus = async (activeJobId: string) => {
    if (!srApiBase || !srApiKey) {
      return;
    }

    if (pollInFlightRef.current) {
      return;
    }

    pollInFlightRef.current = true;
    const controller = new AbortController();
    pollAbortRef.current = controller;

    try {
      const response = await fetch(`${srApiBase}/inference/video/stream/${activeJobId}`, {
        method: "GET",
        headers: {
          "X-API-Key": srApiKey,
        },
        signal: controller.signal,
      });

      const body = (await response.json()) as StreamStatusResponse;
      if (!response.ok) {
        return;
      }

      setJobStatus((String(body.status || "") as StreamJobStatus) || null);
      setProcessedFrames(Number(body.processed_frames ?? 0));
      setFpsEstimate(typeof body.fps_estimate === "number" && Number.isFinite(body.fps_estimate) ? Number(body.fps_estimate) : null);
      setCameraFps(
        typeof body.details?.camera_fps === "number" && Number.isFinite(body.details.camera_fps)
          ? Number(body.details.camera_fps)
          : null,
      );
      setElapsedMs(typeof body.elapsed_ms === "number" && Number.isFinite(body.elapsed_ms) ? Number(body.elapsed_ms) : null);
      setInputUrl(body.input_url ? String(body.input_url) : null);
      setOutputUrl(body.output_url ? String(body.output_url) : null);
      setErrorMessage(body.error_message ? String(body.error_message) : null);
    } catch {
      // Ignore transient polling errors.
    } finally {
      pollInFlightRef.current = false;
      if (pollAbortRef.current === controller) {
        pollAbortRef.current = null;
      }
    }
  };

  useEffect(() => {
    if (!jobId) {
      stopClientRequests();
      return;
    }

    if (!srApiBase || !srApiKey) {
      return;
    }

    const shouldPoll = jobStatus === "queued" || jobStatus === "running" || jobStatus === null;
    if (!shouldPoll) {
      stopClientRequests();
      return;
    }

    pollStatus(jobId);
    if (!pollTimerRef.current) {
      pollTimerRef.current = window.setInterval(() => pollStatus(jobId), POLL_INTERVAL_MS);
    }

    return () => {
      stopClientRequests();
    };
  }, [jobId, jobStatus, srApiBase, srApiKey, stopClientRequests]);

  useEffect(() => {
    if (!srApiBase || !srApiKey) {
      return;
    }

    const timer = window.setInterval(() => setPreviewTick((prev) => prev + 1), 1000);
    return () => window.clearInterval(timer);
  }, [jobStatus, srApiBase, srApiKey]);

  useEffect(() => {
    if (jobStatus === "running" || jobStatus === "queued") {
      setInputPreviewTransport("mjpg");
    }
  }, [jobStatus]);

  useEffect(() => {
    return () => {
      stopClientRequests(true);
    };
  }, [stopClientRequests]);

  const handleStart = async () => {
    if (!srApiBase) {
      toast.error(messages.realtime.missingApiUrl, {
        description: messages.realtime.missingApiUrlHint,
      });
      return;
    }

    if (!srApiKey) {
      toast.error(messages.realtime.missingApiKey, {
        description: messages.realtime.missingApiKeyHint,
      });
      return;
    }

    setIsStarting(true);
    setErrorMessage(null);
    const controller = new AbortController();
    startAbortRef.current = controller;
    let didTimeout = false;
    const timeoutId = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, API_TIMEOUT_MS);

    try {
      // Keep a single active realtime stream to avoid RTSP decode artifacts under heavy load.
      await fetch(`${srApiBase}/inference/video/stream/stop-all`, {
        method: "POST",
        headers: {
          "X-API-Key": srApiKey,
        },
      }).catch(() => undefined);

      const response = await fetch(`${srApiBase}/inference/video/stream/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": srApiKey,
        },
        body: JSON.stringify({
          model,
          frame_skip: Math.max(0, Math.floor(frameSkip)),
          input_name: "lr",
          output_name: "sr",
        }),
        signal: controller.signal,
      });

      const body = (await response.json()) as StreamStartResponse;
      if (!response.ok) {
        throw new Error((body as { message?: string })?.message || `HTTP ${response.status}`);
      }

      const nextJobId = String(body.job_id || "");
      if (!nextJobId) {
        throw new Error("Missing job_id");
      }

      setJobId(nextJobId);
      setJobStatus((String(body.status || "queued") as StreamJobStatus) || "queued");
      setInputUrl(body.input_url ? String(body.input_url) : null);
      setOutputUrl(body.output_url ? String(body.output_url) : null);
      setProcessedFrames(0);
      setCameraFps(null);
      setFpsEstimate(null);
      setElapsedMs(null);

      toast.success(messages.realtime.started, {
        description: `${model} - frame_skip=${Math.max(0, Math.floor(frameSkip))}`,
      });
    } catch (error) {
      if (didTimeout) {
        toast.error(messages.realtime.startFailed, { description: messages.realtime.requestTimeout });
        return;
      }

      if (isAbortError(error)) {
        return;
      }

      const message = error instanceof Error ? error.message : messages.realtime.startFailed;
      toast.error(messages.realtime.startFailed, { description: message });
    } finally {
      window.clearTimeout(timeoutId);
      if (startAbortRef.current === controller) {
        startAbortRef.current = null;
      }
      setIsStarting(false);
    }
  };

  const handleStop = async () => {
    if (!srApiBase || !srApiKey || !jobId) {
      return;
    }

    const targetJobId = jobId;

    // Stop client-side requests immediately when user clicks Stop.
    stopClientRequests();
    setJobId(null);
    setJobStatus("stopped");
    setOutputUrl(null);

    setIsStopping(true);
    const controller = new AbortController();
    stopAbortRef.current = controller;
    let didTimeout = false;
    const timeoutId = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, API_TIMEOUT_MS);

    try {
      const response = await fetch(`${srApiBase}/inference/video/stream/stop`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": srApiKey,
        },
        body: JSON.stringify({ job_id: targetJobId }),
        signal: controller.signal,
      });
      const body = (await response.json()) as StreamStatusResponse;
      if (!response.ok) {
        throw new Error((body as { message?: string })?.message || `HTTP ${response.status}`);
      }

      setJobStatus((String(body.status || "stopped") as StreamJobStatus) || "stopped");
      setProcessedFrames(Number(body.processed_frames ?? processedFrames));
      setFpsEstimate(typeof body.fps_estimate === "number" && Number.isFinite(body.fps_estimate) ? Number(body.fps_estimate) : fpsEstimate);
      setCameraFps(
        typeof body.details?.camera_fps === "number" && Number.isFinite(body.details.camera_fps)
          ? Number(body.details.camera_fps)
          : cameraFps,
      );
      setElapsedMs(typeof body.elapsed_ms === "number" && Number.isFinite(body.elapsed_ms) ? Number(body.elapsed_ms) : elapsedMs);
      setErrorMessage(body.error_message ? String(body.error_message) : null);

      toast.success(messages.realtime.stopped);
    } catch (error) {
      if (didTimeout) {
        toast(messages.realtime.stopFailed, { description: messages.realtime.requestTimeout });
        try {
          await fetch(`${srApiBase}/inference/video/stream/stop-all`, {
            method: "POST",
            headers: {
              "X-API-Key": srApiKey,
            },
          });
        } catch {
          // Best-effort fallback.
        }
        return;
      }

      if (isAbortError(error)) {
        return;
      }

      const message = error instanceof Error ? error.message : messages.realtime.stopFailed;
      toast(messages.realtime.stopFailed, { description: message });

      try {
        await fetch(`${srApiBase}/inference/video/stream/stop-all`, {
          method: "POST",
          headers: {
            "X-API-Key": srApiKey,
          },
        });
      } catch {
        // Best-effort fallback.
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (stopAbortRef.current === controller) {
        stopAbortRef.current = null;
      }
      setIsStopping(false);
    }
  };

  const statusBadge = statusToBadge(jobStatus);
  const latencyMs = elapsedMs != null && processedFrames > 0 ? elapsedMs / processedFrames : null;
  const shouldLivePreview = jobStatus === "running" || jobStatus === "queued";
  const modelFpsDisplay =
    typeof fpsEstimate === "number" && Number.isFinite(fpsEstimate)
      ? fpsEstimate.toFixed(2)
      : shouldLivePreview
        ? "Warming up..."
        : "--";
  const cameraFpsDisplay =
    typeof cameraFps === "number" && Number.isFinite(cameraFps)
      ? cameraFps.toFixed(2)
      : shouldLivePreview
        ? "Warming up..."
        : "--";

  const previewApiKeyQuery = useMemo(() => encodeURIComponent(srApiKey || ""), [srApiKey]);
  const inputPreviewSrc = useMemo(() => {
    if (!srApiBase || !srApiKey) {
      return "";
    }

    // Keep webcam input preview at 25fps before Start; model stream starts only on Start.
    if (inputPreviewTransport === "mjpg") {
      return `${srApiBase}/preview/rtsp/input.mjpg?api_key=${previewApiKeyQuery}&fps=25`;
    }

    // Fallback mode (or idle mode): refresh lightweight snapshots so camera is always visible.
    return `${srApiBase}/preview/rtsp/input.jpg?api_key=${previewApiKeyQuery}&t=${previewTick}`;
  }, [inputPreviewTransport, previewApiKeyQuery, previewTick, srApiBase, srApiKey]);

  const outputPreviewSrc = useMemo(() => {
    if (!srApiBase || !srApiKey || !jobId || !shouldLivePreview) {
      return "";
    }
    return `${srApiBase}/preview/rtsp/output/${jobId}.jpg?api_key=${previewApiKeyQuery}&t=${previewTick}`;
  }, [jobId, previewApiKeyQuery, previewTick, shouldLivePreview, srApiBase, srApiKey]);

  return (
    <div className="space-y-4 p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-foreground">{messages.realtime.title}</h2>
          <StatusBadge status={statusBadge} label={jobStatus === "running" ? messages.common.live : undefined} />
          <div className="text-xs font-mono text-primary bg-primary/10 border border-primary/30 rounded px-2 py-1">
            {messages.realtime.cameraFps}: {cameraFpsDisplay}
          </div>
          <div className="text-xs font-mono text-primary bg-primary/10 border border-primary/30 rounded px-2 py-1">
            {messages.realtime.modelFps}: {modelFpsDisplay}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            onClick={handleStart}
            disabled={!canStart}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 disabled:opacity-60"
          >
            {isStarting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {messages.realtime.start}
          </button>

          <button
            onClick={handleStop}
            disabled={!canStop}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 disabled:opacity-60"
          >
            {isStopping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5" />}
            {messages.realtime.stop}
          </button>
        </div>
      </div>

      {/* Dual Feed */}
      <div className="flex-1 grid grid-cols-2 gap-3 min-h-0">
        {/* Input */}
        <div className="glass rounded-xl overflow-hidden relative flex flex-col">
          <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between">
            <span className="text-xs font-mono text-muted-foreground uppercase">{messages.realtime.inputRtsp}</span>
            {jobId ? <span className="text-[10px] font-mono text-muted-foreground">job: {jobId.slice(0, 8)}…</span> : <span />}
          </div>
          <div className="flex-1 relative">
            {inputPreviewSrc ? (
              <img
                src={inputPreviewSrc}
                alt={messages.realtime.originalAlt}
                className="w-full h-full object-cover"
                onError={() => {
                  if (inputPreviewTransport !== "jpg") {
                    setInputPreviewTransport("jpg");
                  }
                }}
              />
            ) : (
              <div className="h-full w-full p-4 flex items-center justify-center text-sm text-muted-foreground text-center">
                {messages.realtime.missingApiUrl}
              </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 p-3 bg-background/70 backdrop-blur-sm border-t border-border/40 space-y-2">
              <div className="text-[10px] font-mono text-muted-foreground break-all">{inputUrl || "--"}</div>
            </div>
          </div>
        </div>

        {/* Output */}
        <div className="glass rounded-xl overflow-hidden relative flex flex-col">
          <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between">
            <span className="text-xs font-mono text-primary uppercase">{messages.realtime.outputRtsp}</span>
            <span className="text-[10px] font-mono text-primary">{jobStatus || "--"}</span>
          </div>
          <div className="flex-1 relative">
            {outputPreviewSrc ? (
              <img src={outputPreviewSrc} alt={messages.realtime.srAlt} className="w-full h-full object-cover" />
            ) : (
              <div className="h-full w-full p-4 flex items-center justify-center text-sm text-muted-foreground text-center">
                {messages.realtime.start}
              </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 p-3 bg-background/70 backdrop-blur-sm border-t border-border/40 space-y-2">
              <div className="text-[10px] font-mono text-primary break-all">{outputUrl || "--"}</div>
              {errorMessage && (
                <div className="text-[10px] text-destructive break-words">
                  {messages.realtime.errorLabel}: {errorMessage}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard
          label={messages.realtime.cameraFps}
          value={cameraFpsDisplay}
          icon={<Camera className="w-4 h-4" />}
          color="accent"
          percentage={cameraFps != null ? (cameraFps / 30) * 100 : undefined}
        />
        <MetricCard
          label={messages.realtime.modelFps}
          value={modelFpsDisplay}
          icon={<Gauge className="w-4 h-4" />}
          color="primary"
          percentage={fpsEstimate != null ? (fpsEstimate / 30) * 100 : undefined}
        />
        <MetricCard
          label={messages.realtime.latency}
          value={latencyMs != null && Number.isFinite(latencyMs) ? latencyMs.toFixed(1) : "--"}
          unit="ms"
          icon={<Clock className="w-4 h-4" />}
          color={latencyMs != null && latencyMs > 60 ? "warning" : "accent"}
          percentage={latencyMs != null ? (latencyMs / 100) * 100 : undefined}
        />
        <MetricCard
          label={messages.realtime.frames}
          value={processedFrames.toLocaleString()}
          icon={<Activity className="w-4 h-4" />}
          color="success"
        />
      </div>
    </div>
  );
}
