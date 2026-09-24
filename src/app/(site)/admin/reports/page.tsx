import Link from "next/link";
import { ReportsList } from "@/components/admin/reports-list";
import { getI18n } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { requirePageSession } from "@/server/auth";
import { listReports } from "@/server/repositories/admin";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const [{ t }, session, { filter }] = await Promise.all([
    getI18n(),
    requirePageSession("/admin/reports", "admin"),
    searchParams,
  ]);
  const status = filter === "all" ? "all" : "open";
  const { rows } = await listReports(session.supabase, status);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t.admin.reports.title}</h1>
        <nav className="bg-muted flex gap-1 rounded-xl p-1 text-sm">
          {(["open", "all"] as const).map((f) => (
            <Link
              key={f}
              href={f === "open" ? "/admin/reports" : "/admin/reports?filter=all"}
              aria-current={status === f ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-1.5 font-medium",
                status === f ? "bg-card shadow-sm" : "text-muted-foreground",
              )}
            >
              {f === "open" ? t.admin.reports.filterOpen : t.admin.reports.filterAll}
            </Link>
          ))}
        </nav>
      </div>
      <ReportsList rows={rows} />
    </div>
  );
}
