/**
 * Chuẩn hóa + kiểm tra một bản ghi import. Dùng chung ở trình duyệt (xem trước) và
 * server (kiểm tra lại trước khi ghi DB) để kết quả luôn nhất quán.
 */
import { z } from "zod";
import { ruleBasedClassifier } from "@/lib/metadata/classifier";
import { isHttpUrl, normalizeText, normalizeUrl, slugify } from "@/lib/utils";
import type { Difficulty, LicenseCategory, PublishStatus, SimulationType } from "@/types/domain";

export type ImportErrorCode =
  | "required"
  | "invalid_url"
  | "invalid_grade"
  | "grade_range"
  | "unknown_subject"
  | "invalid_language"
  | "too_long"
  | "invalid_number"
  | "invalid_record"
  | "duplicate_in_file"
  | "duplicate_in_db"
  | "server";

export interface ImportIssue {
  row: number;
  field: string;
  code: ImportErrorCode;
  value?: string;
}

export interface SubjectLookup {
  slug: string;
  name: string;
  name_vi: string;
  aliases: string[];
}

export interface NormalizeOptions {
  reviewAutoClassified: boolean;
  isDemo: boolean;
}

/** Bản ghi đã sẵn sàng gửi tới RPC import_simulations. */
export interface ImportRecord {
  title: string;
  slug: string | null;
  description: string | null;
  short_description: string | null;
  subject: string | null;
  sub_subject: string | null;
  grade_min: number;
  grade_max: number;
  topic: string | null;
  subtopic: string | null;
  simulation_type: SimulationType;
  source_name: string | null;
  source_url: string | null;
  simulation_url: string;
  embed_url: string | null;
  thumbnail_url: string | null;
  language: string;
  license: string | null;
  license_url: string | null;
  license_category: LicenseCategory;
  difficulty: Difficulty | null;
  duration_minutes: number | null;
  learning_objectives: string[];
  required_equipment: string[];
  tags: string[];
  is_free: boolean;
  is_verified: boolean;
  is_featured: boolean;
  is_demo: boolean;
  status: PublishStatus;
}

export interface NormalizeResult {
  record: ImportRecord | null;
  urlKey: string | null;
  autoClassified: boolean;
  errors: ImportIssue[];
}

export const CSV_COLUMNS = [
  "title",
  "description",
  "subject",
  "grade_min",
  "grade_max",
  "topic",
  "source_name",
  "source_url",
  "simulation_url",
  "embed_url",
  "language",
  "license",
  "tags",
] as const;

export const OPTIONAL_COLUMNS = [
  "slug",
  "short_description",
  "sub_subject",
  "subtopic",
  "simulation_type",
  "thumbnail_url",
  "license_url",
  "license_category",
  "difficulty",
  "duration_minutes",
  "learning_objectives",
  "required_equipment",
  "is_free",
  "is_verified",
  "is_featured",
] as const;

// Tên cột thay thế thường gặp → tên chuẩn
const FIELD_ALIASES: Record<string, string> = {
  name: "title",
  ten: "title",
  tieu_de: "title",
  url: "simulation_url",
  link: "simulation_url",
  sim_url: "simulation_url",
  source: "source_name",
  provider: "source_name",
  nguon: "source_name",
  mon: "subject",
  mon_hoc: "subject",
  type: "simulation_type",
  loai: "simulation_type",
  lang: "language",
  ngon_ngu: "language",
  thumbnail: "thumbnail_url",
  image: "thumbnail_url",
  duration: "duration_minutes",
  thoi_luong: "duration_minutes",
  objectives: "learning_objectives",
  equipment: "required_equipment",
  keywords: "tags",
  tu_khoa: "tags",
  grades: "grade",
  lop: "grade",
  khoi: "grade",
  chu_de: "topic",
  mo_ta: "description",
};

const LEVEL_RANGES: Record<string, [number, number]> = {
  "tieu hoc": [1, 5],
  primary: [1, 5],
  elementary: [1, 5],
  thcs: [6, 9],
  "trung hoc co so": [6, 9],
  "middle school": [6, 8],
  "lower secondary": [6, 9],
  thpt: [10, 12],
  "trung hoc pho thong": [10, 12],
  "high school": [9, 12],
  "upper secondary": [10, 12],
  "k-12": [1, 12],
  k12: [1, 12],
};

const TYPE_ALIASES: Record<string, SimulationType> = {
  virtual_lab: "virtual_lab",
  "virtual lab": "virtual_lab",
  lab: "virtual_lab",
  "phong thi nghiem ao": "virtual_lab",
  simulation: "simulation",
  sim: "simulation",
  "mo phong": "simulation",
  interactive: "simulation",
  experiment: "experiment",
  "thi nghiem": "experiment",
  model: "model",
  "mo hinh": "model",
  data_lab: "data_lab",
  "data lab": "data_lab",
  data: "data_lab",
  game: "game",
  "game-based learning": "game",
  "game based learning": "game",
  "tro choi": "game",
};

const LICENSE_ALIASES: Record<string, LicenseCategory> = {
  free: "free",
  "mien phi": "free",
  "public domain": "free",
  oer: "oer",
  "open educational resource": "oer",
  "open source": "oer",
  creative_commons: "creative_commons",
  "creative commons": "creative_commons",
  cc: "creative_commons",
  external_free: "external_free",
  "external free": "external_free",
  paid: "paid",
  "tra phi": "paid",
  commercial: "paid",
};

const DIFFICULTY_ALIASES: Record<string, Difficulty> = {
  beginner: "beginner",
  easy: "beginner",
  basic: "beginner",
  "co ban": "beginner",
  de: "beginner",
  intermediate: "intermediate",
  medium: "intermediate",
  "trung binh": "intermediate",
  advanced: "advanced",
  hard: "advanced",
  "nang cao": "advanced",
  kho: "advanced",
};

const LANGUAGE_ALIASES: Record<string, string> = {
  vi: "vi",
  "vi-vn": "vi",
  vietnamese: "vi",
  "tieng viet": "vi",
  en: "en",
  "en-us": "en",
  "en-gb": "en",
  english: "en",
  "tieng anh": "en",
  multi: "multi",
  multilingual: "multi",
  "da ngon ngu": "multi",
};

type RawRecord = Record<string, unknown>;

function canonicalKey(key: string) {
  const k = normalizeText(key).replace(/[\s-]+/g, "_");
  return FIELD_ALIASES[k] ?? k;
}

/** Chuẩn hóa tên cột (hỗ trợ tiếng Việt, khoảng trắng, chữ hoa). */
export function canonicalizeRecord(raw: RawRecord): RawRecord {
  const out: RawRecord = {};
  for (const [key, value] of Object.entries(raw)) {
    const k = canonicalKey(key);
    if (!(k in out) || out[k] === "" || out[k] == null) out[k] = value;
  }
  return out;
}

function str(value: unknown, max = 5000): string | null {
  if (value == null) return null;
  const s = String(value)
    .replace(/\u0000/g, "")
    .trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function list(value: unknown, max = 30, itemMax = 300): string[] {
  let items: unknown[] = [];
  if (Array.isArray(value)) items = value;
  else if (typeof value === "string") items = value.split(/\s*[|;\n]\s*|\s*,\s*(?![^()]*\))/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const s = str(item, itemMax);
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function lines(value: unknown, max = 20): string[] {
  if (typeof value === "string" && !value.includes("|") && !value.includes("\n") && !value.includes(";")) {
    return list([value], max, 500);
  }
  if (typeof value === "string") return list(value.split(/\s*[|;\n]\s*/), max, 500);
  return list(value, max, 500);
}

function bool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value == null || value === "") return fallback;
  const s = normalizeText(String(value));
  if (["true", "1", "yes", "y", "co", "x", "free", "mien phi"].includes(s)) return true;
  if (["false", "0", "no", "n", "khong", "paid"].includes(s)) return false;
  return fallback;
}

function int(value: unknown): number | null | "invalid" {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isInteger(value) ? value : Math.round(value);
  const s = String(value).trim();
  if (!/^-?\d+$/.test(s)) return "invalid";
  return Number(s);
}

function parseDuration(value: unknown): number | null | "invalid" {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Math.round(value);
  const s = normalizeText(String(value));
  const hours = s.match(/(\d+(?:[.,]\d+)?)\s*(h|gio|hour)/);
  const minutes = s.match(/(\d+)\s*(m|min|phut|minute)?/);
  let total = 0;
  if (hours?.[1]) total += Math.round(parseFloat(hours[1].replace(",", ".")) * 60);
  else if (minutes?.[1]) total += Number(minutes[1]);
  else return "invalid";
  return total > 0 && total <= 600 ? total : "invalid";
}

function parseGradeRange(value: unknown): [number, number] | null | "invalid" {
  if (value == null || value === "") return null;
  const s = normalizeText(String(value));
  for (const [key, range] of Object.entries(LEVEL_RANGES)) {
    if (s === key || s.includes(key)) return range;
  }
  const m = s.match(/(\d{1,2})\s*(?:[-–—]|to|den|toi)\s*(\d{1,2})/) ?? s.match(/(\d{1,2})/);
  if (!m?.[1]) return "invalid";
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  return [a, b];
}

export function buildSubjectMatcher(subjects: SubjectLookup[]) {
  const map = new Map<string, string>();
  for (const s of subjects) {
    for (const key of [s.slug, s.name, s.name_vi, ...s.aliases]) map.set(normalizeText(key), s.slug);
  }
  return (value: string) => map.get(normalizeText(value)) ?? null;
}

function hostName(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function normalizeRecord(
  rawInput: RawRecord,
  row: number,
  matchSubject: (value: string) => string | null,
  options: NormalizeOptions,
): NormalizeResult {
  const errors: ImportIssue[] = [];
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    return {
      record: null,
      urlKey: null,
      autoClassified: false,
      errors: [{ row, field: "*", code: "invalid_record" }],
    };
  }
  const raw = canonicalizeRecord(rawInput);
  const fail = (field: string, code: ImportErrorCode, value?: unknown) =>
    errors.push({ row, field, code, value: value == null ? undefined : String(value).slice(0, 120) });

  const title = str(raw.title, 1000);
  if (!title) fail("title", "required");
  else if (title.length > 300) fail("title", "too_long", title);

  const simulationUrl = str(raw.simulation_url, 2000);
  if (!simulationUrl) fail("simulation_url", "required");
  else if (!isHttpUrl(simulationUrl)) fail("simulation_url", "invalid_url", simulationUrl);

  const description = str(raw.description, 5000);
  let shortDescription = str(raw.short_description, 300);
  if (!shortDescription && description) {
    shortDescription =
      description.length <= 160 ? description : `${description.slice(0, 157).replace(/\s+\S*$/, "")}…`;
  }

  const embedRaw = str(raw.embed_url, 2000);
  const embedUrl = embedRaw && isHttpUrl(embedRaw, true) ? embedRaw : null;
  const thumbRaw = str(raw.thumbnail_url, 2000);
  const thumbnailUrl = thumbRaw && isHttpUrl(thumbRaw, true) ? thumbRaw : null;
  const sourceUrlRaw = str(raw.source_url, 2000);
  const sourceUrl = sourceUrlRaw && isHttpUrl(sourceUrlRaw) ? sourceUrlRaw : null;
  const licenseUrlRaw = str(raw.license_url, 2000);
  const licenseUrl = licenseUrlRaw && isHttpUrl(licenseUrlRaw) ? licenseUrlRaw : null;

  let tags = list(raw.tags, 30, 60);
  const topic = str(raw.topic, 200);

  // ---- Suy luận metadata còn thiếu ----
  const suggestion = title
    ? ruleBasedClassifier.classify({ title, description, url: simulationUrl, topic, tags })
    : null;
  let autoClassified = false;

  // Môn học
  let subject: string | null = null;
  const subjectRaw = str(raw.subject, 100);
  if (subjectRaw) {
    subject = matchSubject(subjectRaw);
    if (!subject) fail("subject", "unknown_subject", subjectRaw);
  } else if (suggestion?.subject) {
    subject = suggestion.subject;
    autoClassified = true;
  }

  // Khối lớp
  let gradeMin: number | null = null;
  let gradeMax: number | null = null;
  const gMin = int(raw.grade_min);
  const gMax = int(raw.grade_max);
  if (gMin === "invalid") fail("grade_min", "invalid_number", raw.grade_min);
  if (gMax === "invalid") fail("grade_max", "invalid_number", raw.grade_max);
  if (typeof gMin === "number") gradeMin = gMin;
  if (typeof gMax === "number") gradeMax = gMax;
  if (gradeMin == null && gradeMax == null) {
    const range = parseGradeRange(raw.grade ?? raw.education_level);
    if (range === "invalid") fail("grade", "invalid_grade", raw.grade ?? raw.education_level);
    else if (range) [gradeMin, gradeMax] = range;
    else if (suggestion?.grade_min) {
      gradeMin = suggestion.grade_min;
      gradeMax = suggestion.grade_max ?? suggestion.grade_min;
      autoClassified = true;
    }
  }
  gradeMin ??= gradeMax ?? 1;
  gradeMax ??= gradeMin === 1 ? 12 : gradeMin;
  if (gradeMin < 1 || gradeMin > 12) fail("grade_min", "invalid_grade", gradeMin);
  if (gradeMax < 1 || gradeMax > 12) fail("grade_max", "invalid_grade", gradeMax);
  if (gradeMin > gradeMax) fail("grade_max", "grade_range", `${gradeMin}-${gradeMax}`);

  // Ngôn ngữ
  let language = "en";
  const langRaw = str(raw.language, 40);
  if (langRaw) {
    const n = normalizeText(langRaw);
    const mapped = LANGUAGE_ALIASES[n] ?? (/^[a-z]{2,3}$/.test(n) ? n : null);
    if (!mapped) fail("language", "invalid_language", langRaw);
    else language = mapped;
  } else if (suggestion?.language) {
    language = suggestion.language;
  }

  // Loại, giấy phép, độ khó, thời lượng
  const typeRaw = str(raw.simulation_type, 60);
  const simulationType: SimulationType =
    (typeRaw && TYPE_ALIASES[normalizeText(typeRaw)]) || suggestion?.simulation_type || "simulation";

  const license = str(raw.license, 200);
  const isFree = bool(raw.is_free, true);
  const licenseCatRaw = str(raw.license_category, 60);
  let licenseCategory: LicenseCategory =
    (licenseCatRaw && LICENSE_ALIASES[normalizeText(licenseCatRaw)]) || "external_free";
  if (!licenseCatRaw) {
    const l = normalizeText(license ?? "");
    if (/\bcc\b|creative commons/.test(l)) licenseCategory = "creative_commons";
    else if (/public domain/.test(l)) licenseCategory = "free";
    else if (/\boer\b|open source|open educational|gpl|mit|apache/.test(l)) licenseCategory = "oer";
    else if (!isFree || /commercial|paid|tra phi/.test(l)) licenseCategory = "paid";
  }

  const diffRaw = str(raw.difficulty, 40);
  const difficulty: Difficulty | null =
    (diffRaw && DIFFICULTY_ALIASES[normalizeText(diffRaw)]) || suggestion?.difficulty || null;

  const duration = parseDuration(raw.duration_minutes);
  if (duration === "invalid") fail("duration_minutes", "invalid_number", raw.duration_minutes);

  // Nguồn: theo cột source_name, hoặc nhận diện từ URL, hoặc tên miền.
  let sourceName = str(raw.source_name, 120);
  if (!sourceName && simulationUrl) sourceName = suggestion?.source_name ?? hostName(simulationUrl);

  // Từ khóa tự động: bổ sung từ khóa nhận diện được + chủ đề.
  if (suggestion) {
    const extra = [...suggestion.tags, ...(topic ? [topic] : [])];
    const seen = new Set(tags.map((t) => t.toLowerCase()));
    for (const tag of extra) {
      if (tags.length >= 30) break;
      if (!seen.has(tag.toLowerCase())) {
        tags.push(tag);
        seen.add(tag.toLowerCase());
      }
    }
  }
  tags = tags.map((t) => t.slice(0, 60));

  const slugRaw = str(raw.slug, 160);
  const slug = slugRaw ? slugify(slugRaw) || null : null;

  if (errors.length > 0 || !title || !simulationUrl) {
    return {
      record: null,
      urlKey: simulationUrl ? normalizeUrl(simulationUrl) : null,
      autoClassified,
      errors,
    };
  }

  const record: ImportRecord = {
    title,
    slug,
    description,
    short_description: shortDescription,
    subject,
    sub_subject: str(raw.sub_subject, 120),
    grade_min: gradeMin,
    grade_max: gradeMax,
    topic: topic ?? (autoClassified ? (suggestion?.topic ?? null) : null),
    subtopic: str(raw.subtopic, 200),
    simulation_type: simulationType,
    source_name: sourceName,
    source_url: sourceUrl,
    simulation_url: simulationUrl,
    embed_url: embedUrl,
    thumbnail_url: thumbnailUrl,
    language,
    license,
    license_url: licenseUrl,
    license_category: licenseCategory,
    difficulty,
    duration_minutes: typeof duration === "number" ? duration : null,
    learning_objectives: lines(raw.learning_objectives),
    required_equipment: lines(raw.required_equipment),
    tags,
    is_free: isFree,
    is_verified: bool(raw.is_verified, false),
    is_featured: bool(raw.is_featured, false),
    is_demo: options.isDemo,
    status: autoClassified && options.reviewAutoClassified ? "pending_review" : "published",
  };

  const parsed = importRecordSchema.safeParse(record);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) fail(issue.path.join(".") || "*", "invalid_record");
    return { record: null, urlKey: normalizeUrl(simulationUrl), autoClassified, errors };
  }
  return { record, urlKey: normalizeUrl(simulationUrl), autoClassified, errors };
}

/** Schema cuối cùng — server dùng lại để từ chối dữ liệu bị sửa đổi trên client. */
export const importRecordSchema = z
  .object({
    title: z.string().min(2).max(300),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .max(160)
      .nullable(),
    description: z.string().max(5000).nullable(),
    short_description: z.string().max(300).nullable(),
    subject: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .max(60)
      .nullable(),
    sub_subject: z.string().max(120).nullable(),
    grade_min: z.number().int().min(1).max(12),
    grade_max: z.number().int().min(1).max(12),
    topic: z.string().max(200).nullable(),
    subtopic: z.string().max(200).nullable(),
    simulation_type: z.enum(["virtual_lab", "simulation", "experiment", "model", "data_lab", "game"]),
    source_name: z.string().max(120).nullable(),
    source_url: z.string().url().max(2000).nullable(),
    simulation_url: z
      .string()
      .url()
      .max(2000)
      .refine((u) => /^https?:\/\//i.test(u)),
    embed_url: z
      .string()
      .url()
      .max(2000)
      .refine((u) => /^https:\/\//i.test(u))
      .nullable(),
    thumbnail_url: z
      .string()
      .url()
      .max(2000)
      .refine((u) => /^https:\/\//i.test(u))
      .nullable(),
    language: z.string().regex(/^([a-z]{2,3}(-[A-Za-z]{2,4})?|multi)$/),
    license: z.string().max(200).nullable(),
    license_url: z.string().url().max(2000).nullable(),
    license_category: z.enum(["free", "oer", "creative_commons", "external_free", "paid"]),
    difficulty: z.enum(["beginner", "intermediate", "advanced"]).nullable(),
    duration_minutes: z.number().int().min(1).max(600).nullable(),
    learning_objectives: z.array(z.string().max(500)).max(20),
    required_equipment: z.array(z.string().max(500)).max(20),
    tags: z.array(z.string().max(60)).max(30),
    is_free: z.boolean(),
    is_verified: z.boolean(),
    is_featured: z.boolean(),
    is_demo: z.boolean(),
    status: z.enum(["published", "pending_review", "draft"]),
  })
  .refine((r) => r.grade_min <= r.grade_max, { path: ["grade_max"] });
