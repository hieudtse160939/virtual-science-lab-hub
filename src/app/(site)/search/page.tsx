import type { Metadata } from "next";
import { Suspense } from "react";
import { FilterSidebar, type FilterPanelData } from "@/components/search/filter-panel";
import { SearchBox } from "@/components/search/search-box";
import { SearchResults, type InitialResults } from "@/components/search/search-results";
import { SearchShell } from "@/components/search/search-shell";
import { EmptyState } from "@/components/states";
import { isSupabaseConfigured } from "@/lib/env";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { countActiveFilters, encodeCursor, parseSearchFilters } from "@/lib/search-params";
import { getSession, hasRole } from "@/server/auth";
import { HttpError } from "@/server/http";
import { getCatalogCounts, getSources, getSubjects } from "@/server/repositories/catalog";
import { logSearchQuery, searchSimulations } from "@/server/repositories/simulations";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { t } = await getI18n();
  const filters = parseSearchFilters(await searchParams);
  const title = filters.q ? `${filters.q} – ${t.search.title}` : t.search.title;
  const filtered = !!filters.q || countActiveFilters(filters) > 0;
  return {
    title,
    alternates: { canonical: "/search" },
    // Trang kết quả có từ khóa/bộ lọc không cần lập chỉ mục (tránh trùng lặp nội dung).
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function SearchPage({ searchParams }: Props) {
  const { t } = await getI18n();
  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <EmptyState title={t.errors.notConfigured} />
      </div>
    );
  }
  const raw = await searchParams;
  const filters = parseSearchFilters(raw);
  const session = await getSession();
  const includeDemo = raw.demo === "1" && hasRole(session?.profile, "admin");

  const [subjects, sources, counts] = await Promise.all([getSubjects(), getSources(), getCatalogCounts()]);
  const filterData: FilterPanelData = {
    subjects: subjects.map(({ slug, name, name_vi }) => ({ slug, name, name_vi })),
    sources: sources.map(({ slug, name, is_verified }) => ({ slug, name, is_verified })),
    subjectCounts: counts.subjects,
    sourceCounts: counts.sources,
  };

  let initial: InitialResults;
  try {
    const client = await createClient();
    const result = await searchSimulations(client, filters, null, { includeDemo, withTotal: true });
    initial = {
      items: result.items,
      next: encodeCursor(result.next),
      total: result.total,
      totalCapped: result.totalCapped,
      relaxed: result.relaxed,
      sort: result.sort,
    };
    if (filters.q) void logSearchQuery(client, filters.q, result.total ?? result.items.length);
  } catch (err) {
    initial = {
      items: [],
      next: null,
      total: 0,
      totalCapped: false,
      relaxed: false,
      sort: filters.sort ?? "relevance",
      error: err instanceof HttpError && err.code === "timeout" ? "timeout" : "generic",
    };
  }

  return (
    <SearchShell filters={filters} extraParams={includeDemo ? { demo: "1" } : undefined}>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 space-y-4">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.search.title}</h1>
          <Suspense>
            <SearchBox variant="page" defaultValue={filters.q ?? ""} preserveFilters />
          </Suspense>
        </div>
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <FilterSidebar data={filterData} />
          <SearchResults initial={initial} filterData={filterData} includeDemo={includeDemo} />
        </div>
      </div>
    </SearchShell>
  );
}
