# OIPay Fullstack Guide (Beginner-Friendly)

This guide explains your app stack in plain language, why each tool exists, how frontend and backend connect, and how you can build features yourself in the future.

## 1) What OIPay Is

OIPay is a web app where people can:

- create an account
- log in securely
- create rooms/groups
- add shared expenses
- settle balances

Technically, it works like this:

1. The **frontend** (what you see in the browser) collects user input.
2. The frontend sends requests to **backend API routes**.
3. The backend validates data, checks login permissions, and writes/reads data from PostgreSQL.
4. The frontend updates with results.

## 2) The Stack You Use and Why

## Next.js 14 (App Router)

What it is:
- A framework that supports frontend pages and backend API routes in one project.

Why it was chosen:
- Faster development for MVP.
- Less complexity than maintaining separate frontend/backend repos.

Where in your app:
- Pages: `web/app/*`
- API routes: `web/app/api/*`

## TypeScript

What it is:
- JavaScript with type checks.

Why it was chosen:
- Catches mistakes early.
- Makes refactoring safer as the app grows.

## React + Tailwind CSS

What they are:
- React builds UI with components.
- Tailwind styles UI quickly with utility classes.

Why chosen:
- Fast UI iteration.
- Reusable component patterns.

Where in your app:
- Components: `web/components/*`
- Global styles: `web/app/globals.css`

## PostgreSQL

What it is:
- A relational database.

Why chosen:
- Stable and production-proven.
- Great for linked records (users, rooms, expenses, shares).

## Prisma ORM

What it is:
- Tool that maps database schema to TypeScript queries.

Why chosen:
- Cleaner DB code.
- Strong type-safety.
- Easier schema maintenance.

Where in your app:
- Schema: `web/prisma/schema.prisma`
- Seed data: `web/prisma/seed.ts`

## NextAuth (Credentials)

What it is:
- Authentication/session framework for Next.js.

Why chosen:
- Handles session plumbing and login flow.

Where in your app:
- Auth options: `web/lib/auth.ts`
- Route guard middleware: `web/middleware.ts`

## Zod validation

What it is:
- Schema-based validation for incoming API input.

Why chosen:
- Prevents invalid payloads from reaching business logic/database.

Where in your app:
- `web/lib/validation.ts`

## Docker Compose

What it is:
- Local container orchestration.

Why chosen:
- Easy local Postgres setup.
- Consistent setup across machines.

## 3) How Frontend and Backend Connect (Simple)

The pattern for almost every feature is:

1. UI form collects input.
2. UI calls `fetch('/api/...')`.
3. API route validates input with Zod.
4. API route checks auth/session + membership.
5. API route uses Prisma to read/write DB.
6. API returns JSON.
7. UI shows success or error.

### Example: Create Room

- UI form: `web/components/dashboard/create-group-form.tsx`
- API route: `web/app/api/groups/route.ts`
- DB tables written: `Group`, `GroupMember`, `ActivityLog`

Flow:
- User enters room name -> UI submits -> API validates + creates room and owner membership -> response returns room id -> UI redirects to `/groups/[id]`.

## 4) Important App Rules Already in Place

- Protected routes redirect unauthenticated users to login.
- API routes also verify session server-side.
- Input validation exists for auth and group actions.
- Money values are stored as integer cents (avoids float rounding bugs).
- Group membership checks protect room-specific actions.

## 5) Beginner-Friendly Mental Model

Think in 3 layers:

- **UI layer**: “What user sees and clicks”
- **API layer**: “Rules and permissions”
- **Data layer**: “Database records”

If something breaks, identify which layer is responsible.

## 6) How to Run Your App (One Command)

From repo root:

```bash
zsh start-web.zsh
```

What it does:
- starts local Postgres
- ensures `web/.env` exists
- installs dependencies
- runs Prisma generate + DB sync
- starts Next.js dev server

Useful options:

```bash
zsh start-web.zsh --reset-db
zsh start-web.zsh --seed
zsh start-web.zsh --port 3001
```

## 7) How to Build a New Feature Yourself (Repeatable Checklist)

1. Write behavior in plain English first.
2. Decide if DB schema must change.
3. Add/update validation schema (`web/lib/validation.ts`).
4. Add/update API route (`web/app/api/...`).
5. Enforce auth and membership checks.
6. Build/update UI component.
7. Connect UI to API with `fetch`.
8. Show clear user-friendly errors and success states.
9. Run checks:

```bash
cd web
npm run lint
npm run build
```

10. Manual smoke test:
- signup
- login
- create room
- open room
- invalid input errors
- protected-route redirect when logged out

## 8) Alternatives You Could Have Used

## Separate frontend and backend services

Pros:
- independent scaling and ownership

Cons:
- more complexity for a single-owner MVP

## Firebase/Supabase-first approach

Pros:
- rapid setup

Cons:
- can become restrictive for complex financial/business rules

## Django backend + Next frontend (legacy direction)

Pros:
- strong backend framework features

Cons:
- two active stacks to maintain

## Rails/Laravel fullstack

Pros:
- productive fullstack frameworks

Cons:
- major ecosystem shift from current codebase

## 9) Security Basics You Should Always Keep

- Set `NEXTAUTH_SECRET` in production.
- Never commit real secrets.
- Validate all input server-side.
- Never rely only on frontend checks.
- Keep dependencies patched on a schedule.

## 10) Learning Plan (No Prior Fullstack Experience)

## Week 1: Core concepts

Learn:
- HTTP request/response
- status codes
- JSON
- DB table relationships

Practice:
- Read one API route and explain it in plain language.

## Week 2: Frontend basics

Learn:
- React component, state, form handling

Practice:
- Modify form labels/messages and observe behavior.

## Week 3: Backend basics

Learn:
- API route structure
- Prisma query basics
- auth checks

Practice:
- Add a tiny endpoint (e.g., rename room).

## Week 4: End-to-end feature delivery

Build one small feature from schema to UI.

Suggested first feature:
- room description field

Deliver with validation, API checks, UI feedback, lint/build pass, smoke test.

## 11) Quick Glossary

- Frontend: browser UI.
- Backend: server logic.
- API: bridge between frontend and backend.
- ORM: code layer for DB access.
- Session: logged-in state.
- Middleware: pre-route guard logic.
- Migration/schema change: DB structure update.
- Seed data: demo records inserted into DB.

---

If you follow the checklist and learning plan above, you can confidently repeat this setup and build future features yourself.
