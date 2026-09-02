import {
  ListSkeleton,
  LoadingAnnouncer,
  PageHeaderSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <LoadingAnnouncer label="Cargando la auditoría" />
      <PageHeaderSkeleton />
      <Skeleton className="mb-5 h-48 w-full rounded-[18px]" />
      <ListSkeleton rows={8} />
    </>
  );
}
