"use client";

import { useEffect } from "react";

/** Ghi 1 lượt xem bộ sưu tập mỗi phiên trình duyệt (bỏ qua khi chủ sở hữu tự xem). */
export function CollectionViewTracker({ collectionId, isOwner }: { collectionId: string; isOwner: boolean }) {
  useEffect(() => {
    if (isOwner) return;
    const key = `vsl:collection:${collectionId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // bỏ qua
    }
    void fetch(`/api/collections/${collectionId}/view`, { method: "POST", keepalive: true }).catch(
      () => undefined,
    );
  }, [collectionId, isOwner]);
  return null;
}
