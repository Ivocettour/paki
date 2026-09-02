import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/// Tarjeta de métrica: número grande con tracking negativo, etiqueta discreta.
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "neutral" | "success" | "warning" | "danger";
  className?: string;
}) {
  const toneClasses = {
    neutral: "text-fg",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  } as const;

  return (
    <div
      className={cn(
        "rounded-[18px] border border-line-subtle bg-surface-raised p-5 shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-fg-secondary">{label}</p>
        {Icon ? <Icon className="size-4 shrink-0 text-fg-tertiary" aria-hidden /> : null}
      </div>
      <p
        className={cn(
          "tabular mt-3 text-[30px] font-semibold leading-none tracking-[-0.03em]",
          toneClasses[tone],
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-2 text-[12px] text-fg-tertiary">{hint}</p> : null}
    </div>
  );
}
