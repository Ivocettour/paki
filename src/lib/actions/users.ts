"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { UserStatus } from "@prisma/client";
import {
  changeOwnPasswordSchema,
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
} from "@/lib/validations/user";
import {
  changeOwnPassword,
  createUser,
  resetUserPassword,
  setUserStatus,
  updateUser,
} from "@/lib/services/users";
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

export async function createUserAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const data = parseOrThrow(createUserSchema, input);
    const user = await createUser(data);

    revalidatePath("/usuarios");
    return user;
  });
}

export async function updateUserAction(
  id: string,
  input: unknown,
): Promise<ActionResult<void>> {
  return runAction(async () => {
    const data = parseOrThrow(updateUserSchema, input);
    await updateUser(id, data);

    revalidatePath("/usuarios");
  });
}

export async function setUserStatusAction(
  id: string,
  status: UserStatus,
): Promise<ActionResult<void>> {
  return runAction(async () => {
    await setUserStatus(id, status);
    revalidatePath("/usuarios");
  });
}

export async function resetPasswordAction(
  id: string,
  input: unknown,
): Promise<ActionResult<void>> {
  return runAction(async () => {
    const data = parseOrThrow(resetPasswordSchema, input);
    await resetUserPassword(id, data);

    revalidatePath("/usuarios");
  });
}

export async function changeOwnPasswordAction(input: unknown): Promise<ActionResult<void>> {
  return runAction(async () => {
    const data = parseOrThrow(changeOwnPasswordSchema, input);
    await changeOwnPassword(data);
  });
}
