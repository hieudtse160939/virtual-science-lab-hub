import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { DuplicatesList } from "@/components/admin/duplicates-list";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/lib/i18n/server";
import { requirePageSession } from "@/server/auth";
import { findDuplicates } from "@/server/repositories/admin";

export const dynamic = "force-dynamic";

export default async function DuplicatesPage() {
  const [{ t }, session] = await Promise.all([getI18n(), requirePageSession("/admin/duplicates", "admin")]);
  const groups = await findDuplicates(session.supabase, 100);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.admin.duplicates.title}</h1>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm">{t.admin.duplicates.description}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/duplicates">
            <RefreshCw /> {t.admin.duplicates.scan}
          </Link>
        </Button>
      </div>
      <DuplicatesList groups={groups} />
    </div>
  );
}
