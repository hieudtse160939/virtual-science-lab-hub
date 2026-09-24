import { Activity, Eye, FolderOpen, MousePointerClick } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CollectionCard } from "@/components/collection/collection-card";
import { CreateCollectionDialog } from "@/components/collection/create-collection-dialog";
import { SimulationGrid } from "@/components/simulation/simulation-card";
import { EmptyState } from "@/components/states";
import { DashboardTabs, type TeacherTab } from "@/components/teacher/dashboard-tabs";
import { Button } from "@/components/ui/button";
import { format, formatDate, formatNumber } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { requirePageSession } from "@/server/auth";
import {
  getTeacherActivity,
  listFavorites,
  listMyCollections,
  listRecentActivity,
} from "@/server/repositories/user-content";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.teacher.title, robots: { index: false } };
}

const TABS: TeacherTab[] = ["collections", "favorites", "recent", "activity"];

export default async function TeacherPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ t, locale }, session, { tab }] = await Promise.all([
    getI18n(),
    requirePageSession("/teacher", "teacher"),
    searchParams,
  ]);
  const { supabase, user } = session;
  const [collections, favorites, recent, activity] = await Promise.all([
    listMyCollections(supabase, user.id),
    listFavorites(supabase, user.id, 0, 12),
    listRecentActivity(supabase, user.id, 24),
    getTeacherActivity(supabase, 30),
  ]);
  const initial = TABS.includes(tab as TeacherTab) ? (tab as TeacherTab) : "collections";

  const collectionsPanel =
    collections.length === 0 ? (
      <EmptyState
        icon={<FolderOpen className="size-7" aria-hidden />}
        title={t.collections.empty}
        hint={t.collections.emptyHint}
        action={<CreateCollectionDialog />}
      />
    ) : (
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {collections.map((c) => (
          <li key={c.id}>
            <CollectionCard collection={c} href={`/teacher/collections/${c.id}`} t={t} showVisibility />
          </li>
        ))}
      </ul>
    );

  const favoritesPanel =
    favorites.items.length === 0 ? (
      <EmptyState title={t.favorites.empty} hint={t.favorites.emptyHint} />
    ) : (
      <div className="space-y-6">
        <SimulationGrid items={favorites.items} />
        {favorites.hasMore && (
          <div className="flex justify-center">
            <Button asChild variant="outline">
              <Link href="/favorites">{t.common.viewAll}</Link>
            </Button>
          </div>
        )}
      </div>
    );

  const recentPanel =
    recent.length === 0 ? (
      <EmptyState title={t.teacher.recentEmpty} />
    ) : (
      <ul className="bg-card divide-y rounded-2xl border">
        {recent.map((r) => (
          <li key={r.simulation.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Link
              href={`/simulation/${r.simulation.slug}`}
              className="hover:text-primary min-w-0 flex-1 truncate font-medium hover:underline"
            >
              {r.simulation.title}
            </Link>
            <span className="text-muted-foreground text-xs">
              {format(t.teacher.openedTimes, { n: formatNumber(r.openCount, locale) })} ·{" "}
              {format(t.teacher.lastOpened, {
                date: formatDate(r.lastOpenedAt, locale, { dateStyle: "medium", timeStyle: "short" }),
              })}
            </span>
          </li>
        ))}
      </ul>
    );

  const activityPanel = (
    <div className="space-y-4">
      <p className="bg-muted text-muted-foreground flex gap-2 rounded-xl px-4 py-3 text-sm">
        <Activity className="mt-0.5 size-4 shrink-0" aria-hidden /> {t.teacher.activityHint}
      </p>
      {activity.every((a) => a.views === 0 && a.opens === 0) ? (
        <EmptyState title={t.teacher.activityEmpty} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {activity.map((a) => (
            <li key={a.id} className="bg-card rounded-2xl border p-5 shadow-sm">
              <Link
                href={`/teacher/collections/${a.id}`}
                className="hover:text-primary font-semibold hover:underline"
              >
                {a.name}
              </Link>
              <dl className="mt-3 grid grid-cols-2 gap-3">
                <div className="bg-muted rounded-xl p-3">
                  <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <Eye className="size-3.5" aria-hidden /> {t.teacher.activityViews}
                  </dt>
                  <dd className="text-2xl font-bold tabular-nums">{formatNumber(a.views, locale)}</dd>
                </div>
                <div className="bg-muted rounded-xl p-3">
                  <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <MousePointerClick className="size-3.5" aria-hidden /> {t.teacher.activityOpens}
                  </dt>
                  <dd className="text-2xl font-bold tabular-nums">{formatNumber(a.opens, locale)}</dd>
                </div>
              </dl>
              {a.top.length > 0 && (
                <div className="mt-4">
                  <p className="text-muted-foreground mb-2 text-xs font-semibold">{t.teacher.activityTop}</p>
                  <ol className="space-y-1.5 text-sm">
                    {a.top.map((s) => (
                      <li key={s.slug} className="flex justify-between gap-3">
                        <span className="truncate">{s.title}</span>
                        <span className="text-muted-foreground shrink-0 tabular-nums">
                          {formatNumber(s.opens, locale)}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.teacher.title}</h1>
          <p className="text-muted-foreground mt-1">{t.teacher.subtitle}</p>
        </div>
        <CreateCollectionDialog />
      </div>
      <DashboardTabs
        initial={initial}
        panels={{
          collections: collectionsPanel,
          favorites: favoritesPanel,
          recent: recentPanel,
          activity: activityPanel,
        }}
      />
    </div>
  );
}
