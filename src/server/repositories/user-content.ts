import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomSuffix, slugify } from "@/lib/utils";
import type { Collection, CollectionItem, SimulationCardData } from "@/types/domain";
import { HttpError, toHttpError } from "../http";
import { CARD_SELECT, mapCardRow } from "./simulations";

// ---------------------------------------------------------------------------
// Yêu thích
// ---------------------------------------------------------------------------
export async function listFavoriteIds(client: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await client
    .from("favorites")
    .select("simulation_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw toHttpError(error);
  return (data ?? []).map((r) => r.simulation_id as string);
}

export async function listFavorites(
  client: SupabaseClient,
  userId: string,
  page = 0,
  pageSize = 48,
): Promise<{ items: SimulationCardData[]; hasMore: boolean }> {
  const { data, error } = await client
    .from("favorites")
    .select(`created_at, simulation:simulations(${CARD_SELECT})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize);
  if (error) throw toHttpError(error);
  const rows = (data ?? []).filter((r) => r.simulation);
  return {
    items: rows.slice(0, pageSize).map((r) => mapCardRow(r.simulation as unknown as Record<string, unknown>)),
    hasMore: (data?.length ?? 0) > pageSize,
  };
}

export async function addFavorite(client: SupabaseClient, userId: string, simulationId: string) {
  const { error } = await client
    .from("favorites")
    .upsert(
      { user_id: userId, simulation_id: simulationId },
      { onConflict: "user_id,simulation_id", ignoreDuplicates: true },
    );
  if (error) throw toHttpError(error);
}

export async function removeFavorite(client: SupabaseClient, userId: string, simulationId: string) {
  const { error } = await client
    .from("favorites")
    .delete()
    .eq("user_id", userId)
    .eq("simulation_id", simulationId);
  if (error) throw toHttpError(error);
}

// ---------------------------------------------------------------------------
// Lịch sử sử dụng gần đây
// ---------------------------------------------------------------------------
export async function listRecentActivity(client: SupabaseClient, userId: string, limit = 24) {
  const { data, error } = await client
    .from("user_activity")
    .select(`open_count, last_opened_at, simulation:simulations(${CARD_SELECT})`)
    .eq("user_id", userId)
    .order("last_opened_at", { ascending: false })
    .limit(limit);
  if (error) throw toHttpError(error);
  return (data ?? [])
    .filter((r) => r.simulation)
    .map((r) => ({
      openCount: r.open_count as number,
      lastOpenedAt: r.last_opened_at as string,
      simulation: mapCardRow(r.simulation as unknown as Record<string, unknown>),
    }));
}

// ---------------------------------------------------------------------------
// Bộ sưu tập
// ---------------------------------------------------------------------------
const COLLECTION_SELECT =
  "id, name, slug, description, owner_id, is_public, item_count, view_count, created_at, updated_at";

export async function listMyCollections(client: SupabaseClient, userId: string): Promise<Collection[]> {
  const { data, error } = await client
    .from("collections")
    .select(COLLECTION_SELECT)
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw toHttpError(error);
  return (data ?? []) as Collection[];
}

/** Id các bộ sưu tập của người dùng có chứa mô phỏng (cho hộp thoại "Thêm vào bộ sưu tập"). */
export async function listCollectionIdsContaining(
  client: SupabaseClient,
  userId: string,
  simulationId: string,
) {
  const { data, error } = await client
    .from("collection_items")
    .select("collection_id, collections!inner(owner_id)")
    .eq("simulation_id", simulationId)
    .eq("collections.owner_id", userId);
  if (error) throw toHttpError(error);
  return (data ?? []).map((r) => r.collection_id as string);
}

export async function listPublicCollections(client: SupabaseClient, limit = 8) {
  const { data, error } = await client
    .from("collections")
    .select(COLLECTION_SELECT)
    .eq("is_public", true)
    .gt("item_count", 0)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw toHttpError(error);
  const collections = (data ?? []) as Collection[];
  if (collections.length === 0) return [];
  // Ảnh đại diện: thumbnail của mô phỏng đầu tiên trong mỗi bộ sưu tập.
  const { data: items } = await client
    .from("collection_items")
    .select("collection_id, sort_order, simulation:simulations(thumbnail_url, subject:subjects(icon, color))")
    .in(
      "collection_id",
      collections.map((c) => c.id),
    )
    .order("sort_order")
    .limit(collections.length * 4);
  const covers = new Map<string, { thumbnail_url: string | null; icon?: string; color?: string }[]>();
  for (const it of items ?? []) {
    const sim = it.simulation as unknown as {
      thumbnail_url: string | null;
      subject: { icon: string; color: string } | null;
    } | null;
    if (!sim) continue;
    const list = covers.get(it.collection_id as string) ?? [];
    if (list.length < 4)
      list.push({ thumbnail_url: sim.thumbnail_url, icon: sim.subject?.icon, color: sim.subject?.color });
    covers.set(it.collection_id as string, list);
  }
  return collections.map((c) => ({ ...c, covers: covers.get(c.id) ?? [] }));
}

export async function getCollectionBySlug(client: SupabaseClient, slug: string) {
  const { data, error } = await client
    .from("collections")
    .select(COLLECTION_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw toHttpError(error);
  return (data as Collection | null) ?? null;
}

export async function getCollectionById(client: SupabaseClient, id: string) {
  const { data, error } = await client
    .from("collections")
    .select(COLLECTION_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw toHttpError(error);
  return (data as Collection | null) ?? null;
}

export async function listCollectionItems(
  client: SupabaseClient,
  collectionId: string,
): Promise<CollectionItem[]> {
  const { data, error } = await client
    .from("collection_items")
    .select(`simulation_id, sort_order, note, added_at, simulation:simulations(${CARD_SELECT})`)
    .eq("collection_id", collectionId)
    .order("sort_order")
    .order("added_at")
    .limit(500);
  if (error) throw toHttpError(error);
  return (data ?? [])
    .filter((r) => r.simulation)
    .map((r) => ({
      simulation_id: r.simulation_id as string,
      sort_order: r.sort_order as number,
      note: r.note as string | null,
      added_at: r.added_at as string,
      simulation: mapCardRow(r.simulation as unknown as Record<string, unknown>),
    }));
}

export async function getOwnerDisplayName(client: SupabaseClient, ownerId: string) {
  // Hồ sơ không public (RLS) → chỉ hiện tên khi người xem chính là chủ sở hữu/admin.
  const { data } = await client.from("profiles").select("full_name").eq("id", ownerId).maybeSingle();
  return (data?.full_name as string | undefined) ?? null;
}

export async function createCollection(
  client: SupabaseClient,
  ownerId: string,
  input: { name: string; description?: string | null; is_public?: boolean },
): Promise<Collection> {
  const base = slugify(input.name, 80) || "bo-suu-tap";
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = `${base}-${randomSuffix(6)}`;
    const { data, error } = await client
      .from("collections")
      .insert({
        name: input.name,
        description: input.description ?? null,
        is_public: input.is_public ?? false,
        owner_id: ownerId,
        slug,
      })
      .select(COLLECTION_SELECT)
      .single();
    if (!error) return data as Collection;
    if (error.code !== "23505") throw toHttpError(error);
  }
  throw new HttpError(409, "conflict");
}

export async function updateCollection(
  client: SupabaseClient,
  id: string,
  patch: { name?: string; description?: string | null; is_public?: boolean },
) {
  const { data, error } = await client
    .from("collections")
    .update(patch)
    .eq("id", id)
    .select(COLLECTION_SELECT)
    .maybeSingle();
  if (error) throw toHttpError(error);
  if (!data) throw new HttpError(404, "not_found");
  return data as Collection;
}

export async function deleteCollection(client: SupabaseClient, id: string) {
  const { error, count } = await client.from("collections").delete({ count: "exact" }).eq("id", id);
  if (error) throw toHttpError(error);
  if (!count) throw new HttpError(404, "not_found");
}

export async function addCollectionItem(
  client: SupabaseClient,
  collectionId: string,
  simulationId: string,
  note?: string | null,
) {
  const { data: last } = await client
    .from("collection_items")
    .select("sort_order")
    .eq("collection_id", collectionId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await client
    .from("collection_items")
    .upsert(
      {
        collection_id: collectionId,
        simulation_id: simulationId,
        sort_order: ((last?.sort_order as number | undefined) ?? -1) + 1,
        note: note ?? null,
      },
      { onConflict: "collection_id,simulation_id", ignoreDuplicates: true },
    );
  if (error) throw toHttpError(error);
}

export async function removeCollectionItem(
  client: SupabaseClient,
  collectionId: string,
  simulationId: string,
) {
  const { error } = await client
    .from("collection_items")
    .delete()
    .eq("collection_id", collectionId)
    .eq("simulation_id", simulationId);
  if (error) throw toHttpError(error);
}

export async function updateCollectionItem(
  client: SupabaseClient,
  collectionId: string,
  simulationId: string,
  patch: { note?: string | null },
) {
  const { error } = await client
    .from("collection_items")
    .update(patch)
    .eq("collection_id", collectionId)
    .eq("simulation_id", simulationId);
  if (error) throw toHttpError(error);
}

/** Ghi lại thứ tự mới (danh sách id theo thứ tự hiển thị). */
export async function reorderCollectionItems(
  client: SupabaseClient,
  collectionId: string,
  orderedIds: string[],
) {
  const results = await Promise.all(
    orderedIds.map((simulationId, index) =>
      client
        .from("collection_items")
        .update({ sort_order: index })
        .eq("collection_id", collectionId)
        .eq("simulation_id", simulationId),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw toHttpError(failed.error);
}

export async function getTeacherActivity(client: SupabaseClient, days = 30) {
  const { data, error } = await client.rpc("teacher_collection_activity", { p_days: days });
  if (error) throw toHttpError(error);
  return (data ?? []) as {
    id: string;
    name: string;
    slug: string;
    is_public: boolean;
    item_count: number;
    total_views: number;
    views: number;
    opens: number;
    top: { title: string; slug: string; opens: number; last_opened_at: string }[];
  }[];
}

export async function trackCollectionView(client: SupabaseClient, collectionId: string) {
  const { error } = await client.rpc("track_collection_view", { p_collection_id: collectionId });
  if (error) console.warn("[collections] track view failed", error.message);
}

// ---------------------------------------------------------------------------
// Báo lỗi
// ---------------------------------------------------------------------------
export async function createIssueReport(
  client: SupabaseClient,
  input: { simulation_id: string; reason: string; message?: string | null; reporter_id?: string | null },
) {
  const { error } = await client.from("issue_reports").insert({
    simulation_id: input.simulation_id,
    reason: input.reason,
    message: input.message ?? null,
    reporter_id: input.reporter_id ?? null,
  });
  if (error) throw toHttpError(error);
}
