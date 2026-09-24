"use client";

import { BadgeCheck, Loader2, Pencil, Star } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, NativeSelect } from "@/components/ui/input";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/client";
import { format, formatDate, formatNumber } from "@/lib/i18n/config";
import type { AdminSimulationRow } from "@/server/repositories/admin";

type BulkAction =
  | "activate"
  | "deactivate"
  | "verify"
  | "unverify"
  | "feature"
  | "unfeature"
  | "publish"
  | "delete"
  | "set_subject";

export function AdminSimulationTable({
  rows,
  total,
  page,
  pageSize,
  subjects,
}: {
  rows: AdminSimulationRow[];
  total: number;
  page: number;
  pageSize: number;
  subjects: { id: string; name: string; name_vi: string }[];
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  const navigate = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    setSelected(new Set());
    startTransition(() => router.push(`${pathname}?${params}`));
  };

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const runBulk = async (action: BulkAction, subjectId?: string | null) => {
    if (selected.size === 0) return;
    if (action === "delete" && !window.confirm(format(t.admin.bulk.deleteConfirm, { n: selected.size })))
      return;
    setBusy(true);
    try {
      const res = await apiFetch<{ count: number }>("/api/admin/simulations/bulk", {
        method: "POST",
        json: { ids: Array.from(selected), action, subject_id: subjectId ?? null },
      });
      toast.success(format(t.admin.bulk.done, { n: res.count }));
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const onSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    navigate({ q: String(new FormData(e.currentTarget).get("q") ?? "").trim() || null, page: null });
  };

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const status = searchParams.get("status") ?? "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <form onSubmit={onSearch} className="flex min-w-60 flex-1 gap-2">
          <label htmlFor="admin-q" className="sr-only">
            {t.common.search}
          </label>
          <Input
            id="admin-q"
            name="q"
            defaultValue={searchParams.get("q") ?? ""}
            placeholder={t.admin.searchPlaceholder}
          />
          <Button type="submit" variant="outline">
            {t.common.search}
          </Button>
        </form>
        <label htmlFor="admin-status" className="sr-only">
          {t.admin.filterStatus}
        </label>
        <NativeSelect
          id="admin-status"
          value={status}
          onChange={(e) => navigate({ status: e.target.value || null, page: null })}
          className="w-auto"
        >
          <option value="">{t.admin.allStatuses}</option>
          <option value="published">{t.admin.statuses.published}</option>
          <option value="pending_review">{t.admin.statuses.pending_review}</option>
          <option value="draft">{t.admin.statuses.draft}</option>
          <option value="inactive">{t.admin.statuses.inactive}</option>
          <option value="demo">{t.card.demo}</option>
        </NativeSelect>
      </div>

      <div className="bg-card/95 sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-xl border p-2 backdrop-blur">
        <span className="px-2 text-sm font-medium">{format(t.admin.selected, { n: selected.size })}</span>
        {(["publish", "activate", "deactivate", "verify", "unverify", "feature", "unfeature"] as const).map(
          (a) => (
            <Button
              key={a}
              size="sm"
              variant="outline"
              disabled={busy || selected.size === 0}
              onClick={() => void runBulk(a)}
            >
              {t.admin.bulk[a]}
            </Button>
          ),
        )}
        <label htmlFor="bulk-subject" className="sr-only">
          {t.admin.bulk.setSubject}
        </label>
        <NativeSelect
          id="bulk-subject"
          className="h-8 w-auto text-xs"
          disabled={busy || selected.size === 0}
          value=""
          onChange={(e) => e.target.value && void runBulk("set_subject", e.target.value)}
        >
          <option value="">{t.admin.bulk.setSubject}</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {locale === "vi" ? s.name_vi : s.name}
            </option>
          ))}
        </NativeSelect>
        <Button
          size="sm"
          variant="destructive"
          disabled={busy || selected.size === 0}
          onClick={() => void runBulk("delete")}
        >
          {t.admin.bulk.delete}
        </Button>
        {(busy || pending) && (
          <Loader2 className="text-muted-foreground size-4 animate-spin" aria-label={t.common.loading} />
        )}
      </div>

      <div className="bg-card overflow-x-auto rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground border-b text-left text-xs">
            <tr>
              <th className="w-10 p-3">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label={t.admin.selectAll} />
              </th>
              <th className="p-3">{t.admin.table.title}</th>
              <th className="p-3">{t.admin.table.subject}</th>
              <th className="p-3">{t.admin.table.grades}</th>
              <th className="p-3">{t.admin.table.source}</th>
              <th className="p-3">{t.admin.table.status}</th>
              <th className="p-3 text-right">{t.admin.table.views}</th>
              <th className="p-3">{t.admin.table.updated}</th>
              <th className="p-3">
                <span className="sr-only">{t.common.actions}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id} className={selected.has(r.id) ? "bg-primary-soft/50" : undefined}>
                <td className="p-3">
                  <Checkbox
                    checked={selected.has(r.id)}
                    onCheckedChange={() => toggle(r.id)}
                    aria-label={format(t.admin.selectRow, { title: r.title })}
                  />
                </td>
                <td className="max-w-xs p-3">
                  <Link
                    href={`/admin/simulations/${r.id}`}
                    className="hover:text-primary line-clamp-2 font-medium hover:underline"
                  >
                    {r.title}
                  </Link>
                  <span className="text-muted-foreground block truncate text-xs">{r.simulation_url}</span>
                </td>
                <td className="p-3 whitespace-nowrap">
                  {r.subject ? (locale === "vi" ? r.subject.name_vi : r.subject.name) : "—"}
                </td>
                <td className="p-3 whitespace-nowrap tabular-nums">
                  {r.grade_min}–{r.grade_max}
                </td>
                <td className="p-3 whitespace-nowrap">{r.source?.name ?? "—"}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {!r.is_active ? (
                      <Badge variant="secondary">{t.admin.statuses.inactive}</Badge>
                    ) : (
                      <Badge variant={r.status === "published" ? "success" : "warning"}>
                        {t.admin.statuses[r.status]}
                      </Badge>
                    )}
                    {r.is_verified && (
                      <Badge variant="success" title={t.card.verified}>
                        <BadgeCheck />
                      </Badge>
                    )}
                    {r.is_featured && (
                      <Badge title={t.card.featured}>
                        <Star />
                      </Badge>
                    )}
                    {r.is_demo && <Badge variant="warning">DEMO</Badge>}
                  </div>
                </td>
                <td className="p-3 text-right tabular-nums">{formatNumber(r.view_count, locale)}</td>
                <td className="text-muted-foreground p-3 whitespace-nowrap">
                  {formatDate(r.updated_at, locale)}
                </td>
                <td className="p-3">
                  <Button asChild variant="ghost" size="icon-sm" aria-label={`${t.common.edit}: ${r.title}`}>
                    <Link href={`/admin/simulations/${r.id}`}>
                      <Pencil />
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="text-muted-foreground p-8 text-center">
                  {t.search.noResults}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <nav className="flex items-center justify-between gap-3 text-sm" aria-label={t.common.page}>
        <span className="text-muted-foreground">
          {t.common.page} {page + 1}/{formatNumber(pages, locale)} · {t.common.total} ≈{" "}
          {formatNumber(total, locale)}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => navigate({ page: String(page - 1) })}
          >
            {t.common.previous}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= pages}
            onClick={() => navigate({ page: String(page + 1) })}
          >
            {t.common.next}
          </Button>
        </div>
      </nav>
    </div>
  );
}
