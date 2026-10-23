# Complete web release

## Confirmed with the owner on 2026-10-22

- Serve friends, couples, housemates, and travel groups sharing everyday expenses.
- Complete the active website for phones and computers. Dedicated iPhone and Android applications come later.
- Record repayments made through banks, cash, or external payment apps. OIPay does not move funds.
- Target a live app usable by the owner and a small group with real expenses.
- Include working signup emails, invitations, reliable balances, phone-friendly screens, backups, and a verified end-to-end journey.
- Verify that a person can sign up, create a group, invite friends, split expenses, record repayments, and return later to accurate records.
- Finish and verify core expense sharing before recurring bills, receipt uploads, automatic reminders, and expenses with multiple payers.
- Allow only the record creator or a group owner to edit an expense or repayment; make changes visible in the activity history.
- Apply recorded repayments to balances immediately, without recipient approval.
- Start with a free live release for the owner and invited testers before a wider public launch.
- Let people join through an invitation link by entering a name, without requiring signup first.
- Keep a group currency and offer two optional conversion features: enter foreign-currency expenses converted into the group currency, and view balances in a personal display currency.
- Preserve the original foreign expense amount and the exchange rate used; later exchange-rate changes must not change existing debts.
- Let owners share one group invitation link that multiple people can use to join by name. Owners can disable or replace the link and remove unwanted members.
- Recognise returning guests on the same browser. Offer an optional account for recovery and use on other devices; entering an existing name must never grant access to that person's identity.
- Require an account to create a group; invited members may join as guests.
- Suggest an exchange rate for the day the amount is entered, rather than the expense's historical date. Show the rate and converted amount before saving, allow an override to match the actual bank conversion, and allow manual entry if automatic rates are unavailable.
- Save each financial record's conversion rate; refresh it only when someone explicitly changes that record's conversion.
- Allow repayments in another currency, preserving the original amount and confirmed equivalent in the group currency. Reduce the debt by that confirmed group-currency amount.
- Let an owner issue a private recovery link for an existing guest membership. Recovery replaces previous guest access and preserves the membership's expenses and balance.
- Require distinguishable member names within a group, such as Alex Tan and Alex B.
- Fix the group's accounting currency after the first expense or repayment. Personal display currency remains changeable.
- Require a connection to save expenses and repayments. Show connection failures and preserve entered form details for retry; defer offline financial editing.

## Interview status

The owner confirmed the consolidated scope and authorized implementation and subagents on 2026-10-22. The owner subsequently requested using an existing Vercel project and confirmed they can handle the Vercel deployment; prepare and verify the application and provide deployment instructions for that existing project.

## Consolidated delivery scope

1. Verify the existing active web app and repair failures in signup, recovery, invitations, expenses, splitting, balances, repayments, history, account management, and responsive layouts.
2. Add reusable group invitation links, name-only guest joining, returning guest access, owner-issued guest recovery, and optional account linking without losing records or granting another member's access.
3. Add optional foreign-currency expenses and repayments with saved rates and original amounts, plus personal display conversion that does not change recorded debts.
4. Enforce creator-or-owner corrections, distinguishable member names, stable group currency, accurate rounding, and clear activity history.
5. Verify the complete journey for both owners and guests, including rejected unauthorized access, expired or replaced links, failed conversion lookups, and connection failures.
6. Prepare and verify a free live pilot for the owner and invited testers, including email delivery, database migrations, backups, monitoring, and deployment configuration. Report any missing account access or external configuration that cannot be completed from the available environment; do not claim a live release based only on local checks.
7. Reconcile outdated setup and architecture documentation with the active application.

## Deferred from this release

Dedicated native mobile apps, moving money inside OIPay, recurring bills, receipt uploads, automatic reminders, multiple payers for one expense, offline financial editing, subscriptions, and a wider public launch.

## Initial foundation (historical inventory before implementation)

The active application is in `web/`. Code exists for authentication and account recovery, invitations, four split modes, expense and repayment corrections, balances, group management, histories, account export/deletion, and automated checks.

At the initial inventory, the code used one currency per group and required a verified email account matching an invitation before joining. Optional currency conversion and joining by name through a link were requested changes. Creator-or-owner editing and immediate manual repayment recording already matched the agreed direction. The implemented behavior and current verification results are documented in [the architecture guide](OIPay_Fullstack_Guide.md) and [pilot handoff](pilot-handoff.md).

Recurring expenses, receipt attachments, automatic reminders, multiple payers for a single expense, currency conversion, and offline financial editing were not found in that initial inventory. Currency conversion was added within this scope; the other listed features remain deferred.

The initial inventory also found conflicting technology-stack documentation and unverified live operations. Consult the current [pilot handoff](pilot-handoff.md) for completed local checks, database preparation, and the remaining live deployment, email, backup, and monitoring verification.
