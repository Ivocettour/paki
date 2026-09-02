import { z } from "zod";

export const brandSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "El nombre de la marca es obligatorio." })
    .max(60, { error: "Máximo 60 caracteres." }),
});

export const deviceModelSchema = z.object({
  brandId: z.string().min(1, { error: "Seleccioná una marca." }),
  name: z
    .string()
    .trim()
    .min(1, { error: "El nombre del modelo es obligatorio." })
    .max(80, { error: "Máximo 80 caracteres." }),
  /// Umbral de alerta de stock bajo. En 0 no se avisa.
  minStock: z
    .number({ error: "Ingresá un número válido." })
    .int({ error: "El stock mínimo debe ser un número entero." })
    .nonnegative({ error: "El stock mínimo no puede ser negativo." })
    .max(1000, { error: "El stock mínimo ingresado es demasiado alto." })
    .default(0),
});

export type BrandInput = z.output<typeof brandSchema>;
export type DeviceModelInput = z.output<typeof deviceModelSchema>;
export type DeviceModelFormInput = z.input<typeof deviceModelSchema>;
