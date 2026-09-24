import { handler, json } from "@/server/http";
import { getCatalogCounts, getSubjects } from "@/server/repositories/catalog";

/** GET /api/subjects – danh sách môn học kèm số mô phỏng. */
export const GET = handler(async () => {
  const [subjects, counts] = await Promise.all([getSubjects(), getCatalogCounts()]);
  return json(
    subjects.map((s) => ({ ...s, simulation_count: counts.subjects[s.slug] ?? 0 })),
    { headers: { "cache-control": "public, s-maxage=600, stale-while-revalidate=3600" } },
  );
});
