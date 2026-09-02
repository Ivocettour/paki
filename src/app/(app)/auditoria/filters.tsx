"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Search, X } from "lucide-react";
import { AuditAction } from "@prisma/client";
import { AUDIT_ENTITIES, AUDIT_ENTITY_LABELS } from "@/lib/validations/audit";
import { AUDIT_ACTION_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";

const FILTER_KEYS = [
  "search",
  "userId",
  "action",
  "entity",
  "entityId",
  "dateFrom",
  "dateTo",
] as const;

export function AuditFilters({
  users,
  canExport,
}: {
  users: Array<{ id: string; firstName: string; lastName: string }>;
  canExport: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const applied = searchParams.get("search") ?? "";
  const entityId = searchParams.get("entityId");
  const hasFilters = FILTER_KEYS.some((key) => searchParams.has(key));

  function apply(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    params.delete("page");
    startTransition(() => router.push(`/auditoria?${params.toString()}`));
  }

  return (
    <div className="mb-5 space-y-3">
      {/* Cuando se llega filtrando por una entidad concreta, conviene decirlo. */}
      {entityId ? (
        <div className="flex items-center justify-between gap-3 rounded-[12px] bg-accent-soft px-4 py-2.5 text-[13px] text-accent">
          <span>Mostrando solo el historial de un registro puntual.</span>
          <button
            type="button"
            onClick={() => apply({ entityId: undefined })}
            className="font-medium hover:underline"
          >
            Ver todo
          </button>
        </div>
      ) : null}

      <div className="rounded-[18px] border border-line-subtle bg-surface-raised p-5">
        <form
          key={applied}
          className="relative mb-4"
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get("search");
            apply({ search: typeof value === "string" ? value.trim() : undefined });
          }}
        >
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary"
            aria-hidden
          />
          <Input
            name="search"
            defaultValue={applied}
            placeholder="Buscar por usuario o ID del registro afectado…"
            aria-label="Buscar en la auditoría"
            className="pl-10 pr-10"
          />
          {applied ? (
            <button
              type="button"
              onClick={() => apply({ search: undefined })}
              aria-label="Limpiar búsqueda"
              className="absolute right-1 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-fg-tertiary hover:text-fg"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </form>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="userId">Usuario</Label>
            <Select
              id="userId"
              value={searchParams.get("userId") ?? ""}
              onChange={(event) => apply({ userId: event.target.value })}
            >
              <option value="">Todos</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.lastName}, {user.firstName}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="action">Acción</Label>
            <Select
              id="action"
              value={searchParams.get("action") ?? ""}
              onChange={(event) => apply({ action: event.target.value })}
            >
              <option value="">Todas</option>
              {Object.values(AuditAction).map((action) => (
                <option key={action} value={action}>
                  {AUDIT_ACTION_LABELS[action]}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="entity">Tipo de registro</Label>
            <Select
              id="entity"
              value={searchParams.get("entity") ?? ""}
              onChange={(event) => apply({ entity: event.target.value })}
            >
              <option value="">Todos</option>
              {AUDIT_ENTITIES.map((entity) => (
                <option key={entity} value={entity}>
                  {AUDIT_ENTITY_LABELS[entity]}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dateFrom">Desde</Label>
              <Input
                id="dateFrom"
                type="date"
                defaultValue={searchParams.get("dateFrom") ?? ""}
                onChange={(event) => apply({ dateFrom: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dateTo">Hasta</Label>
              <Input
                id="dateTo"
                type="date"
                defaultValue={searchParams.get("dateTo") ?? ""}
                onChange={(event) => apply({ dateTo: event.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          {hasFilters ? (
            <Button
              variant="ghost"
              size="sm"
              loading={isPending}
              onClick={() => startTransition(() => router.push("/auditoria"))}
            >
              Limpiar filtros
            </Button>
          ) : null}

          {canExport ? (
            // Exporta respetando los filtros aplicados.
            <a href={`/api/auditoria?${searchParams.toString()}`} download>
              <Button variant="secondary" size="sm">
                <Download className="size-4" aria-hidden />
                Exportar a CSV
              </Button>
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
