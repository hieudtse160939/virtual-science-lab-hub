"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/track";

/** Ghi 1 lượt xem cho mỗi mô phỏng trong một phiên trình duyệt (tránh đếm trùng khi tải lại). */
export function ViewTracker({
  simulationId,
  event = "view",
  collectionId,
}: {
  simulationId: string;
  event?: "view" | "embed_open";
  collectionId?: string | null;
}) {
  useEffect(() => {
    const key = `vsl:${event}:${simulationId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // sessionStorage bị chặn → vẫn ghi nhận
    }
    trackEvent(simulationId, event, collectionId);
  }, [simulationId, event, collectionId]);
  return null;
}
