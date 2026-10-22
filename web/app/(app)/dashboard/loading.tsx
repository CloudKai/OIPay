import { Skeleton } from "@/components/ui/feedback";

export default function DashboardLoading() {
  return (
    <div className="space-y-7">
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
