# Production Operations

This is the release runbook for the private pilot, not evidence that production
is deployed. Use Node.js 24, npm 10+, and the active Next.js 16/Supabase Auth/
Prisma 7 app in `web/`. Keep [Supabase setup](supabase-setup.md) beside this guide
when configuring a new environment.

## Environments

Maintain separate Preview, Staging, and Production Vercel environments, each
with a separate Supabase project.

- Runtime functions use Supabase's transaction pooler in `DATABASE_URL`.
- Migration jobs use the session pooler or direct URL in
  `DIRECT_DATABASE_URL`.
- Enable automated backups and periodically verify a restore.

## Release sequence

1. Run `npm ci`, `npm run prisma:generate`, and `npm run check` from `web/`.
2. Run `npm run test:isolated` against disposable local Supabase services, as
   described in [web development](../web/README.md). Browser and database tests
   create data and must not target the production database.
3. Verify a current backup and restore procedure for the target environment.
4. Apply the complete committed migration chain to staging with
   `npm run prisma:deploy`, using its migration connection and trusted server role.
5. Deploy the app to staging with `web/` as the project root. Exercise real
   signup/confirmation/reset emails and the owner/guest journey there, then run
   `npm run smoke -- https://staging.example.com` with the actual staging URL.
6. Apply the reviewed migrations to production before promoting the new app
   version. Deploy the tested version with production environment settings.
7. Check the production health response, signup email, guest access, and one
   controlled expense/repayment journey. Record the deployment URL and evidence.

Seeds never run outside development or CI test databases.

### Guest and currency migrations

Deploy both `20261022010000_guest_members_and_currency` and
`20261022020000_guest_names_and_privacy` as one release before serving code that
uses the new fields. The first adds guest credentials, joining/recovery metadata,
and optional saved conversions without changing existing financial amounts.
The second enables RLS on `GuestSession`, revokes public Data API access, enforces
one browser guest membership per group, and fills distinguishable name keys.
Existing duplicate member labels may gain a member-ID suffix; their IDs, expenses,
and balances are preserved.

Verify RLS is enabled and the Supabase `anon` and `authenticated` roles cannot
read or write `GuestSession` or financial tables through the Data API. Successful
Prisma access from the trusted server is expected; anonymous browser access is
not. Apply the full migration chain so the guest credential table is never
released without its privacy migration. Check migration status with
`npx prisma migrate status` against the intended environment.

The initial Supabase authentication migration replaces earlier custom auth
tables. For existing installations, review and test the complete migration chain
and the account migration procedure in staging before any production upgrade.

## Email and authentication

Configure custom SMTP in Supabase Auth; the built-in SMTP service is not for
production. Keep email confirmation enabled, configure redirect URLs separately
for every environment, and review Supabase Auth rate limits and CAPTCHA before
launch. Resend remains configured in the app for group invitations.

Shared guest joining links do not send email. Owners create them in group
settings and save the URL when it appears; raw tokens are not stored in the
database. Replacing or disabling a link immediately stops new joins through it.
Existing members keep access. Guest recovery links are private, expire in 24
hours, and work once. A recovered membership retains its records and replaces
its previous browser access. For cross-device access, a guest can verify an
account and explicitly link memberships from the original browser.

## Pilot setup and acceptance checklist

These items need evidence from the actual pilot environment. Existing local
environment files, isolated test credentials, and build success do not establish
that production services are configured.

- [ ] Confirm access to the hosting project, production domain, and dedicated
  production Supabase project. Use a separate staging project.
- [ ] Set production `DATABASE_URL` and `DIRECT_DATABASE_URL`; verify the full
  migration chain and RLS/Data API restrictions before app promotion.
- [ ] Set the Supabase URL, publishable key, server-only secret key, and correct
  `NEXT_PUBLIC_SITE_URL`. Keep service credentials and database URLs server-only.
- [ ] Configure SMTP, a verified sender/domain, confirmation/reset templates,
  redirect URLs, and email confirmation in production Supabase Auth. Deliver
  actual signup and password-reset emails to an invited tester.
- [ ] Configure the app's Resend API key and verified `EMAIL_FROM` sender;
  demonstrate an individual email invitation, resend, and failed-delivery status.
  `EMAIL_DELIVERY_MODE=disabled` is only for local tests, not a delivery check.
- [ ] Configure strong `AUTH_RATE_LIMIT_SECRET` and `CRON_SECRET` values, verify
  account-deletion recovery, and confirm the scheduled job runs on the host.
- [ ] Enable database backups and record a successful restore into a separate
  database. Record who can restore data and how to reach them.
- [ ] Configure monitoring and verify a test error and failed health check reach
  the person operating the pilot. Confirm logging avoids credentials and notes.
- [ ] Test signup → create group → join by name → expense → repayment → return
  later on both phone and computer. Also test duplicate names, foreign amounts,
  manual rate fallback, stale edits, and connection failure without lost form input.
- [ ] Test that guests cannot edit another member's record, a stranger cannot
  open the group, replaced links fail, guest recovery is single-use, old guest
  access fails after recovery, and linking an account preserves records.
- [ ] Confirm the original amount, saved rate/date/source, and group equivalent
  remain stable after later rate lookups. Verify account export and account
  deletion on disposable pilot accounts.

Track incomplete items as release blockers or explicit pilot limitations with
an owner. Do not treat the local Supabase test setup, which disables confirmation
and external email delivery, as proof of production authentication delivery.

## Exchange-rate operation

Automatic suggestions use [Frankfurter's official v2 API](https://frankfurter.dev/)
and need no API key. Queries request the entry day in UTC and return the actual
publication date. Daily reference rates may be from the prior business day and
can differ from the rate charged by a bank. Lookup uses a five-second timeout,
a fifteen-minute server cache, and rejects rates more than seven days old.
Unsupported or failed lookups permit manual rate entry.

The group amount is verified through exact integer conversion, with original
amount, confirmed rate, publication date, and source stored on the record.
Later lookups do not refresh saved records. Display currency changes only an
approximate view of balances. Monitor repeated lookup failures as a convenience
failure; manual conversion keeps recording available.

## Monitoring

- `/api/health` reports database connectivity and missing Auth configuration.
- Sentry excludes default personal information.
- Vercel Analytics and Speed Insights track aggregate performance.
- Logs must not include passwords, invitation/reset tokens, or expense notes.

## Incident basics

For a failed release, stop promotion, inspect Vercel runtime/Sentry errors, and
roll back the deployment. Do not roll back a database migration unless a tested
down-migration exists; prefer a forward repair migration.

## Account-deletion recovery and invitation status

Before releasing these changes:

1. Apply migration `20260916010000_recoverable_account_operations` with
   `npm run prisma:deploy` from `web/`. It adds a nullable invitation sending
   status and the private `AccountDeletionJob` table; it does not delete data.
   Apply this migration before serving the new application version because
   authentication now checks the deletion table.
2. Set a random server-only `CRON_SECRET` of at least 32 characters in Vercel.
   Keep `SUPABASE_SECRET_KEY` configured for administrative login removal.
   Account deletion refuses to start if recovery configuration is missing.
3. Verify the `/api/cron/account-deletions` job appears in Vercel after deployment.
   The root `vercel.json` schedules one recovery run daily at 03:00 UTC. Normal
   deletions attempt provider cleanup immediately; the daily run recovers failures.
4. In staging, simulate a provider outage, request deletion using a disposable
   account that is not a sole group owner, and verify the application profile is
   removed and its job remains pending. Restore provider access and invoke the
   recovery endpoint using `Authorization: Bearer <CRON_SECRET>`. Confirm that
   the job completes and the old session cannot recreate the profile.

The profile cleanup and job creation commit together. Workers lease jobs for five
minutes, process at most five per run, and leave failed or interrupted work
eligible for retry. Recovery requires no user login. Monitor non-200 cron responses
and pending jobs older than one day. Increase run frequency on a compatible
hosting plan, or invoke additional authorized batches, if a backlog accumulates.
Provider requests have a ten-second timeout. Never log the bearer secret or auth IDs.

Completed jobs retain only the auth UUID, timestamps, and attempt count as a
deletion marker. Do not remove these markers without a replacement policy that
prevents stale sessions recreating deleted profiles. Existing activity messages
and user-written financial descriptions/notes are not scrubbed by this change;
do not describe account deletion as erasing every historical mention of a person.

Invitation status distinguishes pending sending, provider acceptance, failure,
and explicitly disabled delivery. `SENT` means the provider accepted the email,
not that the recipient received or opened it. Existing invitations have unknown
status until resent. Owners retry failures through **Settings → Resend**; invitation
emails are not automatically queued. Both new invitations and resends share the
ten-per-owner-membership hourly limit. Raw invitation tokens are not stored.

Provider references: [Vercel cron authorization](https://vercel.com/docs/cron-jobs/manage-cron-jobs),
[Supabase account deletion and existing tokens](https://supabase.com/docs/guides/auth/managing-user-data),
and [Resend request deduplication](https://resend.com/docs/dashboard/emails/idempotency-keys).
