import { z } from "zod";
import { requireApiSession } from "@/server/auth";
import { handler, json, readJson } from "@/server/http";
import { createImportJob, finishImportJob, listImportJobs } from "@/server/repositories/admin";

export const GET = handler(async () => {
  const { supabase } = await requireApiSession("admin");
  return json(await listImportJobs(supabase, 20));
});

const createSchema = z.object({
  file_name: z.string().trim().min(1).max(255),
  format: z.enum(["csv", "json", "jsonl"]),
  on_duplicate: z.enum(["skip", "update"]),
  total_records: z.number().int().min(0).max(10_000_000),
});

/** POST /api/admin/import/jobs – bắt đầu một phiên import (ghi nhật ký). */
export const POST = handler(async (request: Request) => {
  const { supabase, user } = await requireApiSession("admin");
  const input = createSchema.parse(await readJson(request));
  return json(await createImportJob(supabase, user.id, input), { status: 201 });
});

const finishSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["completed", "completed_with_errors", "cancelled"]),
  extra_failed: z.number().int().min(0).default(0),
});

/** PATCH /api/admin/import/jobs – kết thúc phiên import. */
export const PATCH = handler(async (request: Request) => {
  const { supabase } = await requireApiSession("admin");
  const input = finishSchema.parse(await readJson(request));
  return json(await finishImportJob(supabase, input.id, input.status, input.extra_failed));
});
