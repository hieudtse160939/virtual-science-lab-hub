import Link from "next/link";
import { BarList, DailyColumns } from "@/components/admin/charts";
import { format, formatNumber } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { requirePageSession } from "@/server/auth";
import { getDashboardStats } from "@/server/repositories/admin";

export const metadata = { title: "Admin" };

export default async function AdminDashboard() {
  const [{ t, locale }, session] = await Promise.all([getI18n(), requirePageSession("/admin", "admin")]);
  const s = await getDashboardStats(session.supabase);
  const n = (v: number) => formatNumber(v, locale);

  const tiles: { label: string; value: string; hint?: string; href?: string }[] = [
    {
      label: t.admin.totals.simulations,
      value: n(s.totals.simulations),
      hint: s.totals.demo ? `${t.admin.totals.demo}: ${n(s.totals.demo)}` : undefined,
    },
    { label: t.admin.totals.active, value: n(s.totals.active) },
    {
      label: t.admin.totals.pending,
      value: n(s.totals.pending_review),
      href: "/admin/simulations?status=pending_review",
    },
    { label: t.admin.totals.sources, value: n(s.sources), href: "/admin/sources" },
    { label: t.admin.totals.subjects, value: n(s.subjects), href: "/admin/subjects" },
    {
      label: t.admin.totals.users,
      value: n(s.users.total),
      hint: format(t.admin.totals.teachers, { n: n(s.users.teachers) }),
    },
    { label: t.admin.totals.favorites, value: n(s.totals.favorites) },
    { label: t.admin.totals.views, value: n(s.totals.views) },
    { label: t.admin.totals.externalOpens, value: n(s.totals.external_opens) },
    { label: t.admin.totals.collections, value: n(s.collections) },
    { label: t.admin.totals.openReports, value: n(s.open_reports), href: "/admin/reports" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t.admin.nav.dashboard}</h1>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((tile) => {
          const body = (
            <>
              <p className="text-muted-foreground text-xs">{tile.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{tile.value}</p>
              {tile.hint && <p className="text-muted-foreground text-xs">{tile.hint}</p>}
            </>
          );
          return (
            <li key={tile.label}>
              {tile.href ? (
                <Link
                  href={tile.href}
                  className="bg-card hover:border-primary block h-full rounded-2xl border p-4 shadow-sm"
                >
                  {body}
                </Link>
              ) : (
                <div className="bg-card h-full rounded-2xl border p-4 shadow-sm">{body}</div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="grid gap-4 md:grid-cols-2">
        <DailyColumns title={t.admin.charts.views} data={s.daily} field="views" />
        <DailyColumns title={t.admin.charts.opens} data={s.daily} field="opens" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarList title={t.admin.charts.bySubject} data={s.by_subject} />
        <BarList title={t.admin.charts.bySource} data={s.by_source} />
        <BarList title={t.admin.charts.byGrade} data={s.by_grade} />
        <BarList
          title={t.admin.charts.byLanguage}
          data={s.by_language.map((d) => {
            const name = (t.languages as Record<string, string>)[d.key] ?? d.key.toUpperCase();
            return { ...d, label: name, label_en: name };
          })}
        />
        <BarList title={t.admin.popularSubjects} data={s.popular_subjects} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="bg-card rounded-2xl border p-5 shadow-sm">
          <h2 className="mb-3 font-semibold">{t.admin.topSimulations}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-left text-xs">
                <tr>
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">{t.admin.table.title}</th>
                  <th className="py-2 pr-2 text-right">{t.admin.totals.views}</th>
                  <th className="py-2 pr-2 text-right">{t.admin.totals.externalOpens}</th>
                  <th className="py-2 text-right">{t.admin.totals.favorites}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {s.top_simulations.map((sim, i) => (
                  <tr key={sim.id}>
                    <td className="text-muted-foreground py-2 pr-2">{i + 1}</td>
                    <td className="py-2 pr-2">
                      <Link href={`/simulation/${sim.slug}`} className="hover:text-primary hover:underline">
                        {sim.title}
                      </Link>
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{n(sim.views)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{n(sim.external_opens)}</td>
                    <td className="py-2 text-right tabular-nums">{n(sim.favorites)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-4">
          <section className="bg-card rounded-2xl border p-5 shadow-sm">
            <h2 className="mb-3 font-semibold">{t.admin.topQueries}</h2>
            {s.top_queries.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t.admin.charts.noData}</p>
            ) : (
              <ol className="divide-y text-sm">
                {s.top_queries.map((q) => (
                  <li key={q.query} className="flex justify-between gap-3 py-2">
                    <Link
                      href={`/search?q=${encodeURIComponent(q.query)}`}
                      className="hover:text-primary truncate hover:underline"
                    >
                      {q.query}
                    </Link>
                    <span className="text-muted-foreground shrink-0 tabular-nums">
                      {format(t.admin.searchCount, { n: n(q.count) })} ·{" "}
                      {format(t.admin.results, { n: n(q.results) })}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section className="bg-card rounded-2xl border p-5 shadow-sm">
            <h2 className="mb-3 font-semibold">{t.admin.zeroQueries}</h2>
            {s.zero_result_queries.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t.admin.charts.noData}</p>
            ) : (
              <ul className="flex flex-wrap gap-2 text-sm">
                {s.zero_result_queries.map((q) => (
                  <li key={q.query} className="bg-warning-soft text-warning rounded-full px-3 py-1">
                    {q.query} ({n(q.count)})
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
