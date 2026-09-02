import {
  LoadingAnnouncer,
  PageHeaderSkeleton,
  Skeleton,
  StatCardsSkeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <LoadingAnnouncer label="Cargando las cuotas" />
      <PageHeaderSkeleton />
      <StatCardsSkeleton count={3} />
      <Skeleton className="mt-6 h-10 w-full max-w-md rounded-full" />
      <div className="mt-4">
        <TableSkeleton columns={7} />
      </div>
    </>
  );
}
