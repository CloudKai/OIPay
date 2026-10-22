"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { MIN_AUTH_PASSWORD_LENGTH } from "@/lib/auth/constants";
import { authClient } from "@/lib/auth-client";

export function ForgotPasswordForm({
  authConfigured
}: {
  authConfigured: boolean;
}) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-[var(--focus-soft)] p-4 text-sm leading-6 text-[var(--ink)]">
          If an account exists for that email, a password reset link is on its
          way. This message is intentionally the same for every address.
        </div>
        <Button asChild variant="secondary" className="w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!authConfigured) return;
        setPending(true);
        setError(null);
        const result = await authClient.requestPasswordReset(
          email.trim().toLowerCase()
        );
        setPending(false);
        if (result.error) {
          setError("The reset email could not be sent. Please try again shortly.");
          return;
        }
        setSent(true);
      }}
    >
      {!authConfigured ? (
        <FormMessage message="Authentication setup is incomplete. Add the Supabase project URL and publishable key to the deployment settings." />
      ) : null}
      <Field label="Email" htmlFor="recovery-email">
        <Input
          id="recovery-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
      </Field>
      <FormMessage message={error} />
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={pending || !authConfigured}
      >
        {pending ? "Sending..." : "Send reset link"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (complete) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-[var(--focus-soft)] p-4 text-sm text-[var(--ink)]">
          Your password was changed and old sessions were revoked.
        </div>
        <Button asChild className="w-full">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (password.length < MIN_AUTH_PASSWORD_LENGTH) {
          setError(`Use at least ${MIN_AUTH_PASSWORD_LENGTH} characters.`);
          return;
        }
        if (password !== confirmPassword) {
          setError("The passwords do not match.");
          return;
        }
        setPending(true);
        setError(null);
        const result = await authClient.updatePassword(password);
        setPending(false);
        if (result.error) {
          setError("This reset link is invalid or expired. Request a new one.");
          return;
        }
        setComplete(true);
      }}
    >
      <Field label="New password" htmlFor="reset-password">
        <Input
          id="reset-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          minLength={MIN_AUTH_PASSWORD_LENGTH}
          required
        />
      </Field>
      <Field label="Confirm new password" htmlFor="reset-password-confirm">
        <Input
          id="reset-password-confirm"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          minLength={MIN_AUTH_PASSWORD_LENGTH}
          required
        />
      </Field>
      <FormMessage message={error} />
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={pending}
      >
        {pending ? "Changing..." : "Set new password"}
      </Button>
    </form>
  );
}
