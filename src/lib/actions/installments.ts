"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  cancelPaymentSchema,
  registerPaymentSchema,
} from "@/lib/validations/installment";
import {
  cancelInstallmentPayment,
  registerInstallmentPayment,
} from "@/lib/services/installments";
import { errors } from "@/lib/errors";
import { runAction, type ActionResult } from "./types";

function parseOrThrow<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw errors.validacion(
      "Revisá los datos ingresados.",
      z.flattenError(result.error).fieldErrors as Record<string, string[]>,
    );
  }
  return result.data;
}

export async function registerPaymentAction(
  installmentId: string,
  input: unknown,
): Promise<ActionResult<void>> {
  return runAction(async () => {
    const data = parseOrThrow(registerPaymentSchema, input);
    await registerInstallmentPayment(installmentId, data);

    revalidatePath("/cuotas");
    revalidatePath("/");
  });
}

export async function cancelPaymentAction(
  installmentId: string,
  input: unknown,
): Promise<ActionResult<void>> {
  return runAction(async () => {
    const data = parseOrThrow(cancelPaymentSchema, input);
    await cancelInstallmentPayment(installmentId, data.reason);

    revalidatePath("/cuotas");
    revalidatePath("/");
  });
}
