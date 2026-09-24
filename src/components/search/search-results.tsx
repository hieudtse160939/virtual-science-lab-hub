"use client";

import { Info, Loader2, SearchX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SimulationCard } from "@/components/simulation/simulation-card";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { SORT_OPTIONS } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/client";
import { format, formatNumber } from "@/lib/i18n/config";
import { serializeSearchFilters } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import type { SimulationCardData, SortOption } from "@/types/domain";
import { ActiveFilterChips, MobileFilterButton, type FilterPanelData } from "./filter-panel";
import { useSearchNav } from "./search-shell";

export interface InitialResults {
  items: SimulationCardData[];
  next: string | null;
  total: number | null;
  totalCapped: boolean;
  relaxed: boolean;
  sort: SortOption;
  error?: "timeout" | "generic" | null;
}

/** Tự động tải thêm khi cuộn tới cuối cho tới giới hạn này, sau đó cần bấm nút. */
const AUTO_LOAD_LIMIT = 240;

export function SearchResults({
  initial,
  filterData,
  includeDemo,
}: {
  initial: InitialResults;
  filterData: FilterPanelData;
  includeDemo?: boolean;
}) {
  const { t, locale } = useI18n();
  const { filters, patch, isPending } = useSearchNav();
  const [items, setItems] = useState(initial.items);
  const [next, setNext] = useState(initial.next);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  // Kết quả mới từ server khi bộ lọc thay đổi.
  useEffect(() => {
    setItems(initial.items);
    setNext(initial.next);
    setLoadError(null);
  }, [initial]);

  const loadMore = useCallback(async () => {
    if (!next || loading) return;
    setLoading(true);
    setLoadError(null);
    try {
      const params = serializeSearchFilters(filters);
      params.set("cursor", next);
      if (includeDemo) params.set("demo", "1");
      const res = await apiFetch<{ items: SimulationCardData[]; next: string | null }>(
        `/api/search?${params}`,
      );
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...res.items.filter((i) => !seen.has(i.id))];
      });
      setNext(res.next);
    } catch (err) {
      setLoadError(errorMessage(err, t));
    } finally {
      setLoading(false);
    }
  }, [next, loading, filters, includeDemo, t]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !next || items.length >= AUTO_LOAD_LIMIT || loadError) return;
    const observer = new IntersectionObserver((entries) => entries[0]?.isIntersecting && void loadMore(), {
      rootMargin: "600px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [next, items.length, loadMore, loadError]);

  const total = initial.total ?? items.length;
  const countLabel = initial.totalCapped
    ? format(t.search.resultsCountCapped, { n: formatNumber(10000, locale) })
    : format(t.search.resultsCount, { n: formatNumber(total, locale) });
  const sortOptions = filters.q ? SORT_OPTIONS : SORT_OPTIONS.filter((s) => s !== "relevance");

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm" role="status" aria-live="polite">
          <span className="text-foreground font-semibold">{countLabel}</span>
          {filters.q && <> {format(t.search.resultsFor, { q: filters.q })}</>}
        </p>
        <div className="flex items-center gap-2">
          <MobileFilterButton data={filterData} resultLabel={countLabel} />
          <label htmlFor="sort" className="sr-only">
            {t.search.sortLabel}
          </label>
          <NativeSelect
            id="sort"
            value={initial.sort}
            onChange={(e) => patch({ sort: e.target.value as SortOption })}
            className="h-10 w-auto min-w-40"
          >
            {sortOptions.map((s) => (
              <option key={s} value={s}>
                {t.search.sort[s]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <ActiveFilterChips data={filterData} />

      {initial.relaxed && items.length > 0 && (
        <p className="bg-warning-soft text-warning flex items-center gap-2 rounded-xl px-4 py-3 text-sm">
          <Info className="size-4 shrink-0" aria-hidden /> {t.search.relaxedNotice}
        </p>
      )}

      {initial.error ? (
        <EmptyState
          title={initial.error === "timeout" ? t.search.timeout : t.search.error}
          icon={<SearchX className="size-7" aria-hidden />}
        />
      ) : items.length === 0 ? (
        <EmptyState
          title={t.search.noResults}
          hint={t.search.noResultsHint}
          icon={<SearchX className="size-7" aria-hidden />}
        />
      ) : (
        <ul
          className={cn(
            "grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4",
            isPending && "pointer-events-none opacity-50",
          )}
          aria-busy={isPending}
        >
          {items.map((sim, i) => (
            // content-visibility: trình duyệt bỏ qua việc vẽ các thẻ ngoài màn hình (danh sách dài vẫn mượt).
            <li key={sim.id} className="[contain-intrinsic-size:auto_420px] [content-visibility:auto]">
              <SimulationCard sim={sim} priority={i < 3} />
            </li>
          ))}
        </ul>
      )}

      <div ref={sentinel} aria-hidden />
      {items.length > 0 && (
        <div className="flex flex-col items-center gap-2 py-6">
          {loadError && (
            <p role="alert" className="text-destructive text-sm">
              {loadError}
            </p>
          )}
          {next ? (
            <Button variant="outline" size="lg" onClick={() => void loadMore()} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="animate-spin" /> {t.search.loadingMore}
                </>
              ) : loadError ? (
                t.common.retry
              ) : (
                t.search.loadMore
              )}
            </Button>
          ) : (
            <p className="text-muted-foreground text-sm">{t.search.endOfResults}</p>
          )}
        </div>
      )}
    </div>
  );
}
