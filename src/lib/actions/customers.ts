"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { customerSchema } from "@/lib/validations/customer";
import { createCustomer, updateCustomer } from "@/lib/services/customers";
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

export async function createCustomerAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const data = parseOrThrow(customerSchema, input);
    const customer = await createCustomer(data);

    revalidatePath("/clientes");
    return customer;
  });
}

export async function updateCustomerAction(
  id: string,
  input: unknown,
): Promise<ActionResult<void>> {
  return runAction(async () => {
    const data = parseOrThrow(customerSchema, input);
    await updateCustomer(id, data);

    revalidatePath("/clientes");
    revalidatePath(`/clientes/${id}`);
  });
}
