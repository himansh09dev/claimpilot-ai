import type { ReactNode, Ref } from "react";
import { cn } from "./cn";

type AlertTone = "info" | "warning" | "danger" | "success";

const tones: Record<AlertTone, { box: string; icon: string }> = {
  info: { box: "border-brand-200 bg-brand-50 text-brand-950", icon: "text-brand-600" },
  warning: { box: "border-amber-300 bg-amber-50 text-amber-950", icon: "text-amber-600" },
  danger: { box: "border-rose-300 bg-rose-50 text-rose-950", icon: "text-rose-600" },
  success: { box: "border-emerald-300 bg-emerald-50 text-emerald-950", icon: "text-emerald-600" },
};

interface AlertProps {
  tone?: AlertTone;
  title: ReactNode;
  children?: ReactNode;
  /**
   * "alert" announces immediately (use for errors after an action),
   * "status" announces politely, undefined = static content.
   */
  role?: "alert" | "status";
  className?: string;
  ref?: Ref<HTMLDivElement>;
  tabIndex?: number;
}

export function Alert({ tone = "info", title, children, role, className, ref, tabIndex }: AlertProps) {
  return (
    <div
      ref={ref}
      role={role}
      tabIndex={tabIndex}
      className={cn("flex gap-3 rounded-lg border p-4 text-sm", tones[tone].box, className)}
    >
      <svg className={cn("mt-0.5 size-5 shrink-0", tones[tone].icon)} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
          clipRule="evenodd"
        />
      </svg>
      <div className="min-w-0 space-y-1">
        <p className="font-semibold">{title}</p>
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}
