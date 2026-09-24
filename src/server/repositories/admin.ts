import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeText, slugify } from "@/lib/utils";
import type { SimulationInput } from "@/lib/validation";
import type { PublishStatus, Source, Subject } from "@/types/domain";
import { HttpError, toHttpError } from "../http";

export interface ChartDatum {
  key: string;
  label: string;
  label_en: string;
  value: number;
}

export interface DashboardStats {
  totals: {
    simulations: number;
    active: number;
    pending_review: number;
    inactive: number;
    demo: number;
    verified: number;
    views: number;
    external_opens: number;
    favorites: number;
  };
  sources: number;
  subjects: number;
  users: { total: number; teachers: number; students: number; admins: number };
  collections: number;
  open_reports: number;
  by_subject: ChartDatum[];
  by_source: ChartDatum[];
  by_grade: ChartDatum[];
  by_language: ChartDatum[];
  top_simulations: {
    id: string;
    slug: string;
    title: string;
    views: number;
    favorites: number;
    external_opens: number;
  }[];
  top_queries: { query: string; count: number; results: number }[];
  zero_result_queries: { query: string; count: number }[];
  popular_subjects: ChartDatum[];
  daily: { day: string; views: number; opens: number }[];
}

export async function getDashboardStats(client: SupabaseClient): Promise<DashboardStats> {
  const { data, error } = await client.rpc("admin_dashboard_stats");
  if (error) throw toHttpError(error);
  return data as DashboardStats;
}

export interface AdminSimulationRow {
  id: string;
  slug: string;
  title: string;
  grade_min: number;
  grade_max: number;
  is_active: boolean;
  is_verified: boolean;
  is_featured: boolean;
  is_demo: boolean;
  status: PublishStatus;
  view_count: number;
  updated_at: string;
  simulation_url: string;
  subject: { name: string; name_vi: string; color: string } | null;
  source: { name: string } | null;
}

export interface AdminListParams {
  q?: string;
  status?: PublishStatus | "inactive" | "demo";
  subject?: string;
  source?: string;
  page: number;
  pageSize: number;
}

export async function listAdminSimulations(client: SupabaseClient, params: AdminListParams) {
  let query = client
    .from("simulations")
    .select(
      "id, slug, title, grade_min, grade_max, is_active, is_verified, is_featured, is_demo, status, view_count, updated_at, simulation_url, subject:subjects(name, name_vi, color), source:sources(name)",
      { count: "estimated" },
    );
  if (params.q) {
    // Chỉ giữ ký tự an toàn cho cú pháp bộ lọc PostgREST.
    const q = normalizeText(params.q)
      .replace(/[^a-z0-9 ./:_-]/g, " ")
      .trim()
      .slice(0, 100);
    if (q) query = query.or(`title_search.ilike.%${q}%,url_key.ilike.%${q}%`);
  }
  if (params.status === "inactive") query = query.eq("is_active", false);
  else if (params.status === "demo") query = query.eq("is_demo", true);
  else if (params.status) query = query.eq("status", params.status).eq("is_active", true);
  if (params.subject) query = query.eq("subject_id", params.subject);
  if (params.source) query = query.eq("source_id", params.source);
  const from = params.page * params.pageSize;
  const { data, error, count } = await query
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + params.pageSize - 1);
  if (error) throw toHttpError(error);
  return { rows: (data ?? []) as unknown as AdminSimulationRow[], total: count ?? 0 };
}

function toDbPayload(input: SimulationInput) {
  const { slug, ...rest } = input;
  return { ...rest, slug: slug || slugify(input.title) || "simulation" };
}

export async function createSimulation(client: SupabaseClient, input: SimulationInput, userId: string) {
  const payload = toDbPayload(input);
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await client
      .from("simulations")
      .insert({ ...payload, created_by: userId })
      .select("id, slug")
      .single();
    if (!error) return data as { id: string; slug: string };
    if (error.code === "23505" && error.message.includes("url_key")) {
      throw new HttpError(409, "duplicate_url", "Đã có mô phỏng với URL này");
    }
    if (error.code === "23505" && attempt === 0) {
      payload.slug = `${payload.slug.slice(0, 150)}-${Math.random().toString(36).slice(2, 7)}`;
      continue;
    }
    throw toHttpError(error);
  }
  throw new HttpError(409, "conflict");
}

export async function updateSimulation(client: SupabaseClient, id: string, input: SimulationInput) {
  const { data, error } = await client
    .from("simulations")
    .update(toDbPayload(input))
    .eq("id", id)
    .select("id, slug")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      throw new HttpError(
        409,
        "conflict",
        error.message.includes("url_key") ? "Đã có mô phỏng với URL này" : "Slug đã tồn tại",
      );
    }
    throw toHttpError(error);
  }
  if (!data) throw new HttpError(404, "not_found");
  return data as { id: string; slug: string };
}

export async function deleteSimulations(client: SupabaseClient, ids: string[]) {
  const { error, count } = await client.from("simulations").delete({ count: "exact" }).in("id", ids);
  if (error) throw toHttpError(error);
  return count ?? 0;
}

export async function bulkUpdateSimulations(
  client: SupabaseClient,
  ids: string[],
  patch: Record<string, unknown>,
) {
  const { error, count } = await client.from("simulations").update(patch, { count: "exact" }).in("id", ids);
  if (error) throw toHttpError(error);
  return count ?? 0;
}

// ---- Nguồn ----
export async function listAllSources(
  client: SupabaseClient,
): Promise<(Source & { simulation_count: number })[]> {
  const [{ data, error }, counts] = await Promise.all([
    client.from("sources").select("*").order("name"),
    client.rpc("catalog_counts"),
  ]);
  if (error) throw toHttpError(error);
  const bySlug = ((counts.data as { sources?: Record<string, number> } | null)?.sources ?? {}) as Record<
    string,
    number
  >;
  return ((data ?? []) as Source[]).map((s) => ({ ...s, simulation_count: bySlug[s.slug] ?? 0 }));
}

export async function upsertSource(
  client: SupabaseClient,
  id: string | null,
  input: Record<string, unknown> & { name: string; slug?: string | null },
) {
  const payload = { ...input, slug: input.slug || slugify(input.name, 80) };
  const q = id
    ? client.from("sources").update(payload).eq("id", id).select("*").maybeSingle()
    : client.from("sources").insert(payload).select("*").single();
  const { data, error } = await q;
  if (error)
    throw error.code === "23505"
      ? new HttpError(409, "conflict", "Tên hoặc slug đã tồn tại")
      : toHttpError(error);
  if (!data) throw new HttpError(404, "not_found");
  return data as Source;
}

export async function deleteSource(client: SupabaseClient, id: string) {
  const { error } = await client.from("sources").delete().eq("id", id);
  if (error) throw toHttpError(error);
}

// ---- Môn học ----
export async function listAllSubjects(client: SupabaseClient): Promise<Subject[]> {
  const { data, error } = await client.from("subjects").select("*").order("sort_order").order("name");
  if (error) throw toHttpError(error);
  return (data ?? []) as Subject[];
}

export async function upsertSubject(
  client: SupabaseClient,
  id: string | null,
  input: Record<string, unknown> & { name: string; slug?: string | null },
) {
  const payload = { ...input, slug: input.slug || slugify(input.name, 60) };
  const q = id
    ? client.from("subjects").update(payload).eq("id", id).select("*").maybeSingle()
    : client.from("subjects").insert(payload).select("*").single();
  const { data, error } = await q;
  if (error)
    throw error.code === "23505" ? new HttpError(409, "conflict", "Slug đã tồn tại") : toHttpError(error);
  if (!data) throw new HttpError(404, "not_found");
  return data as Subject;
}

export async function deleteSubject(client: SupabaseClient, id: string) {
  const { error } = await client.from("subjects").delete().eq("id", id);
  if (error) throw toHttpError(error);
}

// ---- Trùng lặp ----
export interface DuplicateGroup {
  kind: "title" | "url";
  key: string;
  items: {
    id: string;
    slug: string;
    title: string;
    simulation_url: string;
    is_active: boolean;
    view_count: number;
    created_at: string;
    source: string | null;
  }[];
}

export async function findDuplicates(client: SupabaseClient, limit = 100): Promise<DuplicateGroup[]> {
  const { data, error } = await client.rpc("admin_find_duplicates", { p_limit: limit });
  if (error) throw toHttpError(error);
  return (data ?? []) as DuplicateGroup[];
}

// ---- Báo lỗi ----
export interface IssueReportRow {
  id: string;
  reason: string;
  message: string | null;
  status: "open" | "resolved" | "dismissed";
  created_at: string;
  simulation: { id: string; slug: string; title: string; simulation_url: string } | null;
}

export async function listReports(client: SupabaseClient, status: "open" | "all", page = 0, pageSize = 50) {
  let q = client
    .from("issue_reports")
    .select(
      "id, reason, message, status, created_at, simulation:simulations(id, slug, title, simulation_url)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize - 1);
  if (status === "open") q = q.eq("status", "open");
  const { data, error, count } = await q;
  if (error) throw toHttpError(error);
  return { rows: (data ?? []) as unknown as IssueReportRow[], total: count ?? 0 };
}

export async function updateReportStatus(
  client: SupabaseClient,
  id: string,
  status: "open" | "resolved" | "dismissed",
) {
  const { error } = await client
    .from("issue_reports")
    .update({ status, resolved_at: status === "open" ? null : new Date().toISOString() })
    .eq("id", id);
  if (error) throw toHttpError(error);
}

// ---- Import ----
export interface ImportJob {
  id: string;
  file_name: string;
  format: "csv" | "json" | "jsonl";
  on_duplicate: "skip" | "update";
  total_records: number;
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  status: string;
  created_at: string;
  finished_at: string | null;
}

export async function createImportJob(
  client: SupabaseClient,
  userId: string,
  input: { file_name: string; format: string; on_duplicate: string; total_records: number },
) {
  const { data, error } = await client
    .from("import_jobs")
    .insert({ ...input, created_by: userId })
    .select("*")
    .single();
  if (error) throw toHttpError(error);
  return data as ImportJob;
}

export async function finishImportJob(client: SupabaseClient, id: string, status: string, extraFailed = 0) {
  const { data: job } = await client.from("import_jobs").select("failed").eq("id", id).maybeSingle();
  const { data, error } = await client
    .from("import_jobs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      failed: ((job?.failed as number) ?? 0) + extraFailed,
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw toHttpError(error);
  return data as ImportJob | null;
}

export async function listImportJobs(client: SupabaseClient, limit = 10) {
  const { data, error } = await client
    .from("import_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw toHttpError(error);
  return (data ?? []) as ImportJob[];
}

export async function importBatch(
  client: SupabaseClient,
  rows: unknown[],
  onDuplicate: "skip" | "update",
  jobId: string | null,
) {
  const { data, error } = await client.rpc("import_simulations", {
    p_rows: rows,
    p_on_duplicate: onDuplicate,
    p_job_id: jobId,
  });
  if (error) throw toHttpError(error);
  return data as {
    inserted: number;
    updated: number;
    skipped: number;
    errors: { index: number; message: string }[];
  };
}

export async function existingUrlKeys(client: SupabaseClient, keys: string[]) {
  const { data, error } = await client.rpc("existing_url_keys", { p_keys: keys });
  if (error) throw toHttpError(error);
  return ((data ?? []) as (string | { existing_url_keys: string })[]).map((r) =>
    typeof r === "string" ? r : r.existing_url_keys,
  );
}
