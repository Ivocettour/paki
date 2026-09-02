import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { auditFiltersSchema, AUDIT_ENTITY_LABELS, AUDIT_ENTITY_PATHS } from "@/lib/validations/audit";
import type { AuditEntity } from "@/lib/validations/audit";
import { getAuditUsers, listAuditLog } from "@/lib/services/audit-log";
import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { Card, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { ChangeList } from "@/components/change-list";
import { AUDIT_ACTION_LABELS } from "@/lib/constants";
import { formatDateTime, initials } from "@/lib/utils";
import { AuditFilters } from "./filters";
import type { AuditAction } from "@prisma/client";

export const metadata = { title: "Auditoría" };

/// Las acciones que revierten o dan de baja algo se destacan en rojo.
const DESTRUCTIVE_ACTIONS = new Set<string>([
  "BAJA_PRODUCTO",
  "ANULAR_VENTA",
  "DESACTIVAR_USUARIO",
  "ANULAR_PAGO_CUOTA",
  "ANULAR_COMPRA",
  "BAJA_ACCESORIO",
]);

const PRICE_ACTIONS = new Set<string>(["MODIFICAR_PRECIO"]);

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!can(user?.role, "auditoria.ver")) redirect("/");

  const params = await searchParams;
  const parsed = auditFiltersSchema.safeParse(params);
  const filters = parsed.success ? parsed.data : auditFiltersSchema.parse({});

  const [result, users] = await Promise.all([listAuditLog(filters), getAuditUsers()]);

  return (
    <>
      <PageHeader
        title="Auditoría"
        description="Quién hizo qué y cuándo. El registro es de solo lectura: no se edita ni se borra."
      />

      <AuditFilters users={users} canExport={can(user?.role, "reportes.exportar")} />

      {result.byAction.length > 0 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {result.byAction.slice(0, 8).map((row) => (
            <Badge key={row.action} tone="neutral">
              {AUDIT_ACTION_LABELS[row.action as AuditAction]}: {row.count}
            </Badge>
          ))}
        </div>
      ) : null}

      <Card className="overflow-hidden">
        {result.items.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No hay registros que coincidan"
            description="Probá ajustando los filtros o el rango de fechas."
          />
        ) : (
          <>
            <ul className="divide-y divide-line-subtle">
              {result.items.map((entry) => {
                const entityLabel =
                  AUDIT_ENTITY_LABELS[entry.entity as AuditEntity] ?? entry.entity;
                const basePath = AUDIT_ENTITY_PATHS[entry.entity as AuditEntity];

                return (
                  <li key={entry.id} className="px-5 py-4">
                    <div className="flex items-start gap-3.5">
                      <span
                        className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-surface-subtle text-[11px] font-semibold text-fg-secondary"
                        aria-hidden
                      >
                        {initials(
                          entry.userName.split(" ")[0] ?? "?",
                          entry.userName.split(" ")[1] ?? "?",
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-[14px] font-medium text-fg">
                            {entry.userName}
                          </span>
                          <Badge
                            tone={
                              DESTRUCTIVE_ACTIONS.has(entry.action)
                                ? "danger"
                                : PRICE_ACTIONS.has(entry.action)
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {AUDIT_ACTION_LABELS[entry.action as AuditAction] ??
                              entry.action}
                          </Badge>
                          <span className="text-[13px] text-fg-tertiary">
                            {entityLabel}
                          </span>
                          {basePath ? (
                            <Link
                              href={`${basePath}/${entry.entityId}`}
                              className="text-[12px] text-accent hover:underline"
                            >
                              ver ficha
                            </Link>
                          ) : null}
                        </div>

                        <div className="mt-1.5">
                          <ChangeList changes={entry.changes} />
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-[12px] text-fg-secondary">
                          {formatDateTime(entry.createdAt)}
                        </p>
                        <p className="tabular text-[11px] text-fg-tertiary">
                          {entry.entityId.slice(-8)}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <Pagination
              page={result.page}
              pageCount={result.pageCount}
              total={result.total}
              basePath="/auditoria"
            />
          </>
        )}
      </Card>
    </>
  );
}
