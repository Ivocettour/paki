"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cancelSaleSchema, createSaleSchema } from "@/lib/validations/sale";
import { cancelSale, createSale } from "@/lib/services/sales";
import { searchAvailableDevices } from "@/lib/services/devices";
import { searchCustomers } from "@/lib/services/customers";
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

export async function createSaleAction(
  input: unknown,
): Promise<ActionResult<{ id: string; saleNumber: string }>> {
  return runAction(async () => {
    const data = parseOrThrow(createSaleSchema, input);
    const sale = await createSale(data);

    revalidatePath("/ventas");
    revalidatePath("/inventario");
    revalidatePath("/cuotas");
    revalidatePath("/");
    return sale;
  });
}

export async function cancelSaleAction(
  id: string,
  input: unknown,
): Promise<ActionResult<void>> {
  return runAction(async () => {
    const data = parseOrThrow(cancelSaleSchema, input);
    await cancelSale(id, data);

    revalidatePath("/ventas");
    revalidatePath(`/ventas/${id}`);
    revalidatePath("/inventario");
    revalidatePath("/cuotas");
    revalidatePath("/");
  });
}

/// Búsqueda de equipos disponibles para el formulario de venta.
export async function searchDevicesAction(term: string) {
  return runAction(async () => {
    await requirePermission("ventas.registrar");
    return searchAvailableDevices(term);
  });
}

/// Búsqueda de clientes para el formulario de venta.
export async function searchCustomersAction(term: string) {
  return runAction(async () => searchCustomers(term));
}
