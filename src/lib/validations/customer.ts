import { z } from "zod";

const optional = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label}: máximo ${max} caracteres.` })
    .optional()
    .transform((value) => (value === "" ? undefined : value));

export const customerSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, { error: "El nombre es obligatorio." })
    .max(60, { error: "Máximo 60 caracteres." }),
  lastName: z
    .string()
    .trim()
    .min(1, { error: "El apellido es obligatorio." })
    .max(60, { error: "Máximo 60 caracteres." }),
  dni: z
    .string()
    .trim()
    .regex(/^\d{7,9}$/, { error: "El DNI debe tener entre 7 y 9 dígitos." })
    .optional()
    .or(z.literal("").transform(() => undefined)),
  phone: optional(30, "Teléfono"),
  email: z
    .string()
    .trim()
    .pipe(z.email({ error: "Ingresá un email válido." }))
    .optional()
    .or(z.literal("").transform(() => undefined)),
  notes: optional(500, "Observaciones"),
});

export const customerFiltersSchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
});

export type CustomerInput = z.output<typeof customerSchema>;
export type CustomerFormInput = z.input<typeof customerSchema>;
export type CustomerFilters = z.output<typeof customerFiltersSchema>;
