import { revalidateTag } from "next/cache";
import { sourceInputSchema } from "@/lib/validation";
import { requireApiSession } from "@/server/auth";
import { handler, json, readJson } from "@/server/http";
import { listAllSources, upsertSource } from "@/server/repositories/admin";
import { CACHE_TAGS } from "@/server/repositories/catalog";

export const GET = handler(async () => {
  const { supabase } = await requireApiSession("admin");
  return json(await listAllSources(supabase));
});

export const POST = handler(async (request: Request) => {
  const { supabase } = await requireApiSession("admin");
  const input = sourceInputSchema.parse(await readJson(request));
  const source = await upsertSource(supabase, null, input);
  revalidateTag(CACHE_TAGS.catalog);
  return json(source, { status: 201 });
});
