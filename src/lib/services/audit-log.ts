import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/session";
import { PAGE_SIZE } from "@/lib/constants";
import type { AuditEntity, AuditFilters } from "@/lib/validations/audit";

export interface AuditEntryRow {
  id: string;
  action: string;
  entity: AuditEntity | string;
  entityId: string;
  createdAt: Date;
  userId: string;
  userName: string;
  userEmail: string;
  changes: Record<string, { anterior: unknown; nuevo: unknown }> | null;
}

function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function buildWhere(filters: AuditFilters): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.entity ? { entity: filters.entity } : {}),
    ...(filters.entityId ? { entityId: filters.entityId } : {}),
  };

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: endOfDay(filters.dateTo) } : {}),
    };
  }

  if (filters.search) {
    // La búsqueda libre cubre al usuario que hizo la operación y el id de la
    // entidad afectada, que es lo que se tiene a mano al investigar un caso.
    where.OR = [
      { entityId: { contains: filters.search } },
      { user: { firstName: { contains: filters.search, mode: "insensitive" } } },
      { user: { lastName: { contains: filters.search, mode: "insensitive" } } },
      { user: { email: { contains: filters.search, mode: "insensitive" } } },
    ];
  }

  return where;
}

/**
 * Registro de auditoría.
 *
 * Es solo de lectura: no existe forma de editar ni borrar entradas desde la
 * aplicación, por diseño.
 */
export async function listAuditLog(filters: AuditFilters, limit?: number) {
  await requirePermission("auditoria.ver");

  const where = buildWhere(filters);
  const take = limit ?? PAGE_SIZE;

  const [total, rows, byAction] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...(limit ? { take: limit } : { skip: (filters.page - 1) * PAGE_SIZE, take }),
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        changes: true,
        createdAt: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    }),
    prisma.auditLog.groupBy({ by: ["action"], where, _count: { _all: true } }),
  ]);

  return {
    items: rows.map<AuditEntryRow>((entry) => ({
      id: entry.id,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      createdAt: entry.createdAt,
      userId: entry.user.id,
      userName: `${entry.user.firstName} ${entry.user.lastName}`,
      userEmail: entry.user.email,
      changes: entry.changes as AuditEntryRow["changes"],
    })),
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    byAction: byAction
      .map((row) => ({ action: row.action, count: row._count._all }))
      .sort((a, b) => b.count - a.count),
  };
}

/// Usuarios que registraron alguna operación, para el filtro.
export async function getAuditUsers() {
  await requirePermission("auditoria.ver");

  return prisma.user.findMany({
    where: { auditLogs: { some: {} } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });
}
