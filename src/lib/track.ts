"use client";

/** Gửi sự kiện thống kê không chặn điều hướng (sendBeacon, fallback fetch keepalive). */
export function trackEvent(
  simulationId: string,
  event: "view" | "external_open" | "embed_open",
  collectionId?: string | null,
) {
  const body = JSON.stringify({ simulation_id: simulationId, event, collection_id: collectionId ?? null });
  try {
    if (navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) return;
  } catch {
    // bỏ qua, dùng fetch
  }
  void fetch("/api/track", {
    method: "POST",
    body,
    keepalive: true,
    headers: { "content-type": "application/json" },
  }).catch(() => undefined);
}
