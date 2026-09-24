"use client";

import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogTitle, DialogTrigger, SheetContent } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  DURATION_BUCKETS,
  EDUCATION_LEVEL_GRADES,
  EDUCATION_LEVELS,
  GRADES,
  LANGUAGE_FILTERS,
  LICENSE_CATEGORIES,
  SIMULATION_TYPES,
} from "@/lib/constants";
import { useI18n } from "@/lib/i18n/client";
import { format, formatNumber } from "@/lib/i18n/config";
import { countActiveFilters } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import type { SearchFilters, Source, Subject } from "@/types/domain";
import { useSearchNav } from "./search-shell";

export interface FilterPanelData {
  subjects: Pick<Subject, "slug" | "name" | "name_vi">[];
  sources: Pick<Source, "slug" | "name" | "is_verified">[];
  subjectCounts: Record<string, number>;
  sourceCounts: Record<string, number>;
}

function toggle<T>(list: T[] | undefined, value: T): T[] | undefined {
  const set = new Set(list ?? []);
  if (set.has(value)) set.delete(value);
  else set.add(value);
  return set.size > 0 ? Array.from(set) : undefined;
}

function Group({
  title,
  children,
  defaultOpen = true,
  count,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  count?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="border-b py-4 last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold"
      >
        <span className="flex items-center gap-2">
          {title}
          {!!count && <Badge className="px-1.5">{count}</Badge>}
        </span>
        <ChevronDown
          className={cn("text-muted-foreground size-4 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      <div id={id} hidden={!open} className="mt-3">
        {children}
      </div>
    </div>
  );
}

function CheckItem({
  label,
  checked,
  onChange,
  count,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  count?: number;
}) {
  const id = useId();
  return (
    <div className="flex min-h-9 items-center gap-2.5">
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} />
      <label htmlFor={id} className="flex flex-1 cursor-pointer items-center justify-between gap-2 text-sm">
        <span>{label}</span>
        {count !== undefined && <span className="text-muted-foreground text-xs tabular-nums">{count}</span>}
      </label>
    </div>
  );
}

function FilterFields({ data }: { data: FilterPanelData }) {
  const { t, locale } = useI18n();
  const { filters, patch } = useSearchNav();
  const [showAllSources, setShowAllSources] = useState(false);
  const sortedSources = [...data.sources].sort(
    (a, b) => (data.sourceCounts[b.slug] ?? 0) - (data.sourceCounts[a.slug] ?? 0),
  );
  const visibleSources = showAllSources ? sortedSources : sortedSources.slice(0, 6);
  const levelGrades = (filters.levels ?? []).flatMap((l) => {
    const [a, b] = EDUCATION_LEVEL_GRADES[l];
    return Array.from({ length: b - a + 1 }, (_, i) => a + i);
  });

  return (
    <div>
      <div className="space-y-3 border-b pb-4">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="free-only" className="text-sm font-medium">
            {t.search.freeOnly}
          </label>
          <Switch
            id="free-only"
            checked={!!filters.freeOnly}
            onCheckedChange={(v) => patch({ freeOnly: v || undefined })}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="verified-only" className="text-sm font-medium">
            {t.search.verifiedOnly}
          </label>
          <Switch
            id="verified-only"
            checked={!!filters.verifiedOnly}
            onCheckedChange={(v) => patch({ verifiedOnly: v || undefined })}
          />
        </div>
      </div>

      <Group title={t.filters.subject} count={filters.subjects?.length}>
        {data.subjects.map((s) => (
          <CheckItem
            key={s.slug}
            label={locale === "vi" ? s.name_vi : s.name}
            checked={!!filters.subjects?.includes(s.slug)}
            onChange={() => patch({ subjects: toggle(filters.subjects, s.slug) })}
            count={data.subjectCounts[s.slug] ?? 0}
          />
        ))}
      </Group>

      <Group title={t.filters.level} count={filters.levels?.length}>
        {EDUCATION_LEVELS.map((l) => (
          <CheckItem
            key={l}
            label={`${t.levels[l]} (${EDUCATION_LEVEL_GRADES[l][0]}–${EDUCATION_LEVEL_GRADES[l][1]})`}
            checked={!!filters.levels?.includes(l)}
            onChange={() => patch({ levels: toggle(filters.levels, l) })}
          />
        ))}
      </Group>

      <Group title={t.filters.grade} count={filters.grades?.length}>
        <div className="grid grid-cols-6 gap-1.5" role="group" aria-label={t.filters.grade}>
          {GRADES.map((g) => {
            const active = !!filters.grades?.includes(g);
            const implied = !active && levelGrades.includes(g);
            return (
              <button
                key={g}
                type="button"
                aria-pressed={active}
                aria-label={`${t.common.grade} ${g}`}
                onClick={() => patch({ grades: toggle(filters.grades, g)?.sort((a, b) => a - b) })}
                className={cn(
                  "h-9 rounded-lg border text-sm font-semibold tabular-nums transition-colors",
                  active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-accent",
                  implied && "border-primary/40 bg-primary-soft",
                )}
              >
                {g}
              </button>
            );
          })}
        </div>
      </Group>

      <Group title={t.filters.language} count={filters.languages?.length}>
        {LANGUAGE_FILTERS.map((l) => (
          <CheckItem
            key={l}
            label={t.languages[l]}
            checked={!!filters.languages?.includes(l)}
            onChange={() => patch({ languages: toggle(filters.languages, l) })}
          />
        ))}
      </Group>

      <Group title={t.filters.source} count={filters.sources?.length}>
        {visibleSources.map((s) => (
          <CheckItem
            key={s.slug}
            label={s.name}
            checked={!!filters.sources?.includes(s.slug)}
            onChange={() => patch({ sources: toggle(filters.sources, s.slug) })}
            count={data.sourceCounts[s.slug] ?? 0}
          />
        ))}
        <CheckItem
          label={t.filters.otherSource}
          checked={!!filters.sources?.includes("other")}
          onChange={() => patch({ sources: toggle(filters.sources, "other") })}
        />
        {sortedSources.length > 6 && (
          <Button variant="link" size="sm" className="mt-1" onClick={() => setShowAllSources((v) => !v)}>
            {showAllSources ? t.common.showLess : `${t.common.showMore} (${sortedSources.length - 6})`}
          </Button>
        )}
      </Group>

      <Group title={t.filters.type} count={filters.types?.length} defaultOpen={false}>
        {SIMULATION_TYPES.map((v) => (
          <CheckItem
            key={v}
            label={t.types[v]}
            checked={!!filters.types?.includes(v)}
            onChange={() => patch({ types: toggle(filters.types, v) })}
          />
        ))}
      </Group>

      <Group title={t.filters.license} count={filters.licenses?.length} defaultOpen={false}>
        {LICENSE_CATEGORIES.map((v) => (
          <CheckItem
            key={v}
            label={t.licenses[v]}
            checked={!!filters.licenses?.includes(v)}
            onChange={() => patch({ licenses: toggle(filters.licenses, v) })}
          />
        ))}
      </Group>

      <Group title={t.filters.duration} count={filters.durations?.length} defaultOpen={false}>
        {DURATION_BUCKETS.map((v) => (
          <CheckItem
            key={v}
            label={t.durations[v]}
            checked={!!filters.durations?.includes(v)}
            onChange={() => patch({ durations: toggle(filters.durations, v) })}
          />
        ))}
      </Group>
    </div>
  );
}

const EMPTY_FILTERS = (f: SearchFilters): SearchFilters => ({ q: f.q, sort: f.sort });

export function FilterSidebar({ data }: { data: FilterPanelData }) {
  const { t } = useI18n();
  const { filters, setFilters } = useSearchNav();
  const active = countActiveFilters(filters);
  return (
    <aside aria-label={t.search.filters} className="hidden lg:block">
      <div className="bg-card sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold">
            <SlidersHorizontal className="size-4" aria-hidden /> {t.search.filters}
          </h2>
          {active > 0 && (
            <Button variant="link" size="sm" onClick={() => setFilters(EMPTY_FILTERS(filters))}>
              {t.search.clearFilters}
            </Button>
          )}
        </div>
        <FilterFields data={data} />
      </div>
    </aside>
  );
}

export function MobileFilterButton({ data, resultLabel }: { data: FilterPanelData; resultLabel: string }) {
  const { t } = useI18n();
  const { filters, setFilters } = useSearchNav();
  const active = countActiveFilters(filters);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="lg:hidden">
          <SlidersHorizontal /> {t.search.filters}
          {active > 0 && <Badge className="ml-1">{active}</Badge>}
        </Button>
      </DialogTrigger>
      <SheetContent closeLabel={t.common.close} aria-describedby={undefined}>
        <div className="border-b p-4">
          <DialogTitle>{t.search.filters}</DialogTitle>
        </div>
        <div className="flex-1 overflow-y-auto px-4">
          <FilterFields data={data} />
        </div>
        <div className="flex gap-2 border-t p-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setFilters(EMPTY_FILTERS(filters))}
            disabled={active === 0}
          >
            {t.search.clearFilters}
          </Button>
          <DialogTrigger asChild>
            <Button className="flex-1">{resultLabel}</Button>
          </DialogTrigger>
        </div>
      </SheetContent>
    </Dialog>
  );
}

/** Các "chip" bộ lọc đang áp dụng, bấm để bỏ từng bộ lọc. */
export function ActiveFilterChips({ data }: { data: FilterPanelData }) {
  const { t, locale } = useI18n();
  const { filters, patch } = useSearchNav();
  const chips: { key: string; label: string; remove: () => void }[] = [];
  const subjectName = (slug: string) => {
    const s = data.subjects.find((x) => x.slug === slug);
    return s ? (locale === "vi" ? s.name_vi : s.name) : slug;
  };
  filters.subjects?.forEach((v) =>
    chips.push({
      key: `s-${v}`,
      label: subjectName(v),
      remove: () => patch({ subjects: toggle(filters.subjects, v) }),
    }),
  );
  filters.levels?.forEach((v) =>
    chips.push({
      key: `l-${v}`,
      label: t.levels[v],
      remove: () => patch({ levels: toggle(filters.levels, v) }),
    }),
  );
  filters.grades?.forEach((v) =>
    chips.push({
      key: `g-${v}`,
      label: `${t.common.grade} ${v}`,
      remove: () => patch({ grades: toggle(filters.grades, v) }),
    }),
  );
  filters.languages?.forEach((v) =>
    chips.push({
      key: `lang-${v}`,
      label: t.languages[v as keyof typeof t.languages] ?? v,
      remove: () => patch({ languages: toggle(filters.languages, v) }),
    }),
  );
  filters.sources?.forEach((v) =>
    chips.push({
      key: `src-${v}`,
      label: v === "other" ? t.filters.otherSource : (data.sources.find((s) => s.slug === v)?.name ?? v),
      remove: () => patch({ sources: toggle(filters.sources, v) }),
    }),
  );
  filters.types?.forEach((v) =>
    chips.push({
      key: `t-${v}`,
      label: t.types[v],
      remove: () => patch({ types: toggle(filters.types, v) }),
    }),
  );
  filters.licenses?.forEach((v) =>
    chips.push({
      key: `lic-${v}`,
      label: t.licenses[v],
      remove: () => patch({ licenses: toggle(filters.licenses, v) }),
    }),
  );
  filters.durations?.forEach((v) =>
    chips.push({
      key: `d-${v}`,
      label: t.durations[v],
      remove: () => patch({ durations: toggle(filters.durations, v) }),
    }),
  );
  if (filters.freeOnly)
    chips.push({ key: "free", label: t.search.freeOnly, remove: () => patch({ freeOnly: undefined }) });
  if (filters.verifiedOnly)
    chips.push({
      key: "verified",
      label: t.search.verifiedOnly,
      remove: () => patch({ verifiedOnly: undefined }),
    });
  if (chips.length === 0) return null;
  return (
    <ul
      className="flex flex-wrap gap-2"
      aria-label={format(t.search.activeFilters, { n: formatNumber(chips.length, locale) })}
    >
      {chips.map((c) => (
        <li key={c.key}>
          <button
            type="button"
            onClick={c.remove}
            className="bg-card hover:border-destructive hover:text-destructive inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium"
            aria-label={`${t.common.remove}: ${c.label}`}
          >
            {c.label} <X className="size-3" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
