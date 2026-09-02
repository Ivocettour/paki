import { z } from "zod";
import { UserRole, UserStatus } from "@prisma/client";
import { passwordSchema } from "./auth";

const nameField = (label: string) =>
  z
    .string()
    .trim()
    .min(2, { error: `El ${label} debe tener al menos 2 caracteres.` })
    .max(60, { error: "Máximo 60 caracteres." });

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Ingresá un email válido." }));

export const createUserSchema = z
  .object({
    firstName: nameField("nombre"),
    lastName: nameField("apellido"),
    email: emailField,
    role: z.enum(UserRole, { error: "Seleccioná un rol." }),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

/// La edición no toca la contraseña: para eso está el restablecimiento.
export const updateUserSchema = z.object({
  firstName: nameField("nombre"),
  lastName: nameField("apellido"),
  email: emailField,
  role: z.enum(UserRole, { error: "Seleccioná un rol." }),
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

/// Cambio de la propia contraseña: exige la actual como prueba de identidad.
export const changeOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { error: "Ingresá tu contraseña actual." }),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.password !== data.currentPassword, {
    error: "La contraseña nueva tiene que ser distinta de la actual.",
    path: ["password"],
  });

export const userFiltersSchema = z.object({
  search: z.string().trim().optional(),
  role: z.enum(UserRole).optional(),
  status: z.enum(UserStatus).optional(),
});

export type CreateUserInput = z.output<typeof createUserSchema>;
export type UpdateUserInput = z.output<typeof updateUserSchema>;
export type ResetPasswordInput = z.output<typeof resetPasswordSchema>;
export type ChangeOwnPasswordInput = z.output<typeof changeOwnPasswordSchema>;
export type UserFilters = z.output<typeof userFiltersSchema>;
