import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "online" | "processing" | "waiting" | "error" | "completed";
  label?: string;
}

const statusStyles = {
  online: "bg-success/20 text-success border-success/30",
  processing: "bg-primary/20 text-primary border-primary/30",
  waiting: "bg-warning/20 text-warning border-warning/30",
  error: "bg-destructive/20 text-destructive border-destructive/30",
  completed: "bg-accent/20 text-accent border-accent/30",
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-mono border",
      statusStyles[status]
    )}>
      <span className={cn(
        "w-1.5 h-1.5 rounded-full",
        status === "online" && "bg-success animate-pulse-glow",
        status === "processing" && "bg-primary animate-pulse",
        status === "waiting" && "bg-warning",
        status === "error" && "bg-destructive",
        status === "completed" && "bg-accent",
      )} />
      {label || status}
    </span>
  );
}
