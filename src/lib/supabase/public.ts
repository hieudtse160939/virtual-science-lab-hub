import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";

/**
 * Client ẩn danh, KHÔNG đọc cookie → dùng được bên trong unstable_cache cho dữ liệu công khai
 * (trang chủ, trang chi tiết, sitemap) mà không làm trang trở thành dynamic theo từng người dùng.
 */
export function createPublicClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
