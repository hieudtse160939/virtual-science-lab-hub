import type { Metadata } from "next";
import { AccountForm } from "@/components/auth/account-form";
import { getI18n } from "@/lib/i18n/server";
import { requirePageSession } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.account.title, robots: { index: false } };
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ need?: string }> }) {
  const [{ t }, session, { need }] = await Promise.all([
    getI18n(),
    requirePageSession("/account"),
    searchParams,
  ]);
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">{t.account.title}</h1>
      <AccountForm
        profile={session.profile}
        email={session.user.email ?? ""}
        needTeacher={need === "teacher"}
      />
    </div>
  );
}
