import { revalidateTag } from "next/cache";
import { bulkUpdateSchema } from "@/lib/validation";
import { requireApiSession } from "@/server/auth";
import { handler, json, readJson } from "@/server/http";
import { bulkUpdateSimulations, deleteSimulations } from "@/server/repositories/admin";
import { CACHE_TAGS } from "@/server/repositories/catalog";

const PATCHES: Record<string, Record<string, unknown>> = {
  activate: { is_active: true },
  deactivate: { is_active: false },
  verify: { is_verified: true },
  unverify: { is_verified: false },
  feature: { is_featured: true },
  unfeature: { is_featured: false },
  publish: { status: "published", is_active: true },
};

/** POST /api/admin/simulations/bulk { ids, action, subject_id? } – cập nhật hàng loạt (≤1000). */
export const POST = handler(async (request: Request) => {
  const { supabase } = await requireApiSession("admin");
  const { ids, action, subject_id } = bulkUpdateSchema.parse(await readJson(request));
  let count: number;
  if (action === "delete") count = await deleteSimulations(supabase, ids);
  else if (action === "set_subject")
    count = await bulkUpdateSimulations(supabase, ids, { subject_id: subject_id ?? null });
  else count = await bulkUpdateSimulations(supabase, ids, PATCHES[action]!);
  revalidateTag(CACHE_TAGS.simulations);
  revalidateTag(CACHE_TAGS.catalog);
  return json({ count });
});
