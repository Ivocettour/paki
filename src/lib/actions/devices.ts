"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createDeviceSchema,
  deactivateDeviceSchema,
  updateDeviceSchema,
} from "@/lib/validations/device";
import { createDevice, deactivateDevice, updateDevice } from "@/lib/services/devices";
import { errors } from "@/lib/errors";
import { runAction, type ActionResult } from "./types";

/// Convierte los errores de Zod al formato de campos del formulario.
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

export async function createDeviceAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const data = parseOrThrow(createDeviceSchema, input);
    const device = await createDevice(data);

    revalidatePath("/inventario");
    revalidatePath("/");
    return device;
  });
}

export async function updateDeviceAction(
  id: string,
  input: unknown,
): Promise<ActionResult<void>> {
  return runAction(async () => {
    const data = parseOrThrow(updateDeviceSchema, input);
    await updateDevice(id, data);

    revalidatePath("/inventario");
    revalidatePath(`/inventario/${id}`);
    revalidatePath("/");
  });
}

export async function deactivateDeviceAction(
  id: string,
  input: unknown,
): Promise<ActionResult<void>> {
  return runAction(async () => {
    const data = parseOrThrow(deactivateDeviceSchema, input);
    await deactivateDevice(id, data);

    revalidatePath("/inventario");
    revalidatePath(`/inventario/${id}`);
    revalidatePath("/");
  });
}
