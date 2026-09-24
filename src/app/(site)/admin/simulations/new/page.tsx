import { SimulationForm } from "@/components/admin/simulation-form";
import { getI18n } from "@/lib/i18n/server";
import { requirePageSession } from "@/server/auth";
import { listAllSources, listAllSubjects } from "@/server/repositories/admin";

export default async function NewSimulationPage() {
  const [{ t }, session] = await Promise.all([
    getI18n(),
    requirePageSession("/admin/simulations/new", "admin"),
  ]);
  const [subjects, sources] = await Promise.all([
    listAllSubjects(session.supabase),
    listAllSources(session.supabase),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">{t.admin.addSimulation}</h1>
      <SimulationForm subjects={subjects} sources={sources} />
    </div>
  );
}
