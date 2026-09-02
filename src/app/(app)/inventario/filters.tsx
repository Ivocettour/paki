"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { DeviceCondition, InventoryStatus } from "@prisma/client";
import type { Catalog } from "@/lib/services/devices";
import {
  DEVICE_CONDITION_LABELS,
  INVENTORY_STATUS_LABELS,
  STORAGE_OPTIONS_GB,
  formatStorage,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";

/// Filtros del inventario. El estado vive en la URL para que las vistas
/// filtradas sean compartibles y sobrevivan a la navegación.
export function InventoryFilters({ catalog }: { catalog: Catalog }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [showAdvanced, setShowAdvanced] = useState(() =>
    ADVANCED_KEYS.some((key) => searchParams.has(key)),
  );

  // La URL es la única fuente de verdad. El input queda no controlado y se
  // remonta vía `key` cuando cambia la búsqueda aplicada, de modo que la
  // navegación con atrás/adelante lo sincroniza sin efectos ni estado espejo.
  const appliedSearch = searchParams.get("search") ?? "";

  function apply(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === "") params.delete(key);
      else params.set(key, value);
    }

    // Cualquier cambio de filtro vuelve a la primera página.
    params.delete("page");

    startTransition(() => {
      router.push(`/inventario?${params.toString()}`);
    });
  }

  const selectedBrandId = searchParams.get("brandId") ?? "";
  const modelsForBrand = selectedBrandId
    ? (catalog.find((brand) => brand.id === selectedBrandId)?.models ?? [])
    : catalog.flatMap((brand) => brand.models);

  const activeCount = ADVANCED_KEYS.filter((key) => searchParams.has(key)).length;

  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <form
          key={appliedSearch}
          className="relative flex-1"
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
            defaultValue={appliedSearch}
            placeholder="Buscar por IMEI, número de serie, marca, modelo o color…"
            aria-label="Buscar en el inventario"
            className="pl-10 pr-10"
          />
          {appliedSearch ? (
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

        <Button
          type="button"
          variant="secondary"
          onClick={() => setShowAdvanced((value) => !value)}
          aria-expanded={showAdvanced}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Filtros
          {activeCount > 0 ? (
            <span className="ml-1 grid size-5 place-items-center rounded-full bg-accent text-[11px] font-semibold text-white">
              {activeCount}
            </span>
          ) : null}
        </Button>
      </div>

      {showAdvanced ? (
        <div className="rounded-[18px] border border-line-subtle bg-surface-raised p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect
              label="Marca"
              value={selectedBrandId}
              onChange={(value) => apply({ brandId: value, modelId: undefined })}
              options={catalog.map((brand) => ({ value: brand.id, label: brand.name }))}
            />

            <FilterSelect
              label="Modelo"
              value={searchParams.get("modelId") ?? ""}
              onChange={(value) => apply({ modelId: value })}
              options={modelsForBrand.map((model) => ({ value: model.id, label: model.name }))}
            />

            <FilterSelect
              label="Estado de inventario"
              value={searchParams.get("inventoryStatus") ?? ""}
              onChange={(value) => apply({ inventoryStatus: value })}
              options={Object.values(InventoryStatus).map((status) => ({
                value: status,
                label: INVENTORY_STATUS_LABELS[status],
              }))}
            />

            <FilterSelect
              label="Estado del equipo"
              value={searchParams.get("condition") ?? ""}
              onChange={(value) => apply({ condition: value })}
              options={Object.values(DeviceCondition).map((condition) => ({
                value: condition,
                label: DEVICE_CONDITION_LABELS[condition],
              }))}
            />

            <FilterSelect
              label="Capacidad"
              value={searchParams.get("storageGb") ?? ""}
              onChange={(value) => apply({ storageGb: value })}
              options={STORAGE_OPTIONS_GB.map((gb) => ({
                value: String(gb),
                label: formatStorage(gb),
              }))}
            />

            <div className="space-y-1.5">
              <Label htmlFor="minPrice">Precio desde</Label>
              <Input
                id="minPrice"
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={searchParams.get("minPrice") ?? ""}
                onBlur={(event) => apply({ minPrice: event.target.value })}
                placeholder="0"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="maxPrice">Precio hasta</Label>
              <Input
                id="maxPrice"
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={searchParams.get("maxPrice") ?? ""}
                onBlur={(event) => apply({ maxPrice: event.target.value })}
                placeholder="Sin límite"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="minBattery">Batería mínima (%)</Label>
              <Input
                id="minBattery"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                defaultValue={searchParams.get("minBattery") ?? ""}
                onBlur={(event) => apply({ minBattery: event.target.value })}
                placeholder="0"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="entryDateFrom">Ingreso desde</Label>
              <Input
                id="entryDateFrom"
                type="date"
                defaultValue={searchParams.get("entryDateFrom") ?? ""}
                onChange={(event) => apply({ entryDateFrom: event.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="entryDateTo">Ingreso hasta</Label>
              <Input
                id="entryDateTo"
                type="date"
                defaultValue={searchParams.get("entryDateTo") ?? ""}
                onChange={(event) => apply({ entryDateTo: event.target.value })}
              />
            </div>
          </div>

          {activeCount > 0 ? (
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                loading={isPending}
                onClick={() => {
                  const params = new URLSearchParams();
                  const term = searchParams.get("search");
                  if (term) params.set("search", term);
                  startTransition(() => router.push(`/inventario?${params.toString()}`));
                }}
              >
                Limpiar filtros
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const ADVANCED_KEYS = [
  "brandId",
  "modelId",
  "inventoryStatus",
  "condition",
  "storageGb",
  "minPrice",
  "maxPrice",
  "minBattery",
  "entryDateFrom",
  "entryDateTo",
] as const;

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  const id = `filtro-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
