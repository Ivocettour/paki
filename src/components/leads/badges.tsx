import type { LeadPriority, LeadStage } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { LEAD_PRIORITY_LABELS, LEAD_STAGE_LABELS } from "@/lib/constants";
import { dueInfo } from "@/lib/domain/follow-up";
import { cn } from "@/lib/utils";

const STAGE_TONES = {
  CONSULTA: "accent",
  PRECIO_ENVIADO: "warning",
  RESERVADO: "success",
  VENDIDO: "success",
  EN_PAUSA: "neutral",
  PERDIDO: "danger",
} as const;

export function StageBadge({ stage }: { stage: LeadStage }) {
  return <Badge tone={STAGE_TONES[stage]}>{LEAD_STAGE_LABELS[stage]}</Badge>;
}

const PRIORITY_TONES = { ALTA: "danger", MEDIA: "warning", BAJA: "neutral" } as const;

export function PriorityBadge({
  priority,
  reason,
}: {
  priority: LeadPriority | null;
  reason?: string | null;
}) {
  if (!priority) return null;
  return (
    <span title={reason ?? undefined}>
      <Badge tone={PRIORITY_TONES[priority]}>Prioridad {LEAD_PRIORITY_LABELS[priority].toLowerCase()}</Badge>
    </span>
  );
}

/// Cuándo hay que volver a escribirle, con color según lo urgente que sea.
export function DueChip({ next, className }: { next: Date | null; className?: string }) {
  const info = dueInfo(next);
  if (info.status === "none") return null;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium whitespace-nowrap",
        info.status === "overdue" && "bg-danger-soft text-danger",
        info.status === "today" && "bg-warning-soft text-warning",
        info.status === "upcoming" && "bg-surface-subtle text-fg-secondary",
        className,
      )}
    >
      {info.label}
    </span>
  );
}
