"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useTransition, type ReactNode } from "react";
import { serializeSearchFilters } from "@/lib/search-params";
import type { SearchFilters } from "@/types/domain";

interface SearchNav {
  filters: SearchFilters;
  isPending: boolean;
  setFilters: (next: SearchFilters) => void;
  patch: (patch: Partial<SearchFilters>) => void;
}

const SearchNavContext = createContext<SearchNav | null>(null);

export function useSearchNav() {
  const ctx = useContext(SearchNavContext);
  if (!ctx) throw new Error("useSearchNav phải nằm trong SearchShell");
  return ctx;
}

/** Bộ lọc là "nguồn sự thật" trên URL → có thể chia sẻ/đánh dấu trang; server render lại kết quả. */
export function SearchShell({
  filters,
  extraParams,
  children,
}: {
  filters: SearchFilters;
  extraParams?: Record<string, string>;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const setFilters = useCallback(
    (next: SearchFilters) => {
      const params = serializeSearchFilters(next);
      for (const [k, v] of Object.entries(extraParams ?? {})) params.set(k, v);
      startTransition(() =>
        router.replace(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false }),
      );
    },
    [router, pathname, extraParams],
  );

  const patch = useCallback(
    (p: Partial<SearchFilters>) => setFilters({ ...filters, ...p }),
    [filters, setFilters],
  );

  return (
    <SearchNavContext.Provider value={{ filters, isPending, setFilters, patch }}>
      {children}
    </SearchNavContext.Provider>
  );
}
