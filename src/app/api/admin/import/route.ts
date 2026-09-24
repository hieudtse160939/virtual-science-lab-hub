import { revalidateTag } from "next/cache";
import { z } from "zod";
import { importRecordSchema } from "@/lib/import/normalize";
import { requireApiSession } from "@/server/auth";
import { handler, json, readJson } from "@/server/http";
import { CACHE_TAGS } from "@/server/repositories/catalog";
import { importBatch } from "@/server/repositories/admin";

export const maxDuration = 60;

const bodySchema = z.object({
  job_id: z.string().uuid().nullable().optional(),
  on_duplicate: z.enum(["skip", "update"]).default("skip"),
  records: z.array(z.unknown()).min(1).max(1000),
});

/**
 * POST /api/admin/import – nhập MỘT LÔ (≤1000) bản ghi đã chuẩn hóa bằng một lời gọi RPC hàng loạt.
 * Trình duyệt chia tệp lớn (10k–100k+) thành nhiều lô, chạy song song có giới hạn và cho phép thử lại.
 */
export const POST = handler(async (request: Request) => {
  const { supabase } = await requireApiSession("admin");
  const body = bodySchema.parse(await readJson(request, 8_000_000));

  // Kiểm tra lại phía server: không tin dữ liệu từ client.
  const valid: unknown[] = [];
  const indexMap: number[] = [];
  const errors: { index: number; message: string }[] = [];
  body.records.forEach((record, index) => {
    const parsed = importRecordSchema.safeParse(record);
    if (parsed.success) {
      valid.push(parsed.data);
      indexMap.push(index);
    } else {
      errors.push({
        index,
        message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
    }
  });

  let result = { inserted: 0, updated: 0, skipped: 0, errors: [] as { index: number; message: string }[] };
  if (valid.length > 0) {
    result = await importBatch(supabase, valid, body.on_duplicate, body.job_id ?? null);
  }
  if (result.inserted > 0 || result.updated > 0) {
    revalidateTag(CACHE_TAGS.simulations);
    revalidateTag(CACHE_TAGS.catalog);
  }
  return json({
    inserted: result.inserted,
    updated: result.updated,
    skipped: result.skipped,
    errors: [
      ...errors,
      ...result.errors.map((e) => ({ index: indexMap[e.index] ?? e.index, message: e.message })),
    ],
  });
});
