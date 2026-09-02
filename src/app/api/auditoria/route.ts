import { NextRequest } from "next/server";
import { AUDIT_ENTITY_LABELS, auditFiltersSchema } from "@/lib/validations/audit";
import type { AuditEntity } from "@/lib/validations/audit";
import { AUDIT_ACTION_LABELS } from "@/lib/constants";
import { buildCsv, csvFileName, csvResponse, type CsvColumn } from "@/lib/csv";
import { requirePermission } from "@/lib/auth/session";
import { toUserMessage } from "@/lib/errors";
import { listAuditLog, type AuditEntryRow } from "@/lib/services/audit-log";
import type { AuditAction } from "@prisma/client";

/// Tope de la exportación: el registro de auditoría crece sin límite y el
/// archivo tiene que seguir siendo manejable.
const EXPORT_LIMIT = 10_000;

/// Aplana los cambios a una celda legible: "Precio de venta: 800000 → 850000".
function formatChanges(entry: AuditEntryRow): string {
  if (!entry.changes) return "";

  return Object.entries(entry.changes)
    .map(([field, change]) => {
      const previous = change.anterior ?? "—";
      const next = change.nuevo ?? "—";
      return change.anterior === null || change.anterior === undefined
        ? `${field}: ${next}`
        : `${field}: ${previous} → ${next}`;
    })
    .join(" | ");
}

const COLUMNS: CsvColumn<AuditEntryRow>[] = [
  { header: "Fecha", value: (row) => row.createdAt },
  { header: "Usuario", value: (row) => row.userName },
  { header: "Email", value: (row) => row.userEmail },
  {
    header: "Acción",
    value: (row) => AUDIT_ACTION_LABELS[row.action as AuditAction] ?? row.action,
  },
  {
    header: "Tipo de registro",
    value: (row) => AUDIT_ENTITY_LABELS[row.entity as AuditEntity] ?? row.entity,
  },
  { header: "ID del registro", value: (row) => row.entityId },
  { header: "Cambios", value: formatChanges },
];

/**
 * Exportación del registro de auditoría.
 *
 * Como toda ruta accesible por URL, revalida el permiso por su cuenta.
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission("auditoria.ver");
    await requirePermission("reportes.exportar");

    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = auditFiltersSchema.safeParse(params);

    if (!parsed.success) {
      return Response.json({ error: "Los filtros no son válidos." }, { status: 400 });
    }

    const result = await listAuditLog(parsed.data, EXPORT_LIMIT);

    return csvResponse(buildCsv(result.items, COLUMNS), csvFileName("auditoria"));
  } catch (error) {
    const { message, code } = toUserMessage(error);
    const status = code === "NO_AUTENTICADO" ? 401 : code === "SIN_PERMISOS" ? 403 : 500;
    return Response.json({ error: message }, { status });
  }
}
