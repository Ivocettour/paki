import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/// Paginación con enlaces reales: funciona sin JavaScript y los buscadores
/// pueden recorrer el catálogo.
export function StorePagination({
  basePath,
  params,
  page,
  pageCount,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;

  function href(target: number): string {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") query.set(key, value);
    }
    if (target > 1) query.set("page", String(target));
    const string = query.toString();
    return string ? `${basePath}?${string}` : basePath;
  }

  const linkClass =
    "inline-flex h-11 items-center gap-1.5 rounded-full border border-line bg-surface-raised px-5 text-[14px] font-medium text-fg hover:bg-surface-subtle";
  const disabledClass = "pointer-events-none opacity-40";

  return (
    <nav aria-label="Paginación" className="mt-10 flex items-center justify-center gap-4">
      <Link
        href={href(page - 1)}
        aria-disabled={page <= 1}
        tabIndex={page <= 1 ? -1 : undefined}
        rel="prev"
        className={cn(linkClass, page <= 1 && disabledClass)}
      >
        <ChevronLeft className="size-4" aria-hidden />
        Anterior
      </Link>

      <p className="text-[14px] text-fg-secondary">
        Página <span className="font-semibold text-fg">{page}</span> de {pageCount}
      </p>

      <Link
        href={href(page + 1)}
        aria-disabled={page >= pageCount}
        tabIndex={page >= pageCount ? -1 : undefined}
        rel="next"
        className={cn(linkClass, page >= pageCount && disabledClass)}
      >
        Siguiente
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </nav>
  );
}
