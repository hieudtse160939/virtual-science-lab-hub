"use client";

import { AlertTriangle, Inbox, RotateCcw } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  hint,
  icon,
  action,
  className,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-14 text-center",
        className,
      )}
    >
      <div className="bg-muted text-muted-foreground mb-4 flex size-14 items-center justify-center rounded-2xl">
        {icon ?? <Inbox className="size-7" aria-hidden />}
      </div>
      <p className="text-base font-semibold">{title}</p>
      {hint && <p className="text-muted-foreground mt-1 max-w-md text-sm">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Nội dung dùng chung cho error.tsx (Error Boundary của Next.js). */
export function ErrorFallback({ reset, digest }: { reset: () => void; digest?: string }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
      <div className="bg-destructive/10 text-destructive mb-4 flex size-14 items-center justify-center rounded-2xl">
        <AlertTriangle className="size-7" aria-hidden />
      </div>
      <h1 className="text-xl font-bold">{t.errors.boundaryTitle}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{t.errors.boundaryHint}</p>
      {digest && <p className="text-muted-foreground mt-2 font-mono text-xs">#{digest}</p>}
      <div className="mt-6 flex gap-2">
        <Button onClick={reset}>
          <RotateCcw /> {t.common.retry}
        </Button>
        <Button asChild variant="outline">
          <Link href="/">{t.errors.goHome}</Link>
        </Button>
      </div>
    </div>
  );
}
