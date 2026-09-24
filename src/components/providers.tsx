"use client";

import { ThemeProvider } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast, Toaster } from "sonner";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { I18nProvider, useI18n } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { UserRole } from "@/types/domain";

export interface ClientUser {
  id: string;
  email: string | null;
  name: string | null;
  role: UserRole;
}

const UserContext = createContext<ClientUser | null>(null);

export function useUser() {
  return useContext(UserContext);
}

// ---------------------------------------------------------------------------
// Yêu thích: tải danh sách id một lần, cập nhật lạc quan (optimistic).
// ---------------------------------------------------------------------------
interface FavoritesContextValue {
  isFavorite: (id: string) => boolean;
  toggle: (id: string, title: string) => Promise<void>;
  ready: boolean;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

function FavoritesProvider({ user, children }: { user: ClientUser | null; children: ReactNode }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(!user);
  const pending = useRef(new Set<string>());

  useEffect(() => {
    if (!user) {
      setIds(new Set());
      setReady(true);
      return;
    }
    let cancelled = false;
    apiFetch<{ ids: string[] }>("/api/favorites?only=ids")
      .then((res) => !cancelled && setIds(new Set(res.ids)))
      .catch(() => undefined)
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const toggle = useCallback(
    async (id: string, title: string) => {
      if (!user) {
        toast.info(t.auth.loginRequired);
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      if (pending.current.has(id)) return;
      pending.current.add(id);
      const wasFavorite = ids.has(id);
      setIds((prev) => {
        const next = new Set(prev);
        if (wasFavorite) next.delete(id);
        else next.add(id);
        return next;
      });
      try {
        await apiFetch("/api/favorites", {
          method: wasFavorite ? "DELETE" : "POST",
          json: { simulation_id: id },
        });
        toast.success(wasFavorite ? t.favorites.removed : t.favorites.added, { description: title });
      } catch (err) {
        setIds((prev) => {
          const next = new Set(prev);
          if (wasFavorite) next.add(id);
          else next.delete(id);
          return next;
        });
        toast.error(errorMessage(err, t));
      } finally {
        pending.current.delete(id);
      }
    },
    [user, ids, router, pathname, t],
  );

  const value = useMemo(
    () => ({ isFavorite: (id: string) => ids.has(id), toggle, ready }),
    [ids, toggle, ready],
  );
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites phải nằm trong Providers");
  return ctx;
}

// ---------------------------------------------------------------------------
// Tùy chọn hiển thị: cỡ chữ & tương phản cao (lưu ở trình duyệt, áp dụng trước khi vẽ).
// ---------------------------------------------------------------------------
export type TextSize = "md" | "lg" | "xl";
interface DisplayPrefs {
  textSize: TextSize;
  highContrast: boolean;
}
const DISPLAY_KEY = "vsl-display";

const DisplayContext = createContext<{
  prefs: DisplayPrefs;
  update: (p: Partial<DisplayPrefs>) => void;
} | null>(null);

export function useDisplayPrefs() {
  const ctx = useContext(DisplayContext);
  if (!ctx) throw new Error("useDisplayPrefs phải nằm trong Providers");
  return ctx;
}

/** Script chạy trước khi hydrate để tránh nhấp nháy cỡ chữ / tương phản. */
export const displayPrefsScript = `try{var p=JSON.parse(localStorage.getItem("${DISPLAY_KEY}")||"{}");var d=document.documentElement;if(p.textSize&&p.textSize!=="md")d.dataset.textSize=p.textSize;if(p.highContrast)d.classList.add("hc")}catch(e){}`;

function DisplayProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<DisplayPrefs>({ textSize: "md", highContrast: false });

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(DISPLAY_KEY) ?? "{}") as Partial<DisplayPrefs>;
      setPrefs({ textSize: stored.textSize ?? "md", highContrast: !!stored.highContrast });
    } catch {
      // localStorage bị chặn → dùng mặc định
    }
  }, []);

  const update = useCallback((patch: Partial<DisplayPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      const root = document.documentElement;
      if (next.textSize === "md") delete root.dataset.textSize;
      else root.dataset.textSize = next.textSize;
      root.classList.toggle("hc", next.highContrast);
      try {
        localStorage.setItem(DISPLAY_KEY, JSON.stringify(next));
      } catch {
        // bỏ qua
      }
      return next;
    });
  }, []);

  return <DisplayContext.Provider value={{ prefs, update }}>{children}</DisplayContext.Provider>;
}

export function Providers({
  locale,
  t,
  user,
  children,
}: {
  locale: Locale;
  t: Dictionary;
  user: ClientUser | null;
  children: ReactNode;
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <I18nProvider locale={locale} t={t}>
        <DisplayProvider>
          <UserContext.Provider value={user}>
            <FavoritesProvider user={user}>{children}</FavoritesProvider>
          </UserContext.Provider>
        </DisplayProvider>
        <Toaster richColors closeButton position="bottom-right" />
      </I18nProvider>
    </ThemeProvider>
  );
}
