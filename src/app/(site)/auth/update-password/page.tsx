import type { Metadata } from "next";
import { UpdatePasswordForm } from "@/components/auth/auth-forms";
import { getI18n } from "@/lib/i18n/server";
import { requirePageSession } from "@/server/auth";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.auth.updatePassword, robots: { index: false } };
}

export default async function UpdatePasswordPage() {
  await requirePageSession("/auth/update-password");
  return <UpdatePasswordForm />;
}
