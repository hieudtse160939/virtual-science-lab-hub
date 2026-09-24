import type { NextRequest } from "next/server";
import { favoriteSchema } from "@/lib/validation";
import { requireApiSession } from "@/server/auth";
import { handler, json, rateLimit, readJson } from "@/server/http";
import {
  addFavorite,
  listFavoriteIds,
  listFavorites,
  removeFavorite,
} from "@/server/repositories/user-content";

/** GET /api/favorites – danh sách yêu thích (?only=ids chỉ trả id; ?page= phân trang). */
export const GET = handler(async (request: NextRequest) => {
  const { supabase, user } = await requireApiSession();
  if (request.nextUrl.searchParams.get("only") === "ids") {
    return json(
      { ids: await listFavoriteIds(supabase, user.id) },
      { headers: { "cache-control": "private, no-store" } },
    );
  }
  const page = Math.max(Number(request.nextUrl.searchParams.get("page")) || 0, 0);
  return json(await listFavorites(supabase, user.id, page));
});

/** POST /api/favorites { simulation_id } */
export const POST = handler(async (request: Request) => {
  rateLimit(request, "favorites", 60, 60_000);
  const { supabase, user } = await requireApiSession();
  const { simulation_id } = favoriteSchema.parse(await readJson(request));
  await addFavorite(supabase, user.id, simulation_id);
  return json({ ok: true }, { status: 201 });
});

/** DELETE /api/favorites { simulation_id } */
export const DELETE = handler(async (request: Request) => {
  rateLimit(request, "favorites", 60, 60_000);
  const { supabase, user } = await requireApiSession();
  const { simulation_id } = favoriteSchema.parse(await readJson(request));
  await removeFavorite(supabase, user.id, simulation_id);
  return json({ ok: true });
});
