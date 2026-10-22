"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AuthApiPayload, PublicAuthUser } from "@/lib/auth/types";

interface AuthResult {
  error: string | null;
  status?: number;
  fieldErrors?: Record<string, string[]>;
  user?: PublicAuthUser | null;
  retryAfterSeconds?: number;
}

interface SignUpResult extends AuthResult {
  requiresEmailConfirmation: boolean;
}

type SignOutScope = "global" | "local" | "others";

async function authRequest(
  path: string,
  init: RequestInit = {}
): Promise<AuthResult & AuthApiPayload> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...init.headers
      }
    });
  } catch {
    return { error: "Network error. Please try again." };
  }

  const payload = (await response.json().catch(() => ({}))) as AuthApiPayload;
  if (!response.ok) {
    return {
      ...payload,
      error: payload.message ?? "Authentication could not be completed.",
      status: response.status
    };
  }

  return { ...payload, error: null, status: response.status };
}

function absoluteUrl(path: string): string {
  return new URL(path, window.location.origin).toString();
}

export class BrowserAuthService {
  async signInWithPassword(input: {
    email: string;
    password: string;
  }): Promise<AuthResult> {
    return authRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  async signUp(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<SignUpResult> {
    const result = await authRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(input)
    });

    return {
      ...result,
      requiresEmailConfirmation: Boolean(result.requiresEmailConfirmation)
    };
  }

  async signInWithGoogle(next = "/dashboard"): Promise<AuthResult> {
    const redirectTo = absoluteUrl(
      `/auth/callback?next=${encodeURIComponent(next)}`
    );
    const { error } =
      await createSupabaseBrowserClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo }
      });
    return { error: error?.message ?? null };
  }

  async linkGoogle(): Promise<AuthResult> {
    const redirectTo = absoluteUrl("/auth/callback?next=/account");
    const { error } = await createSupabaseBrowserClient().auth.linkIdentity({
      provider: "google",
      options: { redirectTo }
    });
    return { error: error?.message ?? null };
  }

  async requestPasswordReset(email: string): Promise<AuthResult> {
    const { error } =
      await createSupabaseBrowserClient().auth.resetPasswordForEmail(email, {
        redirectTo: absoluteUrl("/reset-password")
      });
    return { error: error?.message ?? null };
  }

  async updatePassword(password: string): Promise<AuthResult> {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };

    const { error: signOutError } = await supabase.auth.signOut({
      scope: "others"
    });
    return { error: signOutError?.message ?? null };
  }

  async signOut(scope: SignOutScope = "local"): Promise<AuthResult> {
    if (scope !== "local") {
      const { error } = await createSupabaseBrowserClient().auth.signOut({
        scope
      });
      return { error: error?.message ?? null };
    }

    return authRequest("/api/auth/logout", {
      method: "POST",
      body: "{}"
    });
  }

  async refreshSession(): Promise<AuthResult> {
    return authRequest("/api/auth/refresh", {
      method: "POST",
      body: "{}"
    });
  }
}

export const authClient = new BrowserAuthService();
