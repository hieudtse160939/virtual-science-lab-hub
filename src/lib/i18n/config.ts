export const LOCALES = ["vi", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "vi";
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Thay {key} trong chuỗi bằng giá trị tương ứng. */
export function format(template: string, vars: Record<string, string | number> = {}) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

export function formatNumber(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(value);
}

export function formatDate(value: string | Date, locale: Locale, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", opts ?? { dateStyle: "medium" }).format(
    typeof value === "string" ? new Date(value) : value,
  );
}
