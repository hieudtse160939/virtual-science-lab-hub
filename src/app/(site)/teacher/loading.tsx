import { SimulationGridSkeleton } from "@/components/simulation/simulation-card";
import { Skeleton } from "@/components/ui/skeleton";

export default function TeacherLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="h-11 w-96 max-w-full rounded-xl" />
      <SimulationGridSkeleton count={4} />
    </div>
  );
}
