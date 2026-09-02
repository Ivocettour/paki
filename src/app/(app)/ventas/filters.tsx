"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { FinancingType, PaymentMethod, SaleStatus } from "@prisma/client";
import {
  FINANCING_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  SALE_STATUS_LABELS,
} from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";

/// El estado de los filtros vive en la URL: las vistas quedan compartibles.
export function SaleFilters({ seesAll: _seesAll }: { seesAll: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const appliedSearch = searchParams.get("search") ?? "";
  const hasFilters = ["status", "paymentMethod", "financingType", "dateFrom", "dateTo"].some(
    (key) => searchParams.has(key),
  );

  function apply(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    params.delete("page");
    startTransition(() => router.push(`/ventas?${params.toString()}`));
  }

  return (
    <div className="mb-5 space-y-3">
      <form
        key={appliedSearch}
        className="relative"
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
          placeholder="Buscar por comprobante, cliente, DNI o IMEI…"
          aria-label="Buscar ventas"
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

      <div className="rounded-[18px] border border-line-subtle bg-surface-raised p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FilterSelect
            label="Estado"
            value={searchParams.get("status") ?? ""}
            onChange={(value) => apply({ status: value })}
            options={Object.values(SaleStatus).map((status) => ({
              value: status,
              label: SALE_STATUS_LABELS[status],
            }))}
          />

          <FilterSelect
            label="Método de pago"
            value={searchParams.get("paymentMethod") ?? ""}
            onChange={(value) => apply({ paymentMethod: value })}
            options={Object.values(PaymentMethod).map((method) => ({
              value: method,
              label: PAYMENT_METHOD_LABELS[method],
            }))}
          />

          <FilterSelect
            label="Financiación"
            value={searchParams.get("financingType") ?? ""}
            onChange={(value) => apply({ financingType: value })}
            options={Object.values(FinancingType).map((type) => ({
              value: type,
              label: FINANCING_TYPE_LABELS[type],
            }))}
          />

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

        {hasFilters ? (
          <div className="mt-4 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              loading={isPending}
              onClick={() => {
                const params = new URLSearchParams();
                if (appliedSearch) params.set("search", appliedSearch);
                startTransition(() => router.push(`/ventas?${params.toString()}`));
              }}
            >
              Limpiar filtros
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

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
  const id = `venta-filtro-${label.toLowerCase().replace(/\s+/g, "-")}`;

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
