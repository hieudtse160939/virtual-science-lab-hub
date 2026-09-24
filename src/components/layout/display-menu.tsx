"use client";

import { Contrast, Languages, Moon, Settings2, Sun, Type } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useDisplayPrefs, type TextSize } from "@/components/providers";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n/client";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";

export function setLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

export function DisplayMenu() {
  const { t, locale } = useI18n();
  const { resolvedTheme, setTheme } = useTheme();
  const { prefs, update } = useDisplayPrefs();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const changeLocale = (value: string) => {
    if (value === locale) return;
    setLocaleCookie(value as Locale);
    document.documentElement.lang = value;
    startTransition(() => router.refresh());
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t.display.title}>
          <Settings2 className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Languages className="size-3.5" /> {t.display.language}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={changeLocale}>
          <DropdownMenuRadioItem value="vi">Tiếng Việt</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2">
          {resolvedTheme === "dark" ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}{" "}
          {t.display.title}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={resolvedTheme ?? "light"} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">{t.display.light}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">{t.display.dark}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2">
          <Type className="size-3.5" /> {t.display.textSize}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={prefs.textSize}
          onValueChange={(v) => update({ textSize: v as TextSize })}
        >
          <DropdownMenuRadioItem value="md">{t.display.textNormal}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="lg">{t.display.textLarge}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="xl">{t.display.textXLarge}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={prefs.highContrast}
          onCheckedChange={(checked) => update({ highContrast: checked === true })}
        >
          <Contrast /> {t.display.highContrast}
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
