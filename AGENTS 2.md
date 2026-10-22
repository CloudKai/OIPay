# Repository Guidelines

## Note About the User
- The project owner is a non-coder. Use plain language, keep jargon minimal, and define any technical term you must use.
- Provide slightly more detail than usual and include concrete examples so implementation choices and tradeoffs are easy to understand.

## Project Structure & Module Organization
This repo is a monorepo with one primary app and two legacy apps:
- `web/`: active MVP (Next.js 14, TypeScript, Prisma, NextAuth).
- `backend/`: legacy Django REST API.
- `mobile/`: legacy Expo React Native client.

Key paths:
- `web/app/` for App Router pages and API routes.
- `web/lib/` for shared business logic (for example `web/lib/money.ts`).
- `web/prisma/` for schema, migrations, and seed script.
- `backend/core/` for models/serializers/views.
- `backend/core/services/` for balance math.
- `backend/core/tests/` for pytest API tests.

## Build, Test, and Development Commands
- `cd web && npm run dev`: run web app at `http://localhost:3000`.
- `cd web && npm run build && npm run start`: production build + local run.
- `cd web && npm run lint`: run Next.js ESLint (`next/core-web-vitals`).
- `cd web && npm run prisma:generate && npm run prisma:migrate && npm run prisma:seed`: Prisma client, DB migrations, demo seed.
- `cd backend && pytest`: run Django API tests (`backend/pytest.ini`).
- `./dev.sh` (repo root): start Postgres (`docker compose`), Django server, and web dev server.
- Optional legacy: `cd mobile && npm run start`.

## Coding Style & Naming Conventions
- TypeScript/React (`web/`): 2-space indentation, `camelCase` functions/vars, `PascalCase` components, lowercase route folders (for example `web/app/groups/[id]`).
- Python/Django (`backend/`): PEP 8, 4-space indentation, `snake_case` functions/modules, `PascalCase` classes.
- Money values should be integer cents (`amount_cents`, `net_cents`) and computed in shared helpers/services.

## Testing Guidelines
- Backend uses `pytest` + `pytest-django`; keep tests in `backend/core/tests/` and prefer `test_*.py` names.
- Existing backend suite focuses on end-to-end room/expense/balance flows (`backend/core/tests/test_mvp.py`).
- Web currently has lint checks but no committed test runner; if adding tests, colocate `*.test.ts`/`*.test.tsx` near features and add the script in `web/package.json`.

## Commit & Pull Request Guidelines
- Use concise, imperative commit subjects (for example `Add exact split validation`).
- PRs should include scope, rationale, verification commands run, migration notes, and UI screenshots/GIFs for `web/` or `mobile/` changes.

## Security & Configuration Tips
- Never commit secrets.
- Create env files from examples: `.env.example`, `web/.env.example`, `backend/.env.example`.
- Local Postgres runs via `docker compose up -d` on host port `5433`.
