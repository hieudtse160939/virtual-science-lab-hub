import { Plus, Upload } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { AdminSimulationTable } from "@/components/admin/simulation-table";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/lib/i18n/server";
import { requirePageSession } from "@/server/auth";
import { listAdminSimulations, listAllSubjects, type AdminListParams } from "@/server/repositories/admin";

const STATUSES = ["published", "pending_review", "draft", "inactive", "demo"] as const;
const PAGE_SIZE = 50;

export default async function AdminSimulationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const [{ t }, session, sp] = await Promise.all([
    getI18n(),
    requirePageSession("/admin/simulations", "admin"),
    searchParams,
  ]);
  const page = Math.min(Math.max(Number(sp.page) || 0, 0), 10_000);
  const status = STATUSES.includes(sp.status as never) ? (sp.status as AdminListParams["status"]) : undefined;
  const [{ rows, total }, subjects] = await Promise.all([
    listAdminSimulations(session.supabase, { q: sp.q, status, page, pageSize: PAGE_SIZE }),
    listAllSubjects(session.supabase),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t.admin.nav.simulations}</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/import">
              <Upload /> {t.admin.nav.import}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/simulations/new">
              <Plus /> {t.admin.addSimulation}
            </Link>
          </Button>
        </div>
      </div>
      <Suspense>
        <AdminSimulationTable
          rows={rows}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          subjects={subjects.map(({ id, name, name_vi }) => ({ id, name, name_vi }))}
        />
      </Suspense>
    </div>
  );
}
