import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { error: "Ingresá tu email." })
    .pipe(z.email({ error: "Ingresá un email válido." })),
  password: z.string().min(1, { error: "Ingresá tu contraseña." }),
});

/// Política de contraseñas para alta y cambio de credenciales.
export const passwordSchema = z
  .string()
  .min(8, { error: "La contraseña debe tener al menos 8 caracteres." })
  .max(72, { error: "La contraseña no puede superar los 72 caracteres." })
  .regex(/[a-z]/, { error: "Debe incluir al menos una letra minúscula." })
  .regex(/[A-Z]/, { error: "Debe incluir al menos una letra mayúscula." })
  .regex(/\d/, { error: "Debe incluir al menos un número." });

export type LoginInput = z.infer<typeof loginSchema>;
