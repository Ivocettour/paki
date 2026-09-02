import { cn } from "@/lib/utils";

/**
 * Bloques de carga.
 *
 * Reproducen la forma de la pantalla que está por aparecer, para que el salto
 * al contenido real sea mínimo. La animación se desactiva sola con
 * `prefers-reduced-motion` (regla global en globals.css).
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-[8px] bg-surface-subtle", className)}
      aria-hidden
    />
  );
}

/// Encabezado de página: título y bajada.
export function PageHeaderSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2.5">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {withAction ? <Skeleton className="h-10 w-40 rounded-full" /> : null}
    </div>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="rounded-[18px] border border-line-subtle bg-surface-raised p-5"
        >
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="mt-3.5 h-8 w-20" />
          <Skeleton className="mt-3 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

/// Tabla con encabezado y filas, dentro de su tarjeta.
export function TableSkeleton({
  rows = 8,
  columns = 6,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-line-subtle bg-surface-raised">
      <div className="flex gap-4 border-b border-line-subtle px-4 py-3">
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={index} className="h-3 flex-1" />
        ))}
      </div>

      {Array.from({ length: rows }, (_, rowIndex) => (
        <div
          key={rowIndex}
          className="flex items-center gap-4 border-b border-line-subtle px-4 py-4 last:border-0"
        >
          {Array.from({ length: columns }, (_, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={cn("h-4 flex-1", columnIndex === 0 && "max-w-[220px]")}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function FiltersSkeleton() {
  return (
    <div className="mb-5 space-y-3">
      <Skeleton className="h-10 w-full rounded-[12px]" />
    </div>
  );
}

/// Lista de tarjetas apiladas, como el registro de auditoría.
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-line-subtle bg-surface-raised">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex items-start gap-3.5 border-b border-line-subtle px-5 py-4 last:border-0"
        >
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
          <Skeleton className="h-3 w-24 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/// Aviso accesible de que la pantalla está cargando.
export function LoadingAnnouncer({ label }: { label: string }) {
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {label}
    </span>
  );
}
