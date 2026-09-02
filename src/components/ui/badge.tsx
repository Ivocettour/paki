import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "accent";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-subtle text-fg-secondary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  accent: "bg-accent-soft text-accent",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/// Indicador de batería: barra + porcentaje, con color según el nivel.
export function BatteryIndicator({ percent }: { percent: number | null }) {
  if (percent === null) {
    return <span className="text-[13px] text-fg-tertiary">—</span>;
  }

  const tone =
    percent >= 85 ? "bg-success" : percent >= 70 ? "bg-warning" : "bg-danger";

  return (
    <span className="inline-flex items-center gap-2" title={`Batería ${percent}%`}>
      <span
        className="relative h-[14px] w-7 shrink-0 rounded-[3px] border border-line"
        aria-hidden
      >
        <span
          className={cn("absolute inset-y-[2px] left-[2px] rounded-[1px]", tone)}
          style={{ width: `calc(${Math.max(percent, 3)}% - 4px)` }}
        />
      </span>
      <span className="tabular text-[13px] text-fg">{percent}%</span>
    </span>
  );
}
