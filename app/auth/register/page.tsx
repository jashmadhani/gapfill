"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { AuthShell, FieldLabel, inputClassName } from "@/components/auth-shell";
import { Button } from "@/components/ui";
import { GoogleButton } from "@/components/google-button";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Couldn't create your account. Try again.");
      }
      router.push("/discover");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Let's get started"
      title="Create your account"
      subtitle="A few details, and Toure starts planning with you."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/auth/login" className="font-semibold text-rani-600 hover:text-rani-700">
            Log in
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
          <FieldLabel htmlFor="name">Full name</FieldLabel>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jordan Lee"
            className={inputClassName}
          />
        </div>

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
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
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

        <div>
          <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Type it again"
            className={inputClassName}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-700">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" disabled={submitting} className="w-full">
          {submitting ? <Loader2 size={18} className="animate-spin" aria-hidden /> : null}
          {submitting ? "Creating account…" : "Create account"}
        </Button>

        <p className="text-center text-xs text-stone-500">
          By continuing, you agree to Toure's Terms and Privacy Policy.
        </p>
        </form>
      </div>
    </AuthShell>
  );
}
