import { z } from "zod";
import { REPORT_REASONS } from "@/lib/constants";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const optionalUrl = (httpsOnly = false) =>
  z
    .string()
    .trim()
    .max(2000)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .refine((v) => v == null || (httpsOnly ? /^https:\/\/\S+$/i : /^https?:\/\/\S+$/i).test(v), {
      message: httpsOnly ? "URL phải bắt đầu bằng https://" : "URL không hợp lệ",
    });

const uuid = z.string().uuid();

export const simulationInputSchema = z
  .object({
    title: z.string().trim().min(2).max(300),
    slug: z
      .string()
      .trim()
      .max(160)
      .regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/, "Chỉ gồm chữ thường, số và dấu gạch ngang")
      .optional()
      .nullable(),
    short_description: optionalText(300),
    description: optionalText(5000),
    subject_id: uuid.nullable().optional(),
    sub_subject: optionalText(120),
    grade_min: z.coerce.number().int().min(1).max(12),
    grade_max: z.coerce.number().int().min(1).max(12),
    topic: optionalText(200),
    subtopic: optionalText(200),
    simulation_type: z.enum(["virtual_lab", "simulation", "experiment", "model", "data_lab", "game"]),
    source_id: uuid.nullable().optional(),
    source_url: optionalUrl(),
    simulation_url: z
      .string()
      .trim()
      .max(2000)
      .regex(/^https?:\/\/\S+$/i, "URL không hợp lệ"),
    embed_url: optionalUrl(true),
    thumbnail_url: optionalUrl(true),
    language: z
      .string()
      .trim()
      .regex(/^([a-z]{2,3}(-[A-Za-z]{2,4})?|multi)$/, "Mã ngôn ngữ không hợp lệ"),
    license: optionalText(200),
    license_url: optionalUrl(),
    license_category: z.enum(["free", "oer", "creative_commons", "external_free", "paid"]),
    difficulty: z.enum(["beginner", "intermediate", "advanced"]).nullable().optional(),
    duration_minutes: z.coerce.number().int().min(1).max(600).nullable().optional(),
    learning_objectives: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
    required_equipment: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
    tags: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
    is_free: z.boolean().default(true),
    is_verified: z.boolean().default(false),
    is_featured: z.boolean().default(false),
    is_active: z.boolean().default(true),
    status: z.enum(["published", "pending_review", "draft"]).default("published"),
  })
  .refine((v) => v.grade_min <= v.grade_max, { path: ["grade_max"], message: "Khối đến phải ≥ khối từ" });

export type SimulationInput = z.infer<typeof simulationInputSchema>;

export const bulkUpdateSchema = z.object({
  ids: z.array(uuid).min(1).max(1000),
  action: z.enum([
    "activate",
    "deactivate",
    "verify",
    "unverify",
    "feature",
    "unfeature",
    "publish",
    "delete",
    "set_subject",
  ]),
  subject_id: uuid.nullable().optional(),
});

export const sourceInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .max(80)
    .regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/)
    .optional()
    .nullable(),
  description: optionalText(1000),
  website_url: optionalUrl(),
  logo_url: optionalUrl(true),
  license: optionalText(200),
  license_url: optionalUrl(),
  country: z
    .string()
    .trim()
    .max(2)
    .transform((v) => (v === "" ? null : v.toUpperCase()))
    .nullable()
    .optional(),
  allows_embed: z.boolean().default(false),
  is_verified: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export const subjectInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  name_vi: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .trim()
    .max(60)
    .regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/)
    .optional()
    .nullable(),
  icon: z.string().trim().max(40).default("flask-conical"),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#2563eb"),
  aliases: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  sort_order: z.coerce.number().int().min(0).max(10000).default(100),
});

export const collectionInputSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: optionalText(2000),
  is_public: z.boolean().optional(),
  simulation_id: uuid.optional(),
});

export const collectionPatchSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  description: optionalText(2000),
  is_public: z.boolean().optional(),
});

export const collectionItemsSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), simulation_id: uuid, note: optionalText(1000) }),
  z.object({ action: z.literal("remove"), simulation_id: uuid }),
  z.object({ action: z.literal("note"), simulation_id: uuid, note: optionalText(1000) }),
  z.object({ action: z.literal("reorder"), order: z.array(uuid).min(1).max(500) }),
]);

export const favoriteSchema = z.object({ simulation_id: uuid });

export const trackSchema = z.object({
  simulation_id: uuid,
  event: z.enum(["view", "external_open", "embed_open"]),
  collection_id: uuid.nullable().optional(),
});

export const reportSchema = z.object({
  simulation_id: uuid,
  reason: z.enum(REPORT_REASONS),
  message: optionalText(1000),
});

export const profileSchema = z.object({
  full_name: optionalText(120),
  school: optionalText(200),
  role: z.enum(["student", "teacher"]).optional(),
});

export const classifySchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().max(5000).optional().nullable(),
  url: z.string().max(2000).optional().nullable(),
});
