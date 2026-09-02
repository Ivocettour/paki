import {
  LoadingAnnouncer,
  PageHeaderSkeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";

/// Carga del dashboard, que es la ruta raíz de este grupo.
export default function Loading() {
  return (
    <>
      <LoadingAnnouncer label="Cargando el dashboard" />
      <PageHeaderSkeleton />
      <StatCardsSkeleton />
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TableSkeleton rows={3} columns={2} />
        <TableSkeleton rows={3} columns={2} />
      </div>
    </>
  );
}
