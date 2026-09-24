/**
 * Sinh supabase/seed.sql (và data/seed-simulations.json cho importer) từ dữ liệu trong scripts/seed.
 *   npm run seed:generate
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { OTHER_SIMULATIONS, PHET_OBJECTIVES, type SeedSimulation } from "./seed/others";
import { PHET_SIMULATIONS } from "./seed/phet";
import { SEED_SOURCES } from "./seed/sources";

const ROOT = join(__dirname, "..");
const FEATURED = new Set([
  "circuit-construction-kit-dc",
  "projectile-motion",
  "build-an-atom",
  "natural-selection",
  "ph-scale",
  "energy-skate-park-basics",
  "graphing-quadratics",
  "greenhouse-effect",
]);

interface Row {
  slug: string;
  title: string;
  description: string;
  shortDescription: string;
  subject: string;
  gradeMin: number;
  gradeMax: number;
  topic: string;
  subtopic: string | null;
  type: string;
  sourceSlug: string;
  sourceName: string;
  sourceUrl: string | null;
  simulationUrl: string;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  language: string;
  license: string;
  licenseUrl: string | null;
  licenseCategory: string;
  difficulty: string;
  duration: number;
  objectives: string[];
  equipment: string[];
  tags: string[];
  isFree: boolean;
  isVerified: boolean;
  isFeatured: boolean;
}

const q = (v: string | null | undefined) => (v == null ? "null" : `'${v.replace(/'/g, "''")}'`);
const arr = (v: string[]) => (v.length === 0 ? "'{}'::text[]" : `array[${v.map(q).join(", ")}]::text[]`);

function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function shorten(text: string, max = 160) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

const phetRows: Row[] = PHET_SIMULATIONS.map(
  ([
    slug,
    title,
    subject,
    gradeMin,
    gradeMax,
    topic,
    subtopic,
    type,
    duration,
    difficulty,
    tags,
    description,
  ]) => {
    const html = `https://phet.colorado.edu/sims/html/${slug}/latest/${slug}_all.html`;
    return {
      slug,
      title,
      description,
      shortDescription: shorten(description),
      subject,
      gradeMin,
      gradeMax,
      topic,
      subtopic,
      type,
      sourceSlug: "phet",
      sourceName: "PhET",
      sourceUrl: `https://phet.colorado.edu/en/simulations/${slug}`,
      simulationUrl: html,
      embedUrl: html,
      thumbnailUrl: `https://phet.colorado.edu/sims/html/${slug}/latest/${slug}-600.png`,
      language: "multi",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      licenseCategory: "creative_commons",
      difficulty,
      duration,
      objectives: PHET_OBJECTIVES[slug] ?? [],
      equipment: ["Máy tính, máy tính bảng hoặc bảng tương tác có trình duyệt web"],
      tags: ["phet", "html5", ...tags],
      isFree: true,
      isVerified: true,
      isFeatured: FEATURED.has(slug),
    };
  },
);

const otherRows: Row[] = OTHER_SIMULATIONS.map((s: SeedSimulation) => {
  const source = SEED_SOURCES.find((x) => x.name === s.source);
  if (!source) throw new Error(`Unknown source ${s.source}`);
  return {
    slug: slugify(s.title),
    title: s.title,
    description: s.description,
    shortDescription: shorten(s.description),
    subject: s.subject,
    gradeMin: s.gradeMin,
    gradeMax: s.gradeMax,
    topic: s.topic,
    subtopic: s.subtopic ?? null,
    type: s.type,
    sourceSlug: source.slug,
    sourceName: source.name,
    sourceUrl: s.sourceUrl ?? source.websiteUrl,
    simulationUrl: s.simulationUrl,
    embedUrl: null,
    thumbnailUrl: s.thumbnailUrl ?? null,
    language: s.language,
    license: s.license,
    licenseUrl: s.licenseUrl ?? source.licenseUrl ?? null,
    licenseCategory: s.licenseCategory,
    difficulty: s.difficulty,
    duration: s.duration,
    objectives: s.objectives ?? [],
    equipment: s.equipment ?? ["Máy tính có trình duyệt web"],
    tags: s.tags,
    isFree: s.isFree,
    isVerified: false,
    isFeatured: false,
  };
});

const rows = [...phetRows, ...otherRows];
const slugs = new Set<string>();
for (const r of rows) {
  if (slugs.has(r.slug)) throw new Error(`Duplicate slug ${r.slug}`);
  slugs.add(r.slug);
}

let sql = `-- =============================================================================
-- SEED DATA – sinh tự động bởi scripts/generate-seed-sql.ts (KHÔNG sửa tay)
-- ${rows.length} mô phỏng thật từ ${SEED_SOURCES.length} nguồn. Chỉ metadata + liên kết tới nhà cung cấp.
-- =============================================================================

`;

sql += `insert into public.sources (name, slug, description, website_url, license, license_url, country, allows_embed, is_verified, is_active) values\n`;
sql += SEED_SOURCES.map(
  (s) =>
    `  (${q(s.name)}, ${q(s.slug)}, ${q(s.description)}, ${q(s.websiteUrl)}, ${q(s.license)}, ${q(s.licenseUrl)}, ${q(s.country)}, ${s.allowsEmbed}, true, true)`,
).join(",\n");
sql += `\non conflict (slug) do update set
  name = excluded.name, description = excluded.description, website_url = excluded.website_url,
  license = excluded.license, license_url = excluded.license_url, country = excluded.country,
  allows_embed = excluded.allows_embed;\n\n`;

sql += `insert into public.simulations (
  slug, title, description, short_description, subject_id, grade_min, grade_max, topic, subtopic,
  simulation_type, source_id, source_url, simulation_url, embed_url, thumbnail_url, language,
  license, license_url, license_category, difficulty, duration_minutes, learning_objectives,
  required_equipment, tags, is_free, is_verified, is_featured, is_active, status
) values\n`;
sql += rows
  .map(
    (r) =>
      `  (${q(r.slug)}, ${q(r.title)}, ${q(r.description)}, ${q(r.shortDescription)}, ` +
      `(select id from public.subjects where slug = ${q(r.subject)}), ${r.gradeMin}, ${r.gradeMax}, ${q(r.topic)}, ${q(r.subtopic)}, ` +
      `${q(r.type)}, (select id from public.sources where slug = ${q(r.sourceSlug)}), ${q(r.sourceUrl)}, ${q(r.simulationUrl)}, ` +
      `${q(r.embedUrl)}, ${q(r.thumbnailUrl)}, ${q(r.language)}, ${q(r.license)}, ${q(r.licenseUrl)}, ${q(r.licenseCategory)}, ` +
      `${q(r.difficulty)}, ${r.duration}, ${arr(r.objectives)}, ${arr(r.equipment)}, ${arr(r.tags)}, ` +
      `${r.isFree}, ${r.isVerified}, ${r.isFeatured}, true, 'published')`,
  )
  .join(",\n");
sql += `\non conflict (url_key) do nothing;\n`;

const seedPath = join(ROOT, "supabase", "seed.sql");
writeFileSync(seedPath, sql, "utf8");

// Bản JSON theo đúng định dạng import (dùng để thử tính năng Import ở trang admin)
const importJson = rows.map((r) => ({
  title: r.title,
  slug: r.slug,
  description: r.description,
  short_description: r.shortDescription,
  subject: r.subject,
  grade_min: r.gradeMin,
  grade_max: r.gradeMax,
  topic: r.topic,
  subtopic: r.subtopic,
  simulation_type: r.type,
  source_name: r.sourceName,
  source_url: r.sourceUrl,
  simulation_url: r.simulationUrl,
  embed_url: r.embedUrl,
  thumbnail_url: r.thumbnailUrl,
  language: r.language,
  license: r.license,
  license_url: r.licenseUrl,
  license_category: r.licenseCategory,
  difficulty: r.difficulty,
  duration_minutes: r.duration,
  learning_objectives: r.objectives,
  required_equipment: r.equipment,
  tags: r.tags,
  is_free: r.isFree,
}));
const jsonPath = join(ROOT, "data", "seed-simulations.json");
mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, JSON.stringify(importJson, null, 2), "utf8");

console.log(`✔ ${rows.length} simulations → ${seedPath}`);
console.log(`✔ JSON import sample → ${jsonPath}`);
