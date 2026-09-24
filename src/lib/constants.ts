import type {
  Difficulty,
  DurationBucket,
  EducationLevel,
  LicenseCategory,
  SimulationType,
  SortOption,
} from "@/types/domain";

export const PAGE_SIZE = 24;
export const MAX_QUERY_LENGTH = 120;

export const EDUCATION_LEVELS: EducationLevel[] = ["primary", "lower_secondary", "upper_secondary"];
export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export const SIMULATION_TYPES: SimulationType[] = [
  "virtual_lab",
  "simulation",
  "experiment",
  "model",
  "data_lab",
  "game",
];
export const LICENSE_CATEGORIES: LicenseCategory[] = [
  "free",
  "oer",
  "creative_commons",
  "external_free",
  "paid",
];
export const DURATION_BUCKETS: DurationBucket[] = ["lte5", "lte10", "lte15", "lte30", "gt30"];
export const DIFFICULTIES: Difficulty[] = ["beginner", "intermediate", "advanced"];
export const SORT_OPTIONS: SortOption[] = ["relevance", "popular", "newest", "title", "favorites"];
/** Ngôn ngữ hiển thị trong bộ lọc; "other" = mọi mã ngôn ngữ còn lại. */
export const LANGUAGE_FILTERS = ["vi", "en", "multi", "other"] as const;

export const EDUCATION_LEVEL_GRADES: Record<EducationLevel, [number, number]> = {
  primary: [1, 5],
  lower_secondary: [6, 9],
  upper_secondary: [10, 12],
};

export const LANGUAGE_FLAGS: Record<string, string> = {
  vi: "🇻🇳",
  en: "🇬🇧",
  multi: "🌐",
  fr: "🇫🇷",
  es: "🇪🇸",
  de: "🇩🇪",
  zh: "🇨🇳",
  ja: "🇯🇵",
  ko: "🇰🇷",
};

export const REPORT_REASONS = [
  "broken_link",
  "embed_blocked",
  "wrong_info",
  "inappropriate",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
