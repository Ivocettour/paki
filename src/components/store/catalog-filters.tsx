"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import type { DeviceCondition, DeviceType } from "@prisma/client";
import type { StoreFacets } from "@/lib/services/storefront";
import {
  DEVICE_CONDITION_LABELS,
  DEVICE_TYPE_LABELS,
  formatStorage,
} from "@/lib/constants";
import { STORE_SORT_LABELS, STORE_SORT_OPTIONS } from "@/lib/validations/storefront";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/field";

const FILTER_KEYS = ["brandId", "condition", "storageGb", "maxPrice"] as const;

/**
 * Filtros del catálogo. El estado vive en la URL: cada vista filtrada se puede
 * compartir, funciona con atrás/adelante y se renderiza en el servidor.
 */
export function CatalogFilters({
  facets,
  resultCount,
}: {
  facets: StoreFacets;
  resultCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const activeCount = FILTER_KEYS.filter((key) => searchParams.has(key)).length;
  const [open, setOpen] = useState(activeCount > 0);

  const appliedSearch = searchParams.get("search") ?? "";
  const currentType = searchParams.get("type") ?? "";

  function apply(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }

    // Cualquier cambio de filtro vuelve a la primera página.
    params.delete("page");

    startTransition(() => {
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  function clearAll() {
    startTransition(() => router.push(pathname, { scroll: false }));
  }

  const hasAnyFilter = activeCount > 0 || Boolean(appliedSearch) || Boolean(currentType);

  const selectClass = "h-11 text-[14px]";

  return (
    <div className={cn("space-y-4 transition-opacity", isPending && "opacity-60")} aria-busy={isPending}>
      {/* Tipo de producto, como pestañas. */}
      <div role="group" aria-label="Tipo de producto" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:px-0">
        <TypeChip active={!currentType} onClick={() => apply({ type: undefined })}>
          Todos
        </TypeChip>
        {facets.types.map(({ type, count }) => (
          <TypeChip
            key={type}
            active={currentType === type}
            onClick={() => apply({ type })}
            count={count}
          >
            {pluralType(type)}
          </TypeChip>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <form
          key={appliedSearch}
          role="search"
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
          <input
            name="search"
            type="search"
            defaultValue={appliedSearch}
            maxLength={80}
            placeholder="Buscar por marca, modelo o color"
            aria-label="Buscar en el catálogo"
            className="h-11 w-full rounded-[12px] border border-line bg-surface-raised pl-10 pr-10 text-[14px] text-fg placeholder:text-fg-tertiary"
          />
          {appliedSearch ? (
            <button
              type="button"
              onClick={() => apply({ search: undefined })}
              aria-label="Limpiar búsqueda"
              className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-fg-tertiary hover:text-fg"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </form>

        <div className="flex gap-3">
          <div className="relative min-w-0 flex-1 sm:w-48 sm:flex-none">
            <label htmlFor="sort" className="sr-only">
              Ordenar por
            </label>
            <Select
              id="sort"
              className={selectClass}
              value={searchParams.get("sort") ?? "recent"}
              onChange={(event) =>
                apply({ sort: event.target.value === "recent" ? undefined : event.target.value })
              }
            >
              {STORE_SORT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {STORE_SORT_LABELS[option]}
                </option>
              ))}
            </Select>
          </div>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="catalog-advanced"
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-line bg-surface-raised px-5 text-[14px] font-medium text-fg hover:bg-surface-subtle"
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            Filtros
            {activeCount > 0 ? (
              <span className="grid size-5 place-items-center rounded-full bg-accent text-[11px] font-semibold text-white">
                {activeCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {open ? (
        <div
          id="catalog-advanced"
          className="grid grid-cols-1 gap-4 rounded-[20px] bg-surface-raised p-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          <FilterSelect
            id="f-brand"
            label="Marca"
            value={searchParams.get("brandId") ?? ""}
            onChange={(value) => apply({ brandId: value })}
            options={facets.brands.map((brand) => ({
              value: brand.id,
              label: `${brand.name} (${brand.count})`,
            }))}
            className={selectClass}
          />

          <FilterSelect
            id="f-condition"
            label="Estado"
            value={searchParams.get("condition") ?? ""}
            onChange={(value) => apply({ condition: value })}
            options={facets.conditions.map(({ condition, count }) => ({
              value: condition,
              label: `${DEVICE_CONDITION_LABELS[condition as DeviceCondition]} (${count})`,
            }))}
            className={selectClass}
          />

          <FilterSelect
            id="f-storage"
            label="Almacenamiento"
            value={searchParams.get("storageGb") ?? ""}
            onChange={(value) => apply({ storageGb: value })}
            options={facets.storages.map((storage) => ({
              value: String(storage.gb),
              label: `${formatStorage(storage.gb)} (${storage.count})`,
            }))}
            className={selectClass}
          />

          <div className="space-y-1.5">
            <label htmlFor="f-max-price" className="block text-[13px] font-medium text-fg-secondary">
              Precio máximo
            </label>
            <input
              id="f-max-price"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="Sin límite"
              defaultValue={searchParams.get("maxPrice") ?? ""}
              key={searchParams.get("maxPrice") ?? ""}
              onBlur={(event) => {
                if (event.target.value !== (searchParams.get("maxPrice") ?? "")) {
                  apply({ maxPrice: event.target.value });
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className="h-11 w-full rounded-[12px] border border-line bg-surface-raised px-3.5 text-[14px] text-fg placeholder:text-fg-tertiary"
            />
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 text-[14px] text-fg-secondary" aria-live="polite">
        <p>
          <span className="font-semibold text-fg">{resultCount}</span>{" "}
          {resultCount === 1 ? "equipo disponible" : "equipos disponibles"}
        </p>
        {hasAnyFilter ? (
          <button type="button" onClick={clearAll} className="text-accent hover:underline">
            Limpiar filtros
          </button>
        ) : null}
      </div>
    </div>
  );
}

function pluralType(type: DeviceType): string {
  const plurals: Record<DeviceType, string> = {
    CELULAR: "Celulares",
    TABLET: "Tablets",
    RELOJ: "Relojes",
    PARLANTE: "Parlantes",
    CAMARA: "Cámaras",
    OTRO: DEVICE_TYPE_LABELS.OTRO,
  };
  return plurals[type];
}

function TypeChip({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-full px-4 py-2 text-[14px] font-medium transition-colors",
        active
          ? "bg-fg text-surface"
          : "bg-surface-raised text-fg-secondary hover:bg-black/5 hover:text-fg",
      )}
    >
      {children}
      {count !== undefined ? (
        <span className={cn("ml-1.5 text-[12px]", active ? "opacity-70" : "text-fg-tertiary")}>
          {count}
        </span>
      ) : null}
    </button>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium text-fg-secondary">
        {label}
      </label>
      <Select
        id={id}
        className={className}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
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
