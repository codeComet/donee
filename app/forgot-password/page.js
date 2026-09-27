"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import AuthLayout, {
  AuthAlert,
  AuthSubmitButton,
  authInputClass,
  authLinkClass,
} from "@/components/auth/AuthLayout";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const prefill = new URLSearchParams(window.location.search).get("email");
    if (prefill) setEmail(prefill);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <AuthLayout
      footer={
        <p className="text-center text-slate-400 text-sm mt-6">
          Remembered it?{" "}
          <Link href="/" className={authLinkClass}>
            Back to sign in
          </Link>
        </p>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <p className="text-center text-slate-300 text-sm">Reset link sent</p>
          <AuthAlert type="success">
            If an account exists for {email}, you&apos;ll receive an email with
            a link to set a new password. Open it in this browser.
          </AuthAlert>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-center text-slate-300 text-sm">
            Enter your email and we&apos;ll send you a link to reset your
            password
          </p>

          <AuthAlert>{error}</AuthAlert>

          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={authInputClass}
          />

          <AuthSubmitButton loading={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </AuthSubmitButton>
        </form>
      )}
    </AuthLayout>
  );
}
