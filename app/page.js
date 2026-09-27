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

export default function LoginPage() {
  const [mode, setMode] = useState("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("code")) {
      setLoading(true);
      window.location.replace(`/auth/callback${window.location.search}`);
      return;
    }
    if (params.get("error") === "auth_failed") {
      setError("That link is invalid or has expired. Please try again.");
    }
  }, []);

  function switchMode(next) {
    setMode(next);
    setError(null);
    setMessage(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      window.location.replace("/dashboard");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (data.session) {
      window.location.replace("/dashboard");
      return;
    }
    // Email confirmation is enabled — no session until the link is clicked
    setMessage("Check your email for a confirmation link to finish signing up.");
    setLoading(false);
  }

  return (
    <AuthLayout
      footer={
        <p className="text-center text-slate-500 text-xs mt-6">
          By continuing, you agree to our terms of service.
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-center text-slate-300 text-sm">
          {mode === "signin"
            ? "Sign in to continue to your workspace"
            : "Create your account"}
        </p>

        <AuthAlert>{error}</AuthAlert>
        <AuthAlert type="success">{message}</AuthAlert>

        {mode === "signup" && (
          <input
            type="text"
            required
            autoComplete="name"
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={authInputClass}
          />
        )}
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={authInputClass}
        />
        <input
          type="password"
          required
          minLength={6}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={authInputClass}
        />

        {mode === "signin" && (
          <div className="flex justify-end -mt-1">
            <Link
              href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`}
              className={`text-xs ${authLinkClass}`}
            >
              Forgot password?
            </Link>
          </div>
        )}

        <AuthSubmitButton loading={loading}>
          {mode === "signin"
            ? loading
              ? "Signing in…"
              : "Sign in"
            : loading
              ? "Creating account…"
              : "Sign up"}
        </AuthSubmitButton>

        <p className="text-center text-slate-400 text-sm">
          {mode === "signin" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("signup")}
                className={authLinkClass}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className={authLinkClass}
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </form>
    </AuthLayout>
  );
}
