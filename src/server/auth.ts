import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/domain";
import { HttpError } from "./http";

export interface Session {
  user: User;
  profile: Profile;
  supabase: SupabaseClient;
}

/** Người dùng hiện tại + hồ sơ (cache trong 1 request). */
export const getSession = cache(async (): Promise<Session | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, school")
    .eq("id", user.id)
    .maybeSingle();
  return {
    user,
    supabase,
    profile: (profile as Profile | null) ?? { id: user.id, full_name: null, role: "student", school: null },
  };
});

const RANK: Record<UserRole, number> = { student: 0, teacher: 1, admin: 2 };

export function hasRole(profile: Profile | undefined | null, role: UserRole) {
  return !!profile && RANK[profile.role] >= RANK[role];
}

/** Dùng trong API route: ném HttpError nếu chưa đăng nhập / không đủ quyền. */
export async function requireApiSession(role: UserRole = "student"): Promise<Session> {
  const session = await getSession();
  if (!session) throw new HttpError(401, "unauthorized");
  if (!hasRole(session.profile, role)) throw new HttpError(403, "forbidden");
  return session;
}

/** Dùng trong trang: chuyển hướng tới đăng nhập nếu cần. */
export async function requirePageSession(nextPath: string, role: UserRole = "student"): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (!hasRole(session.profile, role))
    redirect(role === "admin" ? "/?error=forbidden" : "/account?need=teacher");
  return session;
}
