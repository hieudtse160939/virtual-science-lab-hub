import {
  AlertTriangle,
  ArrowRight,
  Filter,
  MousePointerClick,
  Plus,
  Search as SearchIcon,
} from "lucide-react";
import { unstable_cache } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { CollectionCard } from "@/components/collection/collection-card";
import { SearchBox } from "@/components/search/search-box";
import { SimulationGridSkeleton } from "@/components/simulation/simulation-card";
import { SimulationRow } from "@/components/simulation/simulation-row";
import { SubjectIcon } from "@/components/subject-icon";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";
import { format, formatNumber } from "@/lib/i18n/config";
import { getI18n } from "@/lib/i18n/server";
import { createPublicClient } from "@/lib/supabase/public";
import { CACHE_TAGS, getCatalogCounts, getSubjects } from "@/server/repositories/catalog";
import { searchPublicCached } from "@/server/repositories/simulations";
import { listPublicCollections } from "@/server/repositories/user-content";

// Trang render động (theo ngôn ngữ/phiên), nhưng dữ liệu công khai được cache bằng unstable_cache.
const getPublicCollectionsCached = unstable_cache(
  async () => listPublicCollections(createPublicClient(), 8),
  ["home-collections"],
  { revalidate: 300, tags: [CACHE_TAGS.collections] },
);

const QUICK_SEARCHES = {
  vi: ["định luật Newton", "phản ứng hóa học", "DNA", "mạch điện", "phân số", "hệ Mặt Trời"],
  en: ["Newton's laws", "chemical reactions", "DNA", "circuits", "fractions", "solar system"],
};

function SectionError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="text-muted-foreground flex items-center gap-2 rounded-xl border border-dashed p-6 text-sm"
    >
      <AlertTriangle className="text-warning size-4" aria-hidden /> {message}
    </div>
  );
}

async function SubjectsSection() {
  const { t, locale } = await getI18n();
  try {
    const [subjects, counts] = await Promise.all([getSubjects(), getCatalogCounts()]);
    return (
      <section aria-labelledby="subjects-heading" className="space-y-4">
        <h2 id="subjects-heading" className="text-xl font-bold tracking-tight sm:text-2xl">
          {t.home.exploreBySubject}
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {subjects.map((s) => (
            <li key={s.id}>
              <Link
                href={`/search?subject=${s.slug}`}
                className="group bg-card flex h-full items-center gap-3 rounded-2xl border p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <span
                  className="flex size-12 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: `${s.color}1a`, color: s.color }}
                >
                  <SubjectIcon icon={s.icon} className="size-6" />
                </span>
                <span className="min-w-0">
                  <span className="group-hover:text-primary block truncate font-semibold">
                    {locale === "vi" ? s.name_vi : s.name}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {format(t.home.simulationsCount, {
                      n: formatNumber(counts.subjects[s.slug] ?? 0, locale),
                    })}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  } catch {
    return <SectionError message={t.errors.timeout} />;
  }
}

async function RowsSection() {
  const { t } = await getI18n();
  try {
    const [popular, recent] = await Promise.all([
      searchPublicCached({ sort: "popular" }, 12),
      searchPublicCached({ sort: "newest" }, 12),
    ]);
    if (popular.items.length === 0) {
      return <SectionError message={t.home.emptyCatalog} />;
    }
    return (
      <>
        <SimulationRow
          title={t.home.popular}
          href="/search?sort=popular"
          items={popular.items}
          headingId="popular-heading"
        />
        <SimulationRow
          title={t.home.recent}
          href="/search?sort=newest"
          items={recent.items}
          headingId="recent-heading"
        />
      </>
    );
  } catch {
    return <SectionError message={t.errors.timeout} />;
  }
}

async function CollectionsSection() {
  const { t } = await getI18n();
  let collections: Awaited<ReturnType<typeof getPublicCollectionsCached>> = [];
  try {
    collections = await getPublicCollectionsCached();
  } catch {
    return <SectionError message={t.errors.timeout} />;
  }
  return (
    <section aria-labelledby="teachers-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="teachers-heading" className="text-xl font-bold tracking-tight sm:text-2xl">
            {t.home.forTeachers}
          </h2>
          <p className="text-muted-foreground text-sm">{t.home.forTeachersHint}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/teacher">
            <Plus /> {t.home.createCollection}
          </Link>
        </Button>
      </div>
      {collections.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
          {t.home.noCollections}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {collections.map((c) => (
            <li key={c.id}>
              <CollectionCard collection={c} covers={c.covers} href={`/collection/${c.slug}`} t={t} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function CatalogStat() {
  const { t, locale } = await getI18n();
  try {
    const counts = await getCatalogCounts();
    if (counts.total === 0) return null;
    return (
      <p className="text-muted-foreground text-sm">
        {format(t.home.catalogStat, {
          n: formatNumber(counts.total, locale),
          s: formatNumber(Object.keys(counts.sources).length, locale),
        })}
      </p>
    );
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const { t, locale } = await getI18n();
  const configured = isSupabaseConfigured();

  return (
    <div>
      <section
        className="relative overflow-hidden border-b"
        style={{ background: "linear-gradient(160deg, var(--hero-from), var(--hero-to))" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:22px_22px] opacity-[0.35]"
        />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 pt-14 pb-16 text-center sm:pt-20 sm:pb-20">
          <p className="bg-card/70 text-primary mb-4 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase">
            {t.home.heroEyebrow}
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
            Virtual <span className="text-primary">Science Lab</span>
          </h1>
          <p className="text-muted-foreground mt-4 max-w-2xl text-lg sm:text-xl">{t.home.heroSubtitle}</p>
          <div className="mt-8 w-full">
            <Suspense>
              <SearchBox variant="hero" placeholder={t.home.searchPlaceholder} />
            </Suspense>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="text-muted-foreground">{t.home.quickSearches}</span>
            {QUICK_SEARCHES[locale].map((q) => (
              <Link
                key={q}
                href={`/search?q=${encodeURIComponent(q)}`}
                className="bg-card/80 hover:border-primary hover:text-primary rounded-full border px-3 py-1 font-medium"
              >
                {q}
              </Link>
            ))}
          </div>
          <div className="mt-4 min-h-5">
            {configured && (
              <Suspense>
                <CatalogStat />
              </Suspense>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-14 px-4 py-12 sm:px-6">
        {!configured ? (
          <SectionError message={t.errors.notConfigured} />
        ) : (
          <>
            <Suspense fallback={<div className="bg-muted h-48 animate-pulse rounded-2xl" />}>
              <SubjectsSection />
            </Suspense>

            <section aria-labelledby="steps-heading" className="bg-card rounded-2xl border p-6 shadow-sm">
              <h2 id="steps-heading" className="sr-only">
                {t.home.stepsTitle}
              </h2>
              <ol className="grid gap-6 sm:grid-cols-3">
                {[
                  { icon: SearchIcon, title: t.home.step1, hint: t.home.step1Hint },
                  { icon: Filter, title: t.home.step2, hint: t.home.step2Hint },
                  { icon: MousePointerClick, title: t.home.step3, hint: t.home.step3Hint },
                ].map((s, i) => (
                  <li key={s.title} className="flex items-start gap-3">
                    <span className="bg-primary-soft text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                      <s.icon className="size-5" aria-hidden />
                    </span>
                    <span>
                      <span className="block font-semibold">
                        {i + 1}. {s.title}
                      </span>
                      <span className="text-muted-foreground text-sm">{s.hint}</span>
                    </span>
                    {i < 2 && (
                      <ArrowRight
                        className="text-muted-foreground mt-2 ml-auto hidden size-4 sm:block"
                        aria-hidden
                      />
                    )}
                  </li>
                ))}
              </ol>
            </section>

            <Suspense fallback={<SimulationGridSkeleton count={4} />}>
              <RowsSection />
            </Suspense>

            <Suspense fallback={<SimulationGridSkeleton count={4} />}>
              <CollectionsSection />
            </Suspense>
          </>
        )}
      </div>
    </div>
  );
}
