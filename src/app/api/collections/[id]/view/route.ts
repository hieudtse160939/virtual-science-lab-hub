import { createClient } from "@/lib/supabase/server";
import { handler, HttpError, json, rateLimit } from "@/server/http";
import { trackCollectionView } from "@/server/repositories/user-content";

/** POST /api/collections/[id]/view – đếm lượt mở liên kết chia sẻ (ẩn danh, chỉ bộ sưu tập công khai). */
export const POST = handler(async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
  rateLimit(request, "collection-view", 30, 60_000);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, "invalid_input");
  await trackCollectionView(await createClient(), id);
  return json({ ok: true });
});
