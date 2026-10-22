# Backend improvements for the friends pilot

Status: recommendations only. Reviewed against repository source on 2026-10-23.
Audience: the developer preparing a small friends launch.

Keep the current Next.js application, Supabase Auth, PostgreSQL, and Prisma.
The highest-value work is closing concurrency gaps and proving the hosted release
can recover from failures. This review does not establish a capacity limit,
hosting budget, or production readiness. No hosted configuration was inspected
for this document, and no backend code or database schema was changed.

## Existing protections to preserve

- [Authorization helpers](../web/lib/server/authz.ts) require a session, active
  group membership, and creator-or-owner permission. Guest identity uses a
  [hashed browser credential](../web/lib/guest-session.ts), not a supplied name.
- [Money helpers](../web/lib/money.ts) and
  [currency helpers](../web/lib/currency.ts) calculate recorded amounts in integer
  minor units. Saved conversions retain the original amount, rate, date, and
  source. Display conversions do not alter the ledger.
- Expense and repayment actions have idempotency keys for creation, version
  checks for edits, and transactional activity records. The shared
  [group write lock](../web/lib/server/group-write-lock.ts) protects currency and
  archive state during financial mutations.
- The [foundation migration](../web/prisma/migrations/20260615010000_production_foundation/migration.sql)
  already checks positive totals/versions, nonnegative shares, valid weights,
  and distinct repayment participants. The
  [conversion migration](../web/prisma/migrations/20261022010000_guest_members_and_currency/migration.sql)
  already requires conversion metadata to be complete and rates positive.
- Committed migrations enable row-level security and revoke public Data API
  access to application tables, including guest credentials. Trusted server
  access remains responsible for enforcing individual membership permissions.
- [Group reads](../web/lib/group-data.ts) already use a repeatable-read transaction
  for a consistent snapshot and paginate expense, repayment, and activity history.
- [Account deletion](../web/lib/server/account-deletion.ts) already has durable
  jobs, worker leases, retryable provider cleanup, and deletion markers that stop
  old sessions recreating a deleted profile.

These are not missing features. Extend their tests and keep their guarantees
when implementing the changes below.

## Recommended order

| Phase | Work | Completion evidence |
| --- | --- | --- |
| 1 — before inviting friends | Reconcile migration history; verify backups, email, monitoring, and recovery | Recorded staging rehearsal and hosted acceptance checks |
| 2 — before inviting friends | Make permission and ownership changes safe under simultaneous requests | Deterministic database tests for competing mutations |
| 3 — before distributing joining links | Make login counters atomic; add bounded guest entry/recovery requests | Parallel request tests and visible retry guidance |
| 4 — after the initial hardening | Add database relationship guarantees and improve invitation recovery | Reviewed migration tests and interrupted-delivery tests |
| 5 — driven by measurements | Bound growing reads and tune slow queries | Measured latency, query plans, and correctness checks |

Phases 1–3 are the recommended launch preparation. Phases 4–5 should follow in
small changes, with ordering adjusted to observed failures. The owner has not
specified a user count or latency target; establish those with the pilot operator
before defining performance acceptance thresholds.

## 1. Prove the actual deployment is recoverable

**Evidence:** [Pilot handoff](pilot-handoff.md) records that the existing hosted
database received migrations through Supabase and had no Prisma migration
history table at that inspection. It explicitly warns against replaying the old
initial migrations. This is historical evidence, not a fresh cloud inspection.
[Production operations](production-operations.md) lists hosted checks that local
test success cannot establish.

**Work:**

1. Inspect the intended existing Vercel project and database before taking any
   migration action. Compare the actual schema and both migration histories with
   committed migrations. Capture the result without credentials.
2. Rehearse migration-history reconciliation on a restored copy. Mark a migration
   as applied only after verifying its effects exist. Do not reset the pilot
   database or execute the old initialization chain against existing tables.
3. Confirm the backup/restore path with a successful restore into an isolated
   database. Record who operates recovery and the procedure used.
4. Verify real confirmation/reset mail, guest recovery, account deletion recovery,
   and an error notification in the hosted environment. Keep these separate from
   local tests that disable email delivery or confirmation.
5. Record the deployed version, database migration state, and remaining limitations
   in the handoff. Apply reviewed schema changes before dependent application code.

**Acceptance:** a restored copy retains balances and membership relationships;
the next migration applies once; a fresh database also accepts the complete
migration chain. Public API keys cannot read private tables, while the server
can run the authorized journey. A disposable hosted account completes signup,
guest joining, an expense, a repayment, and deletion recovery.

**Health checks:** [GET /api/health](../web/app/api/health/route.ts) checks
`SELECT 1` and whether authentication configuration exists. It does not prove
Auth availability, email delivery, migration compatibility, or the deletion
worker's schedule. Keep this endpoint cheap. Add a separately scheduled,
controlled journey and alerts for failed checks and overdue deletion jobs.
Define the alert recipient before relying on monitoring. Do not put credentials,
invitation URLs, guest tokens, or expense notes in diagnostic logs.

## 2. Authorize against the state being committed

**Evidence:** [Expense actions](../web/app/actions/expenses.ts) and
[repayment actions](../web/app/actions/settlements.ts) fetch membership and check
permissions before entering their write transaction. `lockWritableGroup` then
rechecks the group's currency and archive state, but not the actor's current
membership, role, or guest credential. Member validation also occurs before
some financial transactions.

In [group actions](../web/app/actions/groups.ts), `removeMemberAction` checks
the actor, target, and remaining owners before its transaction;
`transferOwnershipAction` similarly checks the target before updating roles.
These observations identify stale-check windows. They do not establish a
reproduced exploit or an observed production failure.

**Work:** introduce a small transaction-aware authorization boundary rather than
duplicating fresh checks across actions. Inside the same transaction as the
mutation, read and protect the current group, actor membership, affected members,
and guest credential where applicable. Re-evaluate active status, owner/creator
permission, and the last-owner invariant. Make removal, ownership transfer,
archive/settings changes, guest recovery/linking, and financial writes participate
in the same concurrency policy. Rechecking without a coordinating lock or
equivalent transaction guarantee still leaves a race.

Document one lock acquisition order before implementing it. For example, any
guest-session locks must be acquired in a consistent order relative to group
and member locks; operations spanning several groups must sort identifiers.
[Guest actions](../web/app/actions/guests.ts) currently acquire a group lock before
a guest-session lock during joining, but start with a guest-session lock during
recovery/account linking. Owner link management also takes a member lock before
updating the group. Preserve single-use recovery and name uniqueness while
normalizing this protocol. A specific deadlock has not been reproduced here.

Keep provider requests outside database transactions. Use bounded retries only
for retryable conflicts, retaining existing idempotency and version checks.

**Acceptance:** add real database tests with explicit synchronization points,
not timing-based sleeps, to cover:

- Member removal racing an expense or repayment write.
- Ownership transfer racing another owner-only action.
- Competing owner removals/transfers, preserving at least one active owner.
- Guest recovery or account linking racing a write from the old browser.
- Archive/currency updates racing financial mutations, extending the existing
  [group-write-lock tests](../web/tests/integration/group-write-lock.test.ts).
- Join, recovery, linking, and link replacement under concurrent requests.

Each outcome must correspond to a valid serial ordering. If revocation commits
first, the later mutation must fail; if the authorized write commits first, it
may remain valid. Rejected writes must leave neither partial financial records
nor success activity entries. Run these tests against the isolated database.

## 3. Make abuse controls reliable under concurrency

**Evidence:** [AuthRateLimiter.recordFailure](../web/lib/server/auth-rate-limiter.ts)
reads a count, calculates a new value, and upserts that absolute value inside a
transaction without an explicit isolation level or row lock. Parallel failures
can potentially overwrite increments. Reproduce this with an integration test
before choosing the repair. The existing limiter already has separate
identity/email/IP buckets and hashes their identifiers.

[Guest actions](../web/app/actions/guests.ts) validate token format, expiry,
membership uniqueness, and recovery claims, but have no explicit join/recovery
request quota. High-entropy tokens protect against guessing; they do not prevent
repeated requests or membership creation through a leaked valid joining link.

**Work:** use an atomic database update/upsert or a properly synchronized counter
transaction, including window reset and first-row creation. Add bounded quotas
to guest entry and recovery, with appropriate session/IP and link/group dimensions.
Use hashed identifiers and avoid logging raw tokens. Choose limits with the
operator: friends joining from one shared Wi-Fi connection must remain usable.
Use the same trusted client-address handling as existing authentication routes.
Return clear retry timing instead of an unexplained generic failure.

**Acceptance:** simultaneous failures cannot lose increments; expiry resets one
window correctly; successful login preserves the intended broader IP protection.
Malformed, expired, and repeatedly submitted guest tokens consume bounded work.
Legitimate people behind one shared network can still join. Retrying recovery
never restores an invalidated credential or consumes the same link twice.

## 4. Strengthen database relationships and delivery recovery

### Keep members in the correct group at the database boundary

**Evidence:** [Prisma schema](../web/prisma/schema.prisma) has foreign keys from
expenses/repayments to groups and members, but those independent keys do not
prove that every referenced member belongs to the record's group. Expense shares
likewise reference an expense and a member independently. Application validation
currently supplies that guarantee.

**Work:** first audit existing rows for cross-group references. Design composite
foreign keys, or another reviewed database constraint strategy, for record
creators, payers, repayment participants, and shares. Shares may need an explicit
group key to express the relationship. Account for historical removed members:
their financial references must remain valid. Treat this as a separate migration,
not a broad schema rewrite. Keep split-total validation in the shared financial
service; a simple row-level `CHECK` cannot enforce a sum over multiple share rows.

**Acceptance:** direct trusted-server inserts with cross-group member IDs fail;
valid historical records survive migration; zero-/two-/three-decimal currencies,
exact share sums, and saved conversions remain unchanged. Existing positive
amount, conversion completeness, uniqueness, and privacy constraints remain active.

### Recover interrupted invitation delivery

**Evidence:** [Group actions](../web/app/actions/groups.ts) save invitations and
then call [Resend synchronously](../web/lib/email.ts). They already record sending
status, use provider idempotency keys, and support owner-triggered resend. There
is no durable invitation delivery job. An interrupted request between saving and
delivery/status update can require manual intervention. `SENT` means provider
acceptance, not confirmed delivery to an inbox.

**Work:** retain the current manual resend path for the first pilot and make
stale pending/failed states observable. If automatic recovery is needed, add a
small transactional outbox with bounded retry, leases, and provider deduplication,
borrowing the existing account-deletion worker pattern. Resolve token handling
explicitly: raw invitation tokens are currently not stored, so an outbox cannot
reconstruct a link from its hash. Choose a reviewed encrypted payload with short
retention, or a generation protocol that preserves safe retry semantics. Never
persist raw invitation links in ordinary logs.

**Acceptance:** process interruption after commit, provider timeout, repeated
worker execution, resend, and invitation acceptance do not create duplicate
memberships or let an older attempt overwrite a newer invitation's status.
Document pending/failure recovery for the pilot operator.

## 5. Measure before expanding infrastructure

**Evidence:** [Dashboard reads](../web/lib/group-data.ts) load all active
memberships; [account export](../web/app/api/account/export/route.ts) materializes
all included financial history in one response. Group history is already
paginated. No performance measurement in this review establishes a current
bottleneck.

Instrument request duration, query duration/count, failed mutations, lock waits,
export size, deletion backlog age, and invitation failures without recording
private payloads. Exercise representative group and history sizes agreed with
the owner. Inspect slow query plans on an isolated dataset before adding indexes.
If growth warrants it, paginate dashboard groups and implement bounded export
retrieval with an explicit consistency policy; do not silently truncate exports.

Maintain the current financial service as the source of truth. Introduce cached
balance summaries only if measurement justifies their invalidation and
reconciliation complexity. The friends pilot does not currently justify
microservices, a separate Django backend, a new queue vendor, or a second ledger.

## Verification and follow-up

Use Node.js 24 and the commands in [web/package.json](../web/package.json):
`npm run check` from `web/`, then `npm run test:isolated` for financial,
authorization, or schema changes. Follow [web/README.md](../web/README.md) for
the disposable Supabase setup. Never direct destructive integration tests or
demo seeds at the hosted pilot database.

Submit each phase as a small reviewable change with its migration/release notes
and acceptance evidence. Reuse [production operations](production-operations.md)
for the hosted checks instead of treating a local green test suite as a launch
sign-off. The next developer should confirm the current production state, choose
pilot request limits and performance targets with the operator, and reproduce
the identified concurrency cases before implementation.
