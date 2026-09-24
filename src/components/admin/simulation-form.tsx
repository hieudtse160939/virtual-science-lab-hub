"use client";

import { ExternalLink, Loader2, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { FieldError, Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ApiError, apiFetch, errorMessage } from "@/lib/api-client";
import { DIFFICULTIES, GRADES, LICENSE_CATEGORIES, SIMULATION_TYPES } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/client";
import type { MetadataSuggestion } from "@/lib/metadata/classifier";
import type { SimulationDetail, Source, Subject } from "@/types/domain";

interface FormState {
  title: string;
  slug: string;
  short_description: string;
  description: string;
  subject_id: string;
  sub_subject: string;
  grade_min: number;
  grade_max: number;
  topic: string;
  subtopic: string;
  simulation_type: string;
  source_id: string;
  source_url: string;
  simulation_url: string;
  embed_url: string;
  thumbnail_url: string;
  language: string;
  license: string;
  license_url: string;
  license_category: string;
  difficulty: string;
  duration_minutes: string;
  learning_objectives: string;
  required_equipment: string;
  tags: string;
  is_free: boolean;
  is_verified: boolean;
  is_featured: boolean;
  is_active: boolean;
  status: string;
}

function initialState(sim?: SimulationDetail | null): FormState {
  return {
    title: sim?.title ?? "",
    slug: sim?.slug ?? "",
    short_description: sim?.short_description ?? "",
    description: sim?.description ?? "",
    subject_id: sim?.subject_id ?? "",
    sub_subject: sim?.sub_subject ?? "",
    grade_min: sim?.grade_min ?? 1,
    grade_max: sim?.grade_max ?? 12,
    topic: sim?.topic ?? "",
    subtopic: sim?.subtopic ?? "",
    simulation_type: sim?.simulation_type ?? "simulation",
    source_id: sim?.source_id ?? "",
    source_url: sim?.source_url ?? "",
    simulation_url: sim?.simulation_url ?? "",
    embed_url: sim?.embed_url ?? "",
    thumbnail_url: sim?.thumbnail_url ?? "",
    language: sim?.language ?? "vi",
    license: sim?.license ?? "",
    license_url: sim?.license_url ?? "",
    license_category: sim?.license_category ?? "external_free",
    difficulty: sim?.difficulty ?? "",
    duration_minutes: sim?.duration_minutes?.toString() ?? "",
    learning_objectives: sim?.learning_objectives.join("\n") ?? "",
    required_equipment: sim?.required_equipment.join("\n") ?? "",
    tags: sim?.tags.join(", ") ?? "",
    is_free: sim?.is_free ?? true,
    is_verified: sim?.is_verified ?? false,
    is_featured: sim?.is_featured ?? false,
    is_active: sim?.is_active ?? true,
    status: sim?.status ?? "published",
  };
}

const splitLines = (v: string) =>
  v
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="bg-card space-y-4 rounded-2xl border p-5 shadow-sm">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

export function SimulationForm({
  simulation,
  subjects,
  sources,
}: {
  simulation?: SimulationDetail | null;
  subjects: Subject[];
  sources: Source[];
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initialState(simulation));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const f = t.admin.form;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const field = (
    key: keyof FormState,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
    hint?: string,
  ) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`f-${key}`}>{label}</Label>
      <Input
        id={`f-${key}`}
        value={String(form[key] ?? "")}
        onChange={(e) => set(key, e.target.value as never)}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `e-${key}` : hint ? `h-${key}` : undefined}
        {...props}
      />
      {hint && !errors[key] && (
        <p id={`h-${key}`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      )}
      <FieldError id={`e-${key}`} message={errors[key]} />
    </div>
  );

  const suggest = async () => {
    if (!form.title.trim()) return;
    setSuggesting(true);
    try {
      const s = await apiFetch<MetadataSuggestion>("/api/admin/classify", {
        method: "POST",
        json: { title: form.title, description: form.description, url: form.simulation_url },
      });
      setForm((prev) => ({
        ...prev,
        subject_id: prev.subject_id || subjects.find((x) => x.slug === s.subject)?.id || "",
        grade_min: simulation ? prev.grade_min : (s.grade_min ?? prev.grade_min),
        grade_max: simulation ? prev.grade_max : (s.grade_max ?? prev.grade_max),
        topic: prev.topic || s.topic || "",
        simulation_type:
          prev.simulation_type === "simulation" && s.simulation_type
            ? s.simulation_type
            : prev.simulation_type,
        difficulty: prev.difficulty || s.difficulty || "",
        language: prev.language || s.language || "en",
        source_id: prev.source_id || sources.find((x) => x.name === s.source_name)?.id || "",
        tags: prev.tags || s.tags.join(", "),
      }));
      toast.success(f.suggestApplied);
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setSuggesting(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const payload = {
      ...form,
      slug: form.slug.trim() || null,
      subject_id: form.subject_id || null,
      source_id: form.source_id || null,
      difficulty: form.difficulty || null,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
      grade_min: Number(form.grade_min),
      grade_max: Number(form.grade_max),
      learning_objectives: splitLines(form.learning_objectives),
      required_equipment: splitLines(form.required_equipment),
      tags: form.tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    try {
      if (simulation) {
        await apiFetch(`/api/admin/simulations/${simulation.id}`, { method: "PATCH", json: payload });
        toast.success(f.saved);
        router.refresh();
      } else {
        const created = await apiFetch<{ id: string }>("/api/admin/simulations", {
          method: "POST",
          json: payload,
        });
        toast.success(f.created);
        router.push(`/admin/simulations/${created.id}`);
      }
    } catch (err) {
      if (err instanceof ApiError && err.issues) {
        setErrors(Object.fromEntries(err.issues.map((i) => [i.path.split(".")[0] ?? "", i.message])));
      }
      toast.error(errorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!simulation || !window.confirm(f.deleteConfirm)) return;
    try {
      await apiFetch(`/api/admin/simulations/${simulation.id}`, { method: "DELETE" });
      toast.success(f.deleted);
      router.push("/admin/simulations");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err, t));
    }
  };

  const toggleRow = (key: "is_free" | "is_verified" | "is_featured" | "is_active", label: string) => (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={`f-${key}`}>{label}</Label>
      <Switch id={`f-${key}`} checked={form[key]} onCheckedChange={(v) => set(key, v)} />
    </div>
  );

  return (
    <form onSubmit={submit} className="grid gap-5 xl:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <Section title={f.basics}>
          {field("title", f.title, { required: true, maxLength: 300 })}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void suggest()}
              disabled={suggesting || !form.title.trim()}
            >
              {suggesting ? <Loader2 className="animate-spin" /> : <Sparkles />} {f.suggest}
            </Button>
            <span className="text-muted-foreground text-xs">{f.suggestHint}</span>
          </div>
          {field("slug", f.slug, { maxLength: 160 }, f.slugHint)}
          {field("short_description", f.shortDescription, { maxLength: 300 })}
          <div className="grid gap-1.5">
            <Label htmlFor="f-description">{f.description}</Label>
            <Textarea
              id="f-description"
              rows={5}
              maxLength={5000}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
        </Section>

        <Section title={f.classification}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="f-subject">{f.subject}</Label>
              <NativeSelect
                id="f-subject"
                value={form.subject_id}
                onChange={(e) => set("subject_id", e.target.value)}
              >
                <option value="">—</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {locale === "vi" ? s.name_vi : s.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {field("sub_subject", f.subSubject, { maxLength: 120 })}
            <div className="grid gap-1.5">
              <Label htmlFor="f-grade_min">{f.gradeMin}</Label>
              <NativeSelect
                id="f-grade_min"
                value={form.grade_min}
                onChange={(e) => set("grade_min", Number(e.target.value))}
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="f-grade_max">{f.gradeMax}</Label>
              <NativeSelect
                id="f-grade_max"
                value={form.grade_max}
                onChange={(e) => set("grade_max", Number(e.target.value))}
                aria-invalid={!!errors.grade_max}
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </NativeSelect>
              <FieldError message={errors.grade_max} />
            </div>
            {field("topic", f.topic, { maxLength: 200 })}
            {field("subtopic", f.subtopic, { maxLength: 200 })}
            <div className="grid gap-1.5">
              <Label htmlFor="f-type">{f.type}</Label>
              <NativeSelect
                id="f-type"
                value={form.simulation_type}
                onChange={(e) => set("simulation_type", e.target.value)}
              >
                {SIMULATION_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {t.types[v]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="f-difficulty">{f.difficulty}</Label>
              <NativeSelect
                id="f-difficulty"
                value={form.difficulty}
                onChange={(e) => set("difficulty", e.target.value)}
              >
                <option value="">—</option>
                {DIFFICULTIES.map((v) => (
                  <option key={v} value={v}>
                    {t.difficulty[v]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {field("language", f.language, { required: true, maxLength: 10 }, f.languageHint)}
            {field("duration_minutes", f.duration, { type: "number", min: 1, max: 600 })}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="f-tags">{f.tags}</Label>
            <Input id="f-tags" value={form.tags} onChange={(e) => set("tags", e.target.value)} />
          </div>
        </Section>

        <Section title={f.links}>
          <div className="grid gap-1.5">
            <Label htmlFor="f-source">{f.source}</Label>
            <NativeSelect
              id="f-source"
              value={form.source_id}
              onChange={(e) => set("source_id", e.target.value)}
            >
              <option value="">{f.noSource}</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.allows_embed ? " (embed ✓)" : ""}
                </option>
              ))}
            </NativeSelect>
          </div>
          {field("simulation_url", f.simulationUrl, { required: true, type: "url", maxLength: 2000 })}
          {field("source_url", f.sourceUrl, { type: "url", maxLength: 2000 })}
          {field("embed_url", f.embedUrl, { type: "url", maxLength: 2000 }, f.embedUrlHint)}
          {field("thumbnail_url", f.thumbnailUrl, { type: "url", maxLength: 2000 })}
          <div className="grid gap-4 sm:grid-cols-2">
            {field("license", f.license, { maxLength: 200 })}
            {field("license_url", f.licenseUrl, { type: "url", maxLength: 2000 })}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="f-license-cat">{f.licenseCategory}</Label>
            <NativeSelect
              id="f-license-cat"
              value={form.license_category}
              onChange={(e) => set("license_category", e.target.value)}
            >
              {LICENSE_CATEGORIES.map((v) => (
                <option key={v} value={v}>
                  {t.licenses[v]}
                </option>
              ))}
            </NativeSelect>
          </div>
        </Section>

        <Section title={f.pedagogy}>
          <div className="grid gap-1.5">
            <Label htmlFor="f-objectives">{f.objectives}</Label>
            <Textarea
              id="f-objectives"
              rows={4}
              value={form.learning_objectives}
              onChange={(e) => set("learning_objectives", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="f-equipment">{f.equipment}</Label>
            <Textarea
              id="f-equipment"
              rows={3}
              value={form.required_equipment}
              onChange={(e) => set("required_equipment", e.target.value)}
            />
          </div>
        </Section>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <Section title={f.flags}>
          <div className="grid gap-1.5">
            <Label htmlFor="f-status">{f.status}</Label>
            <NativeSelect id="f-status" value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="published">{t.admin.statuses.published}</option>
              <option value="pending_review">{t.admin.statuses.pending_review}</option>
              <option value="draft">{t.admin.statuses.draft}</option>
            </NativeSelect>
          </div>
          {toggleRow("is_active", f.isActive)}
          {toggleRow("is_free", f.isFree)}
          {toggleRow("is_verified", f.isVerified)}
          {toggleRow("is_featured", f.isFeatured)}
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} {t.common.save}
          </Button>
          {simulation && (
            <Button asChild variant="link" className="w-full">
              <Link href={`/simulation/${simulation.slug}`} target="_blank">
                <ExternalLink /> {f.viewPublic}
              </Link>
            </Button>
          )}
        </Section>
        {simulation && (
          <Section title={f.danger}>
            <Button type="button" variant="destructive" className="w-full" onClick={() => void remove()}>
              <Trash2 /> {t.common.delete}
            </Button>
          </Section>
        )}
      </aside>
    </form>
  );
}
