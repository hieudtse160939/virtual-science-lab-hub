import {
  BadgeCheck,
  BookOpen,
  ChevronRight,
  Clock,
  ExternalLink,
  Gauge,
  GraduationCap,
  Languages,
  Layers,
  Scale,
  ShieldAlert,
  Target,
  Wrench,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AddToCollectionButton } from "@/components/collection/add-to-collection";
import { FavoriteButton, OpenSimulationButton } from "@/components/simulation/simulation-actions";
import { SimulationRow } from "@/components/simulation/simulation-row";
import { SimulationThumbnail } from "@/components/simulation/simulation-thumbnail";
import { ReportDialog } from "@/components/simulation/report-dialog";
import { ViewTracker } from "@/components/simulation/view-tracker";
import { SubjectIcon } from "@/components/subject-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LANGUAGE_FLAGS } from "@/lib/constants";
import { isEmbeddable } from "@/lib/embed";
import { format, formatNumber } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { gradeLabel, siteUrl } from "@/lib/utils";
import { getRelatedSimulations, getSimulationBySlug } from "@/server/repositories/simulations";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ collection?: string }>;
};

async function load(slug: string) {
  if (!/^[a-z0-9-]{1,160}$/.test(slug)) return null;
  return getSimulationBySlug(slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  let sim: Awaited<ReturnType<typeof load>>;
  try {
    sim = await load(slug);
  } catch {
    return {}; // lỗi DB: để trang hiển thị error boundary
  }
  // Gọi notFound() ở đây (trước khi stream) để trả đúng HTTP 404.
  if (!sim) notFound();
  const { t } = await getI18n();
  const description = sim.short_description ?? sim.description?.slice(0, 160) ?? t.meta.defaultDescription;
  const subject = sim.subject ? ` · ${sim.subject.name}` : "";
  return {
    title: `${sim.title}${subject}`,
    description,
    alternates: { canonical: `/simulation/${sim.slug}` },
    openGraph: {
      type: "article",
      title: sim.title,
      description,
      url: `/simulation/${sim.slug}`,
      images: sim.thumbnail_url ? [{ url: sim.thumbnail_url, alt: sim.title }] : undefined,
    },
    twitter: { card: "summary_large_image", title: sim.title, description },
    robots: sim.is_demo ? { index: false } : undefined,
  };
}

export default async function SimulationPage({ params, searchParams }: Props) {
  const [{ slug }, { collection }] = await Promise.all([params, searchParams]);
  const sim = await load(slug);
  if (!sim) notFound();
  const { t, locale } = await getI18n();
  const collectionId = collection && /^[0-9a-f-]{36}$/i.test(collection) ? collection : null;
  const embeddable = isEmbeddable(sim);
  const subjectName = sim.subject ? (locale === "vi" ? sim.subject.name_vi : sim.subject.name) : null;
  const languageName = (t.languages as Record<string, string>)[sim.language] ?? sim.language.toUpperCase();
  const related = await getRelatedSimulations(sim).catch(() => []);
  const sourceName = sim.source?.name ?? t.common.unknown;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: sim.title,
    description: sim.short_description ?? sim.description ?? undefined,
    url: siteUrl(`/simulation/${sim.slug}`),
    image: sim.thumbnail_url ?? undefined,
    inLanguage: sim.language === "multi" ? undefined : sim.language,
    learningResourceType: t.types[sim.simulation_type],
    educationalLevel: `Grade ${sim.grade_min}-${sim.grade_max}`,
    about: sim.topic ?? sim.subject?.name,
    keywords: sim.tags.join(", "),
    isAccessibleForFree: sim.is_free,
    license: sim.license_url ?? undefined,
    timeRequired: sim.duration_minutes ? `PT${sim.duration_minutes}M` : undefined,
    provider: sim.source
      ? { "@type": "Organization", name: sim.source.name, url: sim.source_full?.website_url ?? undefined }
      : undefined,
    teaches: sim.learning_objectives.length > 0 ? sim.learning_objectives : undefined,
  };

  const info: { icon: typeof Clock; label: string; value: React.ReactNode }[] = [
    {
      icon: Layers,
      label: t.detail.subject,
      value: sim.subject ? (
        <Link href={`/search?subject=${sim.subject.slug}`} className="hover:text-primary hover:underline">
          {subjectName}
          {sim.sub_subject ? ` · ${sim.sub_subject}` : ""}
        </Link>
      ) : (
        t.common.unknown
      ),
    },
    {
      icon: GraduationCap,
      label: t.detail.grades,
      value: `${gradeLabel(sim.grade_min, sim.grade_max, t.common.grade)} · ${sim.education_level.map((l) => t.levels[l]).join(", ")}`,
    },
    ...(sim.topic
      ? [
          {
            icon: BookOpen,
            label: t.detail.topic,
            value: [sim.topic, sim.subtopic].filter(Boolean).join(" › "),
          },
        ]
      : []),
    { icon: Target, label: t.detail.type, value: t.types[sim.simulation_type] },
    ...(sim.duration_minutes
      ? [{ icon: Clock, label: t.detail.duration, value: `${sim.duration_minutes} ${t.common.minutes}` }]
      : []),
    ...(sim.difficulty
      ? [{ icon: Gauge, label: t.detail.difficulty, value: t.difficulty[sim.difficulty] }]
      : []),
    {
      icon: Languages,
      label: t.detail.language,
      value: `${LANGUAGE_FLAGS[sim.language] ?? "🌐"} ${languageName}`,
    },
    {
      icon: Scale,
      label: t.detail.license,
      value: (
        <span>
          {sim.license ?? t.licenses[sim.license_category]}
          {sim.license_url && (
            <>
              {" · "}
              <a
                href={sim.license_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {t.detail.viewLicense}
              </a>
            </>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ViewTracker simulationId={sim.id} collectionId={collectionId} />

      <nav
        aria-label="Breadcrumb"
        className="text-muted-foreground mb-5 flex flex-wrap items-center gap-1 text-sm"
      >
        <Link href="/" className="hover:text-foreground">
          {t.nav.home}
        </Link>
        <ChevronRight className="size-4" aria-hidden />
        <Link href="/search" className="hover:text-foreground">
          {t.nav.explore}
        </Link>
        {sim.subject && (
          <>
            <ChevronRight className="size-4" aria-hidden />
            <Link href={`/search?subject=${sim.subject.slug}`} className="hover:text-foreground">
              {subjectName}
            </Link>
          </>
        )}
        <ChevronRight className="size-4" aria-hidden />
        <span aria-current="page" className="text-foreground truncate">
          {sim.title}
        </span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          <div className="bg-card overflow-hidden rounded-2xl border shadow-sm">
            <SimulationThumbnail
              src={sim.thumbnail_url}
              alt={sim.title}
              color={sim.subject?.color}
              icon={sim.subject?.icon}
              priority
              sizes="(max-width: 1024px) 100vw, 60vw"
            />
          </div>

          <section aria-labelledby="about-heading" className="space-y-3">
            <h2 id="about-heading" className="text-lg font-semibold">
              {t.detail.about}
            </h2>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
              {sim.description ?? sim.short_description ?? "—"}
            </p>
          </section>

          {sim.learning_objectives.length > 0 && (
            <section aria-labelledby="objectives-heading" className="space-y-3">
              <h2 id="objectives-heading" className="text-lg font-semibold">
                {t.detail.objectives}
              </h2>
              <ul className="space-y-2">
                {sim.learning_objectives.map((o) => (
                  <li key={o} className="flex gap-2.5">
                    <Target className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {sim.required_equipment.length > 0 && (
            <section aria-labelledby="equipment-heading" className="space-y-3">
              <h2 id="equipment-heading" className="text-lg font-semibold">
                {t.detail.equipment}
              </h2>
              <ul className="space-y-2">
                {sim.required_equipment.map((e) => (
                  <li key={e} className="text-muted-foreground flex gap-2.5">
                    <Wrench className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {sim.tags.length > 0 && (
            <section aria-labelledby="tags-heading" className="space-y-3">
              <h2 id="tags-heading" className="text-lg font-semibold">
                {t.detail.tags}
              </h2>
              <ul className="flex flex-wrap gap-2">
                {sim.tags.map((tag) => (
                  <li key={tag}>
                    <Link
                      href={`/search?q=${encodeURIComponent(tag)}`}
                      className="bg-card hover:border-primary hover:text-primary inline-block rounded-full border px-3 py-1 text-sm"
                    >
                      #{tag}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="bg-card space-y-4 rounded-2xl border p-5 shadow-sm">
            <div className="flex flex-wrap gap-1.5">
              {sim.subject && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{ background: `${sim.subject.color}1a`, color: sim.subject.color }}
                >
                  <SubjectIcon icon={sim.subject.icon} className="size-3.5" /> {subjectName}
                </span>
              )}
              <Badge variant={sim.is_free ? "success" : "secondary"}>
                {sim.is_free ? t.card.free : t.card.paid}
              </Badge>
              {sim.is_verified && (
                <Badge variant="success">
                  <BadgeCheck /> {t.card.verified}
                </Badge>
              )}
              {sim.is_demo && <Badge variant="warning">{t.card.demo}</Badge>}
            </div>

            <div>
              <h1 className="text-2xl leading-tight font-bold tracking-tight sm:text-3xl">{sim.title}</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {t.detail.source}: <span className="text-foreground font-medium">{sourceName}</span>
              </p>
            </div>

            <OpenSimulationButton
              sim={sim}
              collectionId={collectionId}
              label={`▶ ${t.detail.openSimulation}`}
              size="xl"
              className="w-full"
            />

            <p className="bg-muted text-muted-foreground flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs">
              {embeddable ? (
                <BadgeCheck className="text-success mt-0.5 size-4 shrink-0" aria-hidden />
              ) : (
                <ExternalLink className="mt-0.5 size-4 shrink-0" aria-hidden />
              )}
              {embeddable ? t.detail.embedNotice : t.detail.externalNotice}
            </p>

            <div className="grid grid-cols-2 gap-2">
              <FavoriteButton id={sim.id} title={sim.title} withLabel />
              <AddToCollectionButton simulationId={sim.id} title={sim.title} />
            </div>
            {embeddable && (
              <Button asChild variant="link" className="w-full justify-center">
                <a href={sim.simulation_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink /> {t.detail.openOriginal}
                </a>
              </Button>
            )}
          </div>

          <div className="bg-card rounded-2xl border p-5 shadow-sm">
            <h2 className="mb-3 font-semibold">{t.detail.info}</h2>
            <dl className="divide-y">
              {info.map((row) => (
                <div key={row.label} className="grid grid-cols-[auto_1fr] items-start gap-x-3 py-2.5 text-sm">
                  <dt className="text-muted-foreground flex items-center gap-2">
                    <row.icon className="size-4" aria-hidden /> {row.label}
                  </dt>
                  <dd className="text-right font-medium">{row.value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-muted-foreground mt-3 text-xs">
              {format(t.detail.stats, {
                views: formatNumber(sim.view_count, locale),
                favorites: formatNumber(sim.favorite_count, locale),
              })}
            </p>
          </div>

          <div className="text-muted-foreground space-y-3 rounded-2xl border border-dashed p-4 text-xs">
            <p className="flex gap-2">
              <ShieldAlert className="size-4 shrink-0" aria-hidden />
              <span>{format(t.detail.copyrightNotice, { source: sourceName })}</span>
            </p>
            {!sim.is_verified && <p>{t.detail.notVerified}</p>}
            <div className="flex flex-wrap items-center gap-3">
              {sim.source_url && (
                <a
                  href={sim.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="size-3.5" aria-hidden /> {t.detail.visitSource}
                </a>
              )}
              <ReportDialog simulationId={sim.id} variant="link" size="sm" />
            </div>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <div className="mt-14">
          <Suspense>
            <SimulationRow title={t.detail.related} items={related} headingId="related-heading" />
          </Suspense>
        </div>
      )}
    </div>
  );
}
