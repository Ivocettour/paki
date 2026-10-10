import { z } from "zod";
import { FinancingType } from "@prisma/client";
import { MAX_SURCHARGE_PERCENT } from "@/lib/domain/financing";

/// Tipos que admiten cuotas. El contado no tiene plan de financiación.
export const FINANCED_TYPES = [
  FinancingType.TARJETA,
  FinancingType.FINANCIACION_LOCAL,
] as const;

export const financingPlanSchema = z.object({
  type: z.enum(FINANCED_TYPES, { error: "Seleccioná el tipo de financiación." }),
  installments: z
    .number({ error: "Ingresá la cantidad de cuotas." })
    .int({ error: "La cantidad de cuotas debe ser un número entero." })
    .min(1, { error: "La cantidad de cuotas debe ser al menos 1." })
    .max(60, { error: "No se admiten más de 60 cuotas." }),
  /// 0 = cuotas sin interés.
  surchargePercent: z
    .number({ error: "Ingresá un porcentaje válido." })
    .min(0, { error: "El recargo no puede ser negativo." })
    .max(MAX_SURCHARGE_PERCENT, {
      error: `El recargo no puede superar el ${MAX_SURCHARGE_PERCENT}%.`,
    })
    .transform((value) => Math.round(value * 100) / 100),
  isActive: z.boolean().default(true),
});

export type FinancingPlanInput = z.output<typeof financingPlanSchema>;
export type FinancingPlanFormInput = z.input<typeof financingPlanSchema>;
