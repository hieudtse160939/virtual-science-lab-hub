import { handler, json } from "@/server/http";
import { getCatalogCounts, getSources } from "@/server/repositories/catalog";

/** GET /api/sources – các nguồn đang hoạt động kèm số mô phỏng. */
export const GET = handler(async () => {
  const [sources, counts] = await Promise.all([getSources(), getCatalogCounts()]);
  return json(
    sources.map((s) => ({ ...s, simulation_count: counts.sources[s.slug] ?? 0 })),
    { headers: { "cache-control": "public, s-maxage=600, stale-while-revalidate=3600" } },
  );
});
