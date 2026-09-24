import { Loader2 } from "lucide-react";

export default function LabLoading() {
  return (
    <div className="flex h-dvh flex-col">
      <div className="bg-card h-14 border-b" />
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="text-muted-foreground size-8 animate-spin" aria-hidden />
      </div>
    </div>
  );
}
