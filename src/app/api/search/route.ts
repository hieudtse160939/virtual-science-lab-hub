import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decodeCursor, encodeCursor, parseSearchFilters } from "@/lib/search-params";
import { getSession, hasRole } from "@/server/auth";
import { handler, json, rateLimit } from "@/server/http";
import { logSearchQuery, searchSimulations } from "@/server/repositories/simulations";

/**
 * GET /api/search?q=&subject=&grade=&lang=&source=&type=&license=&duration=&free=1&verified=1&sort=&cursor=&limit=
 * Luôn phân trang (tối đa 60 bản ghi/lần) – không bao giờ trả về toàn bộ dữ liệu.
 */
export const GET = handler(async (request: NextRequest) => {
  rateLimit(request, "search", 120, 60_000);
  const params = request.nextUrl.searchParams;
  const filters = parseSearchFilters(params);
  const cursor = decodeCursor(params.get("cursor"));
  const limit = Math.min(Math.max(Number(params.get("limit")) || 24, 1), 60);
  const session = params.get("demo") === "1" ? await getSession() : null;
  const client = await createClient();

  const result = await searchSimulations(client, filters, cursor, {
    limit,
    withTotal: !cursor,
    includeDemo: hasRole(session?.profile, "admin"),
  });
  if (filters.q && !cursor) void logSearchQuery(client, filters.q, result.total ?? result.items.length);

  return json(
    {
      items: result.items,
      total: result.total,
      total_capped: result.totalCapped,
      relaxed: result.relaxed,
      sort: result.sort,
      next: encodeCursor(result.next),
    },
    { headers: { "cache-control": "private, max-age=30" } },
  );
});
