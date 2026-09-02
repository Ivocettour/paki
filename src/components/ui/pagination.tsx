"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";

export function Pagination({
  page,
  pageCount,
  total,
  basePath,
}: {
  page: number;
  pageCount: number;
  total: number;
  basePath: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function goTo(nextPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col items-center justify-between gap-3 px-5 py-3.5 sm:flex-row">
      <p className="text-[13px] text-fg-secondary">
        {total === 0 ? (
          "Sin resultados"
        ) : (
          <>
            Página <span className="font-medium text-fg">{page}</span> de {pageCount} ·{" "}
            <span className="font-medium text-fg">{total}</span>{" "}
            {total === 1 ? "resultado" : "resultados"}
          </>
        )}
      </p>

      {pageCount > 1 ? (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => goTo(page - 1)}
          >
            <ChevronLeft className="size-4" aria-hidden />
            Anterior
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => goTo(page + 1)}
          >
            Siguiente
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
