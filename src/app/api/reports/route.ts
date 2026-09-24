import { createClient } from "@/lib/supabase/server";
import { reportSchema } from "@/lib/validation";
import { getSession } from "@/server/auth";
import { handler, json, rateLimit, readJson } from "@/server/http";
import { createIssueReport } from "@/server/repositories/user-content";

/** POST /api/reports { simulation_id, reason, message? } – báo lỗi, không bắt buộc đăng nhập. */
export const POST = handler(async (request: Request) => {
  rateLimit(request, "reports", 5, 60_000);
  const body = reportSchema.parse(await readJson(request, 5_000));
  const session = await getSession();
  await createIssueReport(session?.supabase ?? (await createClient()), {
    ...body,
    reporter_id: session?.user.id ?? null,
  });
  return json({ ok: true }, { status: 201 });
});
