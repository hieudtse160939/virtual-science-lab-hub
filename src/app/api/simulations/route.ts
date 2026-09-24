import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decodeCursor, encodeCursor, parseSearchFilters } from "@/lib/search-params";
import { handler, json, rateLimit } from "@/server/http";
import { searchSimulations } from "@/server/repositories/simulations";

/**
 * GET /api/simulations – duyệt danh sách có bộ lọc (không cần từ khóa), phân trang bằng cursor.
 * Tham số giống /api/search; mặc định sắp xếp theo độ phổ biến.
 */
export const GET = handler(async (request: NextRequest) => {
  rateLimit(request, "simulations", 120, 60_000);
  const params = request.nextUrl.searchParams;
  const filters = parseSearchFilters(params);
  filters.sort ??= filters.q ? "relevance" : "popular";
  const limit = Math.min(Math.max(Number(params.get("limit")) || 24, 1), 60);
  const cursor = decodeCursor(params.get("cursor"));
  const result = await searchSimulations(await createClient(), filters, cursor, {
    limit,
    withTotal: !cursor,
  });
  return json({
    items: result.items,
    total: result.total,
    total_capped: result.totalCapped,
    next: encodeCursor(result.next),
  });
});
