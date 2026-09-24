import { revalidateTag } from "next/cache";
import { subjectInputSchema } from "@/lib/validation";
import { requireApiSession } from "@/server/auth";
import { handler, json, readJson } from "@/server/http";
import { listAllSubjects, upsertSubject } from "@/server/repositories/admin";
import { CACHE_TAGS } from "@/server/repositories/catalog";

export const GET = handler(async () => {
  const { supabase } = await requireApiSession("admin");
  return json(await listAllSubjects(supabase));
});

export const POST = handler(async (request: Request) => {
  const { supabase } = await requireApiSession("admin");
  const input = subjectInputSchema.parse(await readJson(request));
  const subject = await upsertSubject(supabase, null, input);
  revalidateTag(CACHE_TAGS.catalog);
  return json(subject, { status: 201 });
});
