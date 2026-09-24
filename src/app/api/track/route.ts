import { createClient } from "@/lib/supabase/server";
import { trackSchema } from "@/lib/validation";
import { handler, json, rateLimit, readJson } from "@/server/http";
import { trackSimulationEvent } from "@/server/repositories/simulations";

/**
 * POST /api/track { simulation_id, event: view|external_open|embed_open, collection_id? }
 * Chỉ ghi số liệu tổng hợp theo ngày; không lưu IP hay định danh người xem.
 */
export const POST = handler(async (request: Request) => {
  rateLimit(request, "track", 60, 60_000);
  const body = trackSchema.parse(await readJson(request, 2_000));
  await trackSimulationEvent(await createClient(), body.simulation_id, body.event, body.collection_id);
  return json({ ok: true });
});
