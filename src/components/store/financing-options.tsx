import { FinancingType } from "@prisma/client";
import { quoteFinancing } from "@/lib/domain/financing";
import { formatCurrency } from "@/lib/utils";
import type { StorePlan } from "@/lib/services/storefront";

const GROUP_LABELS: Record<FinancingType, string> = {
  CONTADO: "Contado",
  TARJETA: "Con tarjeta de crédito",
  FINANCIACION_LOCAL: "Financiación del local",
};

/// Cuánto sale cada cuota de un precio, según los planes activos del local.
export function FinancingOptions({ price, plans }: { price: number; plans: StorePlan[] }) {
  const groups = [FinancingType.TARJETA, FinancingType.FINANCIACION_LOCAL]
    .map((type) => ({ type, plans: plans.filter((plan) => plan.type === type) }))
    .filter((group) => group.plans.length > 0);

  if (groups.length === 0) return null;

  return (
    <section aria-labelledby="financiacion" className="rounded-[28px] bg-surface-raised p-6 sm:p-8">
      <h2 id="financiacion" className="text-[24px] font-semibold tracking-[-0.025em] text-fg">
        Pagalo en cuotas.
      </h2>
      <p className="mt-1.5 text-[15px] text-fg-secondary">
        Así queda cada cuota de este equipo. El recargo ya está incluido.
      </p>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        {groups.map((group) => (
          <div key={group.type}>
            <h3 className="mb-2 text-[14px] font-semibold text-fg">{GROUP_LABELS[group.type]}</h3>
            <ul className="divide-y divide-line-subtle rounded-[16px] border border-line-subtle">
              {group.plans.map((plan) => {
                const quote = quoteFinancing(price, plan.surchargePercent, plan.installments);

                return (
                  <li
                    key={plan.installments}
                    className="flex items-baseline justify-between gap-3 px-4 py-3"
                  >
                    <span className="text-[14px] text-fg-secondary">
                      {plan.installments} {plan.installments === 1 ? "cuota" : "cuotas"} de{" "}
                      <span className="tabular font-semibold text-fg">
                        {formatCurrency(quote.installmentAmount)}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-right text-[12px] text-fg-tertiary">
                      {plan.surchargePercent === 0
                        ? "Sin interés"
                        : `Total ${formatCurrency(quote.total)}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
