"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { safeNext } from "@/lib/safe-next";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthShell, FieldLabel, inputClassName } from "@/components/auth-shell";
import { Button } from "@/components/ui";
import { GoogleButton } from "@/components/google-button";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("error") === "google_auth_failed") {
      setError("Couldn't sign you in with Google. Please try again.");
    }
  }, [searchParams]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Couldn't log you in. Check your details and try again.");
      }
      router.push(safeNext(searchParams.get("next")));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Log in"
      subtitle="Pick up your trip right where you left it."
      footer={
        <>
          New to Toure?{" "}
          <Link href={searchParams.get("next") ? `/auth/register?next=${encodeURIComponent(safeNext(searchParams.get("next")))}` : "/auth/register"} className="font-semibold text-rani-600 hover:text-rani-700">
            Create an account
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <GoogleButton />

        <div className="flex items-center gap-3 text-xs font-medium text-stone-400">
          <span className="h-px flex-1 bg-stone-200" />
          OR
          <span className="h-px flex-1 bg-stone-200" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputClassName}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Link href="/auth/forgot-password" className="mb-1.5 text-sm font-semibold text-rani-600 hover:text-rani-700">
                Forgot?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputClassName + " pr-12"}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-1.5 grid w-10 place-items-center text-stone-400 hover:text-stone-600"
              >
                {showPassword ? <EyeOff size={19} aria-hidden /> : <Eye size={19} aria-hidden />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" disabled={submitting} className="w-full">
            {submitting ? <Loader2 size={18} className="animate-spin" aria-hidden /> : null}
            {submitting ? "Logging in…" : "Log in"}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
