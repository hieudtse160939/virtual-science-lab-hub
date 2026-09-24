import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { collectionInputSchema } from "@/lib/validation";
import { getSession, requireApiSession } from "@/server/auth";
import { handler, json, rateLimit, readJson } from "@/server/http";
import { CACHE_TAGS } from "@/server/repositories/catalog";
import {
  addCollectionItem,
  createCollection,
  listCollectionIdsContaining,
  listMyCollections,
  listPublicCollections,
} from "@/server/repositories/user-content";

/**
 * GET /api/collections
 *   ?scope=public            → bộ sưu tập công khai mới nhất
 *   (mặc định, cần đăng nhập) → bộ sưu tập của tôi; kèm ?simulation_id= để biết bộ nào đã chứa mô phỏng
 */
export const GET = handler(async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;
  if (params.get("scope") === "public") {
    const limit = Math.min(Math.max(Number(params.get("limit")) || 12, 1), 48);
    return json(await listPublicCollections(await createClient(), limit));
  }
  const session = await getSession();
  if (!session) return json({ error: "unauthorized" }, { status: 401 });
  const collections = await listMyCollections(session.supabase, session.user.id);
  const simulationId = params.get("simulation_id");
  if (simulationId && /^[0-9a-f-]{36}$/i.test(simulationId)) {
    const containing = new Set(
      await listCollectionIdsContaining(session.supabase, session.user.id, simulationId),
    );
    return json(collections.map((c) => ({ ...c, contains: containing.has(c.id) })));
  }
  return json(collections);
});

/** POST /api/collections { name, description?, is_public?, simulation_id? } – chỉ giáo viên/admin. */
export const POST = handler(async (request: Request) => {
  rateLimit(request, "collections", 30, 60_000);
  const { supabase, user } = await requireApiSession("teacher");
  const input = collectionInputSchema.parse(await readJson(request));
  const collection = await createCollection(supabase, user.id, input);
  if (input.simulation_id) await addCollectionItem(supabase, collection.id, input.simulation_id);
  if (collection.is_public) revalidateTag(CACHE_TAGS.collections);
  return json({ ...collection, item_count: input.simulation_id ? 1 : 0 }, { status: 201 });
});
