"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { financingPlanSchema } from "@/lib/validations/financing";
import {
  createFinancingPlan,
  deleteFinancingPlan,
  updateFinancingPlan,
} from "@/lib/services/financing";
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

/// Los planes alimentan el formulario de venta y las cuotas que muestra la tienda.
function revalidateFinancing() {
  revalidatePath("/configuracion");
  revalidatePath("/ventas/nueva");
  revalidatePath("/tienda", "layout");
}

export async function createFinancingPlanAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const plan = await createFinancingPlan(parseOrThrow(financingPlanSchema, input));
    revalidateFinancing();
    return plan;
  });
}

export async function updateFinancingPlanAction(
  id: string,
  input: unknown,
): Promise<ActionResult<void>> {
  return runAction(async () => {
    await updateFinancingPlan(id, parseOrThrow(financingPlanSchema, input));
    revalidateFinancing();
  });
}

export async function deleteFinancingPlanAction(id: string): Promise<ActionResult<void>> {
  return runAction(async () => {
    await deleteFinancingPlan(id);
    revalidateFinancing();
  });
}
