import { z } from "zod";
import { AccessoryCategory } from "@prisma/client";

export const accessorySchema = z.object({
  category: z.enum(AccessoryCategory, { error: "Seleccioná un rubro." }),
  name: z
    .string()
    .trim()
    .min(2, { error: "El nombre es obligatorio." })
    .max(120, { error: "Máximo 120 caracteres." }),
  brand: z
    .string()
    .trim()
    .max(60, { error: "Máximo 60 caracteres." })
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  sku: z
    .string()
    .trim()
    .max(40, { error: "Máximo 40 caracteres." })
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  salePrice: z
    .number({ error: "Ingresá un precio válido." })
    .nonnegative({ error: "El precio no puede ser negativo." })
    .max(999_999_999, { error: "El precio ingresado es demasiado alto." }),
  minStock: z
    .number({ error: "Ingresá un número válido." })
    .int({ error: "El stock mínimo debe ser un número entero." })
    .nonnegative({ error: "El stock mínimo no puede ser negativo." })
    .default(0),
  notes: z
    .string()
    .trim()
    .max(500, { error: "Máximo 500 caracteres." })
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
});

/// Al dar de alta un accesorio se puede cargar el stock inicial de una vez.
export const createAccessorySchema = accessorySchema.extend({
  initialStock: z
    .number()
    .int({ error: "La cantidad debe ser un número entero." })
    .nonnegative({ error: "La cantidad no puede ser negativa." })
    .max(100_000, { error: "La cantidad ingresada es demasiado alta." })
    .default(0),
});

/// Ajuste manual de stock. El delta puede ser positivo o negativo, nunca cero.
export const stockAdjustmentSchema = z.object({
  quantityDelta: z
    .number({ error: "Ingresá una cantidad." })
    .int({ error: "La cantidad debe ser un número entero." })
    .refine((value) => value !== 0, { error: "La cantidad no puede ser cero." })
    .refine((value) => Math.abs(value) <= 100_000, {
      error: "La cantidad ingresada es demasiado alta.",
    }),
  reason: z
    .string()
    .trim()
    .min(3, { error: "Indicá el motivo del ajuste (mínimo 3 caracteres)." })
    .max(300, { error: "Máximo 300 caracteres." }),
});

export const accessoryFiltersSchema = z.object({
  search: z.string().trim().optional(),
  category: z.enum(AccessoryCategory).optional(),
  onlyLowStock: z.coerce.boolean().optional(),
  includeInactive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
});

export type AccessoryInput = z.output<typeof accessorySchema>;
export type CreateAccessoryInput = z.output<typeof createAccessorySchema>;
export type CreateAccessoryFormInput = z.input<typeof createAccessorySchema>;
export type StockAdjustmentInput = z.output<typeof stockAdjustmentSchema>;
export type AccessoryFilters = z.output<typeof accessoryFiltersSchema>;
