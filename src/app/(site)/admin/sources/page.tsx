import { SourcesManager } from "@/components/admin/catalog-managers";
import { requirePageSession } from "@/server/auth";
import { listAllSources } from "@/server/repositories/admin";

export default async function AdminSourcesPage() {
  const session = await requirePageSession("/admin/sources", "admin");
  return <SourcesManager sources={await listAllSources(session.supabase)} />;
}
