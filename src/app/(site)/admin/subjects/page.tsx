import { SubjectsManager } from "@/components/admin/catalog-managers";
import { requirePageSession } from "@/server/auth";
import { listAllSubjects } from "@/server/repositories/admin";

export default async function AdminSubjectsPage() {
  const session = await requirePageSession("/admin/subjects", "admin");
  const [subjects, counts] = await Promise.all([
    listAllSubjects(session.supabase),
    session.supabase.rpc("catalog_counts"),
  ]);
  const bySlug = ((counts.data as { subjects?: Record<string, number> } | null)?.subjects ?? {}) as Record<
    string,
    number
  >;
  return <SubjectsManager subjects={subjects} counts={bySlug} />;
}
