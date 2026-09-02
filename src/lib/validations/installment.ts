import { z } from "zod";
import { PaymentMethod } from "@prisma/client";

export const registerPaymentSchema = z.object({
  paidAmount: z
    .number({ error: "Ingresá el monto cobrado." })
    .positive({ error: "El monto cobrado debe ser mayor a cero." })
    .max(999_999_999, { error: "El monto ingresado es demasiado alto." }),
  paidAt: z.coerce.date({ error: "Ingresá una fecha de cobro válida." }),
  paymentMethod: z.enum(PaymentMethod, { error: "Seleccioná el método de pago." }),
  notes: z
    .string()
    .trim()
    .max(500, { error: "Máximo 500 caracteres." })
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
});

export const cancelPaymentSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, { error: "Indicá el motivo de la anulación (mínimo 3 caracteres)." })
    .max(500, { error: "Máximo 500 caracteres." }),
});

export type RegisterPaymentInput = z.output<typeof registerPaymentSchema>;
export type RegisterPaymentFormInput = z.input<typeof registerPaymentSchema>;
