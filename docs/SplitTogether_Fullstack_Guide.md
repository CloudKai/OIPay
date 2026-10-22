# SplitTogether Architecture Guide

## Active application

`web/` is the active Next.js 16 and React 19 application. The Django API in
`backend/` and Expo client in `mobile/` are archived prototypes.

- Pages and React components show the interface.
- Server actions validate mutations and enforce group permissions.
- Shared services calculate splits, balances, repayments, and conversion.
- Prisma 7 reads and writes PostgreSQL from trusted server code.
- Supabase Auth handles account signup, confirmation, login, password recovery,
  and optional Google identities.
- Resend delivers individual group email invitations.

Financial tables have Row Level Security (RLS), which restricts database access,
and no access granted to Supabase's public `anon` or `authenticated` Data API
roles. The Next.js server performs its own membership checks before accessing
them through Prisma. Browser clients use Supabase for authentication rather than
direct financial queries.

## Accounts and guests

An account is required to create and own groups. Owners can enable one shared
joining link, replace it, or disable it. People opening an active link enter a
distinct name to become members; signup is optional. Individual email invitations
remain available for account-based joining.

Guest access uses a random browser credential in a secure HTTP-only cookie
(HTTPS deployments). The database stores its hash. A guest's name is a label,
not a password. Group membership and record permissions are checked on every
financial action, including guest actions.

An owner can issue a private recovery link for an active guest membership.
The link expires in 24 hours, works once, and replaces that membership's previous
browser access. It preserves the member ID, records, and balance. Recovery of
one membership does not grant access to the guest's other groups.

Guests can create or sign into an account in the same browser and explicitly
link their guest records after verifying their email. Linking preserves member
IDs and rejects conflicting memberships or pending invitations. Account-only
features, including group creation and ownership management, remain restricted
to account sessions.

## Financial records

Money is stored in integer **minor units**, the smallest supported unit of its
currency: USD 12.34 is `1234`, JPY 123 is `123`, and KWD 1.234 is `1234`.
The split calculation distributes unavoidable rounding units in stable member
order so shares always sum exactly to the expense total.

Each group has one accounting currency. It becomes fixed after the first expense
or repayment, including records later deleted from active balances. Optional
foreign expenses and repayments retain the original currency and amount, a
decimal exchange rate, its publication date, and its source alongside the group
amount. The server recalculates the group amount using exact integer arithmetic
and rounds once to the target currency's minor unit.

The rate lookup requests the entry day in UTC from
[Frankfurter's daily reference-rate API](https://frankfurter.dev/), rather than
using the expense's historical date. The interface shows the actual publication
date; weekends or publication delays can mean an earlier date. Reference rates
can differ from a bank's execution rate. People can confirm a manual override
or enter a manual rate when automatic lookup fails. Rate lookups are limited to
supported currency pairs and require group access.

Saved conversion rates remain unchanged unless explicitly edited. Editing a
description preserves its saved conversion; changing a group amount must agree
with that conversion. Personal display conversion shows an approximate equivalent
using a current reference rate and never changes the recorded debt.

## Validation and history

Each financial change checks session, membership, group archive status, creator
or owner permissions, amounts, member IDs, split totals, and record version.
Repayments reduce balances immediately and are checked against outstanding debts.
Records use a unique request ID to prevent duplicate creation during retries.
Version checks reject conflicting edits from different windows.

Deletion hides the financial record from active calculations while preserving
its history. Activity events record changes; financial edits include the previous
and new amounts and conversion details. Guests can edit their own records;
owners can correct records across the group.

## Where to work

- `web/app/`: pages, server actions, and API routes.
- `web/components/`: interface components and feature forms.
- `web/lib/`: money rules, validation, authorization, sessions, email, and data access.
- `web/prisma/`: database schema, migrations, and development seed.
- `web/tests/`: database integration and browser journeys; unit tests also live
  beside the code they exercise.

For implementation, define the user behavior, change storage through a reviewed
migration when needed, validate on the server, and add checks appropriate to the
risk. Follow [web development](../web/README.md) for verification and
[production operations](production-operations.md) before release.
