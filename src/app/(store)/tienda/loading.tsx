import { Container } from "@/components/store/store-ui";
import { LoadingAnnouncer, Skeleton } from "@/components/ui/skeleton";

/// Esqueleto de la tienda: reproduce la forma de una grilla de productos.
export default function TiendaLoading() {
  return (
    <Container className="py-10 sm:py-14">
      <LoadingAnnouncer label="Cargando la tienda" />
      <Skeleton className="h-12 w-72 max-w-full rounded-[12px]" />
      <Skeleton className="mt-4 h-5 w-96 max-w-full" />

      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="overflow-hidden rounded-[28px] bg-surface-raised">
            <Skeleton className="h-[260px] rounded-none" />
            <div className="space-y-3 p-6">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-4 h-7 w-28" />
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
}
