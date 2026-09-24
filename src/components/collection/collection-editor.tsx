"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Plus,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { SimulationThumbnail } from "@/components/simulation/simulation-thumbnail";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/config";
import { gradeLabel } from "@/lib/utils";
import type { Collection, CollectionItem } from "@/types/domain";

export function CollectionEditor({
  collection: initialCollection,
  items: initialItems,
  shareUrl,
}: {
  collection: Collection;
  items: CollectionItem[];
  shareUrl: string;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [collection, setCollection] = useState(initialCollection);
  const [items, setItems] = useState(initialItems);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const patchCollection = async (patch: Partial<Pick<Collection, "name" | "description" | "is_public">>) => {
    setSaving(true);
    try {
      const updated = await apiFetch<Collection>(`/api/collections/${collection.id}`, {
        method: "PATCH",
        json: patch,
      });
      setCollection(updated);
      toast.success(t.collections.updated);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };

  const itemsAction = (body: Record<string, unknown>) =>
    apiFetch(`/api/collections/${collection.id}/items`, { method: "POST", json: body });

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const previous = items;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setItems(next);
    try {
      await itemsAction({ action: "reorder", order: next.map((i) => i.simulation_id) });
    } catch (err) {
      setItems(previous);
      toast.error(errorMessage(err, t));
    }
  };

  const remove = async (item: CollectionItem) => {
    setBusyId(item.simulation_id);
    try {
      await itemsAction({ action: "remove", simulation_id: item.simulation_id });
      setItems((prev) => prev.filter((i) => i.simulation_id !== item.simulation_id));
      toast.success(format(t.collections.removedFrom, { name: collection.name }));
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusyId(null);
    }
  };

  const saveNote = async (item: CollectionItem, note: string) => {
    setBusyId(item.simulation_id);
    try {
      await itemsAction({ action: "note", simulation_id: item.simulation_id, note });
      setItems((prev) =>
        prev.map((i) => (i.simulation_id === item.simulation_id ? { ...i, note: note || null } : i)),
      );
      setEditingNote(null);
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusyId(null);
    }
  };

  const deleteCollection = async () => {
    if (!window.confirm(format(t.collections.deleteConfirm, { name: collection.name }))) return;
    try {
      await apiFetch(`/api/collections/${collection.id}`, { method: "DELETE" });
      toast.success(t.collections.deleted);
      router.push("/teacher");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err, t));
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success(t.common.copied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t.errors.generic);
    }
  };

  const onDetailsSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    void patchCollection({
      name: String(form.get("name")),
      description: String(form.get("description") ?? ""),
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <section aria-labelledby="items-heading" className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="items-heading" className="text-lg font-semibold">
            {format(t.collections.items, { n: items.length })}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/search">
                <Plus /> {t.common.add}
              </Link>
            </Button>
            <Button asChild variant="secondary" aria-disabled={items.length === 0}>
              <Link href={`/teacher/collections/${collection.id}/lesson`}>
                <FileText /> {t.collections.generateLesson}
              </Link>
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <EmptyState title={t.collections.emptyItems} hint={t.collections.emptyItemsHint} />
        ) : (
          <ol className="space-y-3">
            {items.map((item, index) => {
              const sim = item.simulation;
              return (
                <li
                  key={item.simulation_id}
                  className="bg-card flex gap-3 rounded-2xl border p-3 shadow-sm sm:gap-4"
                >
                  <div className="flex flex-col items-center justify-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => void move(index, -1)}
                      disabled={index === 0}
                      aria-label={`${t.collections.moveUp}: ${sim.title}`}
                    >
                      <ArrowUp />
                    </Button>
                    <span className="text-muted-foreground text-xs font-bold tabular-nums">{index + 1}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => void move(index, 1)}
                      disabled={index === items.length - 1}
                      aria-label={`${t.collections.moveDown}: ${sim.title}`}
                    >
                      <ArrowDown />
                    </Button>
                  </div>
                  <SimulationThumbnail
                    src={sim.thumbnail_url}
                    alt=""
                    color={sim.subject?.color}
                    icon={sim.subject?.icon}
                    className="hidden w-36 shrink-0 self-start rounded-xl sm:block"
                    sizes="144px"
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Link
                      href={`/simulation/${sim.slug}`}
                      className="hover:text-primary line-clamp-2 font-semibold hover:underline"
                    >
                      {sim.title}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      {[
                        sim.subject ? (locale === "vi" ? sim.subject.name_vi : sim.subject.name) : null,
                        gradeLabel(sim.grade_min, sim.grade_max, t.common.grade),
                        sim.source?.name,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {editingNote === item.simulation_id ? (
                      <form
                        className="space-y-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void saveNote(item, String(new FormData(e.currentTarget).get("note") ?? ""));
                        }}
                      >
                        <label htmlFor={`note-${item.simulation_id}`} className="sr-only">
                          {t.collections.note}
                        </label>
                        <Textarea
                          id={`note-${item.simulation_id}`}
                          name="note"
                          defaultValue={item.note ?? ""}
                          maxLength={1000}
                          placeholder={t.collections.notePlaceholder}
                          autoFocus
                          className="min-h-16"
                        />
                        <div className="flex gap-2">
                          <Button type="submit" size="sm" disabled={busyId === item.simulation_id}>
                            {t.common.save}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingNote(null)}
                          >
                            {t.common.cancel}
                          </Button>
                        </div>
                      </form>
                    ) : item.note ? (
                      <p className="bg-warning-soft rounded-lg px-3 py-2 text-sm">{item.note}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-1">
                      {editingNote !== item.simulation_id && (
                        <Button variant="ghost" size="sm" onClick={() => setEditingNote(item.simulation_id)}>
                          <StickyNote /> {t.collections.note}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => void remove(item)}
                        disabled={busyId === item.simulation_id}
                      >
                        {busyId === item.simulation_id ? <Loader2 className="animate-spin" /> : <X />}{" "}
                        {t.common.remove}
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <aside className="space-y-4">
        <div className="bg-card space-y-3 rounded-2xl border p-5 shadow-sm">
          <h2 className="font-semibold">{t.collections.shareTitle}</h2>
          <div className="flex items-start justify-between gap-3">
            <div>
              <Label htmlFor="public-switch">{t.collections.isPublic}</Label>
              <p className="text-muted-foreground mt-1 text-xs">
                {collection.is_public ? t.collections.publicHint : t.collections.makePublicToShare}
              </p>
            </div>
            <Switch
              id="public-switch"
              checked={collection.is_public}
              disabled={saving}
              onCheckedChange={(v) => void patchCollection({ is_public: v })}
            />
          </div>
          <div className="flex gap-2">
            <label htmlFor="share-url" className="sr-only">
              {t.collections.shareLink}
            </label>
            <Input
              id="share-url"
              value={shareUrl}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
              className="text-xs"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => void copyLink()}
              aria-label={t.collections.copyLink}
            >
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>
          <Button asChild variant="link" size="sm">
            <Link href={`/collection/${collection.slug}`} target="_blank">
              <Eye /> {t.collections.studentView} <ExternalLink className="size-3" />
            </Link>
          </Button>
        </div>

        <form onSubmit={onDetailsSubmit} className="bg-card space-y-3 rounded-2xl border p-5 shadow-sm">
          <div className="grid gap-2">
            <Label htmlFor="c-name">{t.collections.name}</Label>
            <Input id="c-name" name="name" defaultValue={collection.name} required maxLength={150} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="c-desc">{t.collections.description}</Label>
            <Textarea
              id="c-desc"
              name="description"
              defaultValue={collection.description ?? ""}
              maxLength={2000}
            />
          </div>
          <Button type="submit" disabled={saving} className="w-full">
            {saving && <Loader2 className="animate-spin" />} {t.common.save}
          </Button>
        </form>

        <Button
          variant="outline"
          className="text-destructive hover:text-destructive w-full"
          onClick={() => void deleteCollection()}
        >
          <Trash2 /> {t.common.delete}
        </Button>
      </aside>
    </div>
  );
}
