"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { PurchaseStatus } from "@prisma/client";
import { PURCHASE_STATUS_LABELS } from "@/lib/constants";
import { Input, Label, Select } from "@/components/ui/field";

export function PurchaseFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const applied = searchParams.get("search") ?? "";

  function apply(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    params.delete("page");
    startTransition(() => router.push(`/compras?${params.toString()}`));
  }

  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end">
      <form
        key={applied}
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
          defaultValue={applied}
          placeholder="Buscar por comprobante o proveedor…"
          aria-label="Buscar compras"
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

      <div className="w-full sm:w-52">
        <Label htmlFor="statusFilter">Estado</Label>
        <Select
          id="statusFilter"
          className="mt-1.5"
          value={searchParams.get("status") ?? ""}
          onChange={(event) => apply({ status: event.target.value })}
        >
          <option value="">Todos</option>
          {Object.values(PurchaseStatus).map((status) => (
            <option key={status} value={status}>
              {PURCHASE_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
