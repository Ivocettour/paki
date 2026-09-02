import { z } from "zod";
import { DeviceCondition, DeviceType, PurchaseStatus } from "@prisma/client";

const cost = z
  .number({ error: "Ingresá un costo válido." })
  .nonnegative({ error: "El costo no puede ser negativo." })
  .max(999_999_999, { error: "El costo ingresado es demasiado alto." });

/// Ítem que ingresa UNA unidad de equipo al inventario.
const deviceItemSchema = z.object({
  kind: z.literal("equipo"),
  modelId: z.string().min(1, { error: "Seleccioná un modelo." }),
  deviceType: z.enum(DeviceType).default(DeviceType.CELULAR),
  color: z
    .string()
    .trim()
    .min(1, { error: "El color es obligatorio." })
    .max(50, { error: "Máximo 50 caracteres." }),
  storageGb: z.number().int().positive().nullable().optional(),
  condition: z.enum(DeviceCondition, { error: "Seleccioná el estado del equipo." }),
  batteryPercent: z
    .number()
    .int({ error: "El porcentaje de batería debe ser un número entero." })
    .min(0, { error: "El porcentaje de batería debe estar entre 0 y 100." })
    .max(100, { error: "El porcentaje de batería debe estar entre 0 y 100." })
    .nullable()
    .optional(),
  imei: z
    .string()
    .trim()
    .regex(/^\d{14,17}$/, { error: "El IMEI debe contener entre 14 y 17 dígitos." })
    .optional()
    .or(z.literal("").transform(() => undefined)),
  serialNumber: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  unitCost: cost,
  /// Precio con el que el equipo entra al inventario al confirmar la compra.
  salePrice: cost,
});

/// Ítem que repone un accesorio ya existente del catálogo.
const accessoryItemSchema = z.object({
  kind: z.literal("accesorio"),
  accessoryId: z.string().min(1, { error: "Seleccioná un accesorio." }),
  quantity: z
    .number()
    .int({ error: "La cantidad debe ser un número entero." })
    .positive({ error: "La cantidad debe ser mayor a cero." })
    .max(10_000, { error: "La cantidad ingresada es demasiado alta." }),
  unitCost: cost,
});

export const purchaseItemSchema = z.discriminatedUnion("kind", [
  deviceItemSchema,
  accessoryItemSchema,
]);

export const createPurchaseSchema = z.object({
  supplierId: z.string().min(1, { error: "Seleccioná un proveedor." }),
  purchaseDate: z.coerce.date({ error: "Ingresá una fecha válida." }),
  notes: z
    .string()
    .trim()
    .max(1000, { error: "Máximo 1000 caracteres." })
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  items: z
    .array(purchaseItemSchema)
    .min(1, { error: "Agregá al menos un producto a la compra." })
    .max(50, { error: "No se pueden cargar más de 50 ítems en una misma compra." }),
});

export const purchaseFiltersSchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(PurchaseStatus).optional(),
  supplierId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
});

export const cancelPurchaseSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, { error: "Indicá el motivo de la anulación (mínimo 5 caracteres)." })
    .max(500, { error: "Máximo 500 caracteres." }),
});

export type PurchaseItemInput = z.output<typeof purchaseItemSchema>;
export type CreatePurchaseInput = z.output<typeof createPurchaseSchema>;
export type PurchaseFilters = z.output<typeof purchaseFiltersSchema>;
export type CancelPurchaseInput = z.output<typeof cancelPurchaseSchema>;
