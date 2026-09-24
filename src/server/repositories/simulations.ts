import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { PAGE_SIZE } from "@/lib/constants";
import { createPublicClient } from "@/lib/supabase/public";
import type {
  SearchCursor,
  SearchFilters,
  SearchResult,
  SimulationCardData,
  SimulationDetail,
  SortOption,
} from "@/types/domain";
import { toHttpError } from "../http";
import { CACHE_TAGS } from "./catalog";

/** Cột cần cho thẻ mô phỏng khi đọc trực tiếp bảng (favorites, collection items…). */
export const CARD_SELECT = `
  id, slug, title, short_description, grade_min, grade_max, language, simulation_type,
  license_category, difficulty, duration_minutes, is_free, is_verified, is_featured, is_demo,
  thumbnail_url, simulation_url, embed_url, view_count, favorite_count, created_at,
  subject:subjects(slug, name, name_vi, icon, color),
  source:sources(slug, name, allows_embed)
`;

export interface SearchOptions {
  limit?: number;
  withTotal?: boolean;
  includeDemo?: boolean;
}

interface RpcSearchResponse {
  items: (SimulationCardData & { _sort_value?: string | null; _score?: number })[];
  total: number | null;
  total_capped: boolean;
  next: SearchCursor | null;
  relaxed: boolean;
  sort: SortOption;
}

/** Tìm kiếm + lọc hoàn toàn phía server (RPC search_simulations). */
export async function searchSimulations(
  client: SupabaseClient,
  filters: SearchFilters,
  cursor: SearchCursor | null = null,
  options: SearchOptions = {},
): Promise<SearchResult> {
  const { data, error } = await client.rpc("search_simulations", {
    p_query: filters.q ?? null,
    p_subjects: filters.subjects ?? null,
    p_levels: filters.levels ?? null,
    p_grades: filters.grades ?? null,
    p_languages: filters.languages ?? null,
    p_sources: filters.sources ?? null,
    p_types: filters.types ?? null,
    p_licenses: filters.licenses ?? null,
    p_durations: filters.durations ?? null,
    p_free_only: filters.freeOnly ?? false,
    p_verified_only: filters.verifiedOnly ?? false,
    p_sort: filters.sort ?? "relevance",
    p_limit: options.limit ?? PAGE_SIZE,
    p_offset: cursor?.offset ?? 0,
    p_cursor_value: cursor?.value ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_with_total: options.withTotal ?? !cursor,
    p_include_demo: options.includeDemo ?? false,
    p_relaxed: cursor?.relaxed ?? false,
  });
  if (error) throw toHttpError(error);
  const res = data as RpcSearchResponse;
  return {
    items: res.items.map(({ _sort_value: _v, _score: _s, ...item }) => item),
    total: res.total,
    totalCapped: res.total_capped,
    next: res.next,
    relaxed: res.relaxed,
    sort: res.sort,
  };
}

/** Phiên bản cache cho dữ liệu công khai (trang chủ, trang tìm kiếm không có người dùng cụ thể). */
export const searchPublicCached = unstable_cache(
  async (filters: SearchFilters, limit: number) =>
    searchSimulations(createPublicClient(), filters, null, { limit, withTotal: false }),
  ["search-public"],
  { revalidate: 300, tags: [CACHE_TAGS.simulations] },
);

const DETAIL_SELECT = `
  *,
  subject:subjects(slug, name, name_vi, icon, color),
  source_full:sources(id, name, slug, website_url, license, license_url, allows_embed, is_verified)
`;

function mapDetail(row: Record<string, unknown>): SimulationDetail {
  const src = row.source_full as SimulationDetail["source_full"];
  const { url_key: _u, search_text: _s, search_vector: _v, title_search: _t, ...rest } = row;
  return {
    ...(rest as unknown as SimulationDetail),
    source: src ? { slug: src.slug, name: src.name, allows_embed: src.allows_embed } : null,
  };
}

export const getSimulationBySlug = unstable_cache(
  async (slug: string): Promise<SimulationDetail | null> => {
    const { data, error } = await createPublicClient()
      .from("simulations")
      .select(DETAIL_SELECT)
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw toHttpError(error);
    return data ? mapDetail(data) : null;
  },
  ["simulation-by-slug"],
  { revalidate: 600, tags: [CACHE_TAGS.simulations] },
);

export async function getSimulationById(
  client: SupabaseClient,
  id: string,
): Promise<SimulationDetail | null> {
  const { data, error } = await client.from("simulations").select(DETAIL_SELECT).eq("id", id).maybeSingle();
  if (error) throw toHttpError(error);
  return data ? mapDetail(data) : null;
}

export async function getRelatedSimulations(sim: SimulationDetail, limit = 8): Promise<SimulationCardData[]> {
  const filters: SearchFilters = {
    q: sim.topic ?? undefined,
    subjects: sim.subject ? [sim.subject.slug] : undefined,
    sort: sim.topic ? "relevance" : "popular",
  };
  const result = await searchPublicCached(filters, limit + 1);
  return result.items.filter((s) => s.id !== sim.id).slice(0, limit);
}

export function mapCardRow(row: Record<string, unknown>): SimulationCardData {
  return row as unknown as SimulationCardData;
}

export async function trackSimulationEvent(
  client: SupabaseClient,
  simulationId: string,
  event: "view" | "external_open" | "embed_open",
  collectionId?: string | null,
) {
  const { error } = await client.rpc("track_simulation_event", {
    p_simulation_id: simulationId,
    p_event: event,
    p_collection_id: collectionId ?? null,
  });
  if (error) throw toHttpError(error);
}

export async function logSearchQuery(client: SupabaseClient, query: string, resultCount: number) {
  const { error } = await client.rpc("log_search_query", { p_query: query, p_result_count: resultCount });
  if (error) console.warn("[search] log failed", error.message);
}

export async function getPopularQuerySuggestions(client: SupabaseClient, prefix: string, limit = 5) {
  const { data, error } = await client.rpc("popular_query_suggestions", { p_prefix: prefix, p_limit: limit });
  if (error) return [];
  return ((data ?? []) as { query: string }[]).map((r) => r.query);
}

// ---- Sitemap ----
export const SITEMAP_CHUNK = 40_000;

export const countPublishedSimulations = unstable_cache(
  async () => {
    const { count, error } = await createPublicClient()
      .from("simulations")
      .select("id", { count: "estimated", head: true })
      .eq("is_active", true)
      .eq("status", "published")
      .eq("is_demo", false);
    if (error) throw toHttpError(error);
    return count ?? 0;
  },
  ["sitemap-count"],
  { revalidate: 3600, tags: [CACHE_TAGS.simulations] },
);

export async function listSitemapSimulations(chunk: number) {
  // Mỗi sitemap con tối đa SITEMAP_CHUNK URL, đọc theo trang 1000 dòng (sitemap được cache 1 giờ).
  const client = createPublicClient();
  const out: { slug: string; updated_at: string }[] = [];
  const pageSize = 1000;
  let from = chunk * SITEMAP_CHUNK;
  const to = from + SITEMAP_CHUNK;
  while (from < to) {
    const { data, error } = await client
      .from("simulations")
      .select("slug, updated_at")
      .eq("is_active", true)
      .eq("status", "published")
      .eq("is_demo", false)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, Math.min(from + pageSize, to) - 1);
    if (error) throw toHttpError(error);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}
