"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/client";
import { format, formatDate, formatNumber } from "@/lib/i18n/config";
import type { DuplicateGroup } from "@/server/repositories/admin";

export function DuplicatesList({ groups }: { groups: DuplicateGroup[] }) {
  const { t, locale } = useI18n();
  const d = t.admin.duplicates;
  const router = useRouter();
  const [keep, setKeep] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const resolve = async (group: DuplicateGroup, key: string) => {
    const keepId = keep[key] ?? group.items.reduce((a, b) => (b.view_count > a.view_count ? b : a)).id;
    const ids = group.items.filter((i) => i.id !== keepId && i.is_active).map((i) => i.id);
    if (ids.length === 0) return;
    setBusy(key);
    try {
      await apiFetch("/api/admin/simulations/bulk", { method: "POST", json: { ids, action: "deactivate" } });
      toast.success(format(d.resolved, { n: ids.length }));
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(null);
    }
  };

  if (groups.length === 0) return <EmptyState title={d.none} />;

  return (
    <ul className="space-y-4">
      {groups.map((group, gi) => {
        const key = `${group.kind}-${gi}`;
        const defaultKeep = group.items.reduce((a, b) => (b.view_count > a.view_count ? b : a)).id;
        const selected = keep[key] ?? defaultKeep;
        return (
          <li key={key} className="bg-card rounded-2xl border p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <Badge variant={group.kind === "url" ? "warning" : "secondary"}>
                {group.kind === "url" ? d.byUrl : d.byTitle}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void resolve(group, key)}
                disabled={busy === key}
              >
                {busy === key && <Loader2 className="animate-spin" />} {d.deactivateOthers}
              </Button>
            </div>
            <fieldset>
              <legend className="sr-only">{d.keep}</legend>
              <ul className="divide-y">
                {group.items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={key}
                        checked={selected === item.id}
                        onChange={() => setKeep((prev) => ({ ...prev, [key]: item.id }))}
                        className="size-4 accent-[var(--primary)]"
                      />
                      <span className="sr-only">{d.keep}</span>
                    </label>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/simulations/${item.id}`}
                        className="hover:text-primary font-medium hover:underline"
                      >
                        {item.title}
                      </Link>
                      <p className="text-muted-foreground truncate text-xs">{item.simulation_url}</p>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {item.source ?? "—"} · {formatNumber(item.view_count, locale)} {t.common.views} ·{" "}
                      {formatDate(item.created_at, locale)}
                    </span>
                    {!item.is_active && <Badge variant="secondary">{t.admin.statuses.inactive}</Badge>}
                  </li>
                ))}
              </ul>
            </fieldset>
          </li>
        );
      })}
    </ul>
  );
}
