import "server-only";
import { unstable_cache } from "next/cache";
import { siteUrl } from "@/lib/utils";

export type EmbedStatus = "ok" | "blocked" | "unreachable" | "unknown";

/**
 * Kiểm tra (phía server) xem nhà cung cấp có cho phép hiển thị trang trong iframe hay không,
 * dựa trên header X-Frame-Options và Content-Security-Policy: frame-ancestors.
 * Chúng tôi TÔN TRỌNG các header này – không proxy, không vượt qua.
 */
async function checkEmbeddable(url: string): Promise<EmbedStatus> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "unreachable";
  }
  if (parsed.protocol !== "https:") return "blocked";

  const request = async (method: "HEAD" | "GET") => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url, {
        method,
        redirect: "follow",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "user-agent": "VirtualScienceLabHub/1.0 (+embed-check)",
          ...(method === "GET" ? { range: "bytes=0-0" } : {}),
        },
      });
      if (method === "GET") await res.body?.cancel().catch(() => undefined);
      return res;
    } finally {
      clearTimeout(timer);
    }
  };

  let res: Response;
  try {
    res = await request("HEAD");
    if (res.status === 405 || res.status === 403 || res.status === 501) res = await request("GET");
  } catch {
    return "unknown";
  }
  if (res.status >= 400 && res.status !== 416) return "unreachable";

  const xfo = res.headers.get("x-frame-options")?.toLowerCase().trim();
  if (xfo && (xfo.includes("deny") || xfo.includes("sameorigin"))) return "blocked";

  const csp = res.headers.get("content-security-policy");
  const frameAncestors = csp
    ?.split(";")
    .map((d) => d.trim())
    .find((d) => d.toLowerCase().startsWith("frame-ancestors"));
  if (frameAncestors) {
    const sources = frameAncestors
      .split(/\s+/)
      .slice(1)
      .map((s) => s.toLowerCase());
    const ourOrigin = new URL(siteUrl()).origin.toLowerCase();
    const allowed = sources.some(
      (s) =>
        s === "*" ||
        s === ourOrigin ||
        s === "https:" ||
        (s.startsWith("https://*.") && ourOrigin.endsWith(s.slice(9))),
    );
    if (!allowed) return "blocked";
  }
  return "ok";
}

/** Kết quả được cache 12 giờ cho mỗi URL. */
export const getEmbedStatus = unstable_cache(checkEmbeddable, ["embed-status"], { revalidate: 60 * 60 * 12 });
