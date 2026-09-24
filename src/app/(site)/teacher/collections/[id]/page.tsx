import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CollectionEditor } from "@/components/collection/collection-editor";
import { getI18n } from "@/lib/i18n/server";
import { siteUrl } from "@/lib/utils";
import { requirePageSession } from "@/server/auth";
import { getCollectionById, listCollectionItems } from "@/server/repositories/user-content";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.collections.manage, robots: { index: false } };
}

export default async function ManageCollectionPage({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ t }, session] = await Promise.all([
    getI18n(),
    requirePageSession(`/teacher/collections/${id}`, "teacher"),
  ]);
  const collection = await getCollectionById(session.supabase, id);
  if (!collection || collection.owner_id !== session.user.id) notFound();
  const items = await listCollectionItems(session.supabase, id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link
        href="/teacher"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> {t.teacher.title}
      </Link>
      <h1 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">{collection.name}</h1>
      <CollectionEditor
        collection={collection}
        items={items}
        shareUrl={siteUrl(`/collection/${collection.slug}`)}
      />
    </div>
  );
}
