import { handler, json } from "@/server/http";
import { getGrades } from "@/server/repositories/catalog";

/** GET /api/grades – khối lớp 1–12 và cấp học. */
export const GET = handler(async () =>
  json(await getGrades(), {
    headers: { "cache-control": "public, s-maxage=86400, stale-while-revalidate=86400" },
  }),
);
