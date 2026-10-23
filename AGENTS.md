# Repository Guidelines

## Communicating with the owner

The owner is a non-coder. Use plain language, explain necessary technical terms,
and give concrete examples when discussing implementation choices or tradeoffs.

## Active application

- Work in `web/`: Next.js 16, React 19, TypeScript, Supabase Auth, PostgreSQL,
  and Prisma 7. `backend/` (Django) and `mobile/` (Expo) are archived prototypes.
- Pages and API routes live in `web/app/`; shared financial rules and server
  authorization live in `web/lib/`; storage changes belong in `web/prisma/`.
- Read `docs/product-scope.md` when changing release scope and
  `docs/OIPay_Fullstack_Guide.md` when changing money rules, guest access,
  or account permissions.

## Financial and access rules

- Store money as integer minor units, respecting each currency's decimal places.
  Use shared helpers for splits and exact conversion; the group's recorded debts
  stay in its accounting currency.
- Preserve saved conversion metadata on edits unless the person explicitly
  changes it. Display currency conversion never changes financial records.
- Validate session, membership, and creator-or-owner permission on the server.
  Guest membership is authenticated by a browser credential, never by a name.
- Apply reviewed migrations before deploying code that requires their fields.
  Read `docs/production-operations.md` for release order, RLS, and live pilot checks.

## Development and verification

- Use Node.js 24 and npm 10+. `web/package.json` is the source of truth for scripts.
- From the repo root, `./start-web.zsh` installs dependencies, generates Prisma,
  applies committed migrations, and starts the web app. `./dev.sh` is its wrapper.
- From `web/`, run `npm run check` for lint, types, unit tests, and a build.
  Run database and browser tests for financial or permission changes; read
  `web/README.md` for the isolated Supabase test setup and `npm run test:isolated`.
- Colocate Vitest `*.test.ts` files near their code; shared integration and
  Playwright journeys live in `web/tests/`.
- Use dedicated development/test databases. Seeds contain demo business data;
  Supabase Auth owns authentication users.

## Style and contributions

Use 2-space indentation, `camelCase` functions and variables, `PascalCase`
components, and lowercase route folders in the active TypeScript app. Use concise
imperative commit subjects. PRs should explain user-visible behavior, rationale,
verification, migrations, and include screenshots for interface changes.

## Configuration

Keep credentials in ignored environment files based on `web/.env.example`.
Current authentication requires Supabase settings; legacy NextAuth settings and
the legacy Docker database alone are insufficient. Follow `docs/supabase-setup.md`
for setup. Record external configuration or live verification that remains
unavailable instead of claiming a production deployment from local tests.
