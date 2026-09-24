"use client";

import { BadgeCheck, FlaskConical, GraduationCap, Info, Star } from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import { SubjectIcon } from "@/components/subject-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LANGUAGE_FLAGS } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/client";
import { cn, gradeLabel } from "@/lib/utils";
import type { SimulationCardData } from "@/types/domain";
import { FavoriteButton, OpenSimulationButton } from "./simulation-actions";
import { SimulationThumbnail } from "./simulation-thumbnail";

export const SimulationCard = memo(function SimulationCard({
  sim,
  collectionId,
  priority,
  className,
}: {
  sim: SimulationCardData;
  collectionId?: string | null;
  priority?: boolean;
  className?: string;
}) {
  const { t, locale } = useI18n();
  const subjectName = sim.subject ? (locale === "vi" ? sim.subject.name_vi : sim.subject.name) : null;
  const languageName = (t.languages as Record<string, string>)[sim.language] ?? sim.language.toUpperCase();
  const detailHref = `/simulation/${sim.slug}${collectionId ? `?collection=${collectionId}` : ""}`;

  return (
    <article
      className={cn(
        "group bg-card flex h-full flex-col overflow-hidden rounded-2xl border shadow-sm transition-shadow hover:shadow-md",
        className,
      )}
      aria-labelledby={`sim-${sim.id}`}
    >
      <Link href={detailHref} tabIndex={-1} aria-hidden className="relative block">
        <SimulationThumbnail
          src={sim.thumbnail_url}
          alt=""
          color={sim.subject?.color}
          icon={sim.subject?.icon}
          priority={priority}
          className="transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {sim.is_demo && (
            <Badge variant="warning" className="bg-warning text-white">
              {t.card.demo}
            </Badge>
          )}
          {sim.is_featured && !sim.is_demo && (
            <Badge className="bg-card/95 text-foreground shadow-sm">
              <Star className="fill-amber-400 text-amber-400" /> {t.card.featured}
            </Badge>
          )}
        </div>
        <div className="absolute top-2 right-2">
          <Badge
            className={cn(
              "shadow-sm",
              sim.is_free
                ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950"
                : "bg-slate-800 text-white",
            )}
          >
            {sim.is_free ? t.card.free : t.card.paid}
          </Badge>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {sim.subject && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold"
              style={{ background: `${sim.subject.color}1a`, color: sim.subject.color }}
            >
              <SubjectIcon icon={sim.subject.icon} className="size-3.5" />
              {subjectName}
            </span>
          )}
          <span className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium">
            <GraduationCap className="size-3.5" aria-hidden />
            {gradeLabel(sim.grade_min, sim.grade_max, t.common.grade)}
          </span>
        </div>

        <h3 id={`sim-${sim.id}`} className="line-clamp-2 text-base leading-snug font-semibold">
          <Link href={detailHref} className="hover:text-primary hover:underline">
            {sim.title}
          </Link>
        </h3>

        <div className="text-muted-foreground mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {sim.source && (
            <span className="inline-flex items-center gap-1">
              <FlaskConical className="size-3.5" aria-hidden />
              {sim.source.name}
            </span>
          )}
          <span>
            <span aria-hidden>{LANGUAGE_FLAGS[sim.language] ?? "🌐"} </span>
            {languageName}
          </span>
          {sim.is_verified && (
            <span className="text-success inline-flex items-center gap-1">
              <BadgeCheck className="size-3.5" aria-hidden />
              {t.card.verified}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <OpenSimulationButton sim={sim} collectionId={collectionId} className="flex-1" size="sm" />
          <Button
            asChild
            variant="outline"
            size="icon-sm"
            aria-label={`${t.card.details}: ${sim.title}`}
            title={t.card.details}
          >
            <Link href={detailHref}>
              <Info />
            </Link>
          </Button>
          <FavoriteButton id={sim.id} title={sim.title} size="icon-sm" />
        </div>
      </div>
    </article>
  );
});

export function SimulationCardSkeleton() {
  return (
    <div className="bg-card overflow-hidden rounded-2xl border">
      <Skeleton className="aspect-video rounded-none" />
      <div className="space-y-3 p-4">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="size-8" />
          <Skeleton className="size-8" />
        </div>
      </div>
    </div>
  );
}

export function SimulationGrid({
  items,
  collectionId,
  className,
}: {
  items: SimulationCardData[];
  collectionId?: string | null;
  className?: string;
}) {
  return (
    <ul className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", className)}>
      {items.map((sim, i) => (
        <li key={sim.id}>
          <SimulationCard sim={sim} collectionId={collectionId} priority={i < 4} />
        </li>
      ))}
    </ul>
  );
}

export function SimulationGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy>
      {Array.from({ length: count }, (_, i) => (
        <SimulationCardSkeleton key={i} />
      ))}
    </div>
  );
}
