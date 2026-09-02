import {
  LoadingAnnouncer,
  PageHeaderSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <LoadingAnnouncer label="Cargando la configuración" />
      <PageHeaderSkeleton withAction />
      <Skeleton className="mb-4 h-16 w-full rounded-[18px]" />
      <div className="space-y-4">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-52 w-full rounded-[18px]" />
        ))}
      </div>
    </>
  );
}
