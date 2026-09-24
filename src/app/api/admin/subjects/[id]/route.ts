import { revalidateTag } from "next/cache";
import { subjectInputSchema } from "@/lib/validation";
import { requireApiSession } from "@/server/auth";
import { handler, json, readJson } from "@/server/http";
import { deleteSubject, upsertSubject } from "@/server/repositories/admin";
import { CACHE_TAGS } from "@/server/repositories/catalog";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (request: Request, { params }: Ctx) => {
  const { id } = await params;
  const { supabase } = await requireApiSession("admin");
  const input = subjectInputSchema.parse(await readJson(request));
  const subject = await upsertSubject(supabase, id, input);
  revalidateTag(CACHE_TAGS.catalog);
  revalidateTag(CACHE_TAGS.simulations);
  return json(subject);
});

export const DELETE = handler(async (_request: Request, { params }: Ctx) => {
  const { id } = await params;
  const { supabase } = await requireApiSession("admin");
  await deleteSubject(supabase, id);
  revalidateTag(CACHE_TAGS.catalog);
  revalidateTag(CACHE_TAGS.simulations);
  return json({ ok: true });
});
