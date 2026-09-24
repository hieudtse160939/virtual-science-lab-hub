import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";
import { requirePageSession } from "@/server/auth";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePageSession("/admin", "admin");
  return (
    <div className="mx-auto grid max-w-[90rem] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[210px_1fr]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <AdminNav />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
