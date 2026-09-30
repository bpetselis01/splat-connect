# Account deletion — design (Spec B)

Date: 2026-09-30 · Scope: migration, API, mobile, web, privacy page ·
Screens: https://claude.ai/artifact/CRSihi6uBv18fAFUeHdBnP · Companion to
`2026-09-30-mobile-sign-in-design.md` (Spec A). Required by Apple 5.1.1(v)
and Google Play's account deletion policy; both store submissions wait on it.

## Decisions (Byron, 2026-09-30)

| Question | Decision |
|---|---|
| Policy | Delete personal data now; records other people rely on stay, without the name |
| In flight | List open exchanges, builds and print jobs; confirming cancels them and tells the other person. Sole org leader must hand over first — the only blocker |
| Confirm | Type DELETE, then an emailed 6-digit code (Apple accounts may use Apple's sheet instead) |
| Guide credit | Checkbox "Keep my name on my published guides", unticked by default → "A former contributor" |
| Mechanism | Approach A: one fixed **Deleted member** profile that shared rows are repointed to |

## Why a placeholder profile

47 columns reference a user (queried from the live schema, not the
migrations). Most are `NOT NULL`, and every screen reads names through them.
Repointing to one fixed profile keeps every constraint valid and every screen
working unchanged. It also defuses today's three blockers —
`toy_idea_messages.sender_id` (NO ACTION), `toy_transactions.printer_id`
and `event_id` (RESTRICT) — because nothing points at the user by the time it
is deleted.

The placeholder is `00000000-0000-4000-8000-00000000dead`, a real
`auth.users` row that can never sign in (no password, banned), with a profile
named "Deleted member" and `public_showcase = false`, so its contributor page
404s like anyone's who opted out.

## What happens to each table — `delete_account(uid, keep_credit)`

One `SECURITY DEFINER` function, one transaction, callable by the service
role only. Order matters and is the order below.

1. **Refuse** the placeholder itself, and an account that is the only leader
   of any organisation (`sole_leader`).
2. **Cancel in-flight** `toy_transactions` (`requested`/`accepted`) where the
   user is requester (→ `withdrawn`) or owner (→ `rejected`). Returned so the
   API can notify each other party.
3. **Pickup address copies**: null `pickup_*` on transactions where the user is
   owner.
4. **Guides**: a tutorial where the user is the only contributor, not
   `approved`, and no build references it → deleted (id returned for Storage).
   Otherwise their credit moves to the placeholder: `former_count` counts the
   departed co-authors and `former_names` holds those who kept their name —
   one row per guide, folded together when a second co-author leaves.
5. **Toys**: with any transaction → repointed and set `draft` (off the
   library); without → deleted (id returned for Storage).
6. **Printers**: with any job → repointed, `accepting = false`; without → deleted.
7. **Repoint** the shared rows: `toy_transactions.requester_id/owner_id`,
   `toy_transaction_messages.sender_id`, `exchange_costs.payer_id/payee_id/created_by`,
   `exchange_settlements.updated_by`, `toy_ideas.author_id`,
   `toy_idea_messages.sender_id`, `toy_idea_reports.reported_by/reported_profile_id`,
   `member_reports.reporter_id`, `org_events.created_by`, `org_stories.created_by`,
   `recycling_dropoffs.contributor_id`, `org_messages.sender_id`,
   `org_conversations.profile_id` (merged into the placeholder's conversation
   with that org when one exists).
8. **Delete the auth user.** Cascades remove everything personal:
   profile (name, email, pickup address, bio), child profiles, notifications,
   saves, agreements, follows, thanks, event registrations, collaborator
   invites, challenge participation, org leadership, organisation requests.
   `SET NULL` columns (reviewer, handler, decided-by) blank themselves.

Also: `account_deletion_preview(uid)` returns the counts the delete screen
shows and the sole-led organisations.

## API

- `GET /api/me/deletion` → preview.
- `DELETE /api/me` `{ confirm: 'DELETE', keepCredit, appleAuthorizationCode? }`
  - 400 unless `confirm === 'DELETE'`.
  - 403 `reauth_required` unless the token's newest `amr` entry is under 10
    minutes old — i.e. the person just proved themselves with the emailed code
    or Apple's sheet.
  - 409 `sole_leader` with the organisation names.
  - Runs `delete_account`, then (best effort, after the data is gone): removes
    Storage objects under each deleted toy/guide id in every bucket; notifies
    each cancelled transaction's other party (`toy_withdrawn`/`toy_rejected`,
    actor "Deleted member"); revokes the Apple grant when a code was sent and
    `APPLE_TEAM_ID`/`APPLE_KEY_ID`/`APPLE_PRIVATE_KEY` are set.
- The admin `DELETE /api/admin/contributors/:id` runs the same function
  (`keep_credit = false`) instead of the bare `deleteUser` that could fail or
  destroy other members' history.
- Guide detail (`tutorials.ts`, `public.ts`) renders a placeholder credit
  from those two columns: "A former contributor", "Sam", "Sam and 1 former
  contributor".

## Screens

Mobile `(my)/account/delete`, web `/dashboard/profile/delete`: the preview
(open now / deleted now / stays without your name), the keep-name checkbox,
the DELETE field, "Email me a code" → six-box code → deleted → "Your account
is deleted" → Done signs out. iOS accounts signed in with Apple also get
"Continue with Apple instead". Sole leader: an alert and "Manage leaders", which opens the organisation
profile's new Leaders section (add a co-leader by email, step down). Account screens gain a **Delete account** row under
Sign Out.

Public web `/delete-account` (Google Play's required URL): what is deleted,
what is kept, the three steps, "Sign in to delete".

**Confirmation email** goes out through Resend (`src/mailer.ts`, plain
fetch) once `RESEND_API_KEY` and `MAIL_FROM` are set; `DELETE /api/me` returns
`{ emailed }` and the done screen only claims an email when it is true. The
same Resend account is the custom SMTP Supabase needs anyway: the built-in
sender is rate-limited and delivers to team addresses only, and Apple's
private relay needs a registered sending domain.

## Privacy page

Rewrite "How long we keep things" and "Your rights" to match: deletion is
immediate and self-serve (in the app or at `/delete-account`); child profiles,
pickup addresses, drafts, saves and photos are deleted at once; published
guides stay credited to "A former contributor" unless you choose to keep your
name; other members' exchange and message records stay under "Deleted member";
exchange cost records are kept for 7 years under "Deleted member".

## Tests

- SQL (API integration, local Supabase): each step above against seeded rows —
  blockers gone, counterparty history intact, drafts gone, published guide
  credited, sole-leader refused, placeholder refused.
- API unit: confirm word, amr freshness, sole-leader 409, Storage removal list.
- Mobile + web unit: delete screen states. e2e (both): sign up → delete with
  the Mailpit code → lands signed out; the account can no longer sign in.

## Out of scope

Data export, delayed/undoable deletion, Apple server-to-server notifications.
