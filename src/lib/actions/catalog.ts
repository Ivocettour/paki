"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { brandSchema, deviceModelSchema } from "@/lib/validations/catalog";
import {
  createBrand,
  createDeviceModel,
  deleteBrand,
  deleteDeviceModel,
  updateBrand,
  updateDeviceModel,
} from "@/lib/services/catalog";
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

/// El catálogo alimenta los formularios de inventario y compras.
function revalidateCatalog() {
  revalidatePath("/configuracion");
  revalidatePath("/inventario");
  revalidatePath("/inventario/nuevo");
  revalidatePath("/compras/nueva");
  revalidatePath("/");
}

export async function createBrandAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const brand = await createBrand(parseOrThrow(brandSchema, input));
    revalidateCatalog();
    return brand;
  });
}

export async function updateBrandAction(
  id: string,
  input: unknown,
): Promise<ActionResult<void>> {
  return runAction(async () => {
    await updateBrand(id, parseOrThrow(brandSchema, input));
    revalidateCatalog();
  });
}

export async function deleteBrandAction(id: string): Promise<ActionResult<void>> {
  return runAction(async () => {
    await deleteBrand(id);
    revalidateCatalog();
  });
}

export async function createModelAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const model = await createDeviceModel(parseOrThrow(deviceModelSchema, input));
    revalidateCatalog();
    return model;
  });
}

export async function updateModelAction(
  id: string,
  input: unknown,
): Promise<ActionResult<void>> {
  return runAction(async () => {
    await updateDeviceModel(id, parseOrThrow(deviceModelSchema, input));
    revalidateCatalog();
  });
}

export async function deleteModelAction(id: string): Promise<ActionResult<void>> {
  return runAction(async () => {
    await deleteDeviceModel(id);
    revalidateCatalog();
  });
}
