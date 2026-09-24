import { SimulationGridSkeleton } from "@/components/simulation/simulation-card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SearchLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <Skeleton className="mb-4 h-9 w-64" />
      <Skeleton className="mb-6 h-11 w-full rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Skeleton className="hidden h-[600px] rounded-2xl lg:block" />
        <SimulationGridSkeleton count={9} />
      </div>
    </div>
  );
}
