"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StockMovementType } from "@prisma/client";
import { STOCK_MOVEMENT_LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";

const FILTER_KEYS = ["dateFrom", "dateTo", "userId", "brandId", "movementType"] as const;

export function MovementFilters({
  users,
  brands,
}: {
  users: Array<{ id: string; firstName: string; lastName: string }>;
  brands: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const hasFilters = FILTER_KEYS.some((key) => searchParams.has(key));

  function apply(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    startTransition(() => router.push(`/movimientos?${params.toString()}`));
  }

  return (
    <div className="mb-5 rounded-[18px] border border-line-subtle bg-surface-raised p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5">
          <Label htmlFor="movementType">Tipo</Label>
          <Select
            id="movementType"
            value={searchParams.get("movementType") ?? ""}
            onChange={(event) => apply({ movementType: event.target.value })}
          >
            <option value="">Todos</option>
            {Object.values(StockMovementType).map((type) => (
              <option key={type} value={type}>
                {STOCK_MOVEMENT_LABELS[type]}
              </option>
            ))}
          </Select>
        </div>

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
          <Label htmlFor="brandId">Marca</Label>
          <Select
            id="brandId"
            value={searchParams.get("brandId") ?? ""}
            onChange={(event) => apply({ brandId: event.target.value })}
          >
            <option value="">Todas</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </Select>
        </div>

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

      {hasFilters ? (
        <div className="mt-4 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            loading={isPending}
            onClick={() => startTransition(() => router.push("/movimientos"))}
          >
            Limpiar filtros
          </Button>
        </div>
      ) : null}
    </div>
  );
}
