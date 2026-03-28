import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: ReactNode;
  color?: "primary" | "accent" | "warning" | "destructive" | "success";
  percentage?: number;
}

const colorMap = {
  primary: "text-primary",
  accent: "text-accent",
  warning: "text-warning",
  destructive: "text-destructive",
  success: "text-success",
};

const barColorMap = {
  primary: "bg-primary",
  accent: "bg-accent",
  warning: "bg-warning",
  destructive: "bg-destructive",
  success: "bg-success",
};

export function MetricCard({ label, value, unit, icon, color = "primary", percentage }: MetricCardProps) {
  return (
    <div className="glass rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{label}</span>
        {icon && <span className={cn("opacity-60", colorMap[color])}>{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn("text-2xl font-bold font-mono", colorMap[color])}>{value}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {percentage !== undefined && (
        <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", barColorMap[color])}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
