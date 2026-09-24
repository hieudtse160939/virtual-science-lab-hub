"use client";

import { GraduationCap, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/client";
import type { Profile } from "@/types/domain";

export function AccountForm({
  profile,
  email,
  needTeacher,
}: {
  profile: Profile;
  email: string;
  needTeacher: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const save = async (patch: Record<string, unknown>) => {
    setSaving(true);
    try {
      await apiFetch("/api/account", { method: "PATCH", json: patch });
      toast.success(t.account.saved);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    void save({ full_name: String(form.get("full_name") ?? ""), school: String(form.get("school") ?? "") });
  };

  return (
    <div className="space-y-6">
      {profile.role === "student" && (
        <div
          className={`flex flex-col gap-3 rounded-2xl border p-5 sm:flex-row sm:items-center ${needTeacher ? "border-primary bg-primary-soft" : "bg-card"}`}
        >
          <GraduationCap className="text-primary size-8 shrink-0" aria-hidden />
          <div className="flex-1">
            <p className="font-semibold">
              {needTeacher ? t.auth.teacherRequired : t.account.switchToTeacher}
            </p>
            <p className="text-muted-foreground text-sm">{t.account.switchToTeacherHint}</p>
          </div>
          <Button onClick={() => void save({ role: "teacher" })} disabled={saving}>
            {t.account.switchToTeacher}
          </Button>
        </div>
      )}

      <form onSubmit={submit} className="bg-card space-y-4 rounded-2xl border p-5 shadow-sm sm:p-6">
        <h2 className="font-semibold">{t.account.profile}</h2>
        <div className="grid gap-2">
          <Label htmlFor="email">{t.auth.email}</Label>
          <Input id="email" value={email} disabled readOnly />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="full_name">{t.auth.fullName}</Label>
          <Input id="full_name" name="full_name" defaultValue={profile.full_name ?? ""} maxLength={120} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="school">{t.account.school}</Label>
          <Input id="school" name="school" defaultValue={profile.school ?? ""} maxLength={200} />
        </div>
        <div className="grid gap-2">
          <span className="text-sm font-medium">{t.account.role}</span>
          <div className="flex flex-wrap items-center gap-3">
            <span className="bg-muted rounded-full px-3 py-1 text-sm font-medium">
              {t.account.roles[profile.role]}
            </span>
            {profile.role === "teacher" && (
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => void save({ role: "student" })}
                disabled={saving}
              >
                {t.account.roles.student}
              </Button>
            )}
          </div>
        </div>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />} {t.common.save}
        </Button>
      </form>
    </div>
  );
}
