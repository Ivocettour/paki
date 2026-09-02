import { Prisma, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requirePermission, requireUser } from "@/lib/auth/session";
import { errors } from "@/lib/errors";
import { diffFields, recordAudit, type DbClient } from "./audit";
import type {
  ChangeOwnPasswordInput,
  CreateUserInput,
  ResetPasswordInput,
  UpdateUserInput,
  UserFilters,
} from "@/lib/validations/user";

/// Coste de bcrypt. Alto a propósito: encarece un ataque por fuerza bruta.
const BCRYPT_ROUNDS = 12;

const AUDITED_FIELDS = ["firstName", "lastName", "email", "role"] as const;

function translateUniqueEmailError(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    String(error.meta?.target ?? "").includes("email")
  ) {
    throw errors.conflicto("Ya existe un usuario registrado con ese email.");
  }
  throw error;
}

export interface UserListItem {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
  /// Operaciones registradas a su nombre: si tiene, jamás se elimina.
  activity: { sales: number; devices: number; movements: number };
  isSelf: boolean;
}

export async function listUsers(filters: UserFilters) {
  const currentUser = await requirePermission("usuarios.ver");

  const where: Prisma.UserWhereInput = {
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };

  if (filters.search) {
    where.OR = [
      { firstName: { contains: filters.search, mode: "insensitive" } },
      { lastName: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.user.findMany({
    where,
    orderBy: [{ status: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      _count: {
        select: { sales: true, devicesCreated: true, stockMovements: true },
      },
    },
  });

  const activeAdmins = rows.filter(
    (user) => user.role === UserRole.ADMINISTRADOR && user.status === UserStatus.ACTIVO,
  ).length;

  return {
    items: rows.map<UserListItem>((user) => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      activity: {
        sales: user._count.sales,
        devices: user._count.devicesCreated,
        movements: user._count.stockMovements,
      },
      isSelf: user.id === currentUser.id,
    })),
    total: rows.length,
    /// La interfaz lo usa para avisar cuando queda un solo administrador.
    activeAdmins,
  };
}

/**
 * Cuenta los administradores activos DISTINTOS del indicado.
 *
 * Es la guarda contra dejar el sistema sin nadie que pueda administrarlo.
 */
async function otherActiveAdminsCount(db: DbClient, excludingUserId: string): Promise<number> {
  return db.user.count({
    where: {
      id: { not: excludingUserId },
      role: UserRole.ADMINISTRADOR,
      status: UserStatus.ACTIVO,
    },
  });
}

export async function createUser(input: CreateUserInput): Promise<{ id: string }> {
  const currentUser = await requirePermission("usuarios.crear");

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          role: input.role,
          passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
        },
        select: { id: true },
      });

      await recordAudit(tx, {
        userId: currentUser.id,
        action: "CREAR_USUARIO",
        entity: "User",
        entityId: user.id,
        // Nunca se registra la contraseña, ni siquiera hasheada.
        changes: {
          email: { anterior: null, nuevo: input.email },
          rol: { anterior: null, nuevo: input.role },
        },
      });

      return user;
    });
  } catch (error) {
    translateUniqueEmailError(error);
  }
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<void> {
  const currentUser = await requirePermission("usuarios.editar");

  const current = await prisma.user.findUnique({
    where: { id },
    select: { id: true, firstName: true, lastName: true, email: true, role: true, status: true },
  });

  if (!current) throw errors.noEncontrado("el usuario");

  const losesAdmin =
    current.role === UserRole.ADMINISTRADOR && input.role !== UserRole.ADMINISTRADOR;

  if (losesAdmin) {
    // Nadie puede quitarse a sí mismo el rol de administrador: se quedaría
    // sin acceso a esta misma pantalla en la petición siguiente.
    if (current.id === currentUser.id) {
      throw errors.regla(
        "No podés quitarte a vos mismo el rol de administrador. Pedíselo a otro administrador.",
      );
    }

    if (current.status === UserStatus.ACTIVO) {
      const remaining = await otherActiveAdminsCount(prisma, id);
      if (remaining === 0) {
        throw errors.regla(
          "Es el único administrador activo. Designá otro antes de cambiarle el rol.",
        );
      }
    }
  }

  const changes = diffFields(current, input, AUDITED_FIELDS);
  if (Object.keys(changes).length === 0) return;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          role: input.role,
        },
      });

      await recordAudit(tx, {
        userId: currentUser.id,
        action: "MODIFICAR_USUARIO",
        entity: "User",
        entityId: id,
        changes,
      });
    });
  } catch (error) {
    translateUniqueEmailError(error);
  }
}

/**
 * Activa o desactiva un usuario.
 *
 * Los usuarios NUNCA se eliminan: sus ventas, altas de productos y movimientos
 * tienen que seguir siendo atribuibles. Desactivar solo le impide entrar.
 */
export async function setUserStatus(id: string, status: UserStatus): Promise<void> {
  const currentUser = await requirePermission("usuarios.desactivar");

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, firstName: true, lastName: true, role: true, status: true },
  });

  if (!target) throw errors.noEncontrado("el usuario");

  if (target.status === status) {
    throw errors.regla(
      status === UserStatus.ACTIVO
        ? "Este usuario ya está activo."
        : "Este usuario ya está desactivado.",
    );
  }

  if (status === UserStatus.INACTIVO) {
    // Desactivarse a uno mismo deja al usuario fuera en el acto, porque la
    // sesión se revalida contra la base en cada petición.
    if (target.id === currentUser.id) {
      throw errors.regla("No podés desactivar tu propia cuenta.");
    }

    if (target.role === UserRole.ADMINISTRADOR) {
      const remaining = await otherActiveAdminsCount(prisma, id);
      if (remaining === 0) {
        throw errors.regla(
          "Es el único administrador activo. Si lo desactivás, nadie podría administrar el sistema.",
        );
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { status } });

    await recordAudit(tx, {
      userId: currentUser.id,
      action: status === UserStatus.INACTIVO ? "DESACTIVAR_USUARIO" : "MODIFICAR_USUARIO",
      entity: "User",
      entityId: id,
      changes: { estado: { anterior: target.status, nuevo: status } },
    });
  });
}

/// Restablece la contraseña de otro usuario. Exclusivo de administradores.
export async function resetUserPassword(
  id: string,
  input: ResetPasswordInput,
): Promise<void> {
  const currentUser = await requirePermission("usuarios.editar");

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!target) throw errors.noEncontrado("el usuario");

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS) },
    });

    // Se deja constancia del hecho, nunca del valor.
    await recordAudit(tx, {
      userId: currentUser.id,
      action: "MODIFICAR_USUARIO",
      entity: "User",
      entityId: id,
      changes: { contraseña: { anterior: null, nuevo: "restablecida" } },
    });
  });
}

/// Cambio de la propia contraseña, verificando la actual.
export async function changeOwnPassword(input: ChangeOwnPasswordInput): Promise<void> {
  const currentUser = await requireUser();

  const user = await prisma.user.findUnique({
    where: { id: currentUser.id },
    select: { id: true, passwordHash: true },
  });

  if (!user) throw errors.noEncontrado("el usuario");

  const matches = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!matches) {
    throw errors.validacion("La contraseña actual no es correcta.", {
      currentPassword: ["La contraseña actual no es correcta."],
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS) },
    });

    await recordAudit(tx, {
      userId: user.id,
      action: "MODIFICAR_USUARIO",
      entity: "User",
      entityId: user.id,
      changes: { contraseña: { anterior: null, nuevo: "cambiada por el propio usuario" } },
    });
  });
}
