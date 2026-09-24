"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch, errorMessage } from "@/lib/api-client";
import type { ReportReason } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/client";
import { formatDate } from "@/lib/i18n/config";
import type { IssueReportRow } from "@/server/repositories/admin";

export function ReportsList({ rows }: { rows: IssueReportRow[] }) {
  const { t, locale } = useI18n();
  const r = t.admin.reports;
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const update = async (id: string, status: "open" | "resolved" | "dismissed") => {
    setBusy(id);
    try {
      await apiFetch(`/api/admin/reports/${id}`, { method: "PATCH", json: { status } });
      toast.success(r.updated);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setBusy(null);
    }
  };

  if (rows.length === 0) return <EmptyState title={r.none} />;

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.id} className="bg-card rounded-2xl border p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={row.status === "open" ? "warning" : "secondary"}>
                  {r.statuses[row.status]}
                </Badge>
                <span className="text-sm font-semibold">
                  {t.report.reasons[row.reason as ReportReason] ?? row.reason}
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatDate(row.created_at, locale, { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>
              {row.simulation && (
                <p className="text-sm">
                  <Link
                    href={`/admin/simulations/${row.simulation.id}`}
                    className="hover:text-primary font-medium hover:underline"
                  >
                    {row.simulation.title}
                  </Link>{" "}
                  <a
                    href={row.simulation.simulation_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary inline-flex items-center"
                    aria-label={t.detail.openOriginal}
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                </p>
              )}
              {row.message && (
                <p className="bg-muted rounded-lg px-3 py-2 text-sm whitespace-pre-line">{row.message}</p>
              )}
            </div>
            <div className="flex gap-2">
              {row.status === "open" ? (
                <>
                  <Button
                    size="sm"
                    variant="success"
                    disabled={busy === row.id}
                    onClick={() => void update(row.id, "resolved")}
                  >
                    {r.resolve}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === row.id}
                    onClick={() => void update(row.id, "dismissed")}
                  >
                    {r.dismiss}
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === row.id}
                  onClick={() => void update(row.id, "open")}
                >
                  {r.reopen}
                </Button>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
