import { z } from "zod";
import { requireApiSession } from "@/server/auth";
import { handler, json, readJson } from "@/server/http";
import { existingUrlKeys } from "@/server/repositories/admin";

const bodySchema = z.object({ url_keys: z.array(z.string().max(2000)).min(1).max(5000) });

/** POST /api/admin/import/check { url_keys } – URL nào đã có trong hệ thống (màn hình xem trước). */
export const POST = handler(async (request: Request) => {
  const { supabase } = await requireApiSession("admin");
  const { url_keys } = bodySchema.parse(await readJson(request, 12_000_000));
  return json({ existing: await existingUrlKeys(supabase, url_keys) });
});
