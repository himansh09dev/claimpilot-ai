import type { ReactNode } from "react";
import { cn } from "./cn";

export type BadgeTone = "neutral" | "info" | "warning" | "success" | "danger" | "preview";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-300",
  info: "bg-brand-50 text-brand-800 ring-brand-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-300",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-300",
  danger: "bg-rose-50 text-rose-800 ring-rose-300",
  preview: "bg-violet-50 text-violet-800 ring-violet-300",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
