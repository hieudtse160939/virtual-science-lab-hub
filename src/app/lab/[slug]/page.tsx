import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LabViewer } from "@/components/simulation/lab-viewer";
import { isEmbeddable } from "@/lib/embed";
import { getEmbedStatus } from "@/server/embed-check";
import { getSimulationBySlug } from "@/server/repositories/simulations";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ collection?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const sim = /^[a-z0-9-]{1,160}$/.test(slug) ? await getSimulationBySlug(slug).catch(() => null) : null;
  if (!sim) return {};
  return {
    title: sim.title,
    alternates: { canonical: `/simulation/${sim.slug}` },
    robots: { index: false, follow: true },
  };
}

export default async function LabPage({ params, searchParams }: Props) {
  const [{ slug }, { collection }] = await Promise.all([params, searchParams]);
  if (!/^[a-z0-9-]{1,160}$/.test(slug)) notFound();
  const sim = await getSimulationBySlug(slug);
  if (!sim) notFound();

  const collectionId = collection && /^[0-9a-f-]{36}$/i.test(collection) ? collection : null;
  let blockedReason: "blocked" | "unreachable" | "not_embeddable" | null = null;
  if (!isEmbeddable(sim) || !sim.embed_url) {
    blockedReason = "not_embeddable";
  } else {
    // Tôn trọng X-Frame-Options / CSP frame-ancestors của nhà cung cấp.
    const status = await getEmbedStatus(sim.embed_url).catch(() => "unknown" as const);
    if (status === "blocked" || status === "unreachable") blockedReason = status;
  }

  return (
    <main id="main-content">
      <LabViewer
        sim={{
          id: sim.id,
          slug: sim.slug,
          title: sim.title,
          simulation_url: sim.simulation_url,
          embed_url: sim.embed_url,
          source: sim.source ? { name: sim.source.name } : null,
        }}
        blockedReason={blockedReason}
        backHref={`/simulation/${sim.slug}${collectionId ? `?collection=${collectionId}` : ""}`}
        collectionId={collectionId}
      />
    </main>
  );
}
