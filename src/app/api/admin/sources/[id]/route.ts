import { revalidateTag } from "next/cache";
import { sourceInputSchema } from "@/lib/validation";
import { requireApiSession } from "@/server/auth";
import { handler, json, readJson } from "@/server/http";
import { deleteSource, upsertSource } from "@/server/repositories/admin";
import { CACHE_TAGS } from "@/server/repositories/catalog";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (request: Request, { params }: Ctx) => {
  const { id } = await params;
  const { supabase } = await requireApiSession("admin");
  const input = sourceInputSchema.parse(await readJson(request));
  const source = await upsertSource(supabase, id, input);
  revalidateTag(CACHE_TAGS.catalog);
  revalidateTag(CACHE_TAGS.simulations);
  return json(source);
});

export const DELETE = handler(async (_request: Request, { params }: Ctx) => {
  const { id } = await params;
  const { supabase } = await requireApiSession("admin");
  await deleteSource(supabase, id);
  revalidateTag(CACHE_TAGS.catalog);
  revalidateTag(CACHE_TAGS.simulations);
  return json({ ok: true });
});
