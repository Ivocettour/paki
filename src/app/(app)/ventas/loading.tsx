import {
  FiltersSkeleton,
  LoadingAnnouncer,
  PageHeaderSkeleton,
  TableSkeleton,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <LoadingAnnouncer label="Cargando las ventas" />
      <PageHeaderSkeleton withAction={true} />
      <FiltersSkeleton />
      <TableSkeleton columns={7} />
    </>
  );
}
