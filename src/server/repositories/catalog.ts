import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import type { CatalogCounts, Grade, Source, Subject } from "@/types/domain";
import { toHttpError } from "../http";

export const CACHE_TAGS = {
  catalog: "catalog",
  simulations: "simulations",
  simulation: (slug: string) => `simulation:${slug}`,
  collections: "collections",
} as const;

export const getSubjects = unstable_cache(
  async (): Promise<Subject[]> => {
    const { data, error } = await createPublicClient()
      .from("subjects")
      .select("id, slug, name, name_vi, icon, color, aliases, sort_order")
      .order("sort_order")
      .order("name");
    if (error) throw toHttpError(error);
    return (data ?? []) as Subject[];
  },
  ["subjects"],
  { revalidate: 3600, tags: [CACHE_TAGS.catalog] },
);

export const getGrades = unstable_cache(
  async (): Promise<Grade[]> => {
    const { data, error } = await createPublicClient().from("grades").select("*").order("id");
    if (error) throw toHttpError(error);
    return (data ?? []) as Grade[];
  },
  ["grades"],
  { revalidate: 86400, tags: [CACHE_TAGS.catalog] },
);

export const getSources = unstable_cache(
  async (): Promise<Source[]> => {
    const { data, error } = await createPublicClient()
      .from("sources")
      .select(
        "id, name, slug, description, website_url, logo_url, license, license_url, country, allows_embed, is_verified, is_active, created_at",
      )
      .eq("is_active", true)
      .order("name");
    if (error) throw toHttpError(error);
    return (data ?? []) as Source[];
  },
  ["sources"],
  { revalidate: 3600, tags: [CACHE_TAGS.catalog] },
);

export const getCatalogCounts = unstable_cache(
  async (): Promise<CatalogCounts> => {
    const { data, error } = await createPublicClient().rpc("catalog_counts");
    if (error) throw toHttpError(error);
    const counts = (data ?? {}) as Partial<CatalogCounts>;
    return { total: counts.total ?? 0, subjects: counts.subjects ?? {}, sources: counts.sources ?? {} };
  },
  ["catalog-counts"],
  { revalidate: 600, tags: [CACHE_TAGS.catalog, CACHE_TAGS.simulations] },
);
