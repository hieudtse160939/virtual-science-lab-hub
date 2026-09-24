"use client";

import { FlaskConical, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle, DialogTrigger, SheetContent } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

export function MobileNav({ links }: { links: { href: string; label: string }[] }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label={t.nav.menu}>
          <Menu className="size-5" />
        </Button>
      </DialogTrigger>
      <SheetContent closeLabel={t.common.close} aria-describedby={undefined}>
        <div className="flex items-center gap-2 border-b p-4 font-bold">
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
            <FlaskConical className="size-4" aria-hidden />
          </span>
          <DialogTitle className="text-base">{t.meta.siteName}</DialogTitle>
        </div>
        <nav aria-label={t.nav.mainNav} className="flex flex-col gap-1 p-3">
          {[{ href: "/", label: t.nav.home }, ...links].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? "page" : undefined}
              className={cn(
                "hover:bg-accent rounded-lg px-3 py-3 text-base font-medium",
                pathname === l.href && "bg-primary-soft text-primary",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Dialog>
  );
}
