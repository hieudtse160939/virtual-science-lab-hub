import { Heart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SimulationGrid } from "@/components/simulation/simulation-card";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/lib/i18n/server";
import { requirePageSession } from "@/server/auth";
import { listFavorites } from "@/server/repositories/user-content";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.favorites.title, robots: { index: false } };
}

export default async function FavoritesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const [{ t }, session, { page: pageParam }] = await Promise.all([
    getI18n(),
    requirePageSession("/favorites"),
    searchParams,
  ]);
  const page = Math.max(Number(pageParam) || 0, 0);
  const { items, hasMore } = await listFavorites(session.supabase, session.user.id, page);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-bold tracking-tight">
        <Heart className="size-6 text-rose-500" aria-hidden /> {t.favorites.title}
      </h1>
      {items.length === 0 && page === 0 ? (
        <EmptyState
          title={t.favorites.empty}
          hint={t.favorites.emptyHint}
          action={
            <Button asChild>
              <Link href="/search">{t.nav.explore}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <SimulationGrid items={items} />
          <nav className="mt-8 flex justify-center gap-2" aria-label={t.common.page}>
            {page > 0 && (
              <Button asChild variant="outline">
                <Link href={`/favorites?page=${page - 1}`}>{t.common.previous}</Link>
              </Button>
            )}
            {hasMore && (
              <Button asChild variant="outline">
                <Link href={`/favorites?page=${page + 1}`}>{t.common.next}</Link>
              </Button>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
