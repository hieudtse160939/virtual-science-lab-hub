"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { cn, safeNextPath } from "@/lib/utils";

function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
      <div className="bg-card rounded-2xl border p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-1 mb-6 text-sm">{subtitle}</p>
        {children}
      </div>
      {footer && <div className="text-muted-foreground mt-4 text-center text-sm">{footer}</div>}
    </div>
  );
}

function Alert({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg px-3 py-2 text-sm",
        kind === "error" ? "bg-destructive/10 text-destructive" : "bg-success-soft text-success",
      )}
    >
      {children}
    </p>
  );
}

export function LoginForm({ next, initialError }: { next?: string; initialError?: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    const { error: err } = await createClient().auth.signInWithPassword({
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
    });
    if (err) {
      setError(err.status === 400 ? t.auth.invalidCredentials : t.auth.genericError);
      setLoading(false);
      return;
    }
    router.replace(safeNextPath(next));
    router.refresh();
  };

  return (
    <AuthCard
      title={t.auth.loginTitle}
      subtitle={t.auth.loginSubtitle}
      footer={
        <>
          {t.auth.noAccount}{" "}
          <Link
            href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="text-primary font-semibold hover:underline"
          >
            {t.nav.signup}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4" noValidate={false}>
        {error && <Alert kind="error">{error}</Alert>}
        <div className="grid gap-2">
          <Label htmlFor="email">{t.auth.email}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t.auth.password}</Label>
            <Link href="/forgot-password" className="text-primary text-xs hover:underline">
              {t.auth.forgot}
            </Link>
          </div>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <Button type="submit" size="lg" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />} {t.auth.submitLogin}
        </Button>
      </form>
    </AuthCard>
  );
}

export function SignupForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<"student" | "teacher">("teacher");

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    if (password.length < 8) {
      setError(t.auth.passwordHint);
      return;
    }
    setLoading(true);
    setError(null);
    const redirect = `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}`;
    const { data, error: err } = await createClient().auth.signUp({
      email: String(form.get("email")).trim(),
      password,
      options: {
        emailRedirectTo: redirect,
        data: { full_name: String(form.get("full_name") ?? "").trim(), role },
      },
    });
    setLoading(false);
    if (err) {
      setError(err.message || t.auth.genericError);
      return;
    }
    if (data.session) {
      // Dự án tắt xác nhận email → đăng nhập ngay.
      router.replace(safeNextPath(next, role === "teacher" ? "/teacher" : "/"));
      router.refresh();
    } else {
      setDone(true);
    }
  };

  return (
    <AuthCard
      title={t.auth.signupTitle}
      subtitle={t.auth.signupSubtitle}
      footer={
        <>
          {t.auth.haveAccount}{" "}
          <Link
            href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="text-primary font-semibold hover:underline"
          >
            {t.nav.login}
          </Link>
        </>
      }
    >
      {done ? (
        <Alert kind="success">{t.auth.checkEmail}</Alert>
      ) : (
        <form onSubmit={submit} className="grid gap-4">
          {error && <Alert kind="error">{error}</Alert>}
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{t.auth.role}</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["teacher", "student"] as const).map((r) => (
                <label
                  key={r}
                  className={cn(
                    "has-[:focus-visible]:outline-ring flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium has-[:focus-visible]:outline-3",
                    role === r ? "border-primary bg-primary-soft text-primary" : "hover:bg-accent",
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r}
                    checked={role === r}
                    onChange={() => setRole(r)}
                    className="sr-only"
                  />
                  {r === "teacher" ? t.auth.roleTeacher : t.auth.roleStudent}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-2">
            <Label htmlFor="full_name">{t.auth.fullName}</Label>
            <Input id="full_name" name="full_name" autoComplete="name" maxLength={120} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">{t.auth.email}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">{t.auth.password}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              aria-describedby="pw-hint"
            />
            <p id="pw-hint" className="text-muted-foreground text-xs">
              {t.auth.passwordHint}
            </p>
          </div>
          <Button type="submit" size="lg" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />} {t.auth.submitSignup}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

export function ForgotPasswordForm() {
  const { t } = useI18n();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    const { error: err } = await createClient().auth.resetPasswordForEmail(String(form.get("email")).trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
    });
    setLoading(false);
    // Không tiết lộ email có tồn tại hay không.
    if (err && err.status === 429) setError(t.errors.rateLimited);
    else setSent(true);
  };

  return (
    <AuthCard
      title={t.auth.resetTitle}
      subtitle={t.auth.resetSubtitle}
      footer={
        <Link href="/login" className="text-primary hover:underline">
          {t.nav.login}
        </Link>
      }
    >
      {sent ? (
        <Alert kind="success">{t.auth.resetSent}</Alert>
      ) : (
        <form onSubmit={submit} className="grid gap-4">
          {error && <Alert kind="error">{error}</Alert>}
          <div className="grid gap-2">
            <Label htmlFor="email">{t.auth.email}</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <Button type="submit" size="lg" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />} {t.auth.resetSubmit}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

export function UpdatePasswordForm() {
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password"));
    if (password.length < 8) {
      setError(t.auth.passwordHint);
      return;
    }
    setLoading(true);
    const { error: err } = await createClient().auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message || t.auth.genericError);
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.replace("/");
      router.refresh();
    }, 1200);
  };

  return (
    <AuthCard title={t.auth.updatePassword} subtitle={t.auth.passwordHint}>
      {done ? (
        <Alert kind="success">{t.auth.passwordUpdated}</Alert>
      ) : (
        <form onSubmit={submit} className="grid gap-4">
          {error && <Alert kind="error">{error}</Alert>}
          <div className="grid gap-2">
            <Label htmlFor="password">{t.auth.newPassword}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <Button type="submit" size="lg" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />} {t.auth.updatePassword}
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
