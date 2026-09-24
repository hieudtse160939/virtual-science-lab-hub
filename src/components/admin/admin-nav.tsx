"use client";

import { AlertTriangle, BookOpen, Copy, Database, LayoutDashboard, Library, Upload } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export function AdminNav() {
  const { t } = useI18n();
  const pathname = usePathname();
  const items = [
    { href: "/admin", label: t.admin.nav.dashboard, icon: LayoutDashboard },
    { href: "/admin/simulations", label: t.admin.nav.simulations, icon: Library },
    { href: "/admin/import", label: t.admin.nav.import, icon: Upload },
    { href: "/admin/sources", label: t.admin.nav.sources, icon: Database },
    { href: "/admin/subjects", label: t.admin.nav.subjects, icon: BookOpen },
    { href: "/admin/duplicates", label: t.admin.nav.duplicates, icon: Copy },
    { href: "/admin/reports", label: t.admin.nav.reports, icon: AlertTriangle },
  ];
  return (
    <nav aria-label={t.admin.title} className="-mx-4 scrollbar-none overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-1 lg:flex-col">
        {items.map((item) => {
          const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap",
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <item.icon className="size-4" aria-hidden /> {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
