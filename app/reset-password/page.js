"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import AuthLayout, {
  AuthAlert,
  AuthSubmitButton,
  MIN_PASSWORD_LENGTH,
  authInputClass,
  authLinkClass,
} from "@/components/auth/AuthLayout";

// Reached via the recovery email → /auth/callback?next=/reset-password,
// which exchanges the code and leaves the user signed in.
export default function ResetPasswordPage() {
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        setHasSession(!!data.user);
        setChecking(false);
      });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    window.location.replace("/dashboard");
  }

  return (
    <AuthLayout>
      {checking ? null : !hasSession ? (
        <div className="space-y-4">
          <AuthAlert>
            This reset link is invalid or has expired. Request a new one.
          </AuthAlert>
          <p className="text-center text-sm">
            <Link href="/forgot-password" className={authLinkClass}>
              Send a new reset link
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-center text-slate-300 text-sm">
            Choose a new password
          </p>

          <AuthAlert>{error}</AuthAlert>

          <input
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass}
          />
          <input
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={authInputClass}
          />

          <AuthSubmitButton loading={loading}>
            {loading ? "Saving…" : "Update password"}
          </AuthSubmitButton>
        </form>
      )}
    </AuthLayout>
  );
}
