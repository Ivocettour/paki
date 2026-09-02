import type { AuditAction, Prisma, PrismaClient } from "@prisma/client";

/// Cliente Prisma o transacción en curso: la auditoría siempre debe poder
/// escribirse dentro de la misma transacción que la operación que registra.
export type DbClient = PrismaClient | Prisma.TransactionClient;

export interface FieldChange {
  anterior: unknown;
  nuevo: unknown;
}

export type AuditChanges = Record<string, FieldChange>;

/// Compara dos versiones de una entidad y devuelve solo los campos que
/// cambiaron, con su valor anterior y nuevo.
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  fields: readonly (keyof T)[],
): AuditChanges {
  const changes: AuditChanges = {};

  for (const field of fields) {
    if (!(field in after)) continue;

    const previous = normalize(before[field]);
    const next = normalize(after[field]);

    if (previous !== next) {
      changes[String(field)] = { anterior: previous, nuevo: next };
    }
  }

  return changes;
}

/// Normaliza a un valor comparable y serializable en JSON.
function normalize(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "toNumber" in value) {
    // Prisma.Decimal
    return (value as { toNumber: () => number }).toNumber();
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

export async function recordAudit(
  db: DbClient,
  entry: {
    userId: string;
    action: AuditAction;
    entity: string;
    entityId: string;
    changes?: AuditChanges | Record<string, unknown>;
  },
): Promise<void> {
  await db.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      changes:
        entry.changes && Object.keys(entry.changes).length > 0
          ? (entry.changes as Prisma.InputJsonValue)
          : undefined,
    },
  });
}
