import { z } from "zod";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Máximo ${max} caracteres.` })
    .optional()
    .transform((value) => (value === "" ? undefined : value));

export const supplierSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "El nombre es obligatorio." })
    .max(120, { error: "Máximo 120 caracteres." }),
  /// CUIT argentino: 11 dígitos, con o sin guiones.
  cuit: z
    .string()
    .trim()
    .regex(/^\d{2}-?\d{8}-?\d$/, { error: "El CUIT debe tener 11 dígitos." })
    .optional()
    .or(z.literal("").transform(() => undefined)),
  phone: optional(30),
  email: z
    .string()
    .trim()
    .pipe(z.email({ error: "Ingresá un email válido." }))
    .optional()
    .or(z.literal("").transform(() => undefined)),
  address: optional(200),
  notes: optional(500),
});

export const supplierFiltersSchema = z.object({
  search: z.string().trim().optional(),
});

export type SupplierInput = z.output<typeof supplierSchema>;
export type SupplierFilters = z.output<typeof supplierFiltersSchema>;
