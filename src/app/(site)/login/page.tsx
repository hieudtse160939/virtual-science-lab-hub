import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/auth-forms";
import { getI18n } from "@/lib/i18n/server";
import { safeNextPath } from "@/lib/utils";
import { getSession } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.loginTitle, robots: { index: false } };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  if (await getSession()) redirect(safeNextPath(next));
  const { t } = await getI18n();
  return <LoginForm next={next} initialError={error === "callback" ? t.auth.callbackError : null} />;
}
