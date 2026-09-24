import { z } from "zod";
import { requireApiSession } from "@/server/auth";
import { handler, json, readJson } from "@/server/http";
import { updateReportStatus } from "@/server/repositories/admin";

const schema = z.object({ status: z.enum(["open", "resolved", "dismissed"]) });

/** PATCH /api/admin/reports/[id] { status } */
export const PATCH = handler(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { supabase } = await requireApiSession("admin");
  const { status } = schema.parse(await readJson(request));
  await updateReportStatus(supabase, id, status);
  return json({ ok: true });
});
