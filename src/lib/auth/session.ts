import { cache } from "react";
import { UserRole, UserStatus } from "@prisma/client";
import { auth } from "./index";
import { can, type Permission } from "./permissions";
import { errors } from "@/lib/errors";
import { prisma } from "@/lib/db";

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
}

/**
 * Usuario de la petición actual.
 *
 * El JWT se revalida contra la base en cada request. Es una consulta extra,
 * pero necesaria: sin ella, desactivar a un usuario o cambiarle el rol no
 * tendría efecto hasta que venciera su sesión (hasta 8 horas después), y un
 * usuario borrado seguiría operando con un id inexistente.
 *
 * `cache` la ejecuta una sola vez por request, compartida entre layout,
 * página y componentes del mismo render.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
    },
  });

  // La cuenta puede haberse desactivado o borrado después de emitir el token.
  if (!user || user.status !== UserStatus.ACTIVO) return null;

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`,
    // El rol se toma de la base, no del token: un cambio de rol surte efecto
    // en la siguiente petición.
    role: user.role,
    status: user.status,
  };
});

/// Exige una sesión válida. Lanza AppError si no la hay.
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw errors.noAutenticado();
  return user;
}

/// Exige una sesión con el permiso indicado. Esta es la barrera real:
/// toda operación del servidor pasa por acá, no por la UI.
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) {
    throw errors.sinPermisos();
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== UserRole.ADMINISTRADOR) {
    throw errors.sinPermisos("Esta acción es exclusiva de administradores.");
  }
  return user;
}
