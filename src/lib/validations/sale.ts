import { z } from "zod";
import { FinancingType, PaymentMethod, SaleStatus } from "@prisma/client";

const money = z
  .number({ error: "Ingresá un importe válido." })
  .nonnegative({ error: "El importe no puede ser negativo." })
  .max(999_999_999, { error: "El importe ingresado es demasiado alto." });

/**
 * Alta de venta.
 *
 * El cliente NO envía precios: solo indica qué equipos se venden. El servidor
 * lee el precio de cada equipo desde la base. De lo contrario, cualquiera
 * podría vender un celular a un peso manipulando la petición.
 */
export const createSaleSchema = z
  .object({
    deviceIds: z
      .array(z.string().min(1))
      .max(20, { error: "No se pueden vender más de 20 equipos en una misma operación." })
      .default([])
      .refine((ids) => new Set(ids).size === ids.length, {
        error: "Hay un equipo repetido en la venta.",
      }),
    /// Accesorios vendidos por cantidad.
    accessoryItems: z
      .array(
        z.object({
          accessoryId: z.string().min(1),
          quantity: z
            .number()
            .int({ error: "La cantidad debe ser un número entero." })
            .positive({ error: "La cantidad debe ser mayor a cero." })
            .max(1000, { error: "La cantidad ingresada es demasiado alta." }),
        }),
      )
      .max(30, { error: "No se pueden vender más de 30 accesorios distintos." })
      .default([])
      .refine(
        (items) => new Set(items.map((item) => item.accessoryId)).size === items.length,
        { error: "Hay un accesorio repetido en la venta." },
      ),
    customerId: z
      .string()
      .optional()
      .transform((value) => (value === "" ? undefined : value)),
    discount: money.default(0),
    paymentMethod: z.enum(PaymentMethod, { error: "Seleccioná el método de pago." }),
    financingType: z.enum(FinancingType, { error: "Seleccioná el tipo de financiación." }),
    installmentCount: z
      .number()
      .int({ error: "La cantidad de cuotas debe ser un número entero." })
      .min(1, { error: "La cantidad de cuotas debe ser al menos 1." })
      .max(60, { error: "No se admiten más de 60 cuotas." })
      .nullable()
      .optional(),
    firstDueDate: z.coerce.date().nullable().optional(),
    notes: z
      .string()
      .trim()
      .max(1000, { error: "Máximo 1000 caracteres." })
      .optional()
      .transform((value) => (value === "" ? undefined : value)),
  })
  .refine((data) => data.deviceIds.length + data.accessoryItems.length > 0, {
    error: "Agregá al menos un producto a la venta.",
    path: ["deviceIds"],
  })
  .refine(
    (data) =>
      data.financingType === FinancingType.CONTADO ||
      (data.installmentCount !== null && data.installmentCount !== undefined),
    {
      error: "Indicá en cuántas cuotas se hace la venta.",
      path: ["installmentCount"],
    },
  )
  .refine(
    (data) =>
      data.financingType !== FinancingType.FINANCIACION_LOCAL ||
      (data.firstDueDate !== null && data.firstDueDate !== undefined),
    {
      error: "Indicá la fecha de vencimiento de la primera cuota.",
      path: ["firstDueDate"],
    },
  );

export const cancelSaleSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(5, { error: "Indicá el motivo de la anulación (mínimo 5 caracteres)." })
    .max(500, { error: "Máximo 500 caracteres." }),
});

export const saleFiltersSchema = z.object({
  search: z.string().trim().optional(),
  status: z.enum(SaleStatus).optional(),
  paymentMethod: z.enum(PaymentMethod).optional(),
  financingType: z.enum(FinancingType).optional(),
  sellerId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
});

export type CreateSaleInput = z.output<typeof createSaleSchema>;
export type CreateSaleFormInput = z.input<typeof createSaleSchema>;
export type CancelSaleInput = z.output<typeof cancelSaleSchema>;
export type SaleFilters = z.output<typeof saleFiltersSchema>;
