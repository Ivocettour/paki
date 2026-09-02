import { z } from "zod";
import { DeviceCondition, InventoryStatus } from "@prisma/client";
import { STORAGE_OPTIONS_GB } from "@/lib/constants";

const optionalText = z
  .string()
  .trim()
  .max(200, { error: "Máximo 200 caracteres." })
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const price = z
  .number({ error: "Ingresá un precio válido." })
  .nonnegative({ error: "El precio no puede ser negativo." })
  .max(999_999_999, { error: "El precio ingresado es demasiado alto." });

/// El IMEI estándar tiene 15 dígitos; se aceptan 14-17 para contemplar
/// variantes (IMEISV) sin bloquear cargas legítimas.
const imeiSchema = z
  .string()
  .trim()
  .regex(/^\d{14,17}$/, { error: "El IMEI debe contener entre 14 y 17 dígitos." });

export const deviceBaseSchema = z.object({
  modelId: z.string().min(1, { error: "Seleccioná un modelo." }),
  color: z
    .string()
    .trim()
    .min(1, { error: "El color es obligatorio." })
    .max(50, { error: "Máximo 50 caracteres." }),
  storageGb: z
    .number({ error: "Seleccioná una capacidad." })
    .int({ error: "La capacidad debe ser un número entero." })
    .positive({ error: "La capacidad debe ser mayor a cero." })
    .refine((value) => STORAGE_OPTIONS_GB.includes(value as never), {
      error: "La capacidad seleccionada no es válida.",
    }),
  condition: z.enum(DeviceCondition, { error: "Seleccioná el estado del equipo." }),
  batteryPercent: z
    .number()
    .int({ error: "El porcentaje de batería debe ser un número entero." })
    .min(0, { error: "El porcentaje de batería debe estar entre 0 y 100." })
    .max(100, { error: "El porcentaje de batería debe estar entre 0 y 100." })
    .nullable()
    .optional(),
  imei: imeiSchema.optional().or(z.literal("").transform(() => undefined)),
  serialNumber: optionalText,
  purchasePrice: price.nullable().optional(),
  salePrice: price,
  entryDate: z.coerce.date({ error: "Ingresá una fecha de ingreso válida." }),
  notes: z
    .string()
    .trim()
    .max(1000, { error: "Máximo 1000 caracteres." })
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  /// Los accesorios no llevan IMEI; los celulares sí.
  requiresImei: z.boolean().default(true),
});

/// Reglas de negocio que cruzan varios campos. Se expresan sobre la forma
/// mínima que necesitan para poder reutilizarse en alta y edición.
interface CrossFieldShape {
  condition: DeviceCondition;
  batteryPercent?: number | null;
  imei?: string;
  requiresImei: boolean;
}

function usedDeviceHasBattery(data: CrossFieldShape): boolean {
  return (
    data.condition !== DeviceCondition.USADO ||
    (data.batteryPercent !== null && data.batteryPercent !== undefined)
  );
}

function phoneHasImei(data: CrossFieldShape): boolean {
  return !data.requiresImei || Boolean(data.imei);
}

const BATTERY_RULE = {
  error: "El porcentaje de batería es obligatorio para equipos usados.",
  path: ["batteryPercent"],
};

const IMEI_RULE = {
  error: "El IMEI es obligatorio para celulares.",
  path: ["imei"],
};

export const createDeviceSchema = deviceBaseSchema
  .refine(usedDeviceHasBattery, BATTERY_RULE)
  .refine(phoneHasImei, IMEI_RULE);

export const updateDeviceSchema = deviceBaseSchema
  .extend({
    inventoryStatus: z.enum(InventoryStatus, {
      error: "Seleccioná un estado de inventario.",
    }),
  })
  .refine(usedDeviceHasBattery, BATTERY_RULE)
  .refine(phoneHasImei, IMEI_RULE);

/// Esquema único para el formulario de alta y edición.
/// El campo `inventoryStatus` solo se usa en edición, por eso es opcional acá;
/// el servidor revalida siempre con el esquema estricto que corresponda.
export const deviceFormSchema = deviceBaseSchema
  .extend({
    inventoryStatus: z.enum(InventoryStatus).optional(),
  })
  .refine(usedDeviceHasBattery, BATTERY_RULE)
  .refine(phoneHasImei, IMEI_RULE);

/// El esquema transforma valores (`entryDate` se coacciona a Date, los textos
/// vacíos pasan a `undefined`), por lo que la entrada del formulario y la
/// salida validada son tipos distintos. React Hook Form necesita ambos.
export type DeviceFormInput = z.input<typeof deviceFormSchema>;
export type DeviceFormValues = z.output<typeof deviceFormSchema>;

export const deviceFiltersSchema = z.object({
  search: z.string().trim().optional(),
  brandId: z.string().optional(),
  modelId: z.string().optional(),
  condition: z.enum(DeviceCondition).optional(),
  inventoryStatus: z.enum(InventoryStatus).optional(),
  storageGb: z.coerce.number().int().positive().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  minBattery: z.coerce.number().int().min(0).max(100).optional(),
  entryDateFrom: z.coerce.date().optional(),
  entryDateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  sortBy: z
    .enum(["entryDate", "salePrice", "createdAt", "batteryPercent"])
    .default("entryDate"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

export const deactivateDeviceSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, { error: "Indicá el motivo de la baja (mínimo 3 caracteres)." })
    .max(500, { error: "Máximo 500 caracteres." }),
  /// Confirmación explícita requerida para dar de baja un equipo vendido.
  forceSold: z.boolean().default(false),
});

export type CreateDeviceInput = z.infer<typeof createDeviceSchema>;
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>;
export type DeviceFilters = z.infer<typeof deviceFiltersSchema>;
export type DeactivateDeviceInput = z.infer<typeof deactivateDeviceSchema>;
