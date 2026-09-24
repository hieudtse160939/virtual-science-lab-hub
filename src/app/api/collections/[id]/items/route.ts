import { revalidateTag } from "next/cache";
import { collectionItemsSchema } from "@/lib/validation";
import { requireApiSession } from "@/server/auth";
import { handler, HttpError, json, rateLimit, readJson } from "@/server/http";
import { CACHE_TAGS } from "@/server/repositories/catalog";
import {
  addCollectionItem,
  getCollectionById,
  removeCollectionItem,
  reorderCollectionItems,
  updateCollectionItem,
} from "@/server/repositories/user-content";

/**
 * POST /api/collections/[id]/items
 *   { action: "add", simulation_id, note? } | { action: "remove", simulation_id }
 *   { action: "note", simulation_id, note } | { action: "reorder", order: [simulation_id...] }
 */
export const POST = handler(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  rateLimit(request, "collection-items", 120, 60_000);
  const { id } = await params;
  const { supabase, user } = await requireApiSession("teacher");
  const collection = await getCollectionById(supabase, id);
  if (!collection) throw new HttpError(404, "not_found");
  if (collection.owner_id !== user.id) throw new HttpError(403, "forbidden");

  const body = collectionItemsSchema.parse(await readJson(request));
  switch (body.action) {
    case "add":
      await addCollectionItem(supabase, id, body.simulation_id, body.note);
      break;
    case "remove":
      await removeCollectionItem(supabase, id, body.simulation_id);
      break;
    case "note":
      await updateCollectionItem(supabase, id, body.simulation_id, { note: body.note ?? null });
      break;
    case "reorder":
      await reorderCollectionItems(supabase, id, body.order);
      break;
  }
  if (collection.is_public) revalidateTag(CACHE_TAGS.collections);
  return json({ ok: true });
});
