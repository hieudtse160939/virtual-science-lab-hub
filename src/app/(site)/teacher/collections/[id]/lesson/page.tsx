import { ArrowLeft, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/states";
import { PrintButton } from "@/components/teacher/print-button";
import { format } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { gradeLabel, siteUrl } from "@/lib/utils";
import { requirePageSession } from "@/server/auth";
import { getCollectionById, listCollectionItems } from "@/server/repositories/user-content";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.lesson.title, robots: { index: false } };
}

/**
 * Phiếu hoạt động theo mô hình 5E, sinh hoàn toàn từ metadata của các mô phỏng trong bộ sưu tập
 * (tiêu đề, chủ đề, mục tiêu học tập, thời lượng). Nội dung có thể chỉnh trực tiếp (contentEditable) trước khi in.
 */
export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ t, locale }, session] = await Promise.all([
    getI18n(),
    requirePageSession(`/teacher/collections/${id}/lesson`, "teacher"),
  ]);
  const collection = await getCollectionById(session.supabase, id);
  if (!collection || collection.owner_id !== session.user.id) notFound();
  const items = await listCollectionItems(session.supabase, id);
  const sims = items.map((i) => i.simulation);

  // Mục tiêu học tập: lấy từ trang chi tiết (không có trong dữ liệu thẻ) → truy vấn bổ sung gọn nhẹ.
  const { data: details } = await session.supabase
    .from("simulations")
    .select("id, topic, learning_objectives")
    .in(
      "id",
      sims.map((s) => s.id),
    );
  const detailMap = new Map(
    (details ?? []).map((d) => [
      d.id as string,
      d as { topic: string | null; learning_objectives: string[] },
    ]),
  );
  const objectives = Array.from(
    new Set(sims.flatMap((s) => detailMap.get(s.id)?.learning_objectives ?? [])),
  ).slice(0, 8);
  const topics = Array.from(new Set(sims.map((s) => detailMap.get(s.id)?.topic).filter(Boolean))) as string[];
  const totalMinutes = sims.reduce((sum, s) => sum + (s.duration_minutes ?? 15), 0) + 15;
  const gradeMin = Math.min(...sims.map((s) => s.grade_min));
  const gradeMax = Math.max(...sims.map((s) => s.grade_max));
  const editable = { contentEditable: true, suppressContentEditableWarning: true } as const;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/teacher/collections/${id}`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden /> {collection.name}
        </Link>
        <PrintButton />
      </div>
      <p className="no-print bg-muted text-muted-foreground mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm">
        <Pencil className="size-4" aria-hidden /> {format(t.lesson.subtitle, { name: collection.name })}{" "}
        {t.lesson.editable}
      </p>

      {sims.length === 0 ? (
        <EmptyState title={t.lesson.emptyCollection} />
      ) : (
        <article className="bg-card space-y-6 rounded-2xl border p-6 shadow-sm sm:p-10 print:border-0 print:p-0 print:shadow-none">
          <header className="space-y-3 border-b pb-5">
            <h1 className="text-2xl font-bold" {...editable}>
              {t.lesson.title}: {collection.name}
            </h1>
            {collection.description && (
              <p className="text-muted-foreground" {...editable}>
                {collection.description}
              </p>
            )}
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="flex gap-2">
                <dt className="font-semibold">{t.lesson.className}:</dt>
                <dd {...editable}>{gradeLabel(gradeMin, gradeMax, t.common.grade)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold">{t.lesson.duration}:</dt>
                <dd {...editable}>
                  {totalMinutes} {t.common.minutes}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold">{t.lesson.date}:</dt>
                <dd className="flex-1 border-b border-dotted" {...editable}>
                  {" "}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold">{t.lesson.studentName}:</dt>
                <dd className="flex-1 border-b border-dotted" {...editable}>
                  {" "}
                </dd>
              </div>
            </dl>
          </header>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">{t.lesson.objectivesTitle}</h2>
            <ul className="list-disc space-y-1 pl-6" {...editable}>
              {(objectives.length > 0 ? objectives : sims.map((s) => s.title)).map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">{t.lesson.materialsTitle}</h2>
            <ul className="list-disc space-y-1 pl-6" {...editable}>
              <li>{t.lesson.materialsDevice}</li>
              {sims.map((s) => (
                <li key={s.id}>
                  {s.title} ({s.source?.name ?? "—"}) – {t.lesson.link}:{" "}
                  <span className="text-primary break-all">{siteUrl(`/simulation/${s.slug}`)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">{t.lesson.engage}</h2>
            <p {...editable}>{format(t.lesson.engageText, { topic: topics[0] ?? sims[0]!.title })}</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">{t.lesson.explore}</h2>
            {sims.map((s, i) => (
              <div key={s.id} className="space-y-3 rounded-xl border p-4 print:break-inside-avoid">
                <p className="font-medium" {...editable}>
                  {i + 1}. {format(t.lesson.exploreText, { title: s.title })}
                  {s.duration_minutes ? ` (${s.duration_minutes} ${t.common.minutes})` : ""}
                </p>
                {items[i]?.note && (
                  <p className="bg-warning-soft rounded-lg px-3 py-2 text-sm" {...editable}>
                    {items[i]!.note}
                  </p>
                )}
                <ol className="list-[lower-alpha] space-y-1 pl-6 text-sm" {...editable}>
                  <li>{t.lesson.exploreStep1}</li>
                  <li>{t.lesson.exploreStep2}</li>
                  <li>{t.lesson.exploreStep3}</li>
                </ol>
                <table className="w-full border-collapse text-sm">
                  <caption className="text-muted-foreground mb-1 text-left text-xs font-semibold">
                    {t.lesson.dataTable}
                  </caption>
                  <thead>
                    <tr>
                      <th className="w-16 border px-2 py-1 text-left">{t.lesson.trial}</th>
                      <th className="border px-2 py-1 text-left">{t.lesson.variable}</th>
                      <th className="border px-2 py-1 text-left">{t.lesson.observation}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3].map((n) => (
                      <tr key={n}>
                        <td className="border px-2 py-3">{n}</td>
                        <td className="border px-2 py-3" {...editable} />
                        <td className="border px-2 py-3" {...editable} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </section>

          {[
            { title: t.lesson.explain, text: t.lesson.explainText },
            { title: t.lesson.elaborate, text: t.lesson.elaborateText },
            { title: t.lesson.evaluate, text: t.lesson.evaluateText },
          ].map((s) => (
            <section key={s.title} className="space-y-2 print:break-inside-avoid">
              <h2 className="text-lg font-semibold">{s.title}</h2>
              <p {...editable}>{s.text}</p>
              <div className="h-20 rounded-lg border border-dashed" aria-hidden />
            </section>
          ))}

          <footer className="text-muted-foreground border-t pt-4 text-xs">
            {sims.map((s) => `${s.title} © ${s.source?.name ?? "—"}`).join(" · ")} · {t.meta.siteName} ·{" "}
            {new Date().toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US")}
          </footer>
        </article>
      )}
    </div>
  );
}
