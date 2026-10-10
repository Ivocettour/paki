/**
 * Cálculo del recargo (interés) por financiación.
 *
 * Módulo puro, compartido por el formulario de venta, el servidor y la tienda:
 * los tres tienen que dar exactamente el mismo número.
 *
 * Los importes se redondean a centavos en cada paso, para que lo que se muestra
 * sea lo mismo que se guarda.
 */

export const MAX_SURCHARGE_PERCENT = 300;

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/// Recargo en pesos para una base y un porcentaje.
export function surchargeAmount(base: number, percent: number): number {
  if (!Number.isFinite(base) || !Number.isFinite(percent) || base <= 0 || percent <= 0) {
    return 0;
  }
  return roundCents((base * percent) / 100);
}

export interface FinancingQuote {
  base: number;
  surcharge: number;
  total: number;
  installmentCount: number;
  /// Valor de la cuota. La primera cuota absorbe el redondeo, igual que el plan real.
  installmentAmount: number;
}

/// Presupuesto de una financiación: total con recargo y valor de cada cuota.
export function quoteFinancing(
  base: number,
  percent: number,
  installmentCount: number,
): FinancingQuote {
  const surcharge = surchargeAmount(base, percent);
  const total = roundCents(base + surcharge);
  const count = Math.max(1, Math.floor(installmentCount) || 1);

  return {
    base,
    surcharge,
    total,
    installmentCount: count,
    installmentAmount: roundCents(total / count),
  };
}
