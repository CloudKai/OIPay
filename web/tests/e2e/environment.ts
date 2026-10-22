export function assertLocalE2eServices(env: Record<string, string | undefined>) {
  if (env.E2E_LOCAL_SERVICES !== "true") {
    throw new Error("Automatic test-user setup requires E2E_LOCAL_SERVICES=true.");
  }
  for (const [key, port] of [["DATABASE_URL", "54322"], ["NEXT_PUBLIC_SUPABASE_URL", "54321"]]) {
    const url = new URL(env[key!] ?? "invalid");
    if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== port) {
      throw new Error("Automatic browser-test setup requires the isolated local Supabase test services.");
    }
  }
}
