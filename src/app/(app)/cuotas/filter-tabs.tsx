import Link from "next/link";
import type { InstallmentFilter, InstallmentsSummary } from "@/lib/services/installments";
import { cn } from "@/lib/utils";

const TABS: Array<{ value: InstallmentFilter; label: string }> = [
  { value: "vencidas", label: "Vencidas" },
  { value: "proximas", label: "Próximas" },
  { value: "pendientes", label: "Pendientes" },
  { value: "pagadas", label: "Pagadas" },
  { value: "todas", label: "Todas" },
];

export function FilterTabs({
  active,
  summary,
}: {
  active: InstallmentFilter;
  summary: InstallmentsSummary;
}) {
  const counts: Partial<Record<InstallmentFilter, number>> = {
    vencidas: summary.overdueCount,
    proximas: summary.dueSoonCount,
    pendientes: summary.pendingCount,
  };

  return (
    <div
      className="flex gap-1 overflow-x-auto rounded-full bg-surface-subtle p-1"
      role="tablist"
      aria-label="Filtrar cuotas"
    >
      {TABS.map((tab) => {
        const isActive = tab.value === active;
        const count = counts[tab.value];

        return (
          <Link
            key={tab.value}
            href={`/cuotas?estado=${tab.value}`}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors",
              isActive
                ? "bg-surface-raised text-fg shadow-[0_1px_2px_rgb(0_0_0_/_0.06)]"
                : "text-fg-secondary hover:text-fg",
            )}
          >
            {tab.label}
            {count !== undefined && count > 0 ? (
              <span
                className={cn(
                  "tabular rounded-full px-1.5 text-[11px]",
                  tab.value === "vencidas"
                    ? "bg-danger-soft text-danger"
                    : "bg-surface-subtle text-fg-tertiary",
                )}
              >
                {count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
