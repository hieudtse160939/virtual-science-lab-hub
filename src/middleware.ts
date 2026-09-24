import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Bỏ qua file tĩnh, ảnh, sitemap, robots và các API công khai chỉ đọc.
    "/((?!_next/static|_next/image|favicon.ico|icon|opengraph-image|sitemap|robots.txt|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
