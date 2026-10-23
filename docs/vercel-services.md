# Vercel multi-service deployment

The repository-root [vercel.json](../vercel.json) defines one deployment with two
independently built services. Vercel Services is currently in Beta. Deploy the
whole repository to the owner's existing project; do not create another project.

## Services and public routing

| Service | Root | Framework | Public access |
| --- | --- | --- | --- |
| `web` | `web` | Next.js | All paths through the final `/(.*)` rewrite |
| `backend` | `backend` | Django | Internal only; no public rewrite |

The active web application owns its API routes, including `/api/auth/*`,
`/api/health`, `/api/exchange-rate`, `/api/account/export`, and
`/api/cron/account-deletions`. Do not route all `/api/*` requests to Django.
The daily account-deletion recovery cron remains at 03:00 UTC in root
`vercel.json`; its request reaches `web` through the public rewrite.

Django is an archived prototype deployed internally at the owner's request.
Its existing `/api/rooms/` and `/admin/` paths remain unchanged and receive no
public traffic. Its room data model is separate from the active app's group
model. Deployment does not connect or synchronize the two applications.

## Bindings and application calls

There are currently **no service-to-service calls and no bindings**. The web app
uses its own server actions/API handlers, PostgreSQL, and external providers.
The archived mobile client calls Django directly but is not a deployed service
in this configuration. Docker Compose only starts a local database; its host
settings are not service-discovery URLs to replace.

No application URL changes are needed for the confirmed routing. Do not invent
a service call, expose a proxy, or add an unused binding merely to connect the
deployments.

If a future server-side web feature needs Django, declare this binding on `web`:

```json
"bindings": [
  {
    "type": "service",
    "service": "backend",
    "format": "url",
    "env": "BACKEND_INTERNAL_URL"
  }
]
```

Then use the injected URL inside the feature's runtime server function:

```ts
const baseUrl = process.env.BACKEND_INTERNAL_URL;
if (!baseUrl) throw new Error("Django service binding is unavailable.");
const response = await fetch(new URL("/api/rooms/", baseUrl), {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(validatedRoomInput),
  cache: "no-store"
});
```

This is future guidance, not a binding or feature currently installed. Never
manually set `BACKEND_INTERNAL_URL`, expose it through `NEXT_PUBLIC_*`, or use
it during a build or in middleware. A binding grants network access; the caller
must still supply whatever credentials the target endpoint requires.

## Existing project settings and environment

- Set the existing Vercel project's Root Directory to the repository root
  (empty), and use Services with frameworks specified per service.
- Clear old project-wide install/build/output overrides. `web` declares
  `npm ci` and `npm run build` under its service. Django uses native detection
  from `manage.py`, `requirements.txt`, and its configured application modules.
  Its explicit development command starts Django on Vercel's assigned `$PORT`;
  the installed CLI does not supply a Django development command automatically.
- Use Node.js 24 for `web`. `backend/.python-version` pins Python 3.12, which
  the existing Django 4.2 dependency supports.
- Keep the web variables listed in [pilot handoff](pilot-handoff.md). Do not
  upload local `.env` files or copy the isolated test environment into Vercel.
- Configure Django's separate `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=0`, and
  `DJANGO_ALLOWED_HOSTS`. Set allowed hosts to the actual internal hostname(s)
  used by Vercel if internal callers are added; do not use `*` as a shortcut.
- Configure Django's `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`,
  `POSTGRES_HOST`, and `POSTGRES_PORT` for its intended PostgreSQL database.
  Use `DB_ENGINE=postgres`. `DATABASE_URL` is consumed by the web app, not by
  the existing Django settings. SQLite is only for disposable local testing;
  a function's local filesystem is not a persistent database.
- Apply each application's reviewed migrations separately. Builds do not run
  migrations or seed records. Do not point Django at the active application
  database or run migrations there without an explicit database plan.

The former `web/vercel.json` has been removed to keep one deployment source of
truth. Uploading only `web/` is no longer the documented deployment method.

## Run and verify locally

Install the web and Django dependencies and supply local development settings
before running from the repository root:

```bash
vercel dev -L --listen 127.0.0.1:3200
```

`-L` runs locally without linking a cloud project. Plain `vercel dev` also runs
the services together when the existing project is linked. Use a current CLI
supporting the `services` configuration. Keep local secrets in ignored env files
or the shell; verify both service processes receive their required environment.

Check through the gateway:

1. `/login` and `/demo` render the web app.
2. `/api/auth/me` and `/api/health` reach Next.js handlers.
3. `/api/rooms/` and `/admin/` do not expose Django. They should return the web
   app's normal denial, redirect, or missing-page response, not Django content.
4. Both services start without routing/configuration errors. No binding variable
   is expected because no caller is configured.

Local `vercel dev` verifies development routing, not a production build or
hosted internal-service isolation. After deploying a preview of the existing
project, inspect both service builds, repeat the public route checks, confirm
the cleanup cron, and verify production email/authentication separately.

### Recorded local check

On 2026-10-23, Vercel CLI 65.0.0 accepted this configuration and started both
services with `vercel dev -L` using disposable local settings. Through the gateway,
`/login` and `/demo` returned 200, `/api/auth/me` returned the web handler's
anonymous response, and `/api/health` returned 200 with local database/auth checks.
`/api/rooms/` and `/admin/` normalized to web routes and returned 404.
The cleanup endpoint returned 401 without its secret. A direct request to the
local Django development process also returned its expected missing-route 404.
The temporary gateway was stopped afterward. No cloud project was linked or
deployed; hosted settings and both production service builds remain unverified.

## References

- [Vercel Services](https://vercel.com/docs/services)
- [Routing](https://vercel.com/docs/services/routing)
- [Bindings](https://vercel.com/docs/services/bindings)
- [Django on Vercel](https://vercel.com/docs/frameworks/full-stack/django)
