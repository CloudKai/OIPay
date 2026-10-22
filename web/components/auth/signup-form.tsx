"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { useAuth } from "@/components/auth/auth-provider";
import { MIN_AUTH_PASSWORD_LENGTH } from "@/lib/auth/constants";
import { authClient } from "@/lib/auth-client";

function firstError(errors: string[] | undefined): string | undefined {
  return errors?.[0];
}

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function SignupForm({
  authConfigured,
  googleEnabled,
}: {
  authConfigured: boolean;
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const { setUser } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [sent, setSent] = useState(false);
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
    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const nextFieldErrors: Record<string, string[]> = {};
    if (trimmedName.length < 2) {
      nextFieldErrors.name = ["Enter your name."];
    }
    if (!isLikelyEmail(normalizedEmail)) {
      nextFieldErrors.email = ["Enter a valid email address."];
    }
    if (password.length < MIN_AUTH_PASSWORD_LENGTH) {
      nextFieldErrors.password = [
        `Use at least ${MIN_AUTH_PASSWORD_LENGTH} characters.`
      ];
    }
    if (Object.keys(nextFieldErrors).length > 0) {
      setPending(false);
      setFieldErrors(nextFieldErrors);
      return;
    }

    const result = await authClient.signUp({
      name: trimmedName,
      email: normalizedEmail,
      password
    });
    setPending(false);
    if (result.error) {
      setFieldErrors(result.fieldErrors ?? {});
      setError(result.error);
      return;
    }
    if (result.requiresEmailConfirmation) {
      setUser(null);
      setSent(true);
      return;
    }
    setUser(result.user ?? null);
    router.push("/dashboard");
    router.refresh();
  }

  if (sent) {
    return (
      <div className="rounded-lg bg-[var(--focus-soft)] p-5">
        <h3 className="font-semibold text-[var(--ink)]">Check your email</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--ink)]">
          We sent a verification link to {email}. Open it to finish creating
          your account.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field
        label="Name"
        htmlFor="signup-name"
        error={firstError(fieldErrors.name)}
      >
        <Input
          id="signup-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          minLength={2}
          required
        />
      </Field>
      <Field
        label="Email"
        htmlFor="signup-email"
        error={firstError(fieldErrors.email)}
      >
        <Input
          id="signup-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
      </Field>
      <Field
        label="Password"
        htmlFor="signup-password"
        hint={`Use at least ${MIN_AUTH_PASSWORD_LENGTH} characters.`}
        error={firstError(fieldErrors.password)}
      >
        <Input
          id="signup-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          minLength={MIN_AUTH_PASSWORD_LENGTH}
          required
        />
      </Field>
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
        {pending ? "Creating account..." : "Create account"}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="w-full"
        disabled={!googleEnabled || !authConfigured}
        onClick={async () => {
          const result = await authClient.signInWithGoogle();
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
