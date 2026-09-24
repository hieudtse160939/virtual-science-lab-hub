import {
  DURATION_BUCKETS,
  EDUCATION_LEVELS,
  LANGUAGE_FILTERS,
  LICENSE_CATEGORIES,
  MAX_QUERY_LENGTH,
  SIMULATION_TYPES,
  SORT_OPTIONS,
} from "@/lib/constants";
import type { SearchCursor, SearchFilters } from "@/types/domain";

type RawParams = Record<string, string | string[] | undefined> | URLSearchParams;

function read(params: RawParams, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

function list<T extends string>(
  params: RawParams,
  key: string,
  allowed?: readonly T[],
  max = 20,
): T[] | undefined {
  const raw = read(params, key);
  if (!raw) return undefined;
  const values = Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ).slice(0, max);
  const filtered = allowed
    ? values.filter((v): v is T => (allowed as readonly string[]).includes(v))
    : (values.filter((v) => /^[a-z0-9-]{1,60}$/.test(v)) as T[]);
  return filtered.length > 0 ? filtered : undefined;
}

/** Đọc & kiểm tra bộ lọc từ URL (?q=&subject=physics,chemistry&grade=10&…). */
export function parseSearchFilters(params: RawParams): SearchFilters {
  const q = read(params, "q")?.trim().slice(0, MAX_QUERY_LENGTH) || undefined;
  const grades = list(params, "grade")
    ?.map(Number)
    .filter((g) => Number.isInteger(g) && g >= 1 && g <= 12);
  const sort = read(params, "sort");
  return {
    q,
    subjects: list(params, "subject"),
    levels: list(params, "level", EDUCATION_LEVELS),
    grades: grades && grades.length > 0 ? grades : undefined,
    languages: list(params, "lang", LANGUAGE_FILTERS),
    sources: list(params, "source"),
    types: list(params, "type", SIMULATION_TYPES),
    licenses: list(params, "license", LICENSE_CATEGORIES),
    durations: list(params, "duration", DURATION_BUCKETS),
    freeOnly: read(params, "free") === "1" || undefined,
    verifiedOnly: read(params, "verified") === "1" || undefined,
    sort: SORT_OPTIONS.includes(sort as never) ? (sort as SearchFilters["sort"]) : undefined,
  };
}

export function serializeSearchFilters(filters: SearchFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.q) p.set("q", filters.q);
  const setList = (key: string, v?: readonly (string | number)[]) => {
    if (v && v.length > 0) p.set(key, v.join(","));
  };
  setList("subject", filters.subjects);
  setList("level", filters.levels);
  setList("grade", filters.grades);
  setList("lang", filters.languages);
  setList("source", filters.sources);
  setList("type", filters.types);
  setList("license", filters.licenses);
  setList("duration", filters.durations);
  if (filters.freeOnly) p.set("free", "1");
  if (filters.verifiedOnly) p.set("verified", "1");
  if (filters.sort) p.set("sort", filters.sort);
  return p;
}

export function countActiveFilters(filters: SearchFilters) {
  return (
    (filters.subjects?.length ?? 0) +
    (filters.levels?.length ?? 0) +
    (filters.grades?.length ?? 0) +
    (filters.languages?.length ?? 0) +
    (filters.sources?.length ?? 0) +
    (filters.types?.length ?? 0) +
    (filters.licenses?.length ?? 0) +
    (filters.durations?.length ?? 0) +
    (filters.freeOnly ? 1 : 0) +
    (filters.verifiedOnly ? 1 : 0)
  );
}

function toBase64Url(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

/** Cursor được mã hóa base64url để truyền qua URL/API (chạy được cả server lẫn trình duyệt). */
export function encodeCursor(cursor: SearchCursor | null): string | null {
  if (!cursor) return null;
  return toBase64Url(JSON.stringify(cursor));
}

export function decodeCursor(raw: string | null | undefined): SearchCursor | null {
  if (!raw || raw.length > 400) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(raw)) as SearchCursor;
    const cursor: SearchCursor = {};
    if (typeof parsed.offset === "number" && parsed.offset >= 0 && parsed.offset <= 5000)
      cursor.offset = parsed.offset;
    if (typeof parsed.relaxed === "boolean") cursor.relaxed = parsed.relaxed;
    if (typeof parsed.value === "string" && parsed.value.length <= 300) cursor.value = parsed.value;
    if (typeof parsed.id === "string" && /^[0-9a-f-]{36}$/i.test(parsed.id)) cursor.id = parsed.id;
    return cursor;
  } catch {
    return null;
  }
}
