"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const SHOW = [
  { value: "sin_responder", label: "Sin responder" },
  { value: "todas", label: "Todas" },
] as const;

const WHO = [
  { value: "todos", label: "De todos" },
  { value: "mias", label: "Mías" },
  { value: "sin_asignar", label: "Sin asignar" },
] as const;

/// Filtros de la bandeja. El estado vive en la URL: se pueden compartir y
/// sobreviven a la navegación.
export function InboxFilters({ seesAll }: { seesAll: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const show = searchParams.get("show") ?? "sin_responder";
  const who = searchParams.get("who") ?? "todos";

  function apply(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    params.delete("page");
    startTransition(() => router.push(`/consultas?${params.toString()}`));
  }

  return (
    <div className={cn("mb-5 flex flex-wrap items-center gap-x-6 gap-y-3", isPending && "opacity-60")}>
      <Segmented label="Mostrar" options={SHOW} value={show} onChange={(v) => apply("show", v)} />
      {seesAll ? (
        <Segmented label="De quién" options={WHO} value={who} onChange={(v) => apply("who", v)} />
      ) : null}
    </div>
  );
}

function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <span className="text-[13px] text-fg-secondary">{label}</span>
      <div className="inline-flex rounded-full bg-surface-subtle p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              value === option.value
                ? "bg-surface-raised text-fg shadow-sm"
                : "text-fg-secondary hover:text-fg",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
