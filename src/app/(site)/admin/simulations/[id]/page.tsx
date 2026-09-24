import { notFound } from "next/navigation";
import { SimulationForm } from "@/components/admin/simulation-form";
import { getI18n } from "@/lib/i18n/server";
import { requirePageSession } from "@/server/auth";
import { listAllSources, listAllSubjects } from "@/server/repositories/admin";
import { getSimulationById } from "@/server/repositories/simulations";

export default async function EditSimulationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ t }, session] = await Promise.all([
    getI18n(),
    requirePageSession(`/admin/simulations/${id}`, "admin"),
  ]);
  const [simulation, subjects, sources] = await Promise.all([
    getSimulationById(session.supabase, id),
    listAllSubjects(session.supabase),
    listAllSources(session.supabase),
  ]);
  if (!simulation) notFound();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">{t.admin.editSimulation}</h1>
      <SimulationForm
        key={simulation.updated_at}
        simulation={simulation}
        subjects={subjects}
        sources={sources}
      />
    </div>
  );
}
