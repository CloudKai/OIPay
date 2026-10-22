# SplitTogether Full-Stack Guide

## Plain-language architecture

SplitTogether has one active application in `web/`.

- **Pages and components** show the interface.
- **Server actions** validate changes and enforce permissions.
- **Domain services** perform split, balance, and settlement math.
- **Prisma** reads and writes PostgreSQL.
- **Better Auth** manages users, verified email, Google accounts, and sessions.

A browser form is never trusted by itself. Every money change is checked again
on the server for login, group access, permissions, amount, split totals,
duplicate submission, and record version.

## Important folders

- `web/app/`: pages, server actions, auth and health routes
- `web/components/`: reusable interface and feature components
- `web/lib/`: validation, money math, permissions, email, and data services
- `web/prisma/`: database schema, migrations, and development seed
- `web/tests/`: PostgreSQL and browser flows

## Money model

Money is stored as integer **minor units**, not floating-point numbers.

- USD 12.34 is stored as `1234`
- JPY 123 is stored as `123`
- KWD 1.234 is stored as `1234`

The largest-remainder algorithm allocates unavoidable rounding units in a
stable member-ID order. This guarantees every expense share adds exactly to the
expense total.

## Safe feature workflow

1. Describe the user behavior.
2. Update the Prisma schema and create a migration if storage changes.
3. Add or update shared Zod validation.
4. Put financial rules in a server-side service.
5. Expose a typed server action with authorization checks.
6. Build the accessible interface.
7. Add unit, database, and browser tests based on risk.
8. Run `npm run check` and Playwright.

## Terms

- **Migration:** a versioned database change.
- **Idempotency key:** a unique request ID that stops a double-click from
  creating the same financial record twice.
- **Optimistic version:** a record number that detects when two windows edit the
  same item at the same time.
- **Soft deletion:** hiding a financial record from balances while retaining an
  audit event explaining the deletion.
