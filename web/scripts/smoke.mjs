const baseUrl = process.argv[2] ?? process.env.SMOKE_BASE_URL;

if (!baseUrl) {
  throw new Error("Pass a deployment URL or set SMOKE_BASE_URL.");
}

for (const path of ["/api/health", "/login", "/offline"]) {
  const response = await fetch(new URL(path, baseUrl), {
    redirect: "manual",
    headers: { "user-agent": "OIPay deployment smoke test" }
  });
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}.`);
  }
  console.log(`OK ${path} ${response.status}`);
}
