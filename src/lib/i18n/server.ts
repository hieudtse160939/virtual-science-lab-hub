import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { getDictionary } from "./dictionaries";

export const getLocale = cache(async (): Promise<Locale> => {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const accept = (await headers()).get("accept-language") ?? "";
  // Mặc định tiếng Việt; chỉ dùng tiếng Anh khi trình duyệt không ưu tiên tiếng Việt.
  if (accept && !/\bvi\b/i.test(accept) && /^en\b/i.test(accept.trim())) return "en";
  return DEFAULT_LOCALE;
});

export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: getDictionary(locale) };
}
