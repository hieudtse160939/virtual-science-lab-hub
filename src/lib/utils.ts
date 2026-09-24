import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function siteUrl(path = "") {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${path.startsWith("/") || path === "" ? path : `/${path}`}`;
}

/** Bỏ dấu tiếng Việt + chữ thường (khớp với public.normalize_search_text trong DB). */
export function normalizeText(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(input: string, maxLength = 120) {
  return normalizeText(input)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
}

/** Khớp với public.normalize_url trong DB – dùng để phát hiện trùng lặp phía client. */
export function normalizeUrl(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\/(www\.)?/, "")
    .replace(/#.*$/, "")
    .replace(/\/+$/, "");
}

export function isHttpUrl(value: string, httpsOnly = false) {
  try {
    const url = new URL(value);
    return httpsOnly ? url.protocol === "https:" : url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function randomSuffix(length = 6) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function gradeLabel(min: number, max: number, prefix: string) {
  return min === max ? `${prefix} ${min}` : `${prefix} ${min}–${max}`;
}

/** Chỉ cho phép đường dẫn nội bộ khi redirect (chống open redirect). */
export function safeNextPath(next: string | null | undefined, fallback = "/") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
