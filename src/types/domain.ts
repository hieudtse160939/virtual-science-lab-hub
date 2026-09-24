export type UserRole = "student" | "teacher" | "admin";
export type SimulationType = "virtual_lab" | "simulation" | "experiment" | "model" | "data_lab" | "game";
export type LicenseCategory = "free" | "oer" | "creative_commons" | "external_free" | "paid";
export type Difficulty = "beginner" | "intermediate" | "advanced";
export type PublishStatus = "published" | "pending_review" | "draft";
export type EducationLevel = "primary" | "lower_secondary" | "upper_secondary";
export type SortOption = "relevance" | "popular" | "newest" | "title" | "favorites";
export type DurationBucket = "lte5" | "lte10" | "lte15" | "lte30" | "gt30";

export interface Subject {
  id: string;
  slug: string;
  name: string;
  name_vi: string;
  icon: string;
  color: string;
  aliases: string[];
  sort_order: number;
}

export interface Grade {
  id: number;
  name: string;
  name_vi: string;
  education_level: EducationLevel;
  age_min: number;
  age_max: number;
}

export interface Source {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  website_url: string | null;
  logo_url: string | null;
  license: string | null;
  license_url: string | null;
  country: string | null;
  allows_embed: boolean;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
}

export interface SubjectRef {
  slug: string;
  name: string;
  name_vi: string;
  icon: string;
  color: string;
}

export interface SourceRef {
  slug: string;
  name: string;
  allows_embed: boolean;
}

/** Dữ liệu tối thiểu cho thẻ mô phỏng (kết quả tìm kiếm, danh sách). */
export interface SimulationCardData {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  grade_min: number;
  grade_max: number;
  language: string;
  simulation_type: SimulationType;
  license_category: LicenseCategory;
  difficulty: Difficulty | null;
  duration_minutes: number | null;
  is_free: boolean;
  is_verified: boolean;
  is_featured: boolean;
  is_demo: boolean;
  thumbnail_url: string | null;
  simulation_url: string;
  embed_url: string | null;
  view_count: number;
  favorite_count: number;
  created_at: string;
  subject: SubjectRef | null;
  source: SourceRef | null;
}

export interface SimulationDetail extends SimulationCardData {
  description: string | null;
  sub_subject: string | null;
  education_level: EducationLevel[];
  topic: string | null;
  subtopic: string | null;
  source_url: string | null;
  license: string | null;
  license_url: string | null;
  learning_objectives: string[];
  required_equipment: string[];
  tags: string[];
  is_active: boolean;
  status: PublishStatus;
  external_open_count: number;
  updated_at: string;
  subject_id: string | null;
  source_id: string | null;
  source_full: Pick<
    Source,
    "id" | "name" | "slug" | "website_url" | "license" | "license_url" | "allows_embed" | "is_verified"
  > | null;
}

export interface SearchFilters {
  q?: string;
  subjects?: string[];
  levels?: EducationLevel[];
  grades?: number[];
  languages?: string[];
  sources?: string[];
  types?: SimulationType[];
  licenses?: LicenseCategory[];
  durations?: DurationBucket[];
  freeOnly?: boolean;
  verifiedOnly?: boolean;
  sort?: SortOption;
}

export interface SearchCursor {
  offset?: number;
  relaxed?: boolean;
  value?: string;
  id?: string;
}

export interface SearchResult {
  items: SimulationCardData[];
  total: number | null;
  totalCapped: boolean;
  next: SearchCursor | null;
  relaxed: boolean;
  sort: SortOption;
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string;
  is_public: boolean;
  item_count: number;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface CollectionItem {
  simulation_id: string;
  sort_order: number;
  note: string | null;
  added_at: string;
  simulation: SimulationCardData;
}

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  school: string | null;
}

export interface CatalogCounts {
  total: number;
  subjects: Record<string, number>;
  sources: Record<string, number>;
}
