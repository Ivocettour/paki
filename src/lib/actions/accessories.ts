"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  accessorySchema,
  createAccessorySchema,
  stockAdjustmentSchema,
} from "@/lib/validations/accessory";
import {
  adjustAccessoryStock,
  createAccessory,
  deactivateAccessory,
  searchAvailableAccessories,
  updateAccessory,
} from "@/lib/services/accessories";
import { requirePermission } from "@/lib/auth/session";
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

function revalidateAccessory(id?: string) {
  revalidatePath("/accesorios");
  if (id) revalidatePath(`/accesorios/${id}`);
  revalidatePath("/");
}

export async function createAccessoryAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const data = parseOrThrow(createAccessorySchema, input);
    const accessory = await createAccessory(data);

    revalidateAccessory();
    return accessory;
  });
}

export async function updateAccessoryAction(
  id: string,
  input: unknown,
): Promise<ActionResult<void>> {
  return runAction(async () => {
    const data = parseOrThrow(accessorySchema, input);
    await updateAccessory(id, data);

    revalidateAccessory(id);
  });
}

export async function adjustStockAction(
  id: string,
  input: unknown,
): Promise<ActionResult<void>> {
  return runAction(async () => {
    const data = parseOrThrow(stockAdjustmentSchema, input);
    await adjustAccessoryStock(id, data);

    revalidateAccessory(id);
  });
}

export async function deactivateAccessoryAction(
  id: string,
  reason: string,
): Promise<ActionResult<void>> {
  return runAction(async () => {
    if (reason.trim().length < 3) {
      throw errors.validacion("Indicá el motivo de la baja (mínimo 3 caracteres).");
    }
    await deactivateAccessory(id, reason.trim());

    revalidateAccessory(id);
  });
}

/// Búsqueda de accesorios con stock para el formulario de venta.
export async function searchAccessoriesAction(term: string) {
  return runAction(async () => {
    await requirePermission("ventas.registrar");
    return searchAvailableAccessories(term);
  });
}
