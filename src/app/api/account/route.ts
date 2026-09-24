import { profileSchema } from "@/lib/validation";
import { requireApiSession } from "@/server/auth";
import { handler, json, readJson, toHttpError } from "@/server/http";

/** PATCH /api/account { full_name?, school?, role?: student|teacher } – cập nhật hồ sơ của chính mình. */
export const PATCH = handler(async (request: Request) => {
  const { supabase, user, profile } = await requireApiSession();
  const input = profileSchema.parse(await readJson(request));
  const patch: Record<string, unknown> = {};
  if (input.full_name !== undefined) patch.full_name = input.full_name;
  if (input.school !== undefined) patch.school = input.school;
  // Admin giữ nguyên vai trò; người dùng thường chỉ chuyển giữa học sinh ↔ giáo viên (DB cũng kiểm tra).
  if (input.role && profile.role !== "admin") patch.role = input.role;
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", user.id)
    .select("id, full_name, role, school")
    .single();
  if (error) throw toHttpError(error);
  return json(data);
});
