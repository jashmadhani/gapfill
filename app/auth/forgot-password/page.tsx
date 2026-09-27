"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { AuthShell, FieldLabel, inputClassName } from "@/components/auth-shell";
import { Button } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch {
      setError("Something went wrong. Try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Reset password"
      title="Forgot your password?"
      subtitle="We'll send a reset link to your email."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/auth/login" className="font-semibold text-rani-600 hover:text-rani-700">
            Back to log in
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-700">
            <MailCheck size={22} aria-hidden />
          </span>
          <p className="text-sm text-stone-600">
            If an account exists for <span className="font-semibold text-ink">{email}</span>,
            we've sent a link to reset your password.
          </p>
        </div>
      ) : (
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

          {error && (
            <p role="alert" className="rounded-2xl bg-red-50 px-4 py-2.5 text-sm text-red-700">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" disabled={submitting} className="w-full">
            {submitting ? <Loader2 size={18} className="animate-spin" aria-hidden /> : null}
            {submitting ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
