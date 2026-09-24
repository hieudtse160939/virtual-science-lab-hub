import { revalidateTag } from "next/cache";
import { simulationInputSchema } from "@/lib/validation";
import { requireApiSession } from "@/server/auth";
import { handler, HttpError, json, readJson } from "@/server/http";
import { deleteSimulations, updateSimulation } from "@/server/repositories/admin";
import { CACHE_TAGS } from "@/server/repositories/catalog";

type Ctx = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

/** PATCH /api/admin/simulations/[id] – cập nhật toàn bộ thông tin mô phỏng. */
export const PATCH = handler(async (request: Request, { params }: Ctx) => {
  const { id } = await params;
  if (!UUID.test(id)) throw new HttpError(400, "invalid_input");
  const { supabase } = await requireApiSession("admin");
  const input = simulationInputSchema.parse(await readJson(request));
  const updated = await updateSimulation(supabase, id, input);
  revalidateTag(CACHE_TAGS.simulations);
  revalidateTag(CACHE_TAGS.catalog);
  return json(updated);
});

/** DELETE /api/admin/simulations/[id] – xóa vĩnh viễn (nên dùng "ẩn" nếu chỉ tạm ngừng). */
export const DELETE = handler(async (_request: Request, { params }: Ctx) => {
  const { id } = await params;
  if (!UUID.test(id)) throw new HttpError(400, "invalid_input");
  const { supabase } = await requireApiSession("admin");
  const count = await deleteSimulations(supabase, [id]);
  if (count === 0) throw new HttpError(404, "not_found");
  revalidateTag(CACHE_TAGS.simulations);
  revalidateTag(CACHE_TAGS.catalog);
  return json({ ok: true });
});
