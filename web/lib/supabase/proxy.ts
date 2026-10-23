import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  getSupabasePublicConfig,
  isSupabaseConfigured
} from "@/lib/supabase/config";

const protectedPrefixes = ["/dashboard", "/groups", "/activity", "/account"];

function isProtectedPath(pathname: string): boolean {
  return protectedPrefixes.some((prefix) => pathname.startsWith(prefix));
}

function loginRedirect(request: NextRequest): NextResponse {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "callbackURL",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );
  return NextResponse.redirect(loginUrl);
}

export async function updateSupabaseSession(request: NextRequest) {
  // Keep the existing credential name across the OIPay rename. A cookie only bypasses
  // the redirect; server pages validate its hash in the database.
  const hasGuestCredential = /^[A-Za-z0-9_-]{43}$/.test(request.cookies.get("splittogether-guest")?.value ?? "");
  if (!isSupabaseConfigured()) {
    return isProtectedPath(request.nextUrl.pathname) && !hasGuestCredential
      ? loginRedirect(request)
      : NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabasePublicConfig();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headersToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headersToSet).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      }
    }
  });

  const { data, error } = await supabase.auth.getClaims();

  if (
    isProtectedPath(request.nextUrl.pathname) && !hasGuestCredential &&
    (error || !data?.claims?.sub)
  ) {
    return loginRedirect(request);
  }

  return response;
}
