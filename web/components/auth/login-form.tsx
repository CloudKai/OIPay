"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { useAuth } from "@/components/auth/auth-provider";
import { GENERIC_LOGIN_ERROR } from "@/lib/auth/constants";
import { authClient } from "@/lib/auth-client";

function firstError(errors: string[] | undefined): string | undefined {
  return errors?.[0];
}

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function LoginForm({
  authConfigured,
  callbackURL,
  googleEnabled
}: {
  authConfigured: boolean;
  callbackURL: string;
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});
    if (!authConfigured) {
      setPending(false);
      setError("Authentication has not been connected to Supabase yet.");
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    const nextFieldErrors: Record<string, string[]> = {};
    if (!isLikelyEmail(normalizedEmail)) {
      nextFieldErrors.email = ["Enter a valid email address."];
    }
    if (!password) {
      nextFieldErrors.password = ["Enter your password."];
    }
    if (Object.keys(nextFieldErrors).length > 0) {
      setPending(false);
      setFieldErrors(nextFieldErrors);
      return;
    }

    const result = await authClient.signInWithPassword({
      email: normalizedEmail,
      password
    });
    setPending(false);
    if (result.error) {
      setFieldErrors(result.fieldErrors ?? {});
      setError(
        result.status === 401 && !result.retryAfterSeconds
          ? GENERIC_LOGIN_ERROR
          : result.error
      );
      return;
    }
    setUser(result.user ?? null);
    router.push(callbackURL);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-2 border-b border-[var(--border)] pb-5">
        <Button asChild variant="secondary" size="lg" className="w-full">
          <Link href="/demo">Try demo as a guest</Link>
        </Button>
        <p className="text-center text-xs leading-5 text-[var(--ink-muted)]">
          Explore a sample group. No account needed.
        </p>
      </div>
      <Field
        label="Email"
        htmlFor="login-email"
        error={firstError(fieldErrors.email)}
      >
        <Input
          id="login-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </Field>
      <Field
        label="Password"
        htmlFor="login-password"
        error={firstError(fieldErrors.password)}
      >
        <div className="relative">
          <Input
            id="login-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="pr-12"
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-lg text-[var(--ink-muted)] hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </Field>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium text-[var(--primary)] hover:underline">
          Forgot password?
        </Link>
      </div>
      <FormMessage message={error} />
      {!authConfigured ? (
        <FormMessage message="Authentication setup is incomplete. Add the Supabase project URL and publishable key to the deployment settings." />
      ) : null}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={pending || !authConfigured}
      >
        {pending ? "Signing in..." : "Sign in"}
      </Button>
      <div className="flex items-center gap-3 text-xs text-[var(--ink-muted)]">
        <span className="h-px flex-1 bg-[var(--border)]" />
        or
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="w-full"
        disabled={!googleEnabled || !authConfigured}
        onClick={async () => {
          const result = await authClient.signInWithGoogle(callbackURL);
          if (result.error) setError("Google sign-in could not be started.");
        }}
      >
        Continue with Google
      </Button>
      {!googleEnabled ? (
        <p className="text-center text-xs leading-5 text-[var(--ink-muted)]">
          Google sign-in is not configured for this deployment yet.
        </p>
      ) : null}
    </form>
  );
}
