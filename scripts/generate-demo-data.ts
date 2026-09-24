/**
 * Dữ liệu TỔNG HỢP để kiểm thử hiệu năng (10k–500k bản ghi). KHÔNG phải mô phỏng thật:
 *   - luôn đánh dấu is_demo = true (bị ẩn khỏi tìm kiếm công khai, sitemap, thống kê danh mục)
 *   - tiêu đề bắt đầu bằng "DEMO"
 *   - URL dùng tên miền .invalid (RFC 2606 – không bao giờ tồn tại)
 *
 *   npm run demo:generate -- --count 100000              → ghi data/demo-100000.jsonl (dùng trang Admin → Import, tick "demo")
 *   npm run demo:generate -- --count 100000 --insert     → chèn trực tiếp (cần SUPABASE_SERVICE_ROLE_KEY)
 *   npm run demo:generate -- --cleanup                   → xóa toàn bộ bản ghi demo
 */
import { createClient } from "@supabase/supabase-js";
import { createWriteStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = join(ROOT, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  }
}

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
};

const SUBJECTS = [
  "physics",
  "chemistry",
  "biology",
  "mathematics",
  "earth-science",
  "environmental-science",
  "computer-science",
  "stem",
];
const TOPICS: Record<string, string[]> = {
  physics: ["Điện học", "Cơ học", "Sóng", "Quang học", "Nhiệt học"],
  chemistry: ["Phản ứng hóa học", "Dung dịch", "Axit – Bazơ", "Cấu tạo nguyên tử"],
  biology: ["Tế bào", "Di truyền", "Tiến hóa", "Sinh thái"],
  mathematics: ["Phân số", "Hàm số", "Hình học", "Xác suất – Thống kê"],
  "earth-science": ["Thiên văn", "Địa chất", "Khí tượng"],
  "environmental-science": ["Khí hậu", "Tài nguyên rừng", "Ô nhiễm"],
  "computer-science": ["Lập trình", "Thuật toán"],
  stem: ["Kỹ thuật & thiết kế", "Âm thanh"],
};
const WORDS = [
  "Circuit",
  "Wave",
  "Atom",
  "Fraction",
  "Energy",
  "Force",
  "Cell",
  "Climate",
  "Orbit",
  "Acid",
  "Gene",
  "Lens",
  "Graph",
  "Robot",
  "Magnet",
];
const TYPES = ["simulation", "virtual_lab", "experiment", "model", "data_lab", "game"];
const LANGS = ["en", "vi", "multi", "fr", "es"];
const LICENSES = ["creative_commons", "oer", "external_free", "free", "paid"];

// PRNG có seed để kết quả tái lập được.
let seed = 42;
const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = <T>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!;

function makeRecord(i: number) {
  const subject = pick(SUBJECTS);
  const gradeMin = 1 + Math.floor(rand() * 10);
  const gradeMax = Math.min(12, gradeMin + Math.floor(rand() * 4));
  const topic = pick(TOPICS[subject]!);
  const word = pick(WORDS);
  const license = pick(LICENSES);
  return {
    title: `DEMO ${word} Lab #${i}`,
    slug: `demo-${word.toLowerCase()}-lab-${i}`,
    description: `Bản ghi tổng hợp #${i} dùng để kiểm thử hiệu năng tìm kiếm (${topic}). Không phải mô phỏng thật.`,
    short_description: `Dữ liệu kiểm thử – ${topic}`,
    subject,
    grade_min: gradeMin,
    grade_max: gradeMax,
    topic,
    simulation_type: pick(TYPES),
    source_name: "Demo Data Generator",
    simulation_url: `https://demo-${i % 97}.invalid/sim/${i}`,
    language: pick(LANGS),
    license: "Synthetic test data",
    license_category: license,
    is_free: license !== "paid",
    difficulty: pick(["beginner", "intermediate", "advanced"]),
    duration_minutes: pick([5, 10, 15, 20, 30, 45, 60]),
    tags: ["demo", word.toLowerCase(), topic.toLowerCase()],
    learning_objectives: [],
    required_equipment: [],
  };
}

async function main() {
  loadEnv();
  const count = Math.min(Math.max(Number(value("count", "10000")) || 10000, 1), 1_000_000);

  if (flag("cleanup") || flag("insert")) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key)
      throw new Error("Cần NEXT_PUBLIC_SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY trong .env.local");
    const db = createClient(url, key, { auth: { persistSession: false } });

    if (flag("cleanup")) {
      let deleted = 0;
      for (;;) {
        const { data, error } = await db.from("simulations").select("id").eq("is_demo", true).limit(1000);
        if (error) throw error;
        if (!data || data.length === 0) break;
        const { error: delError } = await db
          .from("simulations")
          .delete()
          .in(
            "id",
            data.map((r) => r.id),
          );
        if (delError) throw delError;
        deleted += data.length;
        process.stdout.write(`\r🧹 Đã xóa ${deleted} bản ghi demo`);
      }
      await db.from("sources").delete().eq("slug", "demo-data-generator");
      console.log("\n✔ Hoàn tất dọn dữ liệu demo");
      return;
    }

    // Chèn trực tiếp theo lô 1000 (service role bỏ qua RLS). Nguồn + môn được map sẵn.
    const { data: subjects } = await db.from("subjects").select("id, slug");
    const subjectId = new Map((subjects ?? []).map((s) => [s.slug as string, s.id as string]));
    const { data: source, error: srcErr } = await db
      .from("sources")
      .upsert(
        { name: "Demo Data Generator", slug: "demo-data-generator", is_verified: false, is_active: true },
        { onConflict: "slug" },
      )
      .select("id")
      .single();
    if (srcErr) throw srcErr;
    const started = Date.now();
    for (let offset = 0; offset < count; offset += 1000) {
      const batch = Array.from({ length: Math.min(1000, count - offset) }, (_, k) => {
        const { subject, source_name: _s, ...r } = makeRecord(offset + k + 1);
        return {
          ...r,
          subject_id: subjectId.get(subject) ?? null,
          source_id: source.id,
          is_demo: true,
          status: "published",
        };
      });
      const { error } = await db
        .from("simulations")
        .upsert(batch, { onConflict: "url_key", ignoreDuplicates: true });
      if (error) throw error;
      process.stdout.write(
        `\r⏳ ${Math.min(offset + 1000, count)}/${count} (${((Date.now() - started) / 1000).toFixed(0)}s)`,
      );
    }
    console.log(`\n✔ Đã chèn ${count} bản ghi demo (is_demo = true)`);
    return;
  }

  const dir = join(ROOT, "data");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `demo-${count}.jsonl`);
  const out = createWriteStream(path, "utf8");
  for (let i = 1; i <= count; i++) {
    if (!out.write(JSON.stringify(makeRecord(i)) + "\n")) await new Promise((r) => out.once("drain", r));
  }
  await new Promise((r) => out.end(r));
  console.log(
    `✔ ${count} bản ghi demo → ${path}\n  Nhập qua Admin → Import và tick "Đánh dấu là dữ liệu demo".`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
