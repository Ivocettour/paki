"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { StockMovementType, InventoryStatus } from "@prisma/client";
import {
  REPORT_LABELS,
  REPORT_TYPES,
  type ReportType,
} from "@/lib/validations/report";
import { INVENTORY_STATUS_LABELS, STOCK_MOVEMENT_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";

interface FilterOptions {
  users: Array<{ id: string; firstName: string; lastName: string }>;
  brands: Array<{ id: string; name: string; models: Array<{ id: string; name: string }> }>;
}

/// Qué filtros tiene sentido mostrar en cada reporte.
const FILTERS_BY_REPORT: Record<
  ReportType,
  { dates: boolean; user: boolean; product: boolean; inventoryStatus: boolean; movementType: boolean }
> = {
  inventario: { dates: true, user: false, product: true, inventoryStatus: true, movementType: false },
  ventas: { dates: true, user: true, product: false, inventoryStatus: false, movementType: false },
  movimientos: { dates: true, user: true, product: true, inventoryStatus: false, movementType: true },
  "productos-vendidos": { dates: true, user: true, product: false, inventoryStatus: false, movementType: false },
  "stock-bajo": { dates: false, user: false, product: false, inventoryStatus: false, movementType: false },
};

export function ReportTabs({ active }: { active: ReportType }) {
  const searchParams = useSearchParams();

  return (
    <div
      className="mb-5 flex gap-1 overflow-x-auto rounded-full bg-surface-subtle p-1"
      role="tablist"
      aria-label="Tipo de reporte"
    >
      {REPORT_TYPES.map((type) => {
        // Al cambiar de reporte se conservan las fechas, que casi siempre aplican.
        const params = new URLSearchParams();
        params.set("type", type);
        for (const key of ["dateFrom", "dateTo"]) {
          const value = searchParams.get(key);
          if (value) params.set(key, value);
        }

        return (
          <Link
            key={type}
            href={`/reportes?${params.toString()}`}
            role="tab"
            aria-selected={type === active}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors",
              type === active
                ? "bg-surface-raised text-fg shadow-[0_1px_2px_rgb(0_0_0_/_0.06)]"
                : "text-fg-secondary hover:text-fg",
            )}
          >
            {REPORT_LABELS[type]}
          </Link>
        );
      })}
    </div>
  );
}

export function ReportFilters({
  type,
  options,
  canExport,
}: {
  type: ReportType;
  options: FilterOptions;
  canExport: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const visible = FILTERS_BY_REPORT[type];
  const hasAnyFilter = ["dateFrom", "dateTo", "userId", "brandId", "modelId", "inventoryStatus", "movementType"].some(
    (key) => searchParams.has(key),
  );

  function apply(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("type", type);

    for (const [key, value] of Object.entries(updates)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }

    startTransition(() => router.push(`/reportes?${params.toString()}`));
  }

  const selectedBrand = searchParams.get("brandId") ?? "";
  const models = selectedBrand
    ? (options.brands.find((brand) => brand.id === selectedBrand)?.models ?? [])
    : options.brands.flatMap((brand) => brand.models);

  // Solo el reporte de stock bajo no admite ningún filtro.
  const showsPanel =
    visible.dates || visible.user || visible.product || visible.inventoryStatus || visible.movementType;

  const exportHref = `/api/reportes?${(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("type", type);
    return params.toString();
  })()}`;

  return (
    <div className="mb-4 space-y-3">
      {showsPanel ? (
        <div className="rounded-[18px] border border-line-subtle bg-surface-raised p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {visible.dates ? (
              <>
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
              </>
            ) : null}

            {visible.user ? (
              <div className="space-y-1.5">
                <Label htmlFor="userId">Usuario</Label>
                <Select
                  id="userId"
                  value={searchParams.get("userId") ?? ""}
                  onChange={(event) => apply({ userId: event.target.value })}
                >
                  <option value="">Todos</option>
                  {options.users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.lastName}, {user.firstName}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            {visible.product ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="brandId">Marca</Label>
                  <Select
                    id="brandId"
                    value={selectedBrand}
                    onChange={(event) =>
                      apply({ brandId: event.target.value, modelId: undefined })
                    }
                  >
                    <option value="">Todas</option>
                    {options.brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="modelId">Modelo</Label>
                  <Select
                    id="modelId"
                    value={searchParams.get("modelId") ?? ""}
                    onChange={(event) => apply({ modelId: event.target.value })}
                  >
                    <option value="">Todos</option>
                    {models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </>
            ) : null}

            {visible.inventoryStatus ? (
              <div className="space-y-1.5">
                <Label htmlFor="inventoryStatus">Estado de inventario</Label>
                <Select
                  id="inventoryStatus"
                  value={searchParams.get("inventoryStatus") ?? ""}
                  onChange={(event) => apply({ inventoryStatus: event.target.value })}
                >
                  <option value="">Disponible (por defecto)</option>
                  {Object.values(InventoryStatus).map((status) => (
                    <option key={status} value={status}>
                      {INVENTORY_STATUS_LABELS[status]}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            {visible.movementType ? (
              <div className="space-y-1.5">
                <Label htmlFor="movementType">Tipo de movimiento</Label>
                <Select
                  id="movementType"
                  value={searchParams.get("movementType") ?? ""}
                  onChange={(event) => apply({ movementType: event.target.value })}
                >
                  <option value="">Todos</option>
                  {Object.values(StockMovementType).map((movementType) => (
                    <option key={movementType} value={movementType}>
                      {STOCK_MOVEMENT_LABELS[movementType]}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
          </div>

          {hasAnyFilter ? (
            <div className="mt-4 flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                loading={isPending}
                onClick={() =>
                  startTransition(() => router.push(`/reportes?type=${type}`))
                }
              >
                Limpiar filtros
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {canExport ? (
        <div className="flex justify-end">
          {/*
            La descarga va por una ruta propia que revalida el permiso: es
            accesible por URL y no puede confiar en que el botón esté oculto.
          */}
          <a href={exportHref} download>
            <Button variant="secondary">
              <Download className="size-4" aria-hidden />
              Exportar a CSV
            </Button>
          </a>
        </div>
      ) : null}
    </div>
  );
}
