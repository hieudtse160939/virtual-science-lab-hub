import { Importer } from "@/components/admin/importer";
import { getI18n } from "@/lib/i18n/server";
import { requirePageSession } from "@/server/auth";
import { listAllSubjects, listImportJobs } from "@/server/repositories/admin";

export default async function ImportPage() {
  const [{ t }, session] = await Promise.all([getI18n(), requirePageSession("/admin/import", "admin")]);
  const [subjects, history] = await Promise.all([
    listAllSubjects(session.supabase),
    listImportJobs(session.supabase, 10),
  ]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.import.title}</h1>
        <p className="text-muted-foreground mt-1">{t.import.subtitle}</p>
      </div>
      <Importer
        subjects={subjects.map(({ slug, name, name_vi, aliases }) => ({ slug, name, name_vi, aliases }))}
        history={history}
      />
    </div>
  );
}
