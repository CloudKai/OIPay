import "server-only";

import type { AuthError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";

import {
  GENERIC_LOGIN_ERROR,
  RATE_LIMITED_LOGIN_ERROR
} from "@/lib/auth/constants";
import {
  loginInputSchema,
  registerInputSchema,
  type LoginInput,
  type RegisterInput
} from "@/lib/auth/validation";
import { errorLogRecords, isDatabaseConnectionError } from "@/lib/error-reporting";
import {
  AuthRateLimitExceeded,
  AuthRateLimiter
} from "@/lib/server/auth-rate-limiter";
import { currentUserJson } from "@/lib/server/require-auth";
import {
  AccountDeletionRequested,
  appUserSynchronizer,
  getAuthContext,
  toPublicSessionUser
} from "@/lib/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { zodFieldErrors } from "@/lib/validation";

interface ApiFailureOptions {
  fieldErrors?: Record<string, string[]>;
  headers?: Record<string, string>;
}

class AuthApiFailure extends Error {
  readonly fieldErrors?: Record<string, string[]>;
  readonly headers?: Record<string, string>;

  constructor(
    message: string,
    public readonly status: number,
    options: ApiFailureOptions = {}
  ) {
    super(message);
    this.fieldErrors = options.fieldErrors;
    this.headers = options.headers;
  }
}

function noStoreJson(
  body: Record<string, unknown>,
  init: { status?: number; headers?: Record<string, string> } = {}
): NextResponse {
  return NextResponse.json(body, {
    status: init.status,
    headers: {
      "Cache-Control": "no-store",
      ...init.headers
    }
  });
}

function clientIpAddress(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const firstForwarded = forwardedFor?.split(",")[0]?.trim();
  return (
    firstForwarded ||
    request.headers.get("x-real-ip")?.trim() ||
    "local-development"
  );
}

function authErrorMessage(error: AuthError): string {
  if (error.status === 429) return RATE_LIMITED_LOGIN_ERROR;
  return "Authentication could not be completed. Please try again.";
}

export class SupabaseAuthController {
  constructor(private readonly rateLimiter = new AuthRateLimiter()) {}

  async register(request: NextRequest): Promise<NextResponse> {
    try {
      this.ensureConfigured();
      const input = await this.parseJson(request, registerInputSchema);
      const response = await this.createAccount(request, input);
      return noStoreJson(response);
    } catch (error) {
      return this.errorResponse(error, "[auth:register] failed");
    }
  }

  async login(request: NextRequest): Promise<NextResponse> {
    try {
      this.ensureConfigured();
      const input = await this.parseJson(request, loginInputSchema);
      const identity = {
        email: input.email,
        ipAddress: clientIpAddress(request)
      };
      await this.rateLimiter.assertAllowed(identity);

      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.signInWithPassword(input);
      if (error || !data.user) {
        await this.rateLimiter.recordFailure(identity);
        throw new AuthApiFailure(GENERIC_LOGIN_ERROR, 401);
      }

      await this.rateLimiter.recordSuccess(identity);
      const appUser = await appUserSynchronizer.synchronize(data.user);
      return noStoreJson({
        user: toPublicSessionUser(appUser),
        message: "Signed in."
      });
    } catch (error) {
      return this.errorResponse(error, "[auth:login] failed");
    }
  }

  async logout(): Promise<NextResponse> {
    try {
      this.ensureConfigured();
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) {
        throw new AuthApiFailure(authErrorMessage(error), error.status || 500);
      }

      return noStoreJson({ user: null, message: "Signed out." });
    } catch (error) {
      return this.errorResponse(error, "[auth:logout] failed");
    }
  }

  async refresh(): Promise<NextResponse> {
    try {
      this.ensureConfigured();
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.auth.getClaims();
      if (error || !data?.claims?.sub) {
        throw new AuthApiFailure("Your session expired. Please sign in again.", 401);
      }

      const context = await getAuthContext();
      if (!context) {
        throw new AuthApiFailure("Your session expired. Please sign in again.", 401);
      }

      return noStoreJson({
        user: toPublicSessionUser(context.user),
        message: "Session refreshed."
      });
    } catch (error) {
      return this.errorResponse(error, "[auth:refresh] failed");
    }
  }

  async me(): Promise<NextResponse> {
    return currentUserJson();
  }

  private async createAccount(request: NextRequest, input: RegisterInput) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          full_name: input.name,
          name: input.name
        },
        emailRedirectTo: new URL("/dashboard", request.url).toString()
      }
    });

    if (error) {
      throw new AuthApiFailure(
        "We could not create the account. Check the details or try signing in.",
        error.status || 400
      );
    }

    if (data.user && data.session) {
      const appUser = await appUserSynchronizer.synchronize(data.user);
      return {
        user: toPublicSessionUser(appUser),
        requiresEmailConfirmation: false,
        message: "Account created."
      };
    }

    return {
      user: null,
      requiresEmailConfirmation: true,
      message: "Check your email to finish creating your account."
    };
  }

  private ensureConfigured(): void {
    if (!isSupabaseConfigured()) {
      throw new AuthApiFailure(
        "Authentication setup is incomplete. Add the Supabase project URL and publishable key to the deployment settings.",
        503
      );
    }
  }

  private async parseJson<T>(
    request: NextRequest,
    schema: z.ZodType<T>
  ): Promise<T> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new AuthApiFailure("Send a valid JSON request.", 400);
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new AuthApiFailure("Check the highlighted fields.", 400, {
        fieldErrors: zodFieldErrors(parsed.error)
      });
    }
    return parsed.data;
  }

  private errorResponse(error: unknown, logMessage: string): NextResponse {
    if (error instanceof AccountDeletionRequested) {
      return noStoreJson({ message: error.message }, { status: 401 });
    }
    if (error instanceof AuthRateLimitExceeded) {
      return noStoreJson(
        {
          message: RATE_LIMITED_LOGIN_ERROR,
          retryAfterSeconds: error.retryAfterSeconds
        },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds) }
        }
      );
    }

    if (error instanceof AuthApiFailure) {
      return noStoreJson(
        {
          message: error.message,
          ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {})
        },
        { status: error.status, headers: error.headers }
      );
    }

    console.error(logMessage, { errors: errorLogRecords(error) });
    if (isDatabaseConnectionError(error)) {
      return noStoreJson(
        {
          message:
            "OIPay could not connect to its application database. Please try again shortly."
        },
        { status: 503 }
      );
    }

    return noStoreJson(
      { message: "Authentication could not be completed. Please try again." },
      { status: 500 }
    );
  }
}

export type { LoginInput, RegisterInput };
