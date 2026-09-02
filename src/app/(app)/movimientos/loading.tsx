import {
  FiltersSkeleton,
  LoadingAnnouncer,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <LoadingAnnouncer label="Cargando los movimientos" />
      <PageHeaderSkeleton withAction={false} />
      <FiltersSkeleton />
      <TableSkeleton columns={6} />
    </>
  );
}
