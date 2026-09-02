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
      <LoadingAnnouncer label="Generando el reporte" />
      <PageHeaderSkeleton />
      <Skeleton className="mb-5 h-10 w-full max-w-2xl rounded-full" />
      <Skeleton className="mb-4 h-32 w-full rounded-[18px]" />
      <StatCardsSkeleton />
      <div className="mt-4">
        <TableSkeleton columns={7} />
      </div>
    </>
  );
}
