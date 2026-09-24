import { revalidateTag } from "next/cache";
import { collectionPatchSchema } from "@/lib/validation";
import { requireApiSession } from "@/server/auth";
import { handler, HttpError, json, readJson } from "@/server/http";
import { CACHE_TAGS } from "@/server/repositories/catalog";
import { deleteCollection, getCollectionById, updateCollection } from "@/server/repositories/user-content";

type Ctx = { params: Promise<{ id: string }> };

async function ownCollection(id: string) {
  const session = await requireApiSession("teacher");
  const collection = await getCollectionById(session.supabase, id);
  if (!collection) throw new HttpError(404, "not_found");
  if (collection.owner_id !== session.user.id && session.profile.role !== "admin")
    throw new HttpError(403, "forbidden");
  return { session, collection };
}

/** PATCH /api/collections/[id] { name?, description?, is_public? } */
export const PATCH = handler(async (request: Request, { params }: Ctx) => {
  const { id } = await params;
  const { session } = await ownCollection(id);
  const patch = collectionPatchSchema.parse(await readJson(request));
  const updated = await updateCollection(session.supabase, id, patch);
  revalidateTag(CACHE_TAGS.collections);
  return json(updated);
});

/** DELETE /api/collections/[id] */
export const DELETE = handler(async (_request: Request, { params }: Ctx) => {
  const { id } = await params;
  const { session } = await ownCollection(id);
  await deleteCollection(session.supabase, id);
  revalidateTag(CACHE_TAGS.collections);
  return json({ ok: true });
});
