"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { SearchBox } from "@/components/search/search-box";
import { cn } from "@/lib/utils";

const HIDDEN_ON = ["/", "/search"];

/** Ô tìm kiếm trên header (ẩn ở trang chủ và trang tìm kiếm vì đã có ô tìm kiếm lớn). */
export function HeaderSearch({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  if (HIDDEN_ON.includes(pathname) || pathname.startsWith("/lab/")) return null;
  return (
    <div className={cn(mobile ? "px-4 pb-3 sm:hidden" : "hidden w-full max-w-md sm:block")}>
      <Suspense>
        <SearchBox variant="header" />
      </Suspense>
    </div>
  );
}
