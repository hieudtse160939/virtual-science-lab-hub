"use client";

import { FolderPlus, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useUser } from "@/components/providers";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/client";
import { format } from "@/lib/i18n/config";
import type { Collection } from "@/types/domain";

type Row = Collection & { contains: boolean };

export function AddToCollectionButton({
  simulationId,
  title,
  variant = "outline",
  size,
  className,
}: {
  simulationId: string;
  title: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const { t } = useI18n();
  const user = useUser();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setRows(null);
    apiFetch<Row[]>(`/api/collections?simulation_id=${simulationId}`)
      .then(setRows)
      .catch((err) => {
        toast.error(errorMessage(err, t));
        setRows([]);
      });
  }, [open, user, simulationId, t]);

  const isTeacher = user?.role === "teacher" || user?.role === "admin";

  const toggle = async (row: Row) => {
    setBusy(row.id);
    const adding = !row.contains;
    try {
      await apiFetch(`/api/collections/${row.id}/items`, {
        method: "POST",
        json: adding
          ? { action: "add", simulation_id: simulationId }
          : { action: "remove", simulation_id: simulationId },
      });
      setRows(
        (prev) =>
          prev?.map((r) =>
            r.id === row.id ? { ...r, contains: adding, item_count: r.item_count + (adding ? 1 : -1) } : r,
          ) ?? null,
      );
      toast.success(format(adding ? t.collections.addedTo : t.collections.removedFrom, { name: row.name }));
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(null);
    }
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const created = await apiFetch<Collection>("/api/collections", {
        method: "POST",
        json: { name, simulation_id: simulationId },
      });
      setRows((prev) => [{ ...created, contains: true }, ...(prev ?? [])]);
      setNewName("");
      toast.success(format(t.collections.addedTo, { name: created.name }));
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <FolderPlus /> {t.detail.addToCollection}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={t.common.close}>
        <DialogHeader>
          <DialogTitle>{t.collections.addTo}</DialogTitle>
          <DialogDescription>{format(t.collections.addToHint, { title })}</DialogDescription>
        </DialogHeader>

        {!user ? (
          <div className="space-y-3 text-sm">
            <p>{t.collections.loginToCreate}</p>
            <Button asChild>
              <Link href={`/login?next=${encodeURIComponent(pathname)}`}>{t.nav.login}</Link>
            </Button>
          </div>
        ) : !isTeacher ? (
          <div className="space-y-3 text-sm">
            <p>{t.teacher.notTeacherHint}</p>
            <Button asChild variant="outline">
              <Link href="/account">{t.nav.account}</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <form onSubmit={create} className="flex gap-2">
              <label htmlFor="new-collection" className="sr-only">
                {t.collections.name}
              </label>
              <Input
                id="new-collection"
                value={newName}
                maxLength={150}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t.collections.namePlaceholder}
              />
              <Button
                type="submit"
                disabled={creating || !newName.trim()}
                aria-label={t.collections.quickCreate}
              >
                {creating ? <Loader2 className="animate-spin" /> : <Plus />} {t.common.create}
              </Button>
            </form>

            {rows === null ? (
              <div className="flex justify-center py-6">
                <Loader2
                  className="text-muted-foreground size-5 animate-spin"
                  aria-label={t.common.loading}
                />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">{t.collections.empty}</p>
            ) : (
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {rows.map((row) => (
                  <li key={row.id}>
                    <label className="hover:bg-accent flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5">
                      <Checkbox
                        checked={row.contains}
                        disabled={busy === row.id}
                        onCheckedChange={() => void toggle(row)}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {format(t.collections.items, { n: row.item_count })}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
