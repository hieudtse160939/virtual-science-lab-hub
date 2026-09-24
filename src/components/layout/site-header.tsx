import { FlaskConical } from "lucide-react";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import type { UserRole } from "@/types/domain";
import { DisplayMenu } from "./display-menu";
import { HeaderSearch } from "./header-search";
import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";

export async function SiteHeader({ role }: { role: UserRole | null }) {
  const { t } = await getI18n();
  const links = [
    { href: "/search", label: t.nav.explore },
    ...(role === "teacher" || role === "admin" ? [{ href: "/teacher", label: t.nav.teacher }] : []),
    ...(role ? [{ href: "/favorites", label: t.nav.favorites }] : []),
    ...(role === "admin" ? [{ href: "/admin", label: t.nav.admin }] : []),
  ];

  return (
    <header className="no-print bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <MobileNav links={links} />
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-bold tracking-tight"
          aria-label={t.meta.siteName}
        >
          <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl">
            <FlaskConical className="size-5" aria-hidden />
          </span>
          <span className="hidden text-lg lg:inline">
            Virtual <span className="text-primary">Science Lab</span>
          </span>
        </Link>

        <nav aria-label={t.nav.mainNav} className="ml-2 hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-lg px-3 py-2 text-sm font-medium"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1.5">
          <HeaderSearch />
          <DisplayMenu />
          <UserMenu />
        </div>
      </div>
      <HeaderSearch mobile />
    </header>
  );
}
