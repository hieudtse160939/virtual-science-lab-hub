import { revalidateTag } from "next/cache";
import { simulationInputSchema } from "@/lib/validation";
import { requireApiSession } from "@/server/auth";
import { handler, json, readJson } from "@/server/http";
import { createSimulation } from "@/server/repositories/admin";
import { CACHE_TAGS } from "@/server/repositories/catalog";

/** POST /api/admin/simulations – thêm một mô phỏng. */
export const POST = handler(async (request: Request) => {
  const { supabase, user } = await requireApiSession("admin");
  const input = simulationInputSchema.parse(await readJson(request));
  const created = await createSimulation(supabase, input, user.id);
  revalidateTag(CACHE_TAGS.simulations);
  revalidateTag(CACHE_TAGS.catalog);
  return json(created, { status: 201 });
});
