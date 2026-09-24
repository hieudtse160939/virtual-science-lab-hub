"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/states";

export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <ErrorFallback reset={reset} digest={error.digest} />;
}
