import { NextResponse } from "next/server";

import { errorLogRecords } from "@/lib/error-reporting";
import { prisma } from "@/lib/prisma";
import { databaseConnectionDiagnostics } from "@/lib/server/database-diagnostics";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET() {
  const authConfigured = isSupabaseConfigured();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        status: authConfigured ? "ok" : "degraded",
        services: {
          database: "ok",
          authentication: authConfigured ? "configured" : "missing_configuration"
        },
        checkedAt: new Date().toISOString()
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[health] database check failed", {
      errors: errorLogRecords(error),
      connection: databaseConnectionDiagnostics(process.env.DATABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL)
    });
    return NextResponse.json(
      {
        status: "unavailable",
        services: {
          database: "unavailable",
          authentication: authConfigured ? "configured" : "missing_configuration"
        },
        checkedAt: new Date().toISOString()
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
