"use client";

import { BadgeCheck, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { SUBJECT_ICONS, SubjectIcon } from "@/components/subject-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/client";
import { format, formatNumber } from "@/lib/i18n/config";
import type { Source, Subject } from "@/types/domain";

function useCrud(endpoint: string) {
  const { t } = useI18n();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const save = async (id: string | null, payload: Record<string, unknown>, successMsg: string) => {
    setSaving(true);
    try {
      await apiFetch(id ? `${endpoint}/${id}` : endpoint, { method: id ? "PATCH" : "POST", json: payload });
      toast.success(successMsg);
      router.refresh();
      return true;
    } catch (err) {
      toast.error(errorMessage(err, t));
      return false;
    } finally {
      setSaving(false);
    }
  };
  const remove = async (id: string, confirmMsg: string, successMsg: string) => {
    if (!window.confirm(confirmMsg)) return;
    try {
      await apiFetch(`${endpoint}/${id}`, { method: "DELETE" });
      toast.success(successMsg);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err, t));
    }
  };
  return { saving, save, remove };
}

function Field({
  id,
  label,
  children,
  hint,
}: {
  id: string;
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

function ToggleField({
  id,
  label,
  name,
  defaultChecked,
  hint,
}: {
  id: string;
  label: string;
  name: string;
  defaultChecked: boolean;
  hint?: string;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <Label htmlFor={id}>{label}</Label>
        {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={setChecked} />
      <input type="hidden" name={name} value={checked ? "1" : "0"} />
    </div>
  );
}

// --------------------------------------------------------------------------- Nguồn
type SourceRow = Source & { simulation_count: number };

export function SourcesManager({ sources }: { sources: SourceRow[] }) {
  const { t, locale } = useI18n();
  const s = t.admin.sources;
  const { saving, save, remove } = useCrud("/api/admin/sources");
  const [editing, setEditing] = useState<SourceRow | "new" | null>(null);
  const current = editing === "new" ? null : editing;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "");
    const ok = await save(
      current?.id ?? null,
      {
        name: str("name"),
        slug: str("slug") || null,
        description: str("description"),
        website_url: str("website_url"),
        logo_url: str("logo_url"),
        license: str("license"),
        license_url: str("license_url"),
        country: str("country"),
        allows_embed: str("allows_embed") === "1",
        is_verified: str("is_verified") === "1",
        is_active: str("is_active") === "1",
      },
      s.saved,
    );
    if (ok) setEditing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{s.title}</h1>
        <Button onClick={() => setEditing("new")}>
          <Plus /> {s.add}
        </Button>
      </div>
      <div className="bg-card overflow-x-auto rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground border-b text-left text-xs">
            <tr>
              <th className="p-3">{s.name}</th>
              <th className="p-3">{s.license}</th>
              <th className="p-3">{t.common.status}</th>
              <th className="p-3 text-right">{s.count}</th>
              <th className="p-3">
                <span className="sr-only">{t.common.actions}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sources.map((src) => (
              <tr key={src.id}>
                <td className="p-3">
                  <span className="font-medium">{src.name}</span>
                  {src.website_url && (
                    <a
                      href={src.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary block truncate text-xs hover:underline"
                    >
                      {src.website_url}
                    </a>
                  )}
                </td>
                <td className="text-muted-foreground max-w-56 truncate p-3">{src.license ?? "—"}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {src.is_verified && (
                      <Badge variant="success">
                        <BadgeCheck /> {t.card.verified}
                      </Badge>
                    )}
                    {src.allows_embed && <Badge>iframe</Badge>}
                    {!src.is_active && <Badge variant="secondary">{t.admin.statuses.inactive}</Badge>}
                  </div>
                </td>
                <td className="p-3 text-right tabular-nums">{formatNumber(src.simulation_count, locale)}</td>
                <td className="p-3 whitespace-nowrap">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditing(src)}
                    aria-label={`${t.common.edit}: ${src.name}`}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive"
                    onClick={() =>
                      void remove(src.id, format(s.deleteConfirm, { name: src.name }), s.deleted)
                    }
                    aria-label={`${t.common.delete}: ${src.name}`}
                  >
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent closeLabel={t.common.close} className="max-w-xl" aria-describedby={undefined}>
          <form key={current?.id ?? "new"} onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{current ? current.name : s.add}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="s-name" label={s.name}>
                <Input id="s-name" name="name" defaultValue={current?.name} required maxLength={120} />
              </Field>
              <Field id="s-slug" label={s.slug}>
                <Input
                  id="s-slug"
                  name="slug"
                  defaultValue={current?.slug}
                  maxLength={80}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                />
              </Field>
              <Field id="s-web" label={s.website}>
                <Input id="s-web" name="website_url" type="url" defaultValue={current?.website_url ?? ""} />
              </Field>
              <Field id="s-logo" label={s.logo}>
                <Input id="s-logo" name="logo_url" type="url" defaultValue={current?.logo_url ?? ""} />
              </Field>
              <Field id="s-license" label={s.license}>
                <Input id="s-license" name="license" defaultValue={current?.license ?? ""} maxLength={200} />
              </Field>
              <Field id="s-license-url" label={s.licenseUrl}>
                <Input
                  id="s-license-url"
                  name="license_url"
                  type="url"
                  defaultValue={current?.license_url ?? ""}
                />
              </Field>
              <Field id="s-country" label={s.country}>
                <Input id="s-country" name="country" defaultValue={current?.country ?? ""} maxLength={2} />
              </Field>
            </div>
            <Field id="s-desc" label={s.description}>
              <Textarea
                id="s-desc"
                name="description"
                defaultValue={current?.description ?? ""}
                maxLength={1000}
              />
            </Field>
            <ToggleField
              id="s-embed"
              name="allows_embed"
              label={s.allowsEmbed}
              hint={s.allowsEmbedHint}
              defaultChecked={current?.allows_embed ?? false}
            />
            <ToggleField
              id="s-verified"
              name="is_verified"
              label={s.isVerified}
              defaultChecked={current?.is_verified ?? false}
            />
            <ToggleField
              id="s-active"
              name="is_active"
              label={s.isActive}
              defaultChecked={current?.is_active ?? true}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="animate-spin" />} {t.common.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --------------------------------------------------------------------------- Môn học
export function SubjectsManager({
  subjects,
  counts,
}: {
  subjects: Subject[];
  counts: Record<string, number>;
}) {
  const { t, locale } = useI18n();
  const s = t.admin.subjects;
  const { saving, save, remove } = useCrud("/api/admin/subjects");
  const [editing, setEditing] = useState<Subject | "new" | null>(null);
  const current = editing === "new" ? null : editing;

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "");
    const ok = await save(
      current?.id ?? null,
      {
        name: str("name"),
        name_vi: str("name_vi"),
        slug: str("slug") || null,
        icon: str("icon"),
        color: str("color"),
        aliases: str("aliases")
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        sort_order: Number(str("sort_order") || 100),
      },
      s.saved,
    );
    if (ok) setEditing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{s.title}</h1>
        <Button onClick={() => setEditing("new")}>
          <Plus /> {s.add}
        </Button>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {subjects.map((sub) => (
          <li key={sub.id} className="bg-card flex items-center gap-3 rounded-2xl border p-4 shadow-sm">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-xl"
              style={{ background: `${sub.color}1a`, color: sub.color }}
            >
              <SubjectIcon icon={sub.icon} className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{locale === "vi" ? sub.name_vi : sub.name}</p>
              <p className="text-muted-foreground truncate text-xs">
                {sub.slug} · {formatNumber(counts[sub.slug] ?? 0, locale)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditing(sub)}
              aria-label={`${t.common.edit}: ${sub.name}`}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive"
              onClick={() => void remove(sub.id, format(s.deleteConfirm, { name: sub.name_vi }), s.deleted)}
              aria-label={`${t.common.delete}: ${sub.name}`}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent closeLabel={t.common.close} aria-describedby={undefined}>
          <form key={current?.id ?? "new"} onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{current ? current.name_vi : s.add}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="sub-name" label={s.name}>
                <Input id="sub-name" name="name" defaultValue={current?.name} required maxLength={80} />
              </Field>
              <Field id="sub-name-vi" label={s.nameVi}>
                <Input
                  id="sub-name-vi"
                  name="name_vi"
                  defaultValue={current?.name_vi}
                  required
                  maxLength={80}
                />
              </Field>
              <Field id="sub-slug" label={s.slug}>
                <Input
                  id="sub-slug"
                  name="slug"
                  defaultValue={current?.slug}
                  maxLength={60}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                />
              </Field>
              <Field id="sub-order" label={s.sortOrder}>
                <Input
                  id="sub-order"
                  name="sort_order"
                  type="number"
                  min={0}
                  defaultValue={current?.sort_order ?? 100}
                />
              </Field>
              <Field id="sub-icon" label={s.icon}>
                <NativeSelect id="sub-icon" name="icon" defaultValue={current?.icon ?? "flask-conical"}>
                  {Object.keys(SUBJECT_ICONS).map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field id="sub-color" label={s.color}>
                <Input
                  id="sub-color"
                  name="color"
                  type="color"
                  defaultValue={current?.color ?? "#2563eb"}
                  className="h-10 p-1"
                />
              </Field>
            </div>
            <Field id="sub-aliases" label={s.aliases}>
              <Input id="sub-aliases" name="aliases" defaultValue={current?.aliases.join(", ") ?? ""} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="animate-spin" />} {t.common.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
