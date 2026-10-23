# OIPay name and compatibility

The product name is **OIPay**, using an ordinary ASCII capital `I`. The shared
`BrandName` component draws the capital I with top and bottom bars, exposes the
accessible name `OIPay`, and is used by public and signed-in wordmarks. Email
branding uses a monospace I for the same distinction. Browser titles, installation
metadata, email copy, export filenames, package names, documentation, and the
archived Django/mobile projects have been renamed.

The GitHub repository is `CloudKai/OIPay`. Vercel's existing project is `oipay`;
the platform uses lowercase project names. The workspace folder is `OIPay`.
The hosted database's display-name change is pending dashboard sign-in; its
project reference and connection addresses remain unchanged. Codex's own sidebar
cannot be renamed by the available app tools and may need its folder entry
updated by the owner after the filesystem move.

## Existing data and sign-ins

The following internal identifiers deliberately retain their existing values:

- The guest browser credential cookie, so existing guests can still access groups.
- Demo and personal-currency storage keys, so saved browser choices survive.
- The local Supabase test resource ID, so its existing database and ports are reused.
- Legacy database credentials and the physical Docker volume name, so a folder
  rename does not create an empty database in place of existing records.
- The development login-limit hash secret, so existing local counters stay valid.

These identifiers are compatibility details, not visible product names. No
financial rows, authentication users, project references, or database schemas
were renamed. The archived PDF filename was updated; its historical contents
remain an archive rather than a regenerated description of the current app.

## Verification

The rename passed lint, production build and TypeScript checks, all 14 desktop
and phone browser tests (including brand names and automated accessibility),
six legacy Django tests, and the archived mobile TypeScript check. The visible
wordmark was reviewed on desktop and phone. Hosted label changes do not deploy
the changed source by themselves.
