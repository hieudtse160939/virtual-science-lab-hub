import { GraduationCap, Layers, Lock, Pencil, StickyNote } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CollectionViewTracker } from "@/components/collection/collection-view-tracker";
import { SimulationCard } from "@/components/simulation/simulation-card";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { format, formatDate } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/server/auth";
import {
  getCollectionBySlug,
  getOwnerDisplayName,
  listCollectionItems,
} from "@/server/repositories/user-content";

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string) {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const client = await createClient();
  const collection = await getCollectionBySlug(client, slug);
  return collection ? { client, collection } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  let data: Awaited<ReturnType<typeof load>>;
  try {
    data = await load(slug);
  } catch {
    return {};
  }
  if (!data) notFound();
  return {
    title: data.collection.name,
    description: data.collection.description ?? undefined,
    alternates: { canonical: `/collection/${slug}` },
    robots: data.collection.is_public ? undefined : { index: false },
  };
}

/** Trang bộ sưu tập giáo viên chia sẻ cho học sinh – không cần đăng nhập nếu công khai. */
export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { client, collection } = data;
  const [{ t, locale }, session, items] = await Promise.all([
    getI18n(),
    getSession(),
    listCollectionItems(client, collection.id),
  ]);
  const isOwner = session?.user.id === collection.owner_id;
  const ownerName = isOwner ? await getOwnerDisplayName(client, collection.owner_id) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <CollectionViewTracker collectionId={collection.id} isOwner={isOwner} />
      <header className="bg-card mb-8 rounded-2xl border p-6 shadow-sm sm:p-8">
        <p className="text-primary mb-2 inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
          <GraduationCap className="size-4" aria-hidden /> {t.collections.title}
          {!collection.is_public && (
            <span className="bg-muted text-muted-foreground ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 normal-case">
              <Lock className="size-3" aria-hidden /> {t.collections.visibilityPrivate}
            </span>
          )}
        </p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">{collection.name}</h1>
        {collection.description && (
          <p className="text-muted-foreground mt-3 max-w-3xl whitespace-pre-line">{collection.description}</p>
        )}
        <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-1">
            <Layers className="size-4" aria-hidden /> {format(t.collections.items, { n: items.length })}
          </span>
          {ownerName && <span>{format(t.collections.by, { name: ownerName })}</span>}
          <span>{format(t.collections.updatedAt, { date: formatDate(collection.updated_at, locale) })}</span>
          {isOwner && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/teacher/collections/${collection.id}`}>
                <Pencil /> {t.collections.manage}
              </Link>
            </Button>
          )}
        </div>
      </header>

      {items.length === 0 ? (
        <EmptyState title={t.collections.emptyItems} />
      ) : (
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item, i) => (
            <li key={item.simulation_id} className="flex flex-col gap-2">
              <span className="text-muted-foreground text-xs font-bold">#{i + 1}</span>
              {item.note && (
                <p className="bg-warning-soft flex gap-2 rounded-xl px-3 py-2 text-sm">
                  <StickyNote className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>{item.note}</span>
                </p>
              )}
              <SimulationCard
                sim={item.simulation}
                collectionId={collection.id}
                priority={i < 4}
                className="flex-1"
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
