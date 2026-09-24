import { Globe2, Layers, Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { SubjectIcon } from "@/components/subject-icon";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/config";
import type { Collection } from "@/types/domain";

export interface CollectionCover {
  thumbnail_url: string | null;
  icon?: string;
  color?: string;
}

export function CollectionCard({
  collection,
  covers = [],
  href,
  t,
  showVisibility = false,
}: {
  collection: Collection;
  covers?: CollectionCover[];
  href: string;
  t: Dictionary;
  showVisibility?: boolean;
}) {
  const tiles = [...covers.slice(0, 4)];
  while (tiles.length < 4) tiles.push({ thumbnail_url: null });
  return (
    <Link
      href={href}
      className="group bg-card flex h-full flex-col overflow-hidden rounded-2xl border shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="bg-border grid aspect-video grid-cols-2 grid-rows-2 gap-0.5" aria-hidden>
        {tiles.map((c, i) =>
          c.thumbnail_url ? (
            <div key={i} className="bg-muted relative">
              <Image src={c.thumbnail_url} alt="" fill sizes="160px" className="object-cover" />
            </div>
          ) : (
            <div
              key={i}
              className="bg-muted text-muted-foreground flex items-center justify-center"
              style={c.color ? { background: `${c.color}1f`, color: c.color } : undefined}
            >
              {c.icon ? (
                <SubjectIcon icon={c.icon} className="size-6" />
              ) : (
                <Layers className="size-5 opacity-40" />
              )}
            </div>
          ),
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="group-hover:text-primary line-clamp-2 font-semibold">{collection.name}</h3>
        {collection.description && (
          <p className="text-muted-foreground line-clamp-2 text-sm">{collection.description}</p>
        )}
        <div className="text-muted-foreground mt-auto flex items-center gap-3 pt-2 text-xs">
          <span className="inline-flex items-center gap-1">
            <Layers className="size-3.5" aria-hidden />
            {format(t.collections.items, { n: collection.item_count })}
          </span>
          {showVisibility && (
            <span className="inline-flex items-center gap-1">
              {collection.is_public ? (
                <Globe2 className="size-3.5" aria-hidden />
              ) : (
                <Lock className="size-3.5" aria-hidden />
              )}
              {collection.is_public ? t.collections.visibilityPublic : t.collections.visibilityPrivate}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
