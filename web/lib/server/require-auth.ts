import "server-only";

import { NextResponse } from "next/server";

import { getSessionUser, toPublicSessionUser } from "@/lib/session";

export class UnauthorizedApiError extends Error {
  constructor() {
    super("Unauthorized");
  }
}

export type AuthenticatedApiUser = NonNullable<
  Awaited<ReturnType<typeof getSessionUser>>
>;

export async function requireAuth(): Promise<AuthenticatedApiUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedApiError();
  return user;
}

export function authErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof UnauthorizedApiError)) return null;

  return NextResponse.json(
    { message: "Unauthorized", user: null },
    {
      status: 401,
      headers: { "Cache-Control": "no-store" }
    }
  );
}

export async function currentUserJson(): Promise<NextResponse> {
  const user = await getSessionUser();
  return NextResponse.json(
    { user: user ? toPublicSessionUser(user) : null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
