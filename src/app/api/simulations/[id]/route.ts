import { createClient } from "@/lib/supabase/server";
import { handler, HttpError, json } from "@/server/http";
import { getSimulationById, getSimulationBySlug } from "@/server/repositories/simulations";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/simulations/[id] – chấp nhận UUID hoặc slug. */
export const GET = handler(async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const sim = UUID.test(id)
    ? await getSimulationById(await createClient(), id)
    : await getSimulationBySlug(id);
  if (!sim) throw new HttpError(404, "not_found");
  return json(sim);
});
