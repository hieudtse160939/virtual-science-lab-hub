import type { NextRequest } from "next/server";
import { MAX_QUERY_LENGTH } from "@/lib/constants";
import { createPublicClient } from "@/lib/supabase/public";
import { handler, json, rateLimit } from "@/server/http";
import { getPopularQuerySuggestions, searchSimulations } from "@/server/repositories/simulations";

/** GET /api/search/suggest?q= – autocomplete: truy vấn phổ biến + 6 mô phỏng phù hợp nhất. */
export const GET = handler(async (request: NextRequest) => {
  rateLimit(request, "suggest", 240, 60_000);
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  if (q.length < 2) return json({ queries: [], simulations: [] });

  const client = createPublicClient();
  const [queries, result] = await Promise.all([
    getPopularQuerySuggestions(client, q, 4),
    searchSimulations(client, { q }, null, { limit: 6, withTotal: false }),
  ]);
  return json(
    {
      queries,
      simulations: result.items.map((s) => ({ slug: s.slug, title: s.title, subject: s.subject })),
    },
    { headers: { "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" } },
  );
});
