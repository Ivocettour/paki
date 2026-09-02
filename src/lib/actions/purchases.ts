"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cancelPurchaseSchema, createPurchaseSchema } from "@/lib/validations/purchase";
import { supplierSchema } from "@/lib/validations/supplier";
import {
  cancelPurchase,
  confirmPurchase,
  createPurchase,
} from "@/lib/services/purchases";
import { createSupplier, updateSupplier } from "@/lib/services/suppliers";
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

/// Confirmar una compra cambia el inventario: hay que refrescar todo lo que lo muestra.
function revalidateAfterStockChange(purchaseId?: string) {
  revalidatePath("/compras");
  if (purchaseId) revalidatePath(`/compras/${purchaseId}`);
  revalidatePath("/inventario");
  revalidatePath("/accesorios");
  revalidatePath("/movimientos");
  revalidatePath("/");
}

export async function createPurchaseAction(
  input: unknown,
): Promise<ActionResult<{ id: string; purchaseNumber: string }>> {
  return runAction(async () => {
    const data = parseOrThrow(createPurchaseSchema, input);
    const purchase = await createPurchase(data);

    revalidatePath("/compras");
    return purchase;
  });
}

export async function confirmPurchaseAction(id: string): Promise<ActionResult<void>> {
  return runAction(async () => {
    await confirmPurchase(id);
    revalidateAfterStockChange(id);
  });
}

export async function cancelPurchaseAction(
  id: string,
  input: unknown,
): Promise<ActionResult<void>> {
  return runAction(async () => {
    const data = parseOrThrow(cancelPurchaseSchema, input);
    await cancelPurchase(id, data);

    revalidatePath("/compras");
    revalidatePath(`/compras/${id}`);
  });
}

export async function createSupplierAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const data = parseOrThrow(supplierSchema, input);
    const supplier = await createSupplier(data);

    revalidatePath("/proveedores");
    revalidatePath("/compras");
    return supplier;
  });
}

export async function updateSupplierAction(
  id: string,
  input: unknown,
): Promise<ActionResult<void>> {
  return runAction(async () => {
    const data = parseOrThrow(supplierSchema, input);
    await updateSupplier(id, data);

    revalidatePath("/proveedores");
  });
}
