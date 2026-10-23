/** Classifications only: never return URL parts that could contain a credential. */
export function databaseConnectionDiagnostics(connectionString?: string, supabaseUrl?: string) {
  if (!connectionString) return { urlFormat: "missing" };
  try {
    const url = new URL(connectionString);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) return { urlFormat: "invalid" };
    let projectRef: string | undefined;
    try {
      const host = new URL(supabaseUrl ?? "").hostname;
      projectRef = /^([a-z0-9]+)\.supabase\.co$/.exec(host)?.[1];
    } catch { /* A custom or absent API URL cannot establish the project identity. */ }
    const username = decodeURIComponent(url.username);
    const password = decodeURIComponent(url.password);
    const sharedPooler = url.hostname.endsWith(".pooler.supabase.com");
    const directHost = projectRef ? `db.${projectRef}.supabase.co` : undefined;
    return {
      urlFormat: "valid",
      endpoint: sharedPooler ? "supabase-pooler" : url.hostname === directHost ? "supabase-direct" : "other",
      connectionMode: url.port === "6543" ? "transaction" : !url.port || url.port === "5432" ? "session-or-direct" : "other",
      username: username === "postgres" ? "postgres" : projectRef && username === `postgres.${projectRef}` ? "project-postgres" : "other",
      projectMatches: !projectRef ? "unknown" : sharedPooler ? username === `postgres.${projectRef}` : url.hostname === directHost,
      passwordPresent: password.length > 0,
      passwordPlaceholder: /\[your[-_]password\]/i.test(password),
      passwordWhitespace: password !== password.trim(),
      fragmentPresent: Boolean(url.hash)
    };
  } catch {
    return { urlFormat: "invalid" };
  }
}
