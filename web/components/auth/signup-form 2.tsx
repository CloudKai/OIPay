"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validateForm() {
    if (name.trim().length < 2) {
      return "Please enter your name (at least 2 characters).";
    }

    const normalizedEmail = email.trim().toLowerCase();
    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
    if (!isEmailValid) {
      return "Please enter a valid email address.";
    }

    if (password.length < 8) {
      return "Password must be at least 8 characters.";
    }

    return null;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const signupResponse = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: normalizedEmail,
          password
        })
      });

      if (!signupResponse.ok) {
        const payload = (await signupResponse.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Unable to create account.");
        setLoading(false);
        return;
      }

      const loginResult = await signIn("credentials", {
        email: normalizedEmail,
        password,
        redirect: false
      });

      setLoading(false);

      if (!loginResult || loginResult.error) {
        setError("Account created, but sign-in failed. Please sign in manually.");
        router.push("/login");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setLoading(false);
      setError("Network error. Check your connection and try again.");
    }
  }

  const canSubmit = name.trim().length >= 2 && email.trim().length > 0 && password.length >= 8 && !loading;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="signup-name" className="auth-label">
          Name
        </label>
        <input
          id="signup-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="auth-input"
          placeholder="Kai"
          autoComplete="name"
          required
          minLength={2}
        />
      </div>

      <div>
        <label htmlFor="signup-email" className="auth-label">
          Email
        </label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="auth-input"
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </div>

      <div>
        <label htmlFor="signup-password" className="auth-label">
          Password
        </label>
        <div className="relative">
          <input
            id="signup-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="auth-input pr-20"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
            minLength={8}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 transition hover:text-slate-700"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Creating account..." : "Create account"}
      </button>
      <p className="text-xs text-slate-500">Password must be at least 8 characters.</p>
    </form>
  );
}
