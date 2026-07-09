import * as React from "react";
import { cn } from "@/lib/utils";

type Accent = "blue" | "orange" | "green" | "purple" | "red";

const accentBar: Record<Accent, string> = {
  blue: "before:bg-blue-500",
  orange: "before:bg-brand",
  green: "before:bg-emerald-500",
  purple: "before:bg-violet-500",
  red: "before:bg-red-500",
};

const valueColor: Record<Accent, string> = {
  blue: "text-blue-600",
  orange: "text-brand",
  green: "text-emerald-600",
  purple: "text-violet-600",
  red: "text-red-600",
};

const iconColor: Record<Accent, string> = {
  blue: "text-blue-500",
  orange: "text-brand",
  green: "text-emerald-500",
  purple: "text-violet-500",
  red: "text-red-500",
};

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  accent?: Accent;
  className?: string;
}

export function StatCard({ label, value, hint, icon, accent = "blue", className }: StatCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-card)] border border-slate-200/70 bg-white px-5 py-4 shadow-sm",
        "before:absolute before:left-0 before:top-0 before:h-full before:w-1.5 before:content-['']",
        accentBar[accent],
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted">{label}</p>
        {icon && <span className={cn("shrink-0", iconColor[accent])}>{icon}</span>}
      </div>
      <p className={cn("mt-3 text-2xl font-bold", valueColor[accent])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
