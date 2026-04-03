import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Language = "vi" | "en" | "ja";

const MESSAGES = {
  vi: {
    notFound: { message: "Trang bạn tìm không tồn tại.", returnHome: "Quay về trang chủ" },
    status: { online: "Đang hoạt động", processing: "Đang xử lý", waiting: "Đang chờ", error: "Lỗi", completed: "Hoàn tất" },
    common: { live: "Trực tiếp", model: "Mô hình", scale: "Tỉ lệ", metric: "Chỉ số", winner: "Thắng", original: "Gốc" },
    overview: {
      projectTag: "Tổng quan dự án",
      titleLine1: "Siêu phân giải thời gian thực",
      titleLine2: "cho Edge AI",
      description: "Giám sát và so sánh pipeline siêu phân giải video tối ưu cho Jetson.",
      pillars: {
        modelWhatTitle: "Mô hình nào",
        modelWhatDesc: "Chạy mô hình SR nhẹ cho thiết bị biên.",
        improveWhereTitle: "Cải thiện ở đâu",
        improveWhereDesc: "Khôi phục chi tiết từ luồng độ phân giải thấp.",
        reliableTitle: "Ổn định",
        reliableDesc: "Thông lượng ổn định, độ trễ dễ dự đoán.",
      },
      benchmarkTitle: "Bảng benchmark",
      tableHeaders: { model: "Mô hình", psnr: "PSNR", ssim: "SSIM", fps: "FPS", params: "Tham số" },
      rows: { bicubic: "Nội suy Bicubic", oursOptimized: "Mô hình tối ưu của nhóm" },
      beforeAfterTitle: "Trước / Sau",
      slider: { before: "Trước", after: "Sau" },
      aboutTitle: "Giới thiệu",
      aboutDescription: "Dashboard minh họa quy trình SR ảnh và video cho triển khai thực tế ở edge.",
    },
    realtime: {
      title: "Luồng thời gian thực",
      originalFeed: "Luồng gốc",
      originalAlt: "Luồng gốc độ phân giải thấp",
      cameraTag: "Camera",
      srOutput: "Đầu ra SR",
      srAlt: "Kết quả siêu phân giải",
      srTag: "Kết quả mô hình",
      latency: "Độ trễ",
      frames: "Khung hình",
    },
    offline: {
      title: "Xử lý ngoại tuyến",
      uploadHint: "Tải video đã quay để xử lý hàng loạt.",
      uploadFormats: "Định dạng: .mp4, .mov",
      processingQueue: "Hàng đợi xử lý",
      previewTitle: "Xem trước",
    },
    image: {
      title: "Ảnh sang ảnh",
      sampleFood: "Mẫu đồ ăn",
      sampleSushi: "Mẫu sushi",
      uploadHint: "Thả ảnh hoặc chọn mẫu.",
      upscale: "Nâng cấp",
      download: "Tải xuống",
      inputOutput: "Đầu vào / Đầu ra",
    },
    controlPanel: {
      title: "Bảng điều khiển",
      gpuUsage: "Mức dùng GPU",
      vram: "VRAM",
      temperature: "Nhiệt độ",
      powerDraw: "Công suất",
      activeModel: "Mô hình đang chạy",
      autoSwitchHint: "Tự động chuyển mô hình theo tải hiện tại.",
      systemAlerts: "Cảnh báo hệ thống",
      alerts: {
        temperatureWarning: "Nhiệt độ vượt ngưỡng khuyến nghị.",
        switchedInfo: "Đã chuyển sang cấu hình cân bằng.",
        startedInfo: "Pipeline realtime đã khởi động.",
        minAgo2: "2 phút trước",
        minAgo5: "5 phút trước",
        hourAgo1: "1 giờ trước",
      },
    },
    modelArena: {
      title: "Đấu trường mô hình",
      sceneFood: "Cảnh đồ ăn",
      sceneSushi: "Cảnh sushi",
      labelA: "Mô hình A",
      labelB: "Mô hình B",
    },
  },
  en: {
    notFound: { message: "This page does not exist.", returnHome: "Return Home" },
    status: { online: "Online", processing: "Processing", waiting: "Waiting", error: "Error", completed: "Completed" },
    common: { live: "Live", model: "Model", scale: "Scale", metric: "Metric", winner: "Winner", original: "Original" },
    overview: {
      projectTag: "Project Overview",
      titleLine1: "Real-time Super Resolution",
      titleLine2: "for Edge AI",
      description: "Monitor and compare video super-resolution pipelines optimized for Jetson deployment.",
      pillars: {
        modelWhatTitle: "What model",
        modelWhatDesc: "Run lightweight SR models tuned for edge devices.",
        improveWhereTitle: "Where it improves",
        improveWhereDesc: "Recover details from low-resolution streams.",
        reliableTitle: "Reliable",
        reliableDesc: "Stable throughput with predictable latency.",
      },
      benchmarkTitle: "Model Benchmark",
      tableHeaders: { model: "Model", psnr: "PSNR", ssim: "SSIM", fps: "FPS", params: "Params" },
      rows: { bicubic: "Bicubic", oursOptimized: "Ours (Optimized)" },
      beforeAfterTitle: "Before / After",
      slider: { before: "Before", after: "After" },
      aboutTitle: "About",
      aboutDescription: "This dashboard demonstrates image and video super-resolution workflows for practical edge deployment.",
    },
    realtime: {
      title: "Realtime Stream",
      originalFeed: "Original Feed",
      originalAlt: "Original low-resolution stream",
      cameraTag: "Camera",
      srOutput: "SR Output",
      srAlt: "Super-resolution output",
      srTag: "Model Output",
      latency: "Latency",
      frames: "Frames",
    },
    offline: {
      title: "Offline Processing",
      uploadHint: "Upload recorded videos for batch processing.",
      uploadFormats: "Formats: .mp4, .mov",
      processingQueue: "Processing Queue",
      previewTitle: "Preview",
    },
    image: {
      title: "Image to Image",
      sampleFood: "Food sample",
      sampleSushi: "Sushi sample",
      uploadHint: "Drop an image or pick a sample.",
      upscale: "Upscale",
      download: "Download",
      inputOutput: "Input / Output",
    },
    controlPanel: {
      title: "Control Panel",
      gpuUsage: "GPU Usage",
      vram: "VRAM",
      temperature: "Temperature",
      powerDraw: "Power Draw",
      activeModel: "Active Model",
      autoSwitchHint: "Auto-switch picks the best model for current load.",
      systemAlerts: "System Alerts",
      alerts: {
        temperatureWarning: "Temperature is above recommended threshold.",
        switchedInfo: "Model switched to balanced profile.",
        startedInfo: "Realtime pipeline started.",
        minAgo2: "2 min ago",
        minAgo5: "5 min ago",
        hourAgo1: "1 hour ago",
      },
    },
    modelArena: {
      title: "Model Arena",
      sceneFood: "Food Scene",
      sceneSushi: "Sushi Scene",
      labelA: "Model A",
      labelB: "Model B",
    },
  },
  ja: {
    notFound: { message: "ページが見つかりません。", returnHome: "ホームに戻る" },
    status: { online: "稼働中", processing: "処理中", waiting: "待機中", error: "エラー", completed: "完了" },
    common: { live: "ライブ", model: "モデル", scale: "拡大率", metric: "指標", winner: "勝者", original: "元画像" },
    overview: {
      projectTag: "プロジェクト概要",
      titleLine1: "リアルタイム超解像",
      titleLine2: "Edge AI向け",
      description: "Jetson向けに最適化した動画超解像パイプラインを監視・比較します。",
      pillars: {
        modelWhatTitle: "どのモデル",
        modelWhatDesc: "エッジ向けの軽量SRモデルを実行します。",
        improveWhereTitle: "改善ポイント",
        improveWhereDesc: "低解像度映像の細部を復元します。",
        reliableTitle: "安定性",
        reliableDesc: "安定したスループットと予測可能な遅延を実現します。",
      },
      benchmarkTitle: "ベンチマーク",
      tableHeaders: { model: "モデル", psnr: "PSNR", ssim: "SSIM", fps: "FPS", params: "パラメータ" },
      rows: { bicubic: "バイキュービック", oursOptimized: "最適化モデル" },
      beforeAfterTitle: "ビフォー / アフター",
      slider: { before: "ビフォー", after: "アフター" },
      aboutTitle: "概要",
      aboutDescription: "このダッシュボードは、実運用向けエッジSRワークフローを示します。",
    },
    realtime: {
      title: "リアルタイム配信",
      originalFeed: "元映像",
      originalAlt: "低解像度の元映像",
      cameraTag: "カメラ",
      srOutput: "SR出力",
      srAlt: "超解像出力",
      srTag: "モデル出力",
      latency: "遅延",
      frames: "フレーム",
    },
    offline: {
      title: "オフライン処理",
      uploadHint: "録画した動画をアップロードして一括処理します。",
      uploadFormats: "形式: .mp4, .mov",
      processingQueue: "処理キュー",
      previewTitle: "プレビュー",
    },
    image: {
      title: "画像to画像",
      sampleFood: "フードサンプル",
      sampleSushi: "寿司サンプル",
      uploadHint: "画像をドロップするかサンプルを選択します。",
      upscale: "高解像化",
      download: "ダウンロード",
      inputOutput: "入力 / 出力",
    },
    controlPanel: {
      title: "コントロールパネル",
      gpuUsage: "GPU使用率",
      vram: "VRAM",
      temperature: "温度",
      powerDraw: "消費電力",
      activeModel: "稼働モデル",
      autoSwitchHint: "現在の負荷に応じて最適なモデルへ自動切替します。",
      systemAlerts: "システムアラート",
      alerts: {
        temperatureWarning: "温度が推奨しきい値を超えています。",
        switchedInfo: "バランスプロファイルへ切り替えました。",
        startedInfo: "リアルタイム処理を開始しました。",
        minAgo2: "2分前",
        minAgo5: "5分前",
        hourAgo1: "1時間前",
      },
    },
    modelArena: {
      title: "モデルアリーナ",
      sceneFood: "フードシーン",
      sceneSushi: "寿司シーン",
      labelA: "モデルA",
      labelB: "モデルB",
    },
  },
} as const;

type WidenLiteralStrings<T> = T extends string
  ? string
  : T extends Record<string, unknown>
    ? { [K in keyof T]: WidenLiteralStrings<T[K]> }
    : T;

export type Messages = WidenLiteralStrings<(typeof MESSAGES)["vi"]>;

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  messages: Messages;
};

const STORAGE_KEY = "ui-language";
const LanguageContext = createContext<LanguageContextValue | null>(null);

function getInitialLanguage(): Language {
  if (typeof window === "undefined") {
    return "vi";
  }

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "vi" || saved === "en" || saved === "ja") {
    return saved;
  }

  return "vi";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, nextLanguage);
    }
  };

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      messages: MESSAGES[language],
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
