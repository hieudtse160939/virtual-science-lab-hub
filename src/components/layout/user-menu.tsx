"use client";

import { GraduationCap, Heart, LogOut, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useUser } from "@/components/providers";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/config";

export function UserMenu() {
  const user = useUser();
  const { t } = useI18n();

  if (!user) {
    return (
      <div className="flex items-center gap-1.5">
        <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
          <Link href="/login">{t.nav.login}</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/signup">{t.nav.signup}</Link>
        </Button>
      </div>
    );
  }

  const initials = (user.name || user.email || "?").trim().slice(0, 1).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t.nav.account} className="rounded-full">
          <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full text-sm font-bold">
            {initials}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="truncate font-normal">
          {format(t.auth.signedInAs, { email: user.email ?? "" })}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/favorites">
            <Heart /> {t.nav.favorites}
          </Link>
        </DropdownMenuItem>
        {(user.role === "teacher" || user.role === "admin") && (
          <DropdownMenuItem asChild>
            <Link href="/teacher">
              <GraduationCap /> {t.nav.teacher}
            </Link>
          </DropdownMenuItem>
        )}
        {user.role === "admin" && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <ShieldCheck /> {t.nav.admin}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href="/account">
            <UserRound /> {t.nav.account}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action="/auth/signout" method="post">
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut /> {t.nav.logout}
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
