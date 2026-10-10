"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LEAD_SOURCE_LABELS } from "@/lib/constants";
import { Label, Select } from "@/components/ui/field";

/// Filtros del tablero. Viven en la URL, como en el resto de las pantallas.
export function BoardFilters({
  seesAll,
  people,
}: {
  seesAll: boolean;
  people: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function apply(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => router.push(`/seguimiento?${params.toString()}`));
  }

  return (
    <div className={"mb-4 flex flex-wrap items-end gap-4" + (isPending ? " opacity-60" : "")}>
      {seesAll ? (
        <div className="space-y-1.5">
          <Label htmlFor="b-assignee">Responsable</Label>
          <Select
            id="b-assignee"
            value={searchParams.get("assignee") ?? ""}
            onChange={(event) => apply("assignee", event.target.value)}
            className="min-w-[12rem]"
          >
            <option value="">Todos</option>
            <option value="mias">Mías</option>
            <option value="sin_asignar">Sin asignar</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="b-source">Origen</Label>
        <Select
          id="b-source"
          value={searchParams.get("source") ?? ""}
          onChange={(event) => apply("source", event.target.value)}
          className="min-w-[10rem]"
        >
          <option value="">Todos</option>
          {Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
