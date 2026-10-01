# Recycling Build (Sub-project 4, Batch 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the four recycling items in `packages/types/src/pending.ts` (`recycling-photo-upload`, `recycling-intake-credit-rule`, `org-recycling-details`, `recycling-credit-spending`) and ship each one out of the registry.

**Architecture:** One slice per registry item, in the spec's order. Three slices add a migration: 112 (photo bucket, path CHECK), 113 (organisation recycling columns), 114 (credit spends, the balance function, `toy_transactions.print_credit_grams`, and `accept_toy_transaction` spending the credit in the same call as the accept). 115 is reserved and unused. The intake rule is one pure function in `packages/types` that web and mobile both call; the API repeats its limits. Credit is grams at one organisation: a balance is Σ `credit_grams` of received drop-offs minus Σ spends, computed only in SQL (`recycling_credit_balance`), never stored.

**Tech Stack:** Hono + supabase-js + vitest (api), Next.js App Router + vitest (web), Expo SDK 57 / Expo Router / React Native + jest + RNTL (mobile), Postgres migrations via the Supabase CLI.

**Spec:** `docs/superpowers/specs/2026-10-01-recycling-build-design.md` (inherits "Rules every slice keeps" from `docs/superpowers/specs/2026-10-01-guides-build-design.md`).

**Runs after batches 1–4.** Batch 2 (`docs/superpowers/plans/2026-10-01-printing-build.md`) reshapes the two files the credit slice edits most: `POST /api/toy-transactions/print` takes `files: [{ stl_file_id, quantity }]` and builds `quantityOf` (its Task 3), and the mobile request screen gains `qty`, a `ticked` list carrying `quantity`, and an `agreeLine` (its Tasks 3–4). Batch 2 also adds `toy_transactions.print_fit`, `print_fit_at` (094), `print_fit_notes` (096) and `requester_postcode` (099); this batch adds `print_credit_grams` beside them and touches none of theirs. The code in Tasks 6–7 is written against batch 2's shape; if batch 2 has not landed, stop and report.

**Where this plan follows the code, not the spec** (each is repeated in the task that meets it):

1. **Account deletion would break.** 083's `delete_account()` moves a leaver's drop-offs to the placeholder account (`update recycling_dropoffs set contributor_id = ghost`). A photo path pinned to the contributor's folder fails the CHECK the moment that happens, so deleting any account that booked with a photo would raise and roll back. 112 adds a BEFORE UPDATE trigger that clears `photo_url` when `contributor_id` changes, and `account-deletion.ts` removes the leaver's `recycling-photos/<id>/` folder (Task 1).
2. **The credit endpoint is `GET /api/organizations/recycling/credit`,** beside the existing `/recycling/mine`, not the spec's `/api/recycling/credit`: there is no recycling router, and mounting one for a single read is a second home for the same rows (Task 6).
3. **A print request is one row per printer** (074). The request body carries `print_credit: { org_id, grams }`; only the rows whose printer belongs to that organisation store `print_credit_grams`; every other row stores null. That is what makes "any other printer accepting spends nothing" true without a branch in the accept (Task 6).
4. **The spec's `accept_toy_transaction` lives at 057, not `toy-transactions.ts:670`** — the route is at the `toyTransactions.post('/:id/accept'` handler and calls the RPC defined last in `057_build_requests.sql`. Task 6 recreates that body with the spend added (Controller ruling 1).
5. **The column keeps 063's name, `photo_url`, and holds a path** (063 already documents it). The spec names it so; renaming would touch every reader for no behaviour.

## Controller rulings (override the tasks below where they differ)

1. **Re-read `accept_toy_transaction` before writing 114.** Run `grep -ln "function public.accept_toy_transaction" supabase/migrations/*.sql | sort | tail -1`. At the time of writing that is `057_build_requests.sql`, and Task 6's migration copies 057's body verbatim with the credit block added. If any later migration (batches 1–4, including batch 2's printing migrations 094–099) redefines it, copy THAT body and add the same block; never paste 057's over a newer one — that silently undoes their change.
2. **The spend is written inside the accept.** `accept_toy_transaction` takes a transaction-scoped advisory lock on (requester, organisation), re-reads the balance with `recycling_credit_balance`, and either inserts the spend (`on conflict (transaction_id) do nothing`) or clears `print_credit_grams` on the accepted row — all in the one call that flips the status. Short balance accepts the job without credit and the route says so in the thread.
3. **File columns hold storage paths, never URLs.** `recycling_dropoffs.photo_url` is `<contributor_id>/<uuid>.<ext>` with a CHECK anchored to the row's own `contributor_id`; the upload route takes the extension from the whitelisted MIME type, never the filename; reads sign the path server-side (the bucket is private) for the contributor and the organisation's leaders only.
4. **Intake below 2 kg is refused by the API as well as the screens** (400, the board's sentence). Today the API credits any weight; this is a new server rule — flagged for Byron.
5. **The intake credit box is whole grams on both platforms** (web's second box was kilos). The board shows credit in grams ("1950 g credit").
6. **Not built here, flagged for Byron:** the web print-request form's credit checkbox (the registry lists `recycling-credit-spending` as mobile + api; the WB draws it — a follow-up); refunding a spend when an accepted job is later withdrawn or declined (the spec is silent; the spend stays).

## Global Constraints

- **One migration per slice that needs schema, numbered from 112** (batches 1–4 own 085–111): `112_recycling_photos.sql`, `113_org_recycling_details.sql`, `114_recycling_credit.sql`; 115 is reserved and unused (`recycling-intake-credit-rule` has no schema). Each has a `-- DOWN:` block like 068/074. Each migration's integration test selects or exercises its new objects through the admin client, so a repaired-not-run migration fails loudly; the bucket, the CHECK, the RLS table, the function's grant and the RPC's new body also get rows in `scripts/check-schema-guards.sh`.
- **Credit is grams, never money, spent only at the issuing organisation.** Nothing in this batch converts grams to dollars, and no spend row is ever written for an organisation other than the one whose printer accepted.
- **Limits are checked twice:** the API returns 400 with a plain sentence (the API has no zod — hand-written checks, as in every route here); a CHECK in the database backs it. `recycling_turnaround` ≤ 60, `recycling_hours` ≤ 80, `recycling_door` ≤ 120, `recycling_min_kg` 2–1000, `recycling_max_kg` 2–1000 and ≥ min, `recycling_gives` in ('credit','spool','either'), `print_credit_grams` 1–1,000,000 on an org print job only, spend `grams > 0`.
- **No counter or ledger columns.** The balance is `recycling_credit_balance(profile, org)` (`stable`, `security definer`, `set search_path = ''`, execute revoked from `public, anon, authenticated`, granted to `service_role`). Nothing stores a running total.
- **Anon reads a fixed column list** (033/059). Every new `organizations` column is public by design and is granted with `grant select (<cols>) on public.organizations to anon, authenticated`, joins `ORG_COLUMNS` in `organizations.ts`, and joins both hand-written selects in `public.ts`. The pickup columns stay off.
- **Names come from the admin client** in any new read (memory: PostgREST embeds fail silently under 033/045 grants). The existing `organizations(name)` embed in `/recycling/mine` stays.
- **Shipping an item:** delete every `PENDING(<id>)` / `pending="<id>"` reference, set `shipped: true` on the entry (never delete it), run `node scripts/pending.mjs`, and run the drift test. No parity `explained` rule names these four ids (checked: `screen-map.json` and `app-screen-map.json` `recycling`/`org_recycling`/`recycle_new` entries carry none). The commit that flips `shipped` contains that item only. The markers today:
  - `recycling-photo-upload`: `packages/mobile/components/recycling/recycling-screen.tsx` (`<PendingButton pending="recycling-photo-upload" …>`), `packages/mobile/tests/unit/components/recycling/recycling-screen.test.tsx` (the `useRouter` comment).
  - `recycling-intake-credit-rule`: `packages/mobile/components/recycling/intake-screen.tsx` (comment above `export function IntakeScreen`).
  - `org-recycling-details`: `packages/api/src/routes/organizations.ts` (above `organizations.get('/:id/recycling'`), `packages/mobile/components/recycling/intake-screen.tsx` (above "What you can take"), `packages/mobile/components/recycling/recycling-screen.tsx` (in the org card), `packages/mobile/components/organisation/org-profile-screen.tsx` (in the recycling panel).
  - `recycling-credit-spending`: `packages/mobile/components/recycling/recycling-screen.tsx` (hero), `packages/mobile/components/printing/request-screen.tsx` (`<PendingRow pending="recycling-credit-spending" …>`).
- **Mobile is a second consumer of every column.** On each column change run `grep -rn "<column>" packages/mobile`.
- **Copy is quoted from the boards** (`Splat Connect frontend overhaul/SPLAT Connect - Mobile.dc.html` = MB, `SPLAT Connect - Web.dc.html` = WB). Where the boards differ, each platform takes its own board's words (the spec quotes MB in places; web uses WB's). Strings with no board source, flagged for Byron: "That photo is not one you uploaded.", "Could not upload the photo. Please try again." (reused from community notes), "Enter the credit in whole grams.", "{org} takes at least {min} kg at once.", "Per drop is between 2 and 1000 kg, to one decimal place.", "The maximum per drop cannot be under the minimum.", "recycling_gives must be credit, spool or either", "Say how many grams of credit, in whole grams.", "Credit can only be spent at the organisation that issued it.", "This guide does not say how much filament its parts take, so credit cannot be used on it.", "This job needs {n} g of filament, so that is the most credit it can use.", "You have {n} g of credit there.", the thread line "There was not enough recycling credit left at {org} for this job, so it was accepted without credit.", and the intake credit box's unit "g".
- **Mobile number and date formatting** stays on what Hermes already runs here (`toLocaleString('en-AU')`, `toFixed`); no `Intl` options beyond those already in these files (memory: mobile Hermes runtime parity).
- **Web e2e specs import only from `tests/e2e/helpers.ts` / `lib/`,** never a component. Never run web and mobile e2e at the same time.
- **Batches 1–4 land first and other agents may still be touching shared files.** Before editing any file, re-read it; anchor every edit on the code quoted in the step, never on a line number. Files this batch shares: `packages/types/src/index.ts`, `packages/types/src/pending.ts`, `docs/PENDING.md`, `packages/api/src/routes/upload.ts`, `packages/api/src/routes/toy-transactions.ts`, `packages/api/src/routes/organizations.ts`, `packages/api/src/routes/public.ts`, `packages/mobile/lib/upload.ts`, `packages/mobile/components/printing/request-screen.tsx`, `packages/mobile/components/printing/job-screen.tsx`, `packages/mobile/components/organisation/org-profile-screen.tsx`, `packages/web/app/organizations/[id]/public/page.tsx`, `packages/web/app/dashboard/print-requests/[id]/page.tsx`, `scripts/check-schema-guards.sh`.
- **Stage only this task's files.** The tree holds unrelated changes (`CLAUDE.md`, `packages/web/zz3_57656.mjs`, `selfIdentity.plist`, parity reports): list files by name in every `git add`, run `git status --short` first, and `git restore --staged` anything that is not the task's.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV
  ```

## Review Focus

1. **Deleting an account that booked a drop-off with a photo.** 083 hands the drop-off to the placeholder; the photo's folder is the leaver's. Expected: the deletion completes, the placeholder's row has `photo_url` null, and the leaver's folder is emptied. Pinned by Task 1's integration test.
2. **Two accepts racing on one balance.** A family with 50 g left at an organisation has two requests there, each asking 50 g; two leaders accept at the same moment. Expected: exactly one spend of 50 g; the other job is accepted without credit and its thread says so. Pinned by Task 6's integration test (`Promise.all` of both accepts).
3. **Credit on a job nobody can measure.** A guide with a part that has no `filament_grams`. Expected: the API refuses `print_credit` with a sentence, and the phone never offers the checkbox. Pinned by Task 6's integration test and Task 7's request-screen test.
4. **Per-drop limits that contradict each other.** Max under min, min under the 2 kg floor, a max cleared to null, a booking at an organisation with no max. Expected: 400 / 400 / allowed (no ceiling) / allowed; the CHECK refuses max < min even through the admin client. Pinned by Task 4's integration test.
5. **The leader edits the credit, then corrects the weight.** The edited credit must stay what they typed (not snap back to the estimate), a cleared credit box must not send 0 silently, and a credit above the new weight must hold the button. Pinned by Task 3's pure test and mobile intake test.

## Files

New:
- `supabase/migrations/112_recycling_photos.sql`, `113_org_recycling_details.sql`, `114_recycling_credit.sql`.
- `packages/api/tests/integration/orgs/{recycling-photo,recycling-intake,recycling-details}.test.ts`, `packages/api/tests/integration/printers/recycling-credit.test.ts`.
- `packages/web/tests/unit/lib/recycling.test.ts`, `packages/web/tests/unit/components/{recycling-intake,what-you-take,dropoff-form-photo}.test.tsx`, `packages/web/tests/unit/app/recycling.test.tsx`.

## Commands used throughout

- Apply new migrations locally (needs `supabase start`): `supabase migration up`
- API integration: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts <file>`
- API unit: `pnpm --filter @splat-connect/api exec vitest run <file>`
- Drift test: `pnpm --filter @splat-connect/api exec vitest run tests/unit/pending-features.test.ts tests/unit/pending-registry.test.ts` → `Tests  11 passed (11)`
- Regenerate the registry doc: `node scripts/pending.mjs` → `wrote docs/PENDING.md (N items)`
- Web unit: `pnpm --filter @splat-connect/web exec vitest run <file>`
- Mobile unit: `pnpm --filter @splat-connect/mobile exec jest <file>`
- Typecheck: `pnpm typecheck`

---

### Task 1: The photo's bucket, path and reads (`recycling-photo-upload`, part 1 of 2, migration 112)

**Files:**
- Create: `supabase/migrations/112_recycling_photos.sql`
- Modify: `packages/api/src/routes/upload.ts` (new `POST /recycling-photo`)
- Modify: `packages/api/src/routes/organizations.ts` (`POST /:id/recycling` takes `photo_url`; `GET /recycling/mine` and `GET /:id/recycling` sign it)
- Modify: `packages/api/src/account-deletion.ts` (empty the leaver's folder)
- Modify: `packages/types/src/index.ts` (`RecyclingDropoff.photo_signed_url`)
- Modify: `scripts/check-schema-guards.sh`
- Test: `packages/api/tests/integration/orgs/recycling-photo.test.ts` (new)

**Interfaces:**
- Consumes: 063's `recycling_dropoffs.photo_url`; 083's `delete_account(uid, keep_credit)`.
- Produces: `POST /api/upload/recycling-photo` (multipart, one `file` part, no id part) → `{ path: string; url: string | null }`, path `<caller id>/<uuid>.<jpg|png|webp|avif|heic|heif>`. `POST /api/organizations/:id/recycling` accepts `photo_url?: string | null` (a path in the caller's folder; 400 otherwise). Every drop-off from `GET /api/organizations/recycling/mine` and `GET /api/organizations/:id/recycling` carries `photo_signed_url: string | null` (one hour). `RecyclingDropoff.photo_signed_url?: string | null`. Task 2 uses all three.

- [ ] **Step 1: Write the failing test**

`packages/api/tests/integration/orgs/recycling-photo.test.ts`:

```ts
/**
 * 112: the photo of the sorted plastic. A private bucket, a path pinned to the
 * contributor's own folder, signed reads for the contributor and the
 * organisation's leaders — and an account deletion that still completes.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createUserClient } from '../../../src/supabase/client.js'
import { DECLARATION_VERSION } from '@splat-connect/types'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader } from '../../helpers/orgs.js'

const GHOST = '00000000-0000-4000-8000-00000000dead'
let leader: TestUser
let me: TestUser
let other: TestUser
let leaver: TestUser
let orgId: string

const json = (token: string, method: string, body?: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})
const booking = (photo_url: unknown) => ({
  material: 'PLA',
  estimated_grams: 2500,
  condition_declared: true,
  declaration_version: DECLARATION_VERSION,
  photo_url,
})
const png = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'anything.exe', { type: 'image/png' })
const upload = (token: string, file: File) => {
  const fd = new FormData()
  fd.append('file', file)
  return app.request('/api/upload/recycling-photo', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
}

beforeAll(async () => {
  ;[leader, me, other, leaver] = await Promise.all([1, 2, 3, 4].map(() => createTestUser('contributor')))
  orgId = await createOrg({ createdBy: leader.id })
  await addLeader(orgId, leader.id)
  await adminClient().from('organizations').update({ recycling_materials: ['PLA'] }).eq('id', orgId)
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('recycling_dropoffs').delete().eq('org_id', orgId)
  for (const u of [me, other, leaver]) {
    const { data } = await admin.storage.from('recycling-photos').list(u.id)
    if (data?.length) await admin.storage.from('recycling-photos').remove(data.map((f) => `${u.id}/${f.name}`))
  }
  await admin.from('organizations').delete().eq('id', orgId)
  await Promise.all([leader, me, other, leaver].map((u) => deleteTestUser(u.id).catch(() => {})))
})

describe('112 the recycling-photos bucket', () => {
  it('exists and is private', async () => {
    const { data } = await adminClient().storage.getBucket('recycling-photos')
    expect(data?.public).toBe(false)
  })
})

describe('POST /api/upload/recycling-photo', () => {
  it('writes under the caller’s folder, naming the file from its type', async () => {
    const res = await upload(me.token, png())
    expect(res.status).toBe(200)
    const body = (await res.json()) as { path: string; url: string }
    expect(body.path).toMatch(new RegExp(`^${me.id}/[0-9a-f-]{36}\\.png$`))
    expect(body.url).toContain('/object/sign/recycling-photos/')
  })

  it('refuses a file that is not a photo', async () => {
    const res = await upload(me.token, new File(['x'], 'a.png', { type: 'text/plain' }))
    expect(res.status).toBe(400)
  })

  it('will not let one member write into another’s folder', async () => {
    const { error } = await createUserClient(other.token)
      .storage.from('recycling-photos')
      .upload(`${me.id}/${crypto.randomUUID()}.png`, png())
    expect(error).not.toBeNull()
  })
})

describe('a booking with a photo', () => {
  let path: string
  let dropId: string

  beforeAll(async () => {
    path = ((await (await upload(me.token, png())).json()) as { path: string }).path
  })

  it('refuses a path in another member’s folder, or a URL', async () => {
    for (const bad of [`${other.id}/${crypto.randomUUID()}.png`, `https://evil.example/${me.id}/${crypto.randomUUID()}.png`]) {
      const res = await app.request(`/api/organizations/${orgId}/recycling`, json(me.token, 'POST', booking(bad)))
      expect(res.status).toBe(400)
      expect(((await res.json()) as { error: string }).error).toBe('That photo is not one you uploaded.')
    }
  })

  it('refuses the same on a direct insert (the CHECK)', async () => {
    const { error } = await createUserClient(me.token).from('recycling_dropoffs').insert({
      org_id: orgId,
      contributor_id: me.id,
      material: 'PLA',
      estimated_grams: 2500,
      condition_declared: true,
      declaration_version: DECLARATION_VERSION,
      photo_url: `${other.id}/${crypto.randomUUID()}.png`,
    })
    expect(error?.code).toBe('23514')
  })

  it('stores the path and signs it for the contributor and the leader', async () => {
    const res = await app.request(`/api/organizations/${orgId}/recycling`, json(me.token, 'POST', booking(path)))
    expect(res.status).toBe(201)
    const row = (await res.json()) as { id: string; photo_url: string }
    dropId = row.id
    expect(row.photo_url).toBe(path)

    const mine = (await (await app.request('/api/organizations/recycling/mine', json(me.token, 'GET'))).json()) as Array<{ id: string; photo_signed_url: string | null }>
    expect(mine.find((d) => d.id === dropId)?.photo_signed_url).toContain('/object/sign/recycling-photos/')

    const queue = (await (await app.request(`/api/organizations/${orgId}/recycling`, json(leader.token, 'GET'))).json()) as Array<{ id: string; photo_signed_url: string | null }>
    expect(queue.find((d) => d.id === dropId)?.photo_signed_url).toContain('/object/sign/recycling-photos/')
  })

  it('books without a photo exactly as before', async () => {
    const res = await app.request(`/api/organizations/${orgId}/recycling`, json(me.token, 'POST', booking(undefined)))
    expect(res.status).toBe(201)
    expect(((await res.json()) as { photo_url: string | null }).photo_url).toBeNull()
  })
})

describe('deleting an account that booked with a photo', () => {
  it('completes, clears the photo on the placeholder’s row, and empties the folder', async () => {
    const path = ((await (await upload(leaver.token, png())).json()) as { path: string }).path
    const booked = await app.request(`/api/organizations/${orgId}/recycling`, json(leaver.token, 'POST', booking(path)))
    const { id } = (await booked.json()) as { id: string }

    // A token minted seconds ago passes the route's fresh-sign-in check.
    const res = await app.request('/api/me', json(leaver.token, 'DELETE', { confirm: 'DELETE', keepCredit: false }))
    expect(res.status).toBeLessThan(300)

    const { data: row } = await adminClient().from('recycling_dropoffs').select('contributor_id, photo_url').eq('id', id).single()
    expect(row).toEqual({ contributor_id: GHOST, photo_url: null })
    const { data: left } = await adminClient().storage.from('recycling-photos').list(leaver.id)
    expect(left ?? []).toHaveLength(0)
  })
})
```

The last test goes through the self-serve `DELETE /api/me` (`routes/me.ts`: body `{ confirm: 'DELETE', keepCredit }`, and a token younger than its `FRESH_SECONDS`), so it exercises `deleteAccount()` end to end — 083's RPC, 112's trigger and the folder removal.

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/orgs/recycling-photo.test.ts`
Expected: FAIL — `getBucket` returns null (`expected undefined to be false`), the upload route 404s.

- [ ] **Step 3: Write the migration**

`supabase/migrations/112_recycling_photos.sql`:

```sql
-- 112 — the photo of the sorted plastic (recycling-photo-upload).
--
-- 063 added recycling_dropoffs.photo_url as "a storage path in the private
-- recycling-photos bucket, never a URL" and made no bucket, policy or writer.
-- This makes all three, and pins the path to the contributor's own folder:
-- <contributor_id>/<uuid>.<ext>, the extension taken from the checked MIME
-- type by POST /api/upload/recycling-photo. The column keeps 063's name.
--
-- 083's delete_account() hands a leaver's drop-offs to the placeholder
-- account. Their photo's folder is still theirs, so the CHECK below would
-- refuse that update and roll the whole deletion back. The trigger clears the
-- photo when the contributor changes; account-deletion.ts empties the folder.
--
-- DOWN:
--   drop trigger if exists recycling_dropoffs_photo_follows_owner on public.recycling_dropoffs;
--   drop function if exists public.recycling_photo_follows_owner();
--   alter table public.recycling_dropoffs drop constraint if exists recycling_dropoffs_photo_is_own_path;
--   drop policy if exists "Contributors upload their own recycling photos" on storage.objects;
--   drop policy if exists "Contributors and leaders read recycling photos" on storage.objects;
--   drop policy if exists "Contributors remove their own recycling photos" on storage.objects;
--   -- the bucket itself only once it is empty:
--   delete from storage.buckets where id = 'recycling-photos';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recycling-photos', 'recycling-photos', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

create policy "Contributors upload their own recycling photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'recycling-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Reads go through the API's signed URLs; this is the second layer under it.
create policy "Contributors and leaders read recycling photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'recycling-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.recycling_dropoffs d
        where d.photo_url = name and public.is_org_leader(d.org_id)
      )
    )
  );

create policy "Contributors remove their own recycling photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'recycling-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- No row holds a photo yet (no writer existed), so this validates at once.
alter table public.recycling_dropoffs
  add constraint recycling_dropoffs_photo_is_own_path check (
    photo_url is null
    or photo_url ~ ('^' || contributor_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp|avif|heic|heif)$')
  );

create function public.recycling_photo_follows_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.contributor_id is distinct from old.contributor_id then
    new.photo_url := null;
  end if;
  return new;
end;
$$;

create trigger recycling_dropoffs_photo_follows_owner
  before update of contributor_id on public.recycling_dropoffs
  for each row execute function public.recycling_photo_follows_owner();
```

Run: `supabase migration up` → `Applying migration 112_recycling_photos.sql...`

- [ ] **Step 4: The upload route**

In `packages/api/src/routes/upload.ts`, before `export default upload`:

```ts
/**
 * The photo of the sorted plastic on a drop-off booking (112). Written with
 * the caller's own client, so 112's storage policy is what admits it: only
 * under <their id>/. The extension is the checked MIME type's, never the
 * filename's. The path is what POST /organizations/:id/recycling takes; the
 * url is signed because the bucket is private, and is for the preview only.
 * ponytail: a photo picked and never booked stays in the bucket; sweep <uid>/
 * against recycling_dropoffs if storage ever matters.
 */
upload.post('/recycling-photo', async (c) => {
  const file = (await c.req.formData()).get('file')
  if (!(file instanceof File)) return c.json({ error: 'file is required' }, 400)
  if (!PHOTO_MIME.includes(file.type)) return c.json({ error: 'Photos need to be a JPEG, PNG, WebP, AVIF or HEIC image.' }, 400)
  if (file.size > PHOTO_MAX_BYTES) return c.json({ error: 'Photos need to be under 10 MB.' }, 400)
  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type.slice('image/'.length)
  const bucket = createUserClient(c.get('token')).storage.from('recycling-photos')
  const { data, error } = await bucket.upload(`${c.get('userId')}/${crypto.randomUUID()}.${ext}`, file, { upsert: false })
  if (error) return c.json({ error: error.message }, 500)
  const { data: signed } = await bucket.createSignedUrl(data.path, 3600)
  return c.json({ path: data.path, url: signed?.signedUrl ?? null })
})
```

- [ ] **Step 5: The booking and the two reads**

In `packages/api/src/routes/organizations.ts`, after `DROPOFF_COLUMNS`:

```ts
/** 112's CHECK, said once more in the API so the answer is a sentence. */
const ownPhotoPath = (userId: string) =>
  new RegExp(`^${userId}/[0-9a-f-]{36}\\.(jpg|png|webp|avif|heic|heif)$`)

/**
 * The photo is a path in a private bucket; whoever may read the row gets a
 * one-hour signed URL beside it. Signed with the service role because the
 * caller already passed RLS on the row itself.
 */
async function withPhotoUrls<T extends { photo_url: string | null }>(rows: T[]) {
  const paths = rows.map((r) => r.photo_url).filter((p): p is string => Boolean(p))
  if (!paths.length) return rows.map((r) => ({ ...r, photo_signed_url: null }))
  const { data } = await createAdminClient().storage.from('recycling-photos').createSignedUrls(paths, 3600)
  const url = new Map((data ?? []).map((s) => [s.path, s.signedUrl]))
  return rows.map((r) => ({ ...r, photo_signed_url: r.photo_url ? (url.get(r.photo_url) ?? null) : null }))
}
```

`GET /recycling/mine` — replace its `return c.json(…)` with:

```ts
  return c.json(
    await withPhotoUrls(
      (data ?? []).map(({ organizations: org, ...row }: any) => ({ ...row, org_name: org?.name ?? null }))
    )
  )
```

`GET /:id/recycling` — the two returns become:

```ts
  if (!rows.length || !(await ledOrgIds(admin, c.get('userId'))).includes(c.req.param('id'))) {
    return c.json(await withPhotoUrls(rows))
  }
```

and

```ts
  return c.json(await withPhotoUrls(rows.map((r) => ({ ...r, contributor_name: name.get(r.contributor_id) ?? null }))))
```

`POST /:id/recycling` — after the `declaration_version` check, before the insert:

```ts
  // 112: a path in the caller's own folder, from POST /api/upload/recycling-photo.
  const photo = body.photo_url ?? null
  if (photo !== null && (typeof photo !== 'string' || !ownPhotoPath(c.get('userId')).test(photo))) {
    return c.json({ error: 'That photo is not one you uploaded.' }, 400)
  }
```

and add `photo_url: photo,` to the insert object after `declaration_version: DECLARATION_VERSION,`.

In `packages/types/src/index.ts`, `interface RecyclingDropoff`, after `photo_url`:

```ts
  /** 112. A one-hour signed URL for `photo_url`, on the contributor's and the
   *  organisation's reads only. */
  photo_signed_url?: string | null
```

- [ ] **Step 6: Account deletion empties the folder**

In `packages/api/src/account-deletion.ts`, in `deleteAccount`, replace the `Promise.allSettled([...])` line with:

```ts
  await Promise.allSettled([
    removeFiles(admin, [...result.toyIds, ...result.tutorialIds]),
    removeRecyclingPhotos(admin, userId),
    notifyCancelled(admin, result),
  ])
```

and after `removeFiles`:

```ts
/** 112: the leaver's photos of sorted plastic. 112's trigger already cleared
 *  them off the drop-offs 083 handed to the placeholder. */
async function removeRecyclingPhotos(admin: Admin, userId: string) {
  const { data } = await admin.storage.from('recycling-photos').list(userId, { limit: 1000 })
  const paths = (data ?? []).map((f) => `${userId}/${f.name}`)
  if (!paths.length) return
  const { error } = await admin.storage.from('recycling-photos').remove(paths)
  if (error) console.error(`account deletion: recycling-photos/${userId} left behind`, error.message)
}
```

- [ ] **Step 7: Schema guards**

In `scripts/check-schema-guards.sh`, before the line `) as t(guard, ok)`, add a comma after the last row and:

```sql
  -- 112. A public bucket would put photos of people's homes and bags on the open web.
  ('112 recycling-photos bucket is private',
   (select count(*) = 1 from storage.buckets where id = 'recycling-photos' and not public)),

  -- 112. Without it a booking could point at anyone's object.
  ('112 recycling_dropoffs photo path is pinned to its contributor',
   (select count(*) = 1 from pg_constraint
      where conname = 'recycling_dropoffs_photo_is_own_path')),

  -- 112. Without it, deleting an account that booked with a photo fails.
  ('112 recycling_dropoffs_photo_follows_owner trigger',
   (select count(*) > 0 from pg_trigger
      where tgname = 'recycling_dropoffs_photo_follows_owner' and not tgisinternal))
```

- [ ] **Step 8: Run it to see it pass**

Run the Step 2 command. Expected: PASS (9 tests).
Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/orgs/org-screens.test.ts` → PASS (bookings without a photo unchanged).
Run: `grep -rn "photo_url" packages/mobile/components/recycling packages/mobile/lib/recycling.ts` → only the comment in `recycling-screen.tsx`'s header and nothing that writes it (Task 2 adds the writer).

- [ ] **Step 9: Commit**

```bash
git status --short
git add supabase/migrations/112_recycling_photos.sql packages/api/src/routes/upload.ts packages/api/src/routes/organizations.ts packages/api/src/account-deletion.ts packages/types/src/index.ts scripts/check-schema-guards.sh packages/api/tests/integration/orgs/recycling-photo.test.ts
git commit -m "feat(recycling): a private bucket for the photo of the sorted plastic, pinned to the contributor's folder (112)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 2: The photo on both booking forms and both intake screens (`recycling-photo-upload`, part 2 of 2)

**Files:**
- Modify: `packages/mobile/lib/upload.ts` (`UploadPath`)
- Modify: `packages/mobile/components/recycling/recycling-screen.tsx` (`BookDropoff`)
- Modify: `packages/mobile/components/recycling/intake-screen.tsx` (`BookedRow` shows it)
- Modify: `packages/web/components/dropoff-form.tsx`
- Modify: `packages/web/components/recycling-intake.tsx` (`BookedRow` shows it)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/mobile/tests/unit/components/recycling/recycling-screen.test.tsx`, `packages/mobile/tests/unit/components/recycling/intake-screen.test.tsx`, `packages/web/tests/unit/components/dropoff-form-photo.test.tsx` (new)

**Interfaces:**
- Consumes: Task 1's `POST /api/upload/recycling-photo` → `{ path, url }`, `photo_url` on the booking, `photo_signed_url` on reads.
- Produces: nothing later tasks rely on.

Copy: MB image slot "Photo of the sorted plastic"; WB label "Photo of what you are bringing", placeholder "Drop a photo of the sorted plastic"; the line under both "Sorted, in the bag or box you will carry it in. It saves an argument at the door." (WB; the spec puts it on both). "Could not upload the photo. Please try again." and "Photo library access is needed to choose a photo." (no board — reused from community notes).

- [ ] **Step 1: Write the failing tests**

`packages/mobile/tests/unit/components/recycling/recycling-screen.test.tsx`:
- Replace the `expo-router` mock's comment line `// The booking form's pending photo button (PENDING(recycling-photo-upload)) navigates.` with `// Nothing here navigates; the mock keeps any stray useRouter call harmless.`
- After the `../../../../lib/capabilities` mock add:

```tsx
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: () => Promise.resolve({ granted: true }),
  launchImageLibraryAsync: () =>
    Promise.resolve({ canceled: false, assets: [{ uri: 'file:///bag.jpg', fileName: 'bag.jpg', mimeType: 'image/jpeg' }] }),
}))
const mockUpload = jest.fn()
jest.mock('../../../../lib/upload', () => ({ uploadFile: (...a: unknown[]) => mockUpload(...a) }))
```

- Append:

```tsx
it('uploads the photo of the sorted plastic and books with its path', async () => {
  mockUpload.mockResolvedValue({ path: 'me/0b5e7c8a-1d2e-4f3a-9b8c-7d6e5f4a3b2c.jpg', url: 'https://signed' })
  render(<RecyclingScreen />)
  fireEvent.press(await screen.findByLabelText('Book a drop-off at Northside Therapy'))
  expect(screen.getByText('Sorted, in the bag or box you will carry it in. It saves an argument at the door.')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Photo of the sorted plastic'))
  await waitFor(() =>
    expect(mockUpload).toHaveBeenCalledWith(
      '/api/upload/recycling-photo',
      '',
      { uri: 'file:///bag.jpg', name: 'bag.jpg', mimeType: 'image/jpeg' },
      null
    )
  )
  fireEvent.changeText(screen.getByLabelText('How much, roughly, in kilograms'), '2.5')
  for (const line of RECYCLING_DECLARATION) fireEvent.press(screen.getByLabelText(line))
  fireEvent.press(screen.getByLabelText('Book the drop-off'))
  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith(
      '/api/organizations/north/recycling',
      expect.objectContaining({ photo_url: 'me/0b5e7c8a-1d2e-4f3a-9b8c-7d6e5f4a3b2c.jpg' })
    )
  )
})
```

`packages/mobile/tests/unit/components/recycling/intake-screen.test.tsx` — append:

```tsx
it('shows the leader the photo the contributor booked with', async () => {
  route([drop({ photo_url: 'tom/x.jpg', photo_signed_url: 'https://signed/x.jpg' })])
  render(<IntakeScreen />)
  const photo = await screen.findByLabelText('Photo of the sorted plastic')
  expect(photo.props.source).toEqual({ uri: 'https://signed/x.jpg' })
})
```

`packages/web/tests/unit/components/dropoff-form-photo.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RECYCLING_DECLARATION } from '@splat-connect/types'
import { DropoffForm } from '@/components/dropoff-form'
import { browserApiClient } from '@/lib/browser-api-client'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn(), postFormData: vi.fn() } }))

const ORG = { id: 'north', name: 'Northside', suburb: null, state: null, recycling_materials: ['PLA'], recycling_note: null }

describe('DropoffForm photo', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uploads the photo and books with its path', async () => {
    vi.mocked(browserApiClient.postFormData).mockResolvedValue({ path: 'me/a.jpg', url: 'https://signed/a.jpg' })
    vi.mocked(browserApiClient.post).mockResolvedValue({})
    render(<DropoffForm orgs={[ORG]} />)
    expect(screen.getByText('Sorted, in the bag or box you will carry it in. It saves an argument at the door.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Photo of what you are bringing'), {
      target: { files: [new File(['x'], 'bag.jpg', { type: 'image/jpeg' })] },
    })
    expect(await screen.findByAltText('Photo of the sorted plastic')).toHaveAttribute('src', 'https://signed/a.jpg')
    fireEvent.change(screen.getByPlaceholderText('2.0'), { target: { value: '2.5' } })
    for (const line of RECYCLING_DECLARATION) fireEvent.click(screen.getByLabelText(line))
    fireEvent.click(screen.getByRole('button', { name: /Book the drop-off/ }))
    await waitFor(() =>
      expect(browserApiClient.post).toHaveBeenCalledWith(
        '/api/organizations/north/recycling',
        expect.objectContaining({ photo_url: 'me/a.jpg' })
      )
    )
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/recycling/recycling-screen.test.tsx tests/unit/components/recycling/intake-screen.test.tsx` → FAIL (no 'Photo of the sorted plastic').
Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/components/dropoff-form-photo.test.tsx` → FAIL.

- [ ] **Step 3: Mobile**

`packages/mobile/lib/upload.ts` — add to `UploadPath` after `'/api/upload/note-photo'`:

```ts
  // 112: the photo of the sorted plastic. No id part — the path is the caller's own folder.
  | '/api/upload/recycling-photo'
```

`packages/mobile/components/recycling/recycling-screen.tsx`:
- Imports: `Image` joins the `react-native` import; add `import * as ImagePicker from 'expo-image-picker'` and `import { uploadFile } from '../../lib/upload'`; delete `import { PendingButton } from '../ui/pending'`.
- In `BookDropoff`, beside `note`: `const [photo, setPhoto] = useState<{ path: string; uri: string } | null>(null)`, and before `submit`:

```tsx
  async function addPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) return setError('Photo library access is needed to choose a photo.')
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] })
    const asset = result.canceled ? null : result.assets?.[0]
    if (!asset) return
    try {
      const { path } = await uploadFile(
        '/api/upload/recycling-photo',
        '',
        { uri: asset.uri, name: asset.fileName ?? 'photo.jpg', mimeType: asset.mimeType ?? 'image/jpeg' },
        null
      )
      if (path) setPhoto({ path, uri: asset.uri })
    } catch {
      setError('Could not upload the photo. Please try again.')
    }
  }
```

- In `submit`'s post body, after `note: note.trim(),`: `...(photo ? { photo_url: photo.path } : {}),`
- Replace `<PendingButton pending="recycling-photo-upload" label="Add a photo of the sorted plastic" variant="ghost" />` with nothing, and insert before the `TextField` labelled "Anything they should know (optional)" (the board puts the slot after the declaration):

```tsx
        <View>
          <Pressable
            onPress={addPhoto}
            accessibilityRole="button"
            accessibilityLabel="Photo of the sorted plastic"
            style={styles.photoSlot}
          >
            {photo ? (
              <Image source={{ uri: photo.uri }} style={styles.photoFill} accessibilityIgnoresInvertColors />
            ) : (
              <>
                <Ionicons name="camera-outline" size={22} color={theme.colors.primaryDark} />
                <Text style={styles.label}>Photo of the sorted plastic</Text>
              </>
            )}
          </Pressable>
          <Text style={styles.help}>Sorted, in the bag or box you will carry it in. It saves an argument at the door.</Text>
        </View>
```

- Styles:

```tsx
  photoSlot: {
    height: 150,
    borderRadius: 18,
    borderWidth: theme.border.hairline,
    borderStyle: 'dashed',
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.accentFaint,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  photoFill: { width: '100%', height: '100%' },
```

- Header comment: replace "Where the board draws fields no column holds (machines, …) … as web's intake editor decided." only if Task 5 has not yet — leave it for Task 5. Add one sentence after the booking-form paragraph: "The photo is uploaded first (112) and the booking sends its path."

`packages/mobile/components/recycling/intake-screen.tsx`:
- `Image` joins the `react-native` import.
- In `BookedRow`, after `{dropoff.note ? <Text style={styles.note}>{dropoff.note}</Text> : null}`:

```tsx
      {dropoff.photo_signed_url ? (
        <Image
          source={{ uri: dropoff.photo_signed_url }}
          accessibilityLabel="Photo of the sorted plastic"
          style={styles.photo}
        />
      ) : null}
```

- Style: `photo: { width: '100%', height: 150, borderRadius: 18 },`

- [ ] **Step 4: Web**

`packages/web/components/dropoff-form.tsx`:
- Beside `note` state:

```tsx
  const [photo, setPhoto] = useState<{ path: string; url: string | null } | null>(null)
  const [uploading, setUploading] = useState(false)

  async function pickPhoto(file: File | undefined) {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      setPhoto(await browserApiClient.postFormData<{ path: string; url: string | null }>('/api/upload/recycling-photo', fd))
    } catch {
      setError('Could not upload the photo. Please try again.')
    } finally {
      setUploading(false)
    }
  }
```

- In `submit`'s post body after `note: note.trim(),`: `...(photo ? { photo_url: photo.path } : {}),`
- The submit button's `disabled={!valid || saving}` becomes `disabled={!valid || saving || uploading}`.
- Before the "Anything they should know" `<label className="block">`:

```tsx
      <div>
        <label htmlFor="dropoff-photo" className={`${LABEL} mb-1 block`}>
          Photo of what you are bringing
        </label>
        <p className="mb-2.5 text-[13px] text-muted">
          Sorted, in the bag or box you will carry it in. It saves an argument at the door.
        </p>
        <div className="relative grid h-[180px] place-items-center overflow-hidden rounded-[18px] border border-dashed border-[var(--brand)] bg-[var(--b50)] text-sm font-bold text-muted">
          {photo?.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- a signed URL from a private bucket
            <img src={photo.url} alt="Photo of the sorted plastic" className="h-full w-full object-cover" />
          ) : (
            'Drop a photo of the sorted plastic'
          )}
          <input
            id="dropoff-photo"
            type="file"
            accept="image/*"
            onChange={(e) => pickPhoto(e.target.files?.[0])}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </div>
      </div>
```

- Header comment: add "The photo is uploaded first (112) and the booking sends its storage path, never a URL." to the related-files list's lead paragraph.

`packages/web/components/recycling-intake.tsx` — in `BookedRow`, after `{dropoff.note && <span className="mt-1 block text-sm text-muted">{dropoff.note}</span>}`:

```tsx
        {dropoff.photo_signed_url && (
          // eslint-disable-next-line @next/next/no-img-element -- a signed URL from a private bucket
          <img
            src={dropoff.photo_signed_url}
            alt="Photo of the sorted plastic"
            className="mt-2 h-[120px] w-auto rounded-[14px] object-cover"
          />
        )}
```

- [ ] **Step 5: Run the tests to see them pass**

Run both Step 2 commands. Expected: PASS.

- [ ] **Step 6: Ship the item** — `shipped: true,` on `'recycling-photo-upload'` in `packages/types/src/pending.ts`; `git grep -n "recycling-photo-upload" -- packages scripts ':!packages/types/src/pending.ts' ':!*report.json'` → no output; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 7: Commit**

```bash
git status --short
git add packages/mobile/lib/upload.ts packages/mobile/components/recycling/recycling-screen.tsx packages/mobile/components/recycling/intake-screen.tsx packages/web/components/dropoff-form.tsx packages/web/components/recycling-intake.tsx packages/mobile/tests/unit/components/recycling/recycling-screen.test.tsx packages/mobile/tests/unit/components/recycling/intake-screen.test.tsx packages/web/tests/unit/components/dropoff-form-photo.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(recycling): book a drop-off with a photo of the sorted plastic, and the leader sees it at intake

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 3: Credit from the weight (`recycling-intake-credit-rule`)

**Files:**
- Modify: `packages/types/src/index.ts` (`intakeCredit`, `weighedInLine`, after `estimatedCreditGrams`)
- Modify: `packages/api/src/routes/organizations.ts` (`PATCH /:orgId/recycling/:id` refuses under 2 kg)
- Modify: `packages/mobile/lib/recycling.ts` (delete `intakeProblem`)
- Modify: `packages/mobile/components/recycling/intake-screen.tsx` (`BookedRow`, `KgBox`, the flash)
- Modify: `packages/web/components/recycling-intake.tsx` (`BookedRow`, `KgInput`, the status line)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/web/tests/unit/lib/recycling.test.ts` (new), `packages/api/tests/integration/orgs/recycling-intake.test.ts` (new), `packages/mobile/tests/unit/components/recycling/intake-screen.test.tsx`, `packages/mobile/tests/unit/lib/recycling.test.ts`, `packages/web/tests/unit/components/recycling-intake.test.tsx` (new)

**Interfaces:**
- Consumes: `kgToGrams`, `estimatedCreditGrams`, `MIN_DROPOFF_GRAMS` (types).
- Produces: `intakeCredit(weighedKg: string, credit: string | null): { ok: true; weighed_grams: number; credit_grams: number; line: string } | { ok: false; line: string }` — `credit` is the credit box's text, or null while the leader has not touched it (then it follows the weight); `weighedInLine(weighedGrams: number, creditGrams: number, who: string): string`. `PATCH` with `status: 'received'` and `weighed_grams < 2000` → 400 "Under the 2 kg minimum — log it as a donation or hand it back." (Controller ruling 4). Mobile `intakeProblem` is deleted.

Copy (MB/WB, identical): "Actual", "kg", "{g} g credit", "Weigh it to see the credit", "Contaminated", "Weigh and credit", toast "Weighed at {kg} kg — {g} g credit issued to {who}", "Under the 2 kg minimum — log it as a donation or hand it back". No board: "Enter the credit in whole grams.", the credit box's unit "g" (the board has no credit box; decided 2026-09-30).

- [ ] **Step 1: Write the failing tests**

`packages/web/tests/unit/lib/recycling.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { intakeCredit, weighedInLine } from '@splat-connect/types'

describe('intakeCredit', () => {
  it('waits for a weight', () => {
    expect(intakeCredit('', null)).toEqual({ ok: false, line: 'Weigh it to see the credit' })
    expect(intakeCredit('0', null)).toEqual({ ok: false, line: 'Weigh it to see the credit' })
  })

  it('prefills three quarters of the weight while the credit box is untouched', () => {
    expect(intakeCredit('2.6', null)).toEqual({ ok: true, weighed_grams: 2600, credit_grams: 1950, line: '1950 g credit' })
  })

  it('keeps what the leader typed when the weight changes', () => {
    expect(intakeCredit('3', '2000')).toEqual({ ok: true, weighed_grams: 3000, credit_grams: 2000, line: '2000 g credit' })
    expect(intakeCredit('4', '2000')).toMatchObject({ ok: true, credit_grams: 2000 })
  })

  it('refuses under the two-kilo floor in the board’s words', () => {
    expect(intakeCredit('1.5', null)).toEqual({
      ok: false,
      line: 'Under the 2 kg minimum — log it as a donation or hand it back',
    })
  })

  it('never sends a cleared or fractional credit as a number', () => {
    expect(intakeCredit('3', '')).toEqual({ ok: false, line: 'Enter the credit in whole grams.' })
    expect(intakeCredit('3', '12.5')).toEqual({ ok: false, line: 'Enter the credit in whole grams.' })
  })

  it('holds a credit above the weight', () => {
    expect(intakeCredit('2', '2500')).toEqual({ ok: false, line: 'Credit cannot be more than what was weighed.' })
    expect(intakeCredit('2', '2000')).toMatchObject({ ok: true, credit_grams: 2000 })
    expect(intakeCredit('2', '0')).toMatchObject({ ok: true, credit_grams: 0 })
  })
})

describe('weighedInLine', () => {
  it('is the board’s toast', () => {
    expect(weighedInLine(2600, 1950, 'Tom Beattie')).toBe('Weighed at 2.6 kg — 1950 g credit issued to Tom Beattie')
  })
})
```

`packages/api/tests/integration/orgs/recycling-intake.test.ts`:

```ts
/**
 * The intake rule's server half: nothing under the two-kilo floor is credited,
 * whatever the client sends. The credit is the leader's number, not a yield.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { DECLARATION_VERSION } from '@splat-connect/types'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader } from '../../helpers/orgs.js'

let leader: TestUser
let family: TestUser
let orgId: string
let dropId: string

const json = (token: string, method: string, body: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

beforeAll(async () => {
  ;[leader, family] = await Promise.all([createTestUser('contributor'), createTestUser('contributor')])
  orgId = await createOrg({ createdBy: leader.id })
  await addLeader(orgId, leader.id)
  const { data } = await adminClient()
    .from('recycling_dropoffs')
    .insert({ org_id: orgId, contributor_id: family.id, material: 'PLA', estimated_grams: 2500, condition_declared: true, declaration_version: DECLARATION_VERSION })
    .select('id')
    .single()
  dropId = data!.id
})

afterAll(async () => {
  await adminClient().from('recycling_dropoffs').delete().eq('org_id', orgId)
  await adminClient().from('organizations').delete().eq('id', orgId)
  await Promise.all([deleteTestUser(leader.id), deleteTestUser(family.id)])
})

describe('weighing in', () => {
  it('refuses to credit anything under two kilos', async () => {
    const res = await app.request(
      `/api/organizations/${orgId}/recycling/${dropId}`,
      json(leader.token, 'PATCH', { status: 'received', weighed_grams: 1500, credit_grams: 1100 })
    )
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toBe('Under the 2 kg minimum — log it as a donation or hand it back.')
  })

  it('stores the credit the leader entered, not three quarters', async () => {
    const res = await app.request(
      `/api/organizations/${orgId}/recycling/${dropId}`,
      json(leader.token, 'PATCH', { status: 'received', weighed_grams: 2600, credit_grams: 2100 })
    )
    expect(res.status).toBe(200)
    expect(((await res.json()) as { credit_grams: number }).credit_grams).toBe(2100)
  })
})
```

`packages/mobile/tests/unit/components/recycling/intake-screen.test.tsx`:
- Replace the test 'weighs and credits in grams, and holds the button while credit exceeds the weight' with:

```tsx
it('prefills the credit from the weight, sends what the box holds, and says so', async () => {
  route([drop({})])
  render(<IntakeScreen />)
  expect(await screen.findByText('Tom Beattie')).toBeTruthy()
  expect(screen.getByText('Weigh it to see the credit')).toBeTruthy()

  fireEvent.changeText(screen.getByLabelText('Actual, in kilograms'), '2.6')
  expect(screen.getByLabelText('Credit, in grams').props.value).toBe('1950')
  expect(screen.getByText('1950 g credit')).toBeTruthy()

  fireEvent.press(screen.getByLabelText("Weigh and credit Tom Beattie's drop-off"))
  await waitFor(() =>
    expect(mockPatch).toHaveBeenCalledWith('/api/organizations/org1/recycling/d1', {
      status: 'received',
      weighed_grams: 2600,
      credit_grams: 1950,
    })
  )
  expect(await screen.findByText('Weighed at 2.6 kg — 1950 g credit issued to Tom Beattie')).toBeTruthy()
})

it('keeps an edited credit when the weight changes, and holds the button above the weight', async () => {
  route([drop({})])
  render(<IntakeScreen />)
  await screen.findByText('Tom Beattie')
  fireEvent.changeText(screen.getByLabelText('Actual, in kilograms'), '3')
  fireEvent.changeText(screen.getByLabelText('Credit, in grams'), '2000')
  fireEvent.changeText(screen.getByLabelText('Actual, in kilograms'), '4')
  expect(screen.getByLabelText('Credit, in grams').props.value).toBe('2000')

  fireEvent.changeText(screen.getByLabelText('Actual, in kilograms'), '1.8')
  expect(screen.getByText('Under the 2 kg minimum — log it as a donation or hand it back')).toBeTruthy()
  const confirm = screen.getByLabelText("Weigh and credit Tom Beattie's drop-off")
  expect(confirm.props.accessibilityState.disabled).toBe(true)

  fireEvent.changeText(screen.getByLabelText('Actual, in kilograms'), '2')
  fireEvent.changeText(screen.getByLabelText('Credit, in grams'), '2500')
  expect(screen.getByText('Credit cannot be more than what was weighed.')).toBeTruthy()
  expect(confirm.props.accessibilityState.disabled).toBe(true)
})
```

`packages/mobile/tests/unit/lib/recycling.test.ts`: delete `intakeProblem` from the import and the whole `describe('intakeProblem', …)` block (the rule moved to `@splat-connect/types`, tested in web's `recycling.test.ts`).

`packages/web/tests/unit/components/recycling-intake.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RecyclingIntake } from '@/components/recycling-intake'
import { browserApiClient } from '@/lib/browser-api-client'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { patch: vi.fn() } }))

const DROP = {
  id: 'd1', org_id: 'org1', contributor_id: 'tom', material: 'PLA', estimated_grams: 2600,
  condition_declared: true, declaration_version: 'v1-2026-09', photo_url: null, note: null,
  status: 'booked' as const, weighed_grams: null, credit_grams: null, decided_by: null,
  created_at: '2026-09-20T00:00:00Z', updated_at: '2026-09-20T00:00:00Z',
}

describe('RecyclingIntake', () => {
  beforeEach(() => vi.clearAllMocks())

  it('prefills the credit at three quarters, sends what the box holds, and says so', async () => {
    vi.mocked(browserApiClient.patch).mockResolvedValue({})
    render(<RecyclingIntake orgId="org1" dropoffs={[DROP]} names={{ tom: 'Tom Beattie' }} />)
    expect(screen.getByText('Weigh it to see the credit')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Actual, in kilograms'), { target: { value: '2.6' } })
    expect(screen.getByLabelText('Credit, in grams')).toHaveValue('1950')
    expect(screen.getByText('1950 g credit')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Weigh and credit/ }))
    await waitFor(() =>
      expect(browserApiClient.patch).toHaveBeenCalledWith('/api/organizations/org1/recycling/d1', {
        status: 'received',
        weighed_grams: 2600,
        credit_grams: 1950,
      })
    )
    expect(await screen.findByText('Weighed at 2.6 kg — 1950 g credit issued to Tom Beattie')).toBeInTheDocument()
  })

  it('holds the button under two kilos, in the board’s words', () => {
    render(<RecyclingIntake orgId="org1" dropoffs={[DROP]} names={{ tom: 'Tom Beattie' }} />)
    fireEvent.change(screen.getByLabelText('Actual, in kilograms'), { target: { value: '1.5' } })
    expect(screen.getByText('Under the 2 kg minimum — log it as a donation or hand it back')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Weigh and credit/ })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/recycling.test.ts tests/unit/components/recycling-intake.test.tsx` → FAIL (`intakeCredit` is not exported).
Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/orgs/recycling-intake.test.ts` → FAIL (the 1500 g PATCH answers 200).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/recycling/intake-screen.test.tsx` → FAIL (no 'Credit, in grams').

- [ ] **Step 3: The shared rule**

In `packages/types/src/index.ts`, after `estimatedCreditGrams`:

```ts
/**
 * The intake row (decided 2026-09-30): one weight box, and the credit
 * prefilled at the estimate for the leader to change. `credit` is the credit
 * box's text, or null while they have not touched it — then it follows the
 * weight. The ledger stores what the leader sends, never a yield. `line` is
 * what the row says under the boxes, in the board's words where it has them.
 */
export function intakeCredit(
  weighedKg: string,
  credit: string | null
): { ok: true; weighed_grams: number; credit_grams: number; line: string } | { ok: false; line: string } {
  const weighed = kgToGrams(weighedKg)
  if (!weighed) return { ok: false, line: 'Weigh it to see the credit' }
  if (weighed < MIN_DROPOFF_GRAMS) {
    return { ok: false, line: `Under the ${MIN_DROPOFF_GRAMS / 1000} kg minimum — log it as a donation or hand it back` }
  }
  const text = credit === null ? String(estimatedCreditGrams(weighed)) : credit.trim()
  if (!/^\d{1,7}$/.test(text)) return { ok: false, line: 'Enter the credit in whole grams.' }
  const grams = Number(text)
  if (grams > weighed) return { ok: false, line: 'Credit cannot be more than what was weighed.' }
  return { ok: true, weighed_grams: weighed, credit_grams: grams, line: `${grams} g credit` }
}

/** The board's toast once a drop-off is weighed in. */
export const weighedInLine = (weighedGrams: number, creditGrams: number, who: string) =>
  `Weighed at ${weighedGrams / 1000} kg — ${creditGrams} g credit issued to ${who}`
```

- [ ] **Step 4: The API**

In `organizations.ts`, `PATCH /:orgId/recycling/:id`, after the `credit > weighed` check:

```ts
    // The board's floor at the door, as at booking: under two kilos is not a
    // drop-off to credit. A client that skips the screen's rule meets it here.
    if ((weighed as number) < MIN_DROPOFF_GRAMS) {
      return c.json({ error: 'Under the 2 kg minimum — log it as a donation or hand it back.' }, 400)
    }
```

and in its docblock replace "both the leader's, and the yield between them is theirs to apply rather than a constant here. About three quarters is typical, and "typical" is not a number to put in a ledger." with "both the leader's: the screens prefill the credit at about three quarters (intakeCredit) and send whatever the leader leaves in the box. Nothing under two kilos is credited."

- [ ] **Step 5: Mobile**

`packages/mobile/lib/recycling.ts`: delete `intakeProblem` and its docblock; the import line becomes `import { MIN_DROPOFF_GRAMS, RECYCLING_DECLARATION } from '@splat-connect/types'`; in the file's header comment, drop "components/recycling-intake.tsx" from the mirrored list and add "The intake rule itself is intakeCredit in @splat-connect/types, shared with web."

`packages/mobile/components/recycling/intake-screen.tsx`:
- Delete the `// PENDING(recycling-intake-credit-rule): …` line.
- Header comment: replace the paragraph "Credit is minted here … intakeProblem refuses it first." with:

```
 * Credit is minted here, by weighing, and never by the contributor. One
 * weight box; the credit box is prefilled at about three quarters and is the
 * leader's to change (decided 2026-09-30). intakeCredit (@splat-connect/types)
 * is the rule, shared with web; the API repeats the two-kilo floor and the
 * credit-within-weight limit.
```

- Imports: from `@splat-connect/types` drop `estimatedCreditGrams` and `kgToGrams`, add `intakeCredit, weighedInLine`; from `../../lib/recycling` drop `intakeProblem`; add `import { FlashLine, useFlash } from '../ui/Flash'`.
- In `IntakeScreen`: `const [flash, setFlash] = useFlash()`; render `<FlashLine message={flash} />` directly after the lead `<Text>`; `BookedRow`'s `onDone` becomes `onDone={(line) => { if (line) setFlash(line); load() }}`.
- Replace `KgBox` with:

```tsx
function NumberBox({
  label,
  unit,
  value,
  onChange,
}: {
  label: string
  unit: 'kg' | 'g'
  value: string
  onChange: (v: string) => void
}) {
  return (
    <View style={styles.kgBox}>
      <Text style={styles.kgLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={unit === 'kg' ? '0.0' : '0'}
        placeholderTextColor={theme.colors.muted}
        keyboardType={unit === 'kg' ? 'decimal-pad' : 'number-pad'}
        accessibilityLabel={`${label}, in ${unit === 'kg' ? 'kilograms' : 'grams'}`}
        style={styles.kgInput}
      />
      <Text style={styles.kgLabel}>{unit}</Text>
    </View>
  )
}
```

- In `BookedRow`: the prop type's `onDone: () => void` becomes `onDone: (line?: string) => void`; replace the state and checks from `const [weighed, setWeighed] = useState('')` through `const weighedGrams = kgToGrams(weighed)` with:

```tsx
  const [weighed, setWeighed] = useState('')
  // null until the leader types in the credit box: until then it follows the weight.
  const [credit, setCredit] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const check = intakeCredit(weighed, credit)
  const shownCredit = credit ?? (check.ok ? String(check.credit_grams) : '')
```

- `decide`: replace `if (status === 'received' && !check.ok) { setError(check.message); return }` with `if (status === 'received' && !check.ok) { setError(check.line); return }`, and `onDone()` with `onDone(status === 'received' && check.ok ? weighedInLine(check.weighed_grams, check.credit_grams, name) : undefined)`.
- Replace the `kgRow` block and the "About … is typical" `<Text>` with:

```tsx
      <View style={styles.kgRow}>
        <NumberBox label="Actual" unit="kg" value={weighed} onChange={setWeighed} />
        <NumberBox label="Credit" unit="g" value={shownCredit} onChange={setCredit} />
      </View>
      <Text style={styles.meta}>{check.line}</Text>
```

`packages/web/components/recycling-intake.tsx`:
- Header comment: replace the two paragraphs after the first line with:

```
 * Credit is minted here, by weighing — never by the contributor. 059 splits
 * the insert policy from the update policy so a contributor cannot write
 * `credit_grams` at all; the API refuses a credit larger than the weight and
 * anything under two kilos.
 *
 * One weight box; the credit box is prefilled at about three quarters and is
 * the leader's to change (decided 2026-09-30). intakeCredit
 * (@splat-connect/types) is the rule, shared with the phone.
```

- Import `intakeCredit, weighedInLine` from `@splat-connect/types` (beside `initials`).
- Replace `KgInput` with:

```tsx
/** The board's inline number box: mono, 46px, on the canvas. */
function NumberInput({
  label,
  unit,
  value,
  onChange,
}: {
  label: string
  unit: 'kg' | 'g'
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="inline-flex flex-none items-center gap-2 text-sm font-extrabold text-ink">
      {label}
      <input
        aria-label={`${label}, in ${unit === 'kg' ? 'kilograms' : 'grams'}`}
        className="h-[46px] w-[88px] rounded-field border-(length:--border-width) border-line bg-canvas px-3 font-mono text-[15px] font-bold tabular-nums text-ink"
        inputMode={unit === 'kg' ? 'decimal' : 'numeric'}
        placeholder={unit === 'kg' ? '0.0' : '0'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {unit}
    </label>
  )
}
```

- In `BookedRow`: `onDone: () => void` becomes `onDone: (line?: string) => void`; replace the state and the `weighedGrams`/`creditGrams`/`valid` lines with:

```tsx
  const [weighed, setWeighed] = useState('')
  const [credit, setCredit] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const check = intakeCredit(weighed, credit)
  const shownCredit = credit ?? (check.ok ? String(check.credit_grams) : '')
```

- In `decide`: the patch body's received branch becomes `...(status === 'received' && check.ok ? { weighed_grams: check.weighed_grams, credit_grams: check.credit_grams } : {})`; `onDone()` becomes `onDone(status === 'received' && check.ok ? weighedInLine(check.weighed_grams, check.credit_grams, name) : undefined)`.
- Replace the two `KgInput`s and the "About three quarters…" `<span>` with:

```tsx
      <NumberInput label="Actual" unit="kg" value={weighed} onChange={setWeighed} />
      <NumberInput label="Credit" unit="g" value={shownCredit} onChange={setCredit} />
      <span className="flex-[1_1_150px] text-[13px] font-bold text-muted">{check.line}</span>
```

- The confirm button's `disabled={pending || !valid || weighed === '' || credit === ''}` becomes `disabled={pending || !check.ok}`.
- In `RecyclingIntake`: `const [done, setDone] = useState<string | null>(null)`; the `onDone` prop becomes `onDone={(line) => { setDone(line ?? null); router.refresh() }}`; under the "Booked in" intro `<p>` add:

```tsx
        {done && (
          <p role="status" className="mb-4 text-sm font-bold text-ink">
            {done}
          </p>
        )}
```

- [ ] **Step 6: Run the tests to see them pass**

Run the three Step 2 commands, then `pnpm --filter @splat-connect/mobile exec jest tests/unit/lib/recycling.test.ts`. Expected: PASS.

- [ ] **Step 7: Ship the item** — `shipped: true,` on `'recycling-intake-credit-rule'`; `git grep -n "recycling-intake-credit-rule" -- packages scripts ':!packages/types/src/pending.ts' ':!*report.json'` → no output; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 8: Commit**

```bash
git status --short
git add packages/types/src/index.ts packages/api/src/routes/organizations.ts packages/mobile/lib/recycling.ts packages/mobile/components/recycling/intake-screen.tsx packages/web/components/recycling-intake.tsx packages/web/tests/unit/lib/recycling.test.ts packages/web/tests/unit/components/recycling-intake.test.tsx packages/api/tests/integration/orgs/recycling-intake.test.ts packages/mobile/tests/unit/components/recycling/intake-screen.test.tsx packages/mobile/tests/unit/lib/recycling.test.ts packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(recycling): one weight box at intake, the credit prefilled at three quarters and the leader's to change

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 4: What each recycler takes — columns, editor write and the booking limits (`org-recycling-details`, part 1 of 2, migration 113)

**Files:**
- Create: `supabase/migrations/113_org_recycling_details.sql`
- Modify: `packages/types/src/index.ts` (`RECYCLING_MACHINES`, `RECYCLING_FORMS`, `RecyclingGives`, `RECYCLING_GIVES`, `recyclingPerDrop`; `Organization` and `OrgPublicProfile` fields)
- Modify: `packages/api/src/routes/organizations.ts` (`ORG_COLUMNS`, `PATCH /:id/profile`, `POST /:id/recycling`)
- Modify: `packages/api/src/routes/public.ts` (`GET /organizations`, `GET /organizations/:id` selects)
- Test: `packages/api/tests/integration/orgs/recycling-details.test.ts` (new), `packages/web/tests/unit/lib/recycling.test.ts`

**Interfaces:**
- Consumes: 059's `recycling_materials`, `recycling_note`; `MIN_DROPOFF_GRAMS`.
- Produces: `organizations.recycling_machines text[]`, `recycling_forms text[]`, `recycling_min_kg numeric(5,1)`, `recycling_max_kg numeric(5,1)`, `recycling_turnaround text`, `recycling_gives text` ('credit' default), `recycling_hours text`, `recycling_door text` — on `Organization` and `OrgPublicProfile` as optional fields of the same names (`recycling_gives?: RecyclingGives`), returned by `GET /api/organizations/:id`, `GET /api/public/organizations` and `GET /api/public/organizations/:id`, written by `PATCH /api/organizations/:id/profile`. `recyclingPerDrop(o: { recycling_min_kg?: number | null; recycling_max_kg?: number | null; recycling_turnaround?: string | null }): string`. `POST /:id/recycling` → 400 "{org} takes at most {max} kg at once." / "{org} takes at least {min} kg at once.". Task 5 draws all of it.

- [ ] **Step 1: Write the failing tests**

Append to `packages/web/tests/unit/lib/recycling.test.ts` (and add `recyclingPerDrop, RECYCLING_MACHINES, RECYCLING_FORMS` to its import):

```ts
describe('recyclingPerDrop', () => {
  it('is the board’s range and turnaround', () => {
    expect(recyclingPerDrop({ recycling_min_kg: 2, recycling_max_kg: 8, recycling_turnaround: 'About 3 weeks' })).toBe('2–8 kg · About 3 weeks')
  })
  it('stands the platform floor in for an unset minimum', () => {
    expect(recyclingPerDrop({ recycling_max_kg: 5 })).toBe('2–5 kg')
  })
  it('reads "From" without a maximum', () => {
    expect(recyclingPerDrop({})).toBe('From 2 kg')
    expect(recyclingPerDrop({ recycling_min_kg: 3, recycling_turnaround: 'One school term' })).toBe('From 3 kg · One school term')
  })
})

describe('the board’s chip lists', () => {
  it('are the board’s five machines and five forms', () => {
    expect(RECYCLING_MACHINES).toEqual(['Shredder', 'Extruder', 'Filament dryer', 'Injection moulder', 'Sheet press'])
    expect(RECYCLING_FORMS).toEqual(['Failed prints', 'Offcuts', 'Sprues and rafts', 'Bottle caps', 'Clean packaging'])
  })
})
```

`packages/api/tests/integration/orgs/recycling-details.test.ts`:

```ts
/**
 * 113: what a recycler takes, on the organisation, public by design. Limits
 * twice — a sentence from the API and a CHECK — and the booking honours them.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import app from '../../../src/app.js'
import { DECLARATION_VERSION } from '@splat-connect/types'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader } from '../../helpers/orgs.js'

let leader: TestUser
let family: TestUser
let orgId: string

const json = (token: string, method: string, body?: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})
const patch = (body: unknown) => app.request(`/api/organizations/${orgId}/profile`, json(leader.token, 'PATCH', body))
const book = (grams: number) =>
  app.request(
    `/api/organizations/${orgId}/recycling`,
    json(family.token, 'POST', { material: 'PLA', estimated_grams: grams, condition_declared: true, declaration_version: DECLARATION_VERSION })
  )
const DETAILS = {
  recycling_machines: ['Shredder', 'Extruder'],
  recycling_forms: ['Failed prints', 'Offcuts'],
  recycling_min_kg: 3,
  recycling_max_kg: 8,
  recycling_turnaround: 'About 3 weeks',
  recycling_gives: 'either',
  recycling_hours: 'Tue and Thu, 9am–4pm',
  recycling_door: 'Loading door on Corella Lane — ring the bell',
}

beforeAll(async () => {
  ;[leader, family] = await Promise.all([createTestUser('contributor'), createTestUser('contributor')])
  orgId = await createOrg({ createdBy: leader.id, name: `Northside ${Date.now()}` })
  await addLeader(orgId, leader.id)
  await adminClient().from('organizations').update({ recycling_materials: ['PLA'] }).eq('id', orgId)
})

afterAll(async () => {
  await adminClient().from('recycling_dropoffs').delete().eq('org_id', orgId)
  await adminClient().from('organizations').delete().eq('id', orgId)
  await Promise.all([deleteTestUser(leader.id), deleteTestUser(family.id)])
})

describe('113 recycling details', () => {
  it('lets a leader publish them, and anyone read them', async () => {
    const res = await patch(DETAILS)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject(DETAILS)

    const anon = createClient(process.env.SUPABASE_URL ?? 'http://localhost:54321', process.env.SUPABASE_ANON_KEY ?? '')
    const { data, error } = await anon
      .from('organizations')
      .select('recycling_machines, recycling_forms, recycling_min_kg, recycling_max_kg, recycling_turnaround, recycling_gives, recycling_hours, recycling_door')
      .eq('id', orgId)
      .single()
    expect(error).toBeNull()
    expect(data).toMatchObject(DETAILS)

    const pub = (await (await app.request(`/api/public/organizations/${orgId}`)).json()) as Record<string, unknown>
    expect(pub).toMatchObject(DETAILS)
    const list = (await (await app.request('/api/public/organizations')).json()) as Array<Record<string, unknown>>
    expect(list.find((o) => o.id === orgId)).toMatchObject({ recycling_max_kg: 8, recycling_gives: 'either' })
  })

  it.each([
    [{ recycling_machines: ['Kiln'] }, 'recycling_machines must come from the list'],
    [{ recycling_forms: ['Tyres'] }, 'recycling_forms must come from the list'],
    [{ recycling_min_kg: 1.5 }, 'The platform floor is 2 kg. You can ask for more, never less.'],
    [{ recycling_max_kg: 2.25 }, 'Per drop is between 2 and 1000 kg, to one decimal place.'],
    [{ recycling_max_kg: 2.5 }, 'The maximum per drop cannot be under the minimum.'],
    [{ recycling_gives: 'cash' }, 'recycling_gives must be credit, spool or either'],
    [{ recycling_door: 'x'.repeat(121) }, 'recycling_door is longer than 120 characters'],
  ])('refuses %j', async (body, message) => {
    const res = await patch(body)
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toBe(message)
  })

  it('backs the max-over-min rule with a CHECK', async () => {
    const { error } = await adminClient().from('organizations').update({ recycling_max_kg: 2.5 }).eq('id', orgId)
    expect(error?.code).toBe('23514')
  })

  it('refuses a booking over the maximum or under the organisation’s minimum', async () => {
    const over = await book(9000)
    expect(over.status).toBe(400)
    expect(((await over.json()) as { error: string }).error).toMatch(/takes at most 8 kg at once\.$/)
    const under = await book(2500)
    expect(under.status).toBe(400)
    expect(((await under.json()) as { error: string }).error).toMatch(/takes at least 3 kg at once\.$/)
    expect((await book(5000)).status).toBe(201)
  })

  it('takes any weight from the floor up once the maximum is cleared', async () => {
    expect((await patch({ recycling_max_kg: null, recycling_min_kg: null })).status).toBe(200)
    expect((await book(40000)).status).toBe(201)
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/recycling.test.ts` → FAIL (`recyclingPerDrop` is not exported).
Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/orgs/recycling-details.test.ts` → FAIL (column `recycling_machines` does not exist).

- [ ] **Step 3: Write the migration**

`supabase/migrations/113_org_recycling_details.sql`:

```sql
-- 113 — what each recycler takes (org-recycling-details).
--
-- 059 stored only polymers and a free-text note; the board draws machines,
-- forms, a per-drop minimum and maximum, turnaround, what the contributor gets
-- back, hours and the door. All public by design — they are what a
-- contributor reads before packing a box — so they join 059's anon grant.
-- The chip lists are presentational and live in packages/types (037's rule
-- about contact_prefs); the database bounds only their size.
--
-- The minimum may only raise the platform floor (MIN_DROPOFF_GRAMS, 2 kg):
-- "You can ask for more, never less."
--
-- DOWN:
--   alter table public.organizations
--     drop constraint if exists organizations_recycling_max_over_min,
--     drop column if exists recycling_door, drop column if exists recycling_hours,
--     drop column if exists recycling_gives, drop column if exists recycling_turnaround,
--     drop column if exists recycling_max_kg, drop column if exists recycling_min_kg,
--     drop column if exists recycling_forms, drop column if exists recycling_machines;

alter table public.organizations
  add column recycling_machines text[] not null default '{}'
    check (cardinality(recycling_machines) <= 10),
  add column recycling_forms text[] not null default '{}'
    check (cardinality(recycling_forms) <= 10),
  add column recycling_min_kg numeric(5,1)
    check (recycling_min_kg is null or recycling_min_kg between 2 and 1000),
  add column recycling_max_kg numeric(5,1)
    check (recycling_max_kg is null or recycling_max_kg between 2 and 1000),
  add column recycling_turnaround text
    check (recycling_turnaround is null or length(btrim(recycling_turnaround)) <= 60),
  add column recycling_gives text not null default 'credit'
    check (recycling_gives in ('credit', 'spool', 'either')),
  add column recycling_hours text
    check (recycling_hours is null or length(btrim(recycling_hours)) <= 80),
  add column recycling_door text
    check (recycling_door is null or length(btrim(recycling_door)) <= 120),
  add constraint organizations_recycling_max_over_min
    check (recycling_max_kg is null or recycling_max_kg >= coalesce(recycling_min_kg, 2));

grant select (
  recycling_machines, recycling_forms, recycling_min_kg, recycling_max_kg,
  recycling_turnaround, recycling_gives, recycling_hours, recycling_door
) on public.organizations to anon, authenticated;
```

Run: `supabase migration up` → `Applying migration 113_org_recycling_details.sql...`

- [ ] **Step 4: Types**

In `packages/types/src/index.ts`, after `weighedInLine` (Task 3):

```ts
/** The board's "What you can take" chips (113). Presentational, so a list here
 *  rather than a CHECK. */
export const RECYCLING_MACHINES = ['Shredder', 'Extruder', 'Filament dryer', 'Injection moulder', 'Sheet press'] as const
export const RECYCLING_FORMS = ['Failed prints', 'Offcuts', 'Sprues and rafts', 'Bottle caps', 'Clean packaging'] as const
/** What a contributor gets back for a drop-off (113). Credit by default. */
export type RecyclingGives = 'credit' | 'spool' | 'either'
export const RECYCLING_GIVES: RecyclingGives[] = ['credit', 'spool', 'either']

/**
 * The board's "Per drop" line: "2–8 kg · About 3 weeks". The platform floor
 * stands in for an unset minimum; with no maximum it reads "From 2 kg".
 */
export function recyclingPerDrop(o: {
  recycling_min_kg?: number | null
  recycling_max_kg?: number | null
  recycling_turnaround?: string | null
}): string {
  const min = o.recycling_min_kg ?? MIN_DROPOFF_GRAMS / 1000
  const range = o.recycling_max_kg != null ? `${min}–${o.recycling_max_kg} kg` : `From ${min} kg`
  return [range, o.recycling_turnaround].filter(Boolean).join(' · ')
}
```

In `interface Organization`, after `recycling_note?: string | null`, and in `interface OrgPublicProfile`, after its `recycling_note?: string | null`:

```ts
  /** 113. What the recycler takes, beyond polymers. Public by design. */
  recycling_machines?: string[]
  recycling_forms?: string[]
  recycling_min_kg?: number | null
  recycling_max_kg?: number | null
  recycling_turnaround?: string | null
  recycling_gives?: RecyclingGives
  recycling_hours?: string | null
  recycling_door?: string | null
```

- [ ] **Step 5: The API**

`organizations.ts`:
- Import `RECYCLING_MACHINES, RECYCLING_FORMS, RECYCLING_GIVES` from `@splat-connect/types`.
- `ORG_COLUMNS` (one literal, as its comment requires) gains, after `recycling_note`: `, recycling_machines, recycling_forms, recycling_min_kg, recycling_max_kg, recycling_turnaround, recycling_gives, recycling_hours, recycling_door`.
- `PATCH /:id/profile`: in the second `text()` loop's list (`kind`, `visit_hours`, `service_area`) add `['recycling_turnaround', 60], ['recycling_hours', 80], ['recycling_door', 120],`. After the `capabilities`/`recycling_materials` loop add:

```ts
  // 113. Chips from the board's lists only; a leader cannot invent a machine.
  for (const [field, allowed] of [
    ['recycling_machines', RECYCLING_MACHINES],
    ['recycling_forms', RECYCLING_FORMS],
  ] as const) {
    if (!Object.hasOwn(body, field)) continue
    const value = body[field]
    if (!Array.isArray(value) || value.some((v) => !(allowed as readonly unknown[]).includes(v))) {
      return c.json({ error: `${field} must come from the list` }, 400)
    }
    patch[field] = [...new Set(value as string[])]
  }

  if (Object.hasOwn(body, 'recycling_gives')) {
    if (!RECYCLING_GIVES.includes(body.recycling_gives as never)) {
      return c.json({ error: 'recycling_gives must be credit, spool or either' }, 400)
    }
    patch.recycling_gives = body.recycling_gives
  }

  // 113. Kilos to one decimal; the minimum may only raise the platform floor.
  for (const field of ['recycling_min_kg', 'recycling_max_kg'] as const) {
    if (!Object.hasOwn(body, field)) continue
    const value = body[field]
    if (value === null) {
      patch[field] = null
      continue
    }
    if (typeof value !== 'number' || !/^\d{1,4}(\.\d)?$/.test(String(value)) || value > 1000) {
      return c.json({ error: 'Per drop is between 2 and 1000 kg, to one decimal place.' }, 400)
    }
    if (value < MIN_DROPOFF_GRAMS / 1000) {
      return c.json({ error: 'The platform floor is 2 kg. You can ask for more, never less.' }, 400)
    }
    patch[field] = value
  }
  if (Object.hasOwn(patch, 'recycling_min_kg') || Object.hasOwn(patch, 'recycling_max_kg')) {
    const { data: current } = await createAdminClient()
      .from('organizations')
      .select('recycling_min_kg, recycling_max_kg')
      .eq('id', orgId)
      .maybeSingle()
    const min = (Object.hasOwn(patch, 'recycling_min_kg') ? patch.recycling_min_kg : current?.recycling_min_kg) as number | null
    const max = (Object.hasOwn(patch, 'recycling_max_kg') ? patch.recycling_max_kg : current?.recycling_max_kg) as number | null
    if (max != null && max < (min ?? MIN_DROPOFF_GRAMS / 1000)) {
      return c.json({ error: 'The maximum per drop cannot be under the minimum.' }, 400)
    }
  }
```

- `POST /:id/recycling`: after `if (grams < MIN_DROPOFF_GRAMS) return …`:

```ts
  // 113. The organisation's own limits, inside the platform's.
  const { data: org } = await supabase
    .from('organizations')
    .select('name, recycling_min_kg, recycling_max_kg')
    .eq('id', c.req.param('id'))
    .maybeSingle()
  if (!org) return c.json({ error: 'Not found' }, 404)
  if (org.recycling_max_kg != null && grams > Math.round(org.recycling_max_kg * 1000)) {
    return c.json({ error: `${org.name} takes at most ${org.recycling_max_kg} kg at once.` }, 400)
  }
  if (org.recycling_min_kg != null && grams < Math.round(org.recycling_min_kg * 1000)) {
    return c.json({ error: `${org.name} takes at least ${org.recycling_min_kg} kg at once.` }, 400)
  }
```

`public.ts`:
- `GET /organizations`: the select becomes `'id, name, description, status, suburb, state, recycling_materials, recycling_note, recycling_machines, recycling_forms, recycling_min_kg, recycling_max_kg, recycling_turnaround, recycling_gives, recycling_hours, recycling_door'`; in the comment above it, "All four are public by design and granted in 059" becomes "All are public by design and granted in 059 and 113".
- `GET /organizations/:id`: append the same eight columns to the hand-written select string after `recycling_note`, and change its comment to "059's and 113's profile fields".

Run: `grep -rn "recycling_note" packages/mobile packages/web --include=*.ts --include=*.tsx | grep -v tests` and confirm each hit is a reader Task 5 lists.

- [ ] **Step 6: Run the tests to see them pass**

Run both Step 2 commands. Expected: PASS. Then `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/orgs/org-screens.test.ts tests/integration/public/organizations.test.ts` → PASS.

- [ ] **Step 7: Commit**

```bash
git status --short
git add supabase/migrations/113_org_recycling_details.sql packages/types/src/index.ts packages/api/src/routes/organizations.ts packages/api/src/routes/public.ts packages/api/tests/integration/orgs/recycling-details.test.ts packages/web/tests/unit/lib/recycling.test.ts
git commit -m "feat(recycling): machines, forms, per-drop limits, turnaround, what you get, hours and door on each recycler (113)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 5: What each recycler takes — editors, cards and booking hints (`org-recycling-details`, part 2 of 2)

**Files:**
- Modify: `packages/web/app/dashboard/organisation/recycling/what-you-take.tsx`, `packages/web/app/dashboard/organisation/recycling/page.tsx`
- Modify: `packages/web/components/dropoff-form.tsx` (`DropoffOrg`, the weight hint, the max)
- Modify: `packages/web/app/organizations/[id]/public/page.tsx` (`RecyclingCard`)
- Modify: `packages/mobile/lib/recycling.ts` (`TakerOrg`, `bookingProblem`)
- Modify: `packages/mobile/components/recycling/intake-screen.tsx` (`WhatYouTake`)
- Modify: `packages/mobile/components/recycling/recycling-screen.tsx` (org card, booking header and hint)
- Modify: `packages/mobile/components/organisation/org-profile-screen.tsx` (recycling panel)
- Modify: `packages/api/src/routes/organizations.ts` (delete the `PENDING(org-recycling-details)` comment)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/web/tests/unit/components/what-you-take.test.tsx` (new), `packages/web/tests/unit/components/dropoff-form-photo.test.tsx`, `packages/mobile/tests/unit/components/recycling/recycling-screen.test.tsx`, `packages/mobile/tests/unit/components/recycling/intake-screen.test.tsx`, `packages/mobile/tests/unit/components/organisation/org-profile-screen.test.tsx`, `packages/mobile/tests/unit/lib/recycling.test.ts`

**Interfaces:**
- Consumes: Task 4's columns, `RECYCLING_MACHINES`, `RECYCLING_FORMS`, `RecyclingGives`, `recyclingPerDrop`.
- Produces: `bookingProblem(input: { grams: number | null; material: string; ticked: number; minGrams?: number; maxGrams?: number | null; orgName?: string }): string | null`. `WhatYouTake` (web) takes `{ orgId: string; org: Organization }`.

Copy:
- Editor lead (WB, web): "Contributors see this before they pack a box. Be specific — every unlisted item is one somebody has to pick out by hand." (already on web). Mobile keeps MB's "Contributors see this before they pack a box. Every unlisted item is one somebody picks out by hand." (already there).
- Web editor labels (WB): "Machines you run", "Polymers accepted", "In what form", "Minimum per drop", "Maximum per drop", "kg", "Turnaround" (placeholder "About 3 weeks"), "What the contributor gets back" — "Print credit" / "A spool back" / "Either, their choice", "Drop-off hours" (placeholder "Tuesday and Thursday, 9am–4pm"), "Which door" (placeholder "Loading door on the lane, ring the bell"), "Save what you take". Min note: "The platform floor is 2 kg. You can ask for more, never less."
- Mobile editor labels (MB): "Machines", "Polymers", "In what form", "Minimum", "Maximum", the same min note, "Turnaround", "They get back" — "Print credit" / "A spool back" / "Either", "Drop-off hours", "Which door", "Save what you take".
- Mobile contributor card (MB): "Takes" "{polymers} · {forms}", "Machines", "Per drop", "You get" — "Print credit" / "A spool back" / "Credit or a spool", "When" "{hours} · {door}". Booking header (MB): "{hours} · {door} · {min–max} kg". Hints (MB): "Under the 2 kg minimum — hold on to it.", "{org} takes at most {max} kg at once.", "Between {min} and {max} kg. They weigh it again at the door."
- Mobile org profile (MB): "Polymers", "Form", "Per drop", "You get" — "Print credit on their machines" / "A spool to take home" / "Credit, or a spool", "When" (hours).
- Web org profile (WB): "Polymers", "In what form", "Machines", "Per drop", "You get" — "Print credit on their machines" / "A spool to take home" / "Credit, or a spool if you prefer", "When" (hours), then "{door}. They weigh it at the door and issue the credit against that weight."
- Web booking hints (WB): "Under the 2 kg minimum — hold on to it until you have 2 kg.", "{org} can take at most {max} kg in one drop. Split it across two.", "Between 2 and {max} kg. They weigh it again at the door — this is just so they can plan."
- `recycling_note` stays as free text below, everywhere.

- [ ] **Step 1: Write the failing tests**

`packages/web/tests/unit/components/what-you-take.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { WhatYouTake } from '@/app/dashboard/organisation/recycling/what-you-take'
import { browserApiClient } from '@/lib/browser-api-client'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { patch: vi.fn() } }))

const ORG = {
  id: 'o1', name: 'Northside', status: 'active', created_by: null, created_at: '', updated_at: '', description: null,
  recycling_materials: ['PLA'], recycling_note: 'Clean and dry.', recycling_machines: ['Extruder'], recycling_forms: [],
  recycling_min_kg: null, recycling_max_kg: 5, recycling_turnaround: null, recycling_gives: 'credit' as const,
  recycling_hours: null, recycling_door: null,
}

describe('WhatYouTake', () => {
  beforeEach(() => vi.clearAllMocks())

  it('publishes every field the board edits, in one PATCH', async () => {
    vi.mocked(browserApiClient.patch).mockResolvedValue({})
    render(<WhatYouTake orgId="o1" org={ORG as never} />)
    expect(screen.getByText('The platform floor is 2 kg. You can ask for more, never less.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Shredder' }))
    fireEvent.click(screen.getByRole('button', { name: 'Offcuts' }))
    fireEvent.change(screen.getByLabelText('Maximum per drop'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('Turnaround'), { target: { value: 'About 3 weeks' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Either, their choice' }))
    fireEvent.change(screen.getByLabelText('Drop-off hours'), { target: { value: 'Tue, 9am–4pm' } })
    fireEvent.change(screen.getByLabelText('Which door'), { target: { value: 'Back gate' } })
    fireEvent.click(screen.getByRole('button', { name: /Save what you take/ }))
    await waitFor(() =>
      expect(browserApiClient.patch).toHaveBeenCalledWith('/api/organizations/o1/profile', {
        recycling_materials: ['PLA'],
        recycling_note: 'Clean and dry.',
        recycling_machines: ['Extruder', 'Shredder'],
        recycling_forms: ['Offcuts'],
        recycling_min_kg: null,
        recycling_max_kg: 8,
        recycling_turnaround: 'About 3 weeks',
        recycling_gives: 'either',
        recycling_hours: 'Tue, 9am–4pm',
        recycling_door: 'Back gate',
      })
    )
  })

  it('will not send a weight it cannot read', async () => {
    render(<WhatYouTake orgId="o1" org={ORG as never} />)
    fireEvent.change(screen.getByLabelText('Minimum per drop'), { target: { value: 'two' } })
    fireEvent.click(screen.getByRole('button', { name: /Save what you take/ }))
    expect(await screen.findByText('Per drop is between 2 and 1000 kg, to one decimal place.')).toBeInTheDocument()
    expect(browserApiClient.patch).not.toHaveBeenCalled()
  })
})
```

Append to `packages/web/tests/unit/components/dropoff-form-photo.test.tsx`:

```tsx
describe('DropoffForm per-drop limits', () => {
  it('holds a weight over the organisation’s maximum, in the board’s words', () => {
    render(<DropoffForm orgs={[{ ...ORG, recycling_max_kg: 5 }]} />)
    expect(screen.getByText('Between 2 and 5 kg. They weigh it again at the door — this is just so they can plan.')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('2.0'), { target: { value: '6' } })
    expect(screen.getAllByText('Northside can take at most 5 kg in one drop. Split it across two.').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Book the drop-off/ })).toBeDisabled()
  })
})
```

`packages/mobile/tests/unit/components/recycling/recycling-screen.test.tsx`: in `ORGS`, the `north` entry gains `recycling_machines: ['Shredder', 'Extruder'], recycling_forms: ['Failed prints', 'Offcuts'], recycling_min_kg: 2, recycling_max_kg: 8, recycling_turnaround: 'About 3 weeks', recycling_gives: 'credit', recycling_hours: 'Tue and Thu, 9am–4pm', recycling_door: 'Loading door on Corella Lane'` and its `recycling_note` becomes `'Bring it sorted.'`. Append:

```tsx
it('draws the board’s card for each recycler, with the note below', async () => {
  render(<RecyclingScreen />)
  expect(await screen.findByText('PLA, PETG · Failed prints, Offcuts')).toBeTruthy()
  expect(screen.getByText('Shredder · Extruder')).toBeTruthy()
  expect(screen.getByText('2–8 kg · About 3 weeks')).toBeTruthy()
  expect(screen.getByText('Print credit')).toBeTruthy()
  expect(screen.getByText('Tue and Thu, 9am–4pm · Loading door on Corella Lane')).toBeTruthy()
  expect(screen.getByText('Bring it sorted.')).toBeTruthy()
})

it('holds a booking over the maximum', async () => {
  render(<RecyclingScreen />)
  fireEvent.press(await screen.findByLabelText('Book a drop-off at Northside Therapy'))
  expect(screen.getByText('Tue and Thu, 9am–4pm · Loading door on Corella Lane · 2–8 kg')).toBeTruthy()
  fireEvent.changeText(screen.getByLabelText('How much, roughly, in kilograms'), '9')
  expect(screen.getAllByText('Northside Therapy takes at most 8 kg at once.').length).toBeGreaterThan(0)
  for (const line of RECYCLING_DECLARATION) fireEvent.press(screen.getByLabelText(line))
  expect(screen.getByLabelText('Book the drop-off').props.accessibilityState.disabled).toBe(true)
})
```

`packages/mobile/tests/unit/components/recycling/intake-screen.test.tsx`: in `route`, the org returned becomes `{ id: 'org1', name: 'N', recycling_materials: ['PLA'], recycling_note: null, recycling_machines: [], recycling_forms: [], recycling_min_kg: null, recycling_max_kg: null, recycling_turnaround: null, recycling_gives: 'credit', recycling_hours: null, recycling_door: null }`. Append:

```tsx
it('publishes what the machines take, in one PATCH', async () => {
  route([])
  render(<IntakeScreen />)
  fireEvent.press(await screen.findByLabelText('Shredder'))
  fireEvent.press(screen.getByLabelText('Offcuts'))
  fireEvent.changeText(screen.getByLabelText('Maximum'), '8')
  fireEvent.press(screen.getByLabelText('A spool back'))
  fireEvent.changeText(screen.getByLabelText('Which door'), 'Back gate')
  fireEvent.press(screen.getByLabelText('Save what you take'))
  await waitFor(() =>
    expect(mockPatch).toHaveBeenCalledWith('/api/organizations/org1/profile', {
      recycling_materials: ['PLA'],
      recycling_note: '',
      recycling_machines: ['Shredder'],
      recycling_forms: ['Offcuts'],
      recycling_min_kg: null,
      recycling_max_kg: 8,
      recycling_turnaround: '',
      recycling_gives: 'spool',
      recycling_hours: '',
      recycling_door: 'Back gate',
    })
  )
})
```

`packages/mobile/tests/unit/components/organisation/org-profile-screen.test.tsx` — append inside `describe('OrgProfileScreen')`:

```tsx
  it('draws what the recycler takes in the board’s terms', async () => {
    mockGet.mockImplementation((path: string) =>
      Promise.resolve(
        path.startsWith('/api/public')
          ? {
              ...ORG,
              recycling_materials: ['PLA', 'PETG'],
              recycling_forms: ['Offcuts'],
              recycling_max_kg: 8,
              recycling_turnaround: 'About 3 weeks',
              recycling_gives: 'either',
              recycling_hours: 'Tue and Thu, 9am–4pm',
            }
          : relationship()
      )
    )
    render(<OrgProfileScreen id="o1" />)
    expect(await screen.findByText('They take waste plastic')).toBeTruthy()
    expect(screen.getByText('Offcuts')).toBeTruthy()
    expect(screen.getByText('2–8 kg · About 3 weeks')).toBeTruthy()
    expect(screen.getByText('Credit, or a spool')).toBeTruthy()
    expect(screen.getByText('Tue and Thu, 9am–4pm')).toBeTruthy()
  })
```

`packages/mobile/tests/unit/lib/recycling.test.ts` — in `describe('bookingProblem')` add:

```ts
  it('holds a drop under the organisation’s minimum or over its maximum', () => {
    expect(bookingProblem({ grams: 2500, material: 'PLA', ticked: all, minGrams: 3000 })).toBe('A drop needs to be at least 3 kg.')
    expect(bookingProblem({ grams: 9000, material: 'PLA', ticked: all, maxGrams: 8000, orgName: 'Northside' })).toBe('Northside takes at most 8 kg at once.')
    expect(bookingProblem({ grams: 8000, material: 'PLA', ticked: all, maxGrams: 8000, orgName: 'Northside' })).toBeNull()
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/components/what-you-take.test.tsx tests/unit/components/dropoff-form-photo.test.tsx` → FAIL.
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/recycling tests/unit/components/organisation/org-profile-screen.test.tsx tests/unit/lib/recycling.test.ts` → FAIL.

- [ ] **Step 3: Web editor**

`packages/web/app/dashboard/organisation/recycling/page.tsx`: replace the `<WhatYouTake orgId={orgId} materials={…} note={…} />` element with `<WhatYouTake orgId={orgId} org={org} />`; in the header comment, "059 puts `recycling_materials` and `recycling_note` on the organisation" becomes "059 and 113 put what the machines take on the organisation".

`packages/web/app/dashboard/organisation/recycling/what-you-take.tsx` — replace the whole file:

```tsx
'use client'
/**
 * "What you can take" — the board edits it in place, on the page a leader is
 * already on when a wrong box turns up.
 *
 * Every field the board draws has a column (059's polymers and note, 113's
 * machines, forms, per-drop limits, turnaround, what they get back, hours and
 * door). The polymers and note stay on the profile editor too; this PATCHes
 * only the recycling fields, and the route leaves every field it is not sent
 * alone.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowsSplit, Check, Coins, Package } from '@phosphor-icons/react/dist/ssr'
import type { Organization, RecyclingGives } from '@splat-connect/types'
import { PRINT_MATERIALS, RECYCLING_FORMS, RECYCLING_MACHINES } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'

const GIVES: Array<[RecyclingGives, string, typeof Coins]> = [
  ['credit', 'Print credit', Coins],
  ['spool', 'A spool back', Package],
  ['either', 'Either, their choice', ArrowsSplit],
]
const LABEL = 'mb-[7px] block text-sm font-extrabold text-ink'
const BAD_KG = 'Per drop is between 2 and 1000 kg, to one decimal place.'

/** '' is "not said"; anything else must read as kilos to one decimal. */
function kgValue(text: string): number | null | undefined {
  const t = text.trim()
  if (!t) return null
  return /^\d{1,4}(\.\d)?$/.test(t) ? Number(t) : undefined
}

function Chips({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string
  options: readonly string[]
  value: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <fieldset>
      <legend className="mb-[9px] text-sm font-extrabold text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((m) => {
          const on = value.includes(m)
          return (
            <button
              key={m}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== m) : [...value, m])}
              className={`min-h-11 rounded-full border-2 px-4 text-sm font-extrabold text-ink ${
                on ? 'border-brand-dark bg-brand-tint' : 'border-line bg-surface'
              }`}
            >
              {m}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export function WhatYouTake({ orgId, org }: { orgId: string; org: Organization }) {
  const router = useRouter()
  const [materials, setMaterials] = useState(org.recycling_materials ?? [])
  const [machines, setMachines] = useState(org.recycling_machines ?? [])
  const [forms, setForms] = useState(org.recycling_forms ?? [])
  const [min, setMin] = useState(org.recycling_min_kg != null ? String(org.recycling_min_kg) : '')
  const [max, setMax] = useState(org.recycling_max_kg != null ? String(org.recycling_max_kg) : '')
  const [turnaround, setTurnaround] = useState(org.recycling_turnaround ?? '')
  const [gives, setGives] = useState<RecyclingGives>(org.recycling_gives ?? 'credit')
  const [hours, setHours] = useState(org.recycling_hours ?? '')
  const [door, setDoor] = useState(org.recycling_door ?? '')
  const [note, setNote] = useState(org.recycling_note ?? '')
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  function save() {
    setStatus(null)
    const minKg = kgValue(min)
    const maxKg = kgValue(max)
    if (minKg === undefined || maxKg === undefined) {
      setStatus({ ok: false, text: BAD_KG })
      return
    }
    startTransition(async () => {
      try {
        await browserApiClient.patch(`/api/organizations/${orgId}/profile`, {
          recycling_materials: materials,
          recycling_note: note,
          recycling_machines: machines,
          recycling_forms: forms,
          recycling_min_kg: minKg,
          recycling_max_kg: maxKg,
          recycling_turnaround: turnaround,
          recycling_gives: gives,
          recycling_hours: hours,
          recycling_door: door,
        })
        setStatus({ ok: true, text: 'Saved — contributors see this now.' })
        router.refresh()
      } catch (err) {
        const detail = err instanceof Error ? /\{"error":"(.+?)"\}/.exec(err.message)?.[1] : null
        setStatus({ ok: false, text: detail ?? 'That did not save. Try once more.' })
      }
    })
  }

  return (
    <div className="card flex flex-col gap-[22px] p-[26px]">
      <Chips legend="Machines you run" options={RECYCLING_MACHINES} value={machines} onChange={setMachines} />
      <div>
        <Chips legend="Polymers accepted" options={PRINT_MATERIALS} value={materials} onChange={setMaterials} />
        <p className="mt-2 text-[13px] text-muted">
          Leave it empty if you do not take drop-offs — nobody can book one until something is on
          this list.
        </p>
      </div>
      <Chips legend="In what form" options={RECYCLING_FORMS} value={forms} onChange={setForms} />

      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        <label>
          <span className={LABEL}>Minimum per drop</span>
          <span className="flex items-center gap-2">
            <input aria-label="Minimum per drop" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} placeholder="2" className="field !w-[110px] bg-canvas font-mono" />
            <span className="font-extrabold text-muted">kg</span>
          </span>
          <span className="mt-1.5 block text-[13px] text-muted">The platform floor is 2 kg. You can ask for more, never less.</span>
        </label>
        <label>
          <span className={LABEL}>Maximum per drop</span>
          <span className="flex items-center gap-2">
            <input aria-label="Maximum per drop" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} className="field !w-[110px] bg-canvas font-mono" />
            <span className="font-extrabold text-muted">kg</span>
          </span>
        </label>
        <label>
          <span className={LABEL}>Turnaround</span>
          <input aria-label="Turnaround" value={turnaround} onChange={(e) => setTurnaround(e.target.value)} maxLength={60} placeholder="About 3 weeks" className="field w-full bg-canvas" />
        </label>
      </div>

      <fieldset>
        <legend className="mb-[9px] text-sm font-extrabold text-ink">What the contributor gets back</legend>
        <div role="radiogroup" className="flex flex-wrap gap-2">
          {GIVES.map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={gives === value}
              onClick={() => setGives(value)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-4 text-sm font-extrabold text-ink ${
                gives === value ? 'border-brand-dark bg-brand-tint' : 'border-line bg-surface'
              }`}
            >
              <Icon weight="bold" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        <label>
          <span className={LABEL}>Drop-off hours</span>
          <input aria-label="Drop-off hours" value={hours} onChange={(e) => setHours(e.target.value)} maxLength={80} placeholder="Tuesday and Thursday, 9am–4pm" className="field w-full bg-canvas" />
        </label>
        <label>
          <span className={LABEL}>Which door</span>
          <input aria-label="Which door" value={door} onChange={(e) => setDoor(e.target.value)} maxLength={120} placeholder="Loading door on the lane, ring the bell" className="field w-full bg-canvas" />
        </label>
      </div>

      <label>
        <span className={LABEL}>How you want it brought</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={500}
          className="field w-full bg-canvas py-3"
          placeholder="Clean, dry, sorted by colour."
        />
      </label>

      <div className="flex flex-wrap items-center gap-3 border-t-(length:--border-width) border-line pt-2">
        <button type="button" onClick={save} disabled={pending} className="btn btn-primary mt-2">
          <Check weight="bold" aria-hidden="true" />
          Save what you take
        </button>
        {status && (
          <p
            role={status.ok ? 'status' : 'alert'}
            className={`mt-2 text-sm font-semibold ${status.ok ? 'text-muted' : 'text-danger'}`}
          >
            {status.text}
          </p>
        )}
      </div>
    </div>
  )
}
```

(The textarea's old placeholder named "Two-kilo minimum. Tuesday and Thursday, 9am–4pm, loading door on the lane." — those now have their own fields, so it is shortened to the part that is still free text.)

- [ ] **Step 4: Web booking and org profile**

`packages/web/components/dropoff-form.tsx`:
- `DropoffOrg` gains `recycling_min_kg?: number | null; recycling_max_kg?: number | null`.
- After `const heavyEnough = …`:

```tsx
  // 113: the organisation's own per-drop limits, inside the platform floor.
  const minGrams = Math.max(MIN_DROPOFF_GRAMS, org?.recycling_min_kg != null ? Math.round(org.recycling_min_kg * 1000) : 0)
  const maxGrams = org?.recycling_max_kg != null ? Math.round(org.recycling_max_kg * 1000) : null
  const tooHeavy = grams !== null && maxGrams !== null && grams > maxGrams
  const overMax = `${org?.name} can take at most ${maxGrams! / 1000} kg in one drop. Split it across two.`
```

- `heavyEnough` becomes `grams !== null && grams >= minGrams`; `valid` gains `&& !tooHeavy`.
- The `#weight-help` span's children become:

```tsx
            {grams !== null && grams > 0 && grams < MIN_DROPOFF_GRAMS
              ? `Under the ${MIN_DROPOFF_GRAMS / 1000} kg minimum — hold on to it until you have ${MIN_DROPOFF_GRAMS / 1000} kg.`
              : tooHeavy
                ? overMax
                : maxGrams !== null
                  ? `Between ${minGrams / 1000} and ${maxGrams / 1000} kg. They weigh it again at the door — this is just so they can plan.`
                  : `At least ${minGrams / 1000} kg. They weigh it again at the door — this is just so they can plan.`}
```

- The footer status span's ternary gains a branch: `: tooHeavy ? overMax` before `: !heavyEnough ?`, and the `!heavyEnough` branch reads `` `A drop needs to be at least ${minGrams / 1000} kg.` ``.

`packages/web/app/organizations/[id]/public/page.tsx` — replace `RecyclingCard`'s `<dl>` and the `<p>` after it with:

```tsx
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[13px]">
        <dt className="font-semibold opacity-80">Polymers</dt>
        <dd className="m-0 font-extrabold">{(org.recycling_materials ?? []).join(' · ')}</dd>
        {(org.recycling_forms ?? []).length > 0 && (
          <>
            <dt className="font-semibold opacity-80">In what form</dt>
            <dd className="m-0 font-extrabold">{org.recycling_forms!.join(', ')}</dd>
          </>
        )}
        {(org.recycling_machines ?? []).length > 0 && (
          <>
            <dt className="font-semibold opacity-80">Machines</dt>
            <dd className="m-0 font-extrabold">{org.recycling_machines!.join(' · ')}</dd>
          </>
        )}
        <dt className="font-semibold opacity-80">Per drop</dt>
        <dd className="m-0 font-extrabold">{recyclingPerDrop(org)}</dd>
        <dt className="font-semibold opacity-80">You get</dt>
        <dd className="m-0 font-extrabold">{GIVES_PROFILE[org.recycling_gives ?? 'credit']}</dd>
        {org.recycling_hours && (
          <>
            <dt className="font-semibold opacity-80">When</dt>
            <dd className="m-0 font-extrabold">{org.recycling_hours}</dd>
          </>
        )}
      </dl>
      <p className="m-0 text-[13px] leading-[1.5]">
        {org.recycling_door ? `${org.recycling_door}. ` : ''}They weigh it at the door and issue the
        credit against that weight.
      </p>
      {org.recycling_note && <p className="m-0 text-[13px] leading-[1.5]">{org.recycling_note}</p>}
```

and above `function RecyclingCard`:

```tsx
// WB's org profile words for 113's recycling_gives.
const GIVES_PROFILE: Record<RecyclingGives, string> = {
  credit: 'Print credit on their machines',
  spool: 'A spool to take home',
  either: 'Credit, or a spool if you prefer',
}
```

Import `recyclingPerDrop` and `type RecyclingGives` from `@splat-connect/types`.

- [ ] **Step 5: Mobile**

`packages/mobile/lib/recycling.ts`:
- `TakerOrg` becomes:

```ts
export type TakerOrg = Pick<Organization, 'id' | 'name' | 'status' | 'suburb' | 'state'> &
  Pick<
    Organization,
    | 'recycling_materials'
    | 'recycling_note'
    | 'recycling_machines'
    | 'recycling_forms'
    | 'recycling_min_kg'
    | 'recycling_max_kg'
    | 'recycling_turnaround'
    | 'recycling_gives'
    | 'recycling_hours'
    | 'recycling_door'
  >
```

- `bookingProblem` becomes:

```ts
/**
 * Why the booking cannot go yet, or null when it can. The order is the order
 * the form reads in, so the line under the button names the first thing left.
 * minGrams/maxGrams are the organisation's own limits (113); the platform
 * floor still applies under any minimum.
 */
export function bookingProblem(input: {
  grams: number | null
  material: string
  ticked: number
  minGrams?: number
  maxGrams?: number | null
  orgName?: string
}): string | null {
  const min = Math.max(MIN_DROPOFF_GRAMS, input.minGrams ?? 0)
  if (input.grams === null || input.grams < min) return `A drop needs to be at least ${min / 1000} kg.`
  if (input.maxGrams != null && input.grams > input.maxGrams) {
    return `${input.orgName} takes at most ${input.maxGrams / 1000} kg at once.`
  }
  if (!input.material) return 'Pick the polymer you are bringing.'
  const left = RECYCLING_DECLARATION.length - input.ticked
  if (left > 0) return `${left} declaration line${left === 1 ? '' : 's'} still to tick.`
  return null
}
```

`packages/mobile/components/recycling/recycling-screen.tsx`:
- Header comment: replace the paragraph "Where the board draws fields no column holds … as web's intake editor decided." with "Every field the board draws on a recycler's card has a column (059, 113); `recycling_note` stays as free text below them."
- Import `recyclingPerDrop` and `type RecyclingGives` from `@splat-connect/types`. Above `export function RecyclingScreen`:

```tsx
// MB's card words for 113's recycling_gives.
const GIVES_CARD: Record<RecyclingGives, string> = {
  credit: 'Print credit',
  spool: 'A spool back',
  either: 'Credit or a spool',
}
const when = (o: TakerOrg) => [o.recycling_hours, o.recycling_door].filter(Boolean).join(' · ')
```

- In the org card, replace the `PENDING(org-recycling-details)` comment and the four `Fact`s with:

```tsx
                  <Fact
                    term="Takes"
                    value={[(o.recycling_materials ?? []).join(', '), (o.recycling_forms ?? []).join(', ')].filter(Boolean).join(' · ')}
                  />
                  {(o.recycling_machines ?? []).length ? <Fact term="Machines" value={o.recycling_machines!.join(' · ')} /> : null}
                  <Fact term="Per drop" value={recyclingPerDrop(o)} />
                  <Fact term="You get" value={GIVES_CARD[o.recycling_gives ?? 'credit']} />
                  {when(o) ? <Fact term="When" value={when(o)} /> : null}
                  {o.recycling_note ? <Text style={styles.meta}>{o.recycling_note}</Text> : null}
```

- In `BookDropoff`, after `const grams = kgToGrams(amount)`:

```tsx
  const minGrams = Math.max(MIN_DROPOFF_GRAMS, org.recycling_min_kg != null ? Math.round(org.recycling_min_kg * 1000) : 0)
  const maxGrams = org.recycling_max_kg != null ? Math.round(org.recycling_max_kg * 1000) : null
```

  `problem` becomes `bookingProblem({ grams, material, ticked: ticked.length, minGrams, maxGrams, orgName: org.name })`; `heavyEnough` becomes `grams !== null && grams >= minGrams`.
- The header `<Text style={styles.meta}>` under "Drop-off at {org.name}" becomes:

```tsx
          <Text style={styles.meta}>
            {[when(org), recyclingPerDrop({ ...org, recycling_turnaround: null })].filter(Boolean).join(' · ')}
          </Text>
          {org.recycling_note ? <Text style={styles.meta}>{org.recycling_note}</Text> : null}
```

  (MB's `recSelMinMax` is "min–max kg"; with no maximum `recyclingPerDrop` reads "From 2 kg".)
- The weight hint `<Text style={styles.help}>` becomes:

```tsx
          <Text style={styles.help}>
            {grams !== null && grams > 0 && grams < MIN_DROPOFF_GRAMS
              ? `Under the ${MIN_DROPOFF_GRAMS / 1000} kg minimum — hold on to it.`
              : maxGrams !== null && grams !== null && grams > maxGrams
                ? `${org.name} takes at most ${maxGrams / 1000} kg at once.`
                : maxGrams !== null
                  ? `Between ${minGrams / 1000} and ${maxGrams / 1000} kg. They weigh it again at the door.`
                  : `At least ${minGrams / 1000} kg. They weigh it again at the door — this is just so they can plan.`}
          </Text>
```

`packages/mobile/components/recycling/intake-screen.tsx`:
- Delete the `PENDING(org-recycling-details)` comment above "What you can take".
- Header comment: replace the paragraph ""What you can take" edits only the two fields … as web's what-you-take.tsx decided." with ""What you can take" edits every field the board draws (059's polymers and note, 113's machines, forms, per-drop limits, turnaround, what they get back, hours and door)."
- Imports from `@splat-connect/types` gain `RECYCLING_FORMS, RECYCLING_MACHINES` and `type RecyclingGives`.
- Replace `WhatYouTake` with:

```tsx
// MB's editor words for 113's recycling_gives.
const GIVES_EDIT: Array<[RecyclingGives, string]> = [
  ['credit', 'Print credit'],
  ['spool', 'A spool back'],
  ['either', 'Either'],
]
const BAD_KG = 'Per drop is between 2 and 1000 kg, to one decimal place.'
/** '' is "not said"; anything else must read as kilos to one decimal. */
const kgValue = (text: string): number | null | undefined => {
  const t = text.trim()
  if (!t) return null
  return /^\d{1,4}(\.\d)?$/.test(t) ? Number(t) : undefined
}

function ChipSet({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {options.map((m) => {
          const on = value.includes(m)
          return <Chip key={m} label={m} active={on} onPress={() => onChange(on ? value.filter((x) => x !== m) : [...value, m])} />
        })}
      </View>
    </View>
  )
}

function WhatYouTake({ org }: { org: Organization }) {
  const [materials, setMaterials] = useState<string[]>(org.recycling_materials ?? [])
  const [machines, setMachines] = useState<string[]>(org.recycling_machines ?? [])
  const [forms, setForms] = useState<string[]>(org.recycling_forms ?? [])
  const [min, setMin] = useState(org.recycling_min_kg != null ? String(org.recycling_min_kg) : '')
  const [max, setMax] = useState(org.recycling_max_kg != null ? String(org.recycling_max_kg) : '')
  const [turnaround, setTurnaround] = useState(org.recycling_turnaround ?? '')
  const [gives, setGives] = useState<RecyclingGives>(org.recycling_gives ?? 'credit')
  const [hours, setHours] = useState(org.recycling_hours ?? '')
  const [door, setDoor] = useState(org.recycling_door ?? '')
  const [note, setNote] = useState(org.recycling_note ?? '')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  // Whatever they already publish stays pickable even if it is not a print
  // material — a leader should be able to untick "HDPE", not be stuck with it.
  const polymers = [...new Set([...PRINT_MATERIALS, ...materials])]

  async function save() {
    const minKg = kgValue(min)
    const maxKg = kgValue(max)
    if (minKg === undefined || maxKg === undefined) return setStatus({ ok: false, text: BAD_KG })
    setBusy(true)
    setStatus(null)
    try {
      await apiClient.patch(`/api/organizations/${org.id}/profile`, {
        recycling_materials: materials,
        recycling_note: note,
        recycling_machines: machines,
        recycling_forms: forms,
        recycling_min_kg: minKg,
        recycling_max_kg: maxKg,
        recycling_turnaround: turnaround,
        recycling_gives: gives,
        recycling_hours: hours,
        recycling_door: door,
      })
      setStatus({ ok: true, text: 'Saved — contributors see this now.' })
    } catch (err) {
      setStatus({ ok: false, text: apiMessage(err, 'That did not save. Try once more.') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card style={styles.row}>
      <ChipSet label="Machines" options={RECYCLING_MACHINES} value={machines} onChange={setMachines} />
      <ChipSet label="Polymers" options={polymers} value={materials} onChange={setMaterials} />
      <Text style={styles.meta}>
        Leave it empty if you do not take drop-offs — nobody can book one until something is on
        this list.
      </Text>
      <ChipSet label="In what form" options={RECYCLING_FORMS} value={forms} onChange={setForms} />
      <View style={styles.kgRow}>
        <View style={styles.flex}>
          <TextField label="Minimum" accessibilityLabel="Minimum" value={min} onChangeText={setMin} keyboardType="decimal-pad" placeholder="2" />
        </View>
        <View style={styles.flex}>
          <TextField label="Maximum" accessibilityLabel="Maximum" value={max} onChangeText={setMax} keyboardType="decimal-pad" />
        </View>
      </View>
      <Text style={styles.meta}>The platform floor is 2 kg. You can ask for more, never less.</Text>
      <TextField label="Turnaround" accessibilityLabel="Turnaround" value={turnaround} onChangeText={setTurnaround} maxLength={60} />
      <View style={styles.group}>
        <Text style={styles.label}>They get back</Text>
        <View accessibilityRole="radiogroup" style={styles.chips}>
          {GIVES_EDIT.map(([value, label]) => (
            <Chip key={value} label={label} role="radio" active={gives === value} onPress={() => setGives(value)} />
          ))}
        </View>
      </View>
      <TextField label="Drop-off hours" accessibilityLabel="Drop-off hours" value={hours} onChangeText={setHours} maxLength={80} />
      <TextField label="Which door" accessibilityLabel="Which door" value={door} onChangeText={setDoor} maxLength={120} />
      <TextField
        label="How you want it brought"
        accessibilityLabel="How you want it brought"
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={500}
        placeholder="Clean, dry, sorted."
      />
      {status ? (
        status.ok ? (
          <Text style={styles.meta} accessibilityRole="alert">
            {status.text}
          </Text>
        ) : (
          <ErrorRow message={status.text} />
        )
      ) : null}
      <Button label="Save what you take" onPress={save} loading={busy} />
    </Card>
  )
}
```

  Add `group: { gap: 8 },` to the styles. (The Button's accessibility name is its label — `getByLabelText('Save what you take')` relies on `Button` passing `label` as `accessibilityLabel`; check `components/ui/Button.tsx` and pass `accessibilityLabel="Save what you take"` if it does not.)

`packages/mobile/components/organisation/org-profile-screen.tsx`:
- Import `recyclingPerDrop` and `type RecyclingGives` from `@splat-connect/types`; above the component:

```tsx
// MB's org profile words for 113's recycling_gives.
const GIVES_PROFILE: Record<RecyclingGives, string> = {
  credit: 'Print credit on their machines',
  spool: 'A spool to take home',
  either: 'Credit, or a spool',
}
```

- In the recycling panel, replace the `PENDING(org-recycling-details)` comment and the `Polymers` `Fact` with:

```tsx
              <Fact k="Polymers" v={(org.recycling_materials ?? []).join(' · ')} />
              {(org.recycling_forms ?? []).length ? <Fact k="Form" v={org.recycling_forms!.join(', ')} /> : null}
              <Fact k="Per drop" v={recyclingPerDrop(org)} />
              <Fact k="You get" v={GIVES_PROFILE[org.recycling_gives ?? 'credit']} />
              {org.recycling_hours ? <Fact k="When" v={org.recycling_hours} /> : null}
```

  (the `recycling_note` line below stays).

`packages/api/src/routes/organizations.ts`: delete the line `// PENDING(org-recycling-details): machines, forms, min/max per drop, turnaround, "You get", hours and door need columns.`

- [ ] **Step 6: Run the tests to see them pass**

Run both Step 2 commands. Expected: PASS.

- [ ] **Step 7: Ship the item** — `shipped: true,` on `'org-recycling-details'`; `git grep -n "org-recycling-details" -- packages scripts ':!packages/types/src/pending.ts' ':!*report.json'` → no output; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 8: Commit**

```bash
git status --short
git add packages/web/app/dashboard/organisation/recycling/what-you-take.tsx packages/web/app/dashboard/organisation/recycling/page.tsx packages/web/components/dropoff-form.tsx "packages/web/app/organizations/[id]/public/page.tsx" packages/mobile/lib/recycling.ts packages/mobile/components/recycling/intake-screen.tsx packages/mobile/components/recycling/recycling-screen.tsx packages/mobile/components/organisation/org-profile-screen.tsx packages/api/src/routes/organizations.ts packages/web/tests/unit/components/what-you-take.test.tsx packages/web/tests/unit/components/dropoff-form-photo.test.tsx packages/mobile/tests/unit/components/recycling/recycling-screen.test.tsx packages/mobile/tests/unit/components/recycling/intake-screen.test.tsx packages/mobile/tests/unit/components/organisation/org-profile-screen.test.tsx packages/mobile/tests/unit/lib/recycling.test.ts packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(recycling): leaders publish what their machines take, and contributors see it before they pack a box

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 6: Spending credit — the ledger, the balance and the accept (`recycling-credit-spending`, part 1 of 2, migration 114)

**Files:**
- Create: `supabase/migrations/114_recycling_credit.sql`
- Modify: `packages/api/src/routes/organizations.ts` (`GET /recycling/credit`)
- Modify: `packages/api/src/routes/toy-transactions.ts` (`POST /print` takes `print_credit`; `POST /:id/accept` reports a short balance)
- Modify: `packages/types/src/index.ts` (`RecyclingCredit`, `ToyTransaction.print_credit_grams`)
- Modify: `scripts/check-schema-guards.sh`
- Test: `packages/api/tests/integration/printers/recycling-credit.test.ts` (new)

**Interfaces:**
- Consumes: batch 2's `POST /print` shape — `files: [{ stl_file_id, quantity }]`, the `quantityOf: Map<string, number>` and `rows` it builds (re-read the handler first; if `quantityOf` is absent, batch 2 has not landed — stop). The latest `accept_toy_transaction` definition (Controller ruling 1).
- Produces: table `recycling_credit_spends(id, profile_id, org_id, transaction_id unique, grams, created_at)`; `recycling_credit_balance(p_profile uuid, p_org uuid) returns integer` (service role only); `toy_transactions.print_credit_grams integer`; `accept_toy_transaction` returns `credit: 'spent' | 'short' | null` beside `outcome`. `GET /api/organizations/recycling/credit` → `RecyclingCredit[]` = `{ org_id: string; org_name: string | null; grams: number; weighed_grams: number }`, only orgs with `grams > 0`. `POST /api/toy-transactions/print` accepts `print_credit?: { org_id: string; grams: number }`. `ToyTransaction.print_credit_grams?: number | null` — after accept it is the grams actually spent (null if short). Task 7 uses all of it.

- [ ] **Step 1: Write the failing test**

`packages/api/tests/integration/printers/recycling-credit.test.ts`:

```ts
/**
 * 114: recycling credit spent on a print job. Grams, never money; spent only
 * at the organisation that issued it, and only when that organisation's
 * printer accepts — in the same database call as the accept, re-checking the
 * balance, once per job.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createUserClient } from '../../../src/supabase/client.js'
import { DECLARATION_VERSION } from '@splat-connect/types'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader } from '../../helpers/orgs.js'

let family: TestUser
let leadA: TestUser
let leadB: TestUser
let maker: TestUser
let orgA: string
let orgB: string
const printers: Record<string, string> = {}
const guides: string[] = []
const parts: string[] = []

const json = (token: string, method: string, body?: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})
const pickup = { pickup_line1: '1 Test St', pickup_suburb: 'Newtown', pickup_state: 'NSW', pickup_postcode: '2042' }
/** Guide n has one 100 g part. */
const ask = (n: number, printerIds: string[], extra: Record<string, unknown> = {}, quantity = 1) =>
  app.request(
    '/api/toy-transactions/print',
    json(family.token, 'POST', { printer_ids: printerIds, tutorial_id: guides[n], files: [{ stl_file_id: parts[n], quantity }], ...extra })
  )
const jobOn = async (n: number, printerId: string) =>
  (await adminClient().from('toy_transactions').select('id, print_credit_grams, status').eq('tutorial_id', guides[n]).eq('printer_id', printerId).single()).data!
const spends = async () =>
  (await adminClient().from('recycling_credit_spends').select('transaction_id, grams, org_id').eq('profile_id', family.id)).data!
const credit = async () =>
  (await (await app.request('/api/organizations/recycling/credit', json(family.token, 'GET'))).json()) as Array<{ org_id: string; grams: number; weighed_grams: number }>

beforeAll(async () => {
  ;[family, leadA, leadB, maker] = await Promise.all([1, 2, 3, 4].map(() => createTestUser('contributor')))
  const admin = adminClient()
  orgA = await createOrg({ createdBy: leadA.id, name: `Northside ${Date.now()}` })
  orgB = await createOrg({ createdBy: leadB.id, name: `Riverina ${Date.now()}` })
  await addLeader(orgA, leadA.id)
  await addLeader(orgB, leadB.id)
  await admin.from('organizations').update({ pickup_line1: '1 Org St', pickup_suburb: 'Newtown', pickup_state: 'NSW', pickup_postcode: '2042' }).in('id', [orgA, orgB])
  for (let n = 0; n < 6; n++) {
    const { data: t } = await admin.from('tutorials').insert({ title: `Credit fixture ${n}`, description: 'x', difficulty: 'easy', status: 'approved' }).select('id').single()
    guides.push(t!.id)
    const { data: f } = await admin.from('stl_files').insert({ tutorial_id: t!.id, filename: 'mount.stl', file_url: `${t!.id}/mount.stl`, filament_grams: 100 }).select('id').single()
    parts.push(f!.id)
  }
  const machine = async (row: Record<string, unknown>) =>
    (await admin.from('printers').insert({ name: 'Bench', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200, capacity: 10, ...row }).select('id').single()).data!.id as string
  printers.a1 = await machine({ owner_org_id: orgA })
  printers.a2 = await machine({ owner_org_id: orgA })
  printers.b = await machine({ owner_org_id: orgB })
  printers.maker = await machine({ owner_id: maker.id })
  const drop = (org_id: string, status: string, weighed: number | null, creditG: number | null) => ({
    org_id, contributor_id: family.id, material: 'PLA', estimated_grams: 2500, condition_declared: true,
    declaration_version: DECLARATION_VERSION, status, weighed_grams: weighed, credit_grams: creditG, decided_by: status === 'booked' ? null : leadA.id,
  })
  await admin.from('recycling_dropoffs').insert([
    drop(orgA, 'received', 400, 300),
    drop(orgA, 'declined', null, null),
    drop(orgA, 'booked', null, null),
    drop(orgB, 'received', 2000, 0),
  ])
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_transactions').delete().in('tutorial_id', guides)
  await admin.from('printers').delete().in('id', Object.values(printers))
  await admin.from('tutorials').delete().in('id', guides)
  await admin.from('recycling_dropoffs').delete().eq('contributor_id', family.id)
  await admin.from('organizations').delete().in('id', [orgA, orgB])
  await Promise.all([family, leadA, leadB, maker].map((u) => deleteTestUser(u.id)))
})

describe('114 objects', () => {
  it('has the spends table, the balance function and the column', async () => {
    const admin = adminClient()
    expect((await admin.from('recycling_credit_spends').select('id').limit(1)).error).toBeNull()
    expect((await admin.from('toy_transactions').select('print_credit_grams').limit(1)).error).toBeNull()
    expect((await admin.rpc('recycling_credit_balance', { p_profile: family.id, p_org: orgA })).data).toBe(300)
  })

  it('keeps the balance function and the ledger away from clients', async () => {
    const db = createUserClient(family.token)
    expect((await db.rpc('recycling_credit_balance', { p_profile: family.id, p_org: orgA })).error).not.toBeNull()
    const { error } = await db.from('recycling_credit_spends').insert({ profile_id: family.id, org_id: orgA, transaction_id: crypto.randomUUID(), grams: 1 })
    expect(error).not.toBeNull()
  })
})

describe('GET /api/organizations/recycling/credit', () => {
  it('is received credit minus spends, per organisation, leaving out empty ones', async () => {
    expect(await credit()).toEqual([{ org_id: orgA, org_name: expect.any(String), grams: 300, weighed_grams: 400 }])
  })
})

describe('asking with credit', () => {
  it.each([
    [{ org_id: 'x', grams: 1.5 }, 'Say how many grams of credit, in whole grams.'],
    [{ grams: 50 }, 'Say how many grams of credit, in whole grams.'],
  ])('refuses %j', async (print_credit, message) => {
    const res = await ask(0, [printers.a1], { print_credit })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toBe(message)
  })

  it('refuses credit at an organisation not being asked', async () => {
    const res = await ask(0, [printers.b], { print_credit: { org_id: orgA, grams: 50 } })
    expect(((await res.json()) as { error: string }).error).toBe('Credit can only be spent at the organisation that issued it.')
  })

  it('refuses more than the job needs, and more than the balance', async () => {
    const over = await ask(0, [printers.a1], { print_credit: { org_id: orgA, grams: 101 } })
    expect(((await over.json()) as { error: string }).error).toBe('This job needs 100 g of filament, so that is the most credit it can use.')
    const broke = await ask(0, [printers.a1], { print_credit: { org_id: orgA, grams: 400 } }, 5)
    expect(((await broke.json()) as { error: string }).error).toBe('You have 300 g of credit there.')
  })

  it('refuses credit on a guide whose part has no grams', async () => {
    await adminClient().from('stl_files').update({ filament_grams: null }).eq('id', parts[5])
    const res = await ask(5, [printers.a1], { print_credit: { org_id: orgA, grams: 10 } })
    expect(((await res.json()) as { error: string }).error).toBe('This guide does not say how much filament its parts take, so credit cannot be used on it.')
  })

  it('stores the credit only on that organisation’s rows, and the database refuses it elsewhere', async () => {
    const res = await ask(0, [printers.a1, printers.maker], { print_credit: { org_id: orgA, grams: 100 } })
    expect(res.status).toBe(201)
    expect((await jobOn(0, printers.a1)).print_credit_grams).toBe(100)
    expect((await jobOn(0, printers.maker)).print_credit_grams).toBeNull()
    const { error } = await adminClient().from('toy_transactions').update({ print_credit_grams: 5 }).eq('id', (await jobOn(0, printers.maker)).id)
    expect(error?.code).toBe('23514')
  })
})

describe('accepting', () => {
  it('spends nothing when a personal printer takes it', async () => {
    const job = await jobOn(0, printers.maker)
    expect((await app.request(`/api/toy-transactions/${job.id}/accept`, json(maker.token, 'POST', pickup))).status).toBe(200)
    expect(await spends()).toEqual([])
  })

  it('spends nothing when a different organisation’s printer takes it', async () => {
    expect((await ask(1, [printers.a1, printers.b], { print_credit: { org_id: orgA, grams: 100 } })).status).toBe(201)
    const job = await jobOn(1, printers.b)
    expect((await app.request(`/api/toy-transactions/${job.id}/accept`, json(leadB.token, 'POST', {}))).status).toBe(200)
    expect(await spends()).toEqual([])
  })

  it('spends once, in the accept, when the issuing organisation takes it', async () => {
    expect((await ask(2, [printers.a1], { print_credit: { org_id: orgA, grams: 100 } })).status).toBe(201)
    const job = await jobOn(2, printers.a1)
    expect((await app.request(`/api/toy-transactions/${job.id}/accept`, json(leadA.token, 'POST', {}))).status).toBe(200)
    expect((await app.request(`/api/toy-transactions/${job.id}/accept`, json(leadA.token, 'POST', {}))).status).toBe(409)
    expect(await spends()).toEqual([{ transaction_id: job.id, grams: 100, org_id: orgA }])
    expect((await credit())[0].grams).toBe(200)
    const dup = await adminClient().from('recycling_credit_spends').insert({ profile_id: family.id, org_id: orgA, transaction_id: job.id, grams: 1 })
    expect(dup.error?.code).toBe('23505')
  })

  it('accepts without credit when the balance ran out, and says so in the thread', async () => {
    // Balance 200: two jobs of 200 g each asking 150 g pass at request time.
    expect((await ask(3, [printers.a1], { print_credit: { org_id: orgA, grams: 150 } }, 2)).status).toBe(201)
    expect((await ask(4, [printers.a2], { print_credit: { org_id: orgA, grams: 150 } }, 2)).status).toBe(201)
    const first = await jobOn(3, printers.a1)
    const second = await jobOn(4, printers.a2)
    expect((await app.request(`/api/toy-transactions/${first.id}/accept`, json(leadA.token, 'POST', {}))).status).toBe(200)
    const res = await app.request(`/api/toy-transactions/${second.id}/accept`, json(leadA.token, 'POST', {}))
    expect(res.status).toBe(200)
    expect(((await res.json()) as { print_credit_grams: number | null }).print_credit_grams).toBeNull()
    expect((await spends()).filter((s) => s.transaction_id === second.id)).toEqual([])
    const { data: said } = await adminClient().from('toy_transaction_messages').select('body').eq('transaction_id', second.id)
    expect(said!.map((m) => m.body)).toContainEqual(expect.stringMatching(/^There was not enough recycling credit left at .+ for this job, so it was accepted without credit\.$/))
  })

  it('never overdraws when two accepts race on the last of the balance', async () => {
    // Balance 50 now. Two requests of 50 g each, accepted at the same moment.
    await adminClient().from('stl_files').update({ filament_grams: 100 }).eq('id', parts[5])
    expect((await ask(5, [printers.a1], { print_credit: { org_id: orgA, grams: 50 } })).status).toBe(201)
    expect((await ask(1, [printers.a2], { print_credit: { org_id: orgA, grams: 50 } })).status).toBe(201)
    const x = await jobOn(5, printers.a1)
    const y = await jobOn(1, printers.a2)
    const [rx, ry] = await Promise.all([
      app.request(`/api/toy-transactions/${x.id}/accept`, json(leadA.token, 'POST', {})),
      app.request(`/api/toy-transactions/${y.id}/accept`, json(leadA.token, 'POST', {})),
    ])
    expect([rx.status, ry.status]).toEqual([200, 200])
    const raced = (await spends()).filter((s) => s.transaction_id === x.id || s.transaction_id === y.id)
    expect(raced).toHaveLength(1)
    expect((await adminClient().rpc('recycling_credit_balance', { p_profile: family.id, p_org: orgA })).data).toBe(0)
  })
})
```

(Guide 1's org-B job was accepted earlier, so the family has no open job on `a2` for guide 1; the duplicate-open-job check is per printer and guide.)

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/printers/recycling-credit.test.ts`
Expected: FAIL — `relation "public.recycling_credit_spends" does not exist`.

- [ ] **Step 3: Write the migration**

First, Controller ruling 1: `grep -ln "function public.accept_toy_transaction" supabase/migrations/*.sql | sort | tail -1`. The SQL below copies `057_build_requests.sql`'s body; if a later file is printed, copy that file's body instead and add the same three marked pieces (`v_credit` declaration, the `114:` block, the `credit` key in the final return).

`supabase/migrations/114_recycling_credit.sql`:

```sql
-- 114 — spending recycling credit on a print job (recycling-credit-spending).
--
-- Decided 2026-09-30: credit is grams, never money; it is spent only at the
-- organisation that issued it, and only when that organisation's printer
-- accepts the job. A balance is never stored: it is what that organisation
-- credited (059's credit_grams on received drop-offs) minus what was spent
-- there, computed by recycling_credit_balance().
--
-- The spend is written inside accept_toy_transaction(), in the same call that
-- takes the job, after re-reading the balance under a lock on (requester,
-- organisation). Two leaders accepting two jobs at the same moment therefore
-- cannot both spend the last 50 g. Short means the job is accepted without
-- credit; the API says so in the thread. transaction_id is unique, so a
-- double accept writes one spend.
--
-- print_credit_grams is set at request time only on the rows (one per printer,
-- 074) whose printer belongs to the issuing organisation. Any other printer
-- accepting finds null and spends nothing. After the accept it is the grams
-- actually spent; a short balance clears it.
--
-- DOWN:
--   -- re-run the previous accept_toy_transaction definition (057, or the latest before 114)
--   alter table public.toy_transactions drop constraint if exists toy_transactions_print_credit;
--   alter table public.toy_transactions drop column if exists print_credit_grams;
--   drop function if exists public.recycling_credit_balance(uuid, uuid);
--   drop table if exists public.recycling_credit_spends;

create table public.recycling_credit_spends (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  transaction_id uuid not null unique references public.toy_transactions (id) on delete cascade,
  grams integer not null check (grams > 0 and grams <= 1000000),
  created_at timestamptz not null default now()
);

create index recycling_credit_spends_owner_idx on public.recycling_credit_spends (profile_id, org_id);

alter table public.recycling_credit_spends enable row level security;

-- Own read, no client writes: only accept_toy_transaction() inserts.
create policy "Read your own credit spends"
  on public.recycling_credit_spends for select to authenticated
  using (profile_id = auth.uid());

revoke all on public.recycling_credit_spends from anon, authenticated;
grant select on public.recycling_credit_spends to authenticated;

create function public.recycling_credit_balance(p_profile uuid, p_org uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    coalesce((
      select sum(d.credit_grams) from public.recycling_dropoffs d
      where d.contributor_id = p_profile and d.org_id = p_org and d.status = 'received'
    ), 0)
    - coalesce((
      select sum(s.grams) from public.recycling_credit_spends s
      where s.profile_id = p_profile and s.org_id = p_org
    ), 0)
  )::integer
$$;

-- Any profile id is a parameter, so a client calling it could read anyone's balance.
revoke all on function public.recycling_credit_balance(uuid, uuid) from public, anon, authenticated;
grant execute on function public.recycling_credit_balance(uuid, uuid) to service_role;

alter table public.toy_transactions add column print_credit_grams integer;

alter table public.toy_transactions
  add constraint toy_transactions_print_credit check (
    print_credit_grams is null
    or (print_credit_grams between 1 and 1000000 and type = 'print' and owner_org_id is not null)
  );

-- 057's body, unchanged, with the three pieces marked 114.
create or replace function public.accept_toy_transaction(
  p_transaction_id uuid,
  p_owner_code text,
  p_requester_code text,
  p_pickup_line1 text default null,
  p_pickup_suburb text default null,
  p_pickup_state text default null,
  p_pickup_postcode text default null
) returns jsonb as $$
declare
  v_tx public.toy_transactions;
  v_quantity integer;
  v_accepted integer;
  v_line1 text;
  v_suburb text;
  v_state text;
  v_postcode text;
  v_instructions text;
  v_updated public.toy_transactions;
  v_credit text; -- 114
begin
  select * into v_tx from public.toy_transactions where id = p_transaction_id;
  if not found then
    return jsonb_build_object('outcome', 'missing');
  end if;
  if v_tx.status <> 'requested' then
    return jsonb_build_object('outcome', 'closed');
  end if;

  if v_tx.toy_id is not null then
    select t.quantity into v_quantity
    from public.toys t where t.id = v_tx.toy_id
    for update;
    if not found then
      return jsonb_build_object('outcome', 'missing');
    end if;

    select count(*) into v_accepted
    from public.toy_transactions t
    where t.toy_id = v_tx.toy_id and t.status = 'accepted';

    if v_accepted >= v_quantity then
      return jsonb_build_object('outcome', 'full');
    end if;
  end if;

  if v_tx.owner_org_id is not null then
    select o.pickup_line1, o.pickup_suburb, o.pickup_state, o.pickup_postcode, o.pickup_instructions
      into v_line1, v_suburb, v_state, v_postcode, v_instructions
    from public.organizations o where o.id = v_tx.owner_org_id;

    if v_line1 is null or v_suburb is null or v_state is null or v_postcode is null then
      return jsonb_build_object('outcome', 'no_org_pickup');
    end if;
  else
    v_line1 := p_pickup_line1;
    v_suburb := p_pickup_suburb;
    v_state := p_pickup_state;
    v_postcode := p_pickup_postcode;
  end if;

  update public.toy_transactions
  set status = 'accepted',
      owner_code = p_owner_code,
      requester_code = p_requester_code,
      pickup_line1 = v_line1,
      pickup_suburb = v_suburb,
      pickup_state = v_state,
      pickup_postcode = v_postcode,
      pickup_instructions = v_instructions,
      updated_at = now()
  where id = p_transaction_id and status = 'requested'
  returning * into v_updated;

  if not found then
    return jsonb_build_object('outcome', 'closed');
  end if;

  -- 114: the credit, spent in this same call. The lock serialises every spend
  -- by this requester at this organisation, so the balance read below cannot
  -- be spent twice by two accepts racing.
  if v_updated.print_credit_grams is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(v_updated.requester_id::text || ':' || v_updated.owner_org_id::text, 114)
    );
    if public.recycling_credit_balance(v_updated.requester_id, v_updated.owner_org_id) >= v_updated.print_credit_grams then
      insert into public.recycling_credit_spends (profile_id, org_id, transaction_id, grams)
      values (v_updated.requester_id, v_updated.owner_org_id, v_updated.id, v_updated.print_credit_grams)
      on conflict (transaction_id) do nothing;
      v_credit := 'spent';
    else
      update public.toy_transactions set print_credit_grams = null
      where id = v_updated.id
      returning * into v_updated;
      v_credit := 'short';
    end if;
  end if;

  return jsonb_build_object('outcome', 'accepted', 'transaction', to_jsonb(v_updated), 'credit', v_credit); -- 114: credit
end;
$$ language plpgsql security invoker set search_path = '';
```

(057's long comments inside the function body are dropped in the copy; behaviour is identical. Keep them if copying a later body that has its own.)

Run: `supabase migration up` → `Applying migration 114_recycling_credit.sql...`

- [ ] **Step 4: Types**

`packages/types/src/index.ts`:
- In `interface ToyTransaction`, after `print_delivery`:

```ts
  /** 114. Recycling credit, in grams, at the organisation whose printer this
   *  row is for. Set at request time only on that organisation's rows; after
   *  accept it is what was actually spent (null if the balance ran short). */
  print_credit_grams?: number | null
```

- After `recyclingPerDrop` (Task 4):

```ts
/** 114. A member's unspent credit at one organisation: grams, never money,
 *  spendable only there. `weighed_grams` is what they dropped off there. */
export interface RecyclingCredit {
  org_id: string
  org_name: string | null
  grams: number
  weighed_grams: number
}
```

- [ ] **Step 5: The API**

`organizations.ts`, directly after the `organizations.get('/recycling/mine', …)` handler:

```ts
/**
 * GET /api/organizations/recycling/credit — the caller's unspent credit at
 * each organisation (114). The balance is recycling_credit_balance(), the one
 * place the arithmetic lives; it is service-role only, so this asks it for
 * the caller and nobody else. Organisations with nothing left are omitted.
 */
organizations.get('/recycling/credit', async (c) => {
  const admin = createAdminClient()
  const userId = c.get('userId')
  const { data: drops, error } = await admin
    .from('recycling_dropoffs')
    .select('org_id, weighed_grams')
    .eq('contributor_id', userId)
    .eq('status', 'received')
  if (error) return c.json({ error: error.message }, 500)
  const weighed = new Map<string, number>()
  for (const d of drops ?? []) weighed.set(d.org_id, (weighed.get(d.org_id) ?? 0) + (d.weighed_grams ?? 0))
  const orgIds = [...weighed.keys()]
  if (!orgIds.length) return c.json([])
  const [{ data: orgs }, balances] = await Promise.all([
    admin.from('organizations').select('id, name').in('id', orgIds),
    Promise.all(orgIds.map((org) => admin.rpc('recycling_credit_balance', { p_profile: userId, p_org: org }))),
  ])
  const name = new Map((orgs ?? []).map((o) => [o.id as string, o.name as string]))
  return c.json(
    orgIds
      .map((org_id, i) => ({
        org_id,
        org_name: name.get(org_id) ?? null,
        grams: (balances[i].data as number | null) ?? 0,
        weighed_grams: weighed.get(org_id)!,
      }))
      .filter((r) => r.grams > 0)
  )
})
```

`toy-transactions.ts`, `POST /print`:
- The `stl_files` select becomes `.select('id, tutorial_id, filament_grams')` and the `rows` cast `Array<{ id: string; tutorial_id: string; filament_grams: number | null }>`.
- After the `tutorial.status !== 'approved'` check and before the duplicate-open-job read:

```ts
  // 114: recycling credit, at one organisation being asked. Grams, never
  // money; spent only if that organisation's printer is the one that accepts.
  let credit: { org_id: string; grams: number } | null = null
  if (body.print_credit != null) {
    const asked = body.print_credit as { org_id?: unknown; grams?: unknown }
    if (typeof asked.org_id !== 'string' || !Number.isInteger(asked.grams) || (asked.grams as number) < 1) {
      return c.json({ error: 'Say how many grams of credit, in whole grams.' }, 400)
    }
    if (!printers!.some((p) => p.owner_org_id === asked.org_id)) {
      return c.json({ error: 'Credit can only be spent at the organisation that issued it.' }, 400)
    }
    const needed = rows.some((f) => f.filament_grams == null)
      ? null
      : rows.reduce((n, f) => n + f.filament_grams! * (quantityOf.get(f.id) ?? 1), 0)
    if (needed === null) {
      return c.json({ error: 'This guide does not say how much filament its parts take, so credit cannot be used on it.' }, 400)
    }
    if ((asked.grams as number) > needed) {
      return c.json({ error: `This job needs ${needed} g of filament, so that is the most credit it can use.` }, 400)
    }
    const { data: balance, error: balanceError } = await admin.rpc('recycling_credit_balance', {
      p_profile: userId,
      p_org: asked.org_id,
    })
    if (balanceError) return c.json({ error: balanceError.message }, 500)
    if ((asked.grams as number) > (balance as number)) {
      return c.json({ error: `You have ${balance} g of credit there.` }, 400)
    }
    credit = { org_id: asked.org_id, grams: asked.grams as number }
  }
```

- In the per-printer insert object, after `owner_org_id: printer.owner_org_id,`:

```ts
        // Only this organisation's rows carry it, so any other printer accepting spends nothing.
        print_credit_grams: credit && printer.owner_org_id === credit.org_id ? credit.grams : null,
```

`toy-transactions.ts`, `POST /:id/accept` — after the `toy_accepted` notification insert:

```ts
  // 114: the RPC spent the credit, or found the balance short and accepted
  // without it. Short is said in the thread, where both sides will see it.
  if ((result as { credit?: string | null }).credit === 'short') {
    await admin.from('toy_transaction_messages').insert({
      transaction_id: tx.id,
      sender_id: userId,
      kind: 'system',
      body: `There was not enough recycling credit left at ${await ownerSideName(admin, tx as any, 'the organisation')} for this job, so it was accepted without credit.`,
    })
  }
```

- [ ] **Step 6: Schema guards**

In `scripts/check-schema-guards.sh`, after Task 1's last row (comma first):

```sql
  -- 114. Without RLS any member could read every other member's spends.
  ('114 recycling_credit_spends has RLS on',
   (select relrowsecurity from pg_class where oid = 'public.recycling_credit_spends'::regclass)),

  -- 114. Callable by a client, anyone could read anyone's balance.
  ('114 recycling_credit_balance() is service-role only',
   (select count(*) = 1 from pg_proc p
      where p.proname = 'recycling_credit_balance' and p.pronamespace = 'public'::regnamespace
        and not has_function_privilege('authenticated', p.oid, 'execute')
        and not has_function_privilege('anon', p.oid, 'execute'))),

  -- 114. An older body accepts the job and never spends the credit.
  ('114 accept_toy_transaction() spends recycling credit',
   (select count(*) = 1 from pg_proc
      where proname = 'accept_toy_transaction' and prosrc like '%recycling_credit_spends%'))
```

- [ ] **Step 7: Run it to see it pass**

Run the Step 2 command. Expected: PASS (14 tests).
Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/printers` → PASS (batch 2's print tests and 074's groups unchanged).
Run: `grep -rn "print_credit_grams" packages/mobile` → no output yet (Task 7 adds the readers).

- [ ] **Step 8: Commit**

```bash
git status --short
git add supabase/migrations/114_recycling_credit.sql packages/api/src/routes/organizations.ts packages/api/src/routes/toy-transactions.ts packages/types/src/index.ts scripts/check-schema-guards.sh packages/api/tests/integration/printers/recycling-credit.test.ts
git commit -m "feat(recycling): spend recycling credit on a print job, in the same call as the accept (114)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 7: Spending credit — the request, the hero and the cost line (`recycling-credit-spending`, part 2 of 2)

**Files:**
- Modify: `packages/mobile/components/printing/request-screen.tsx` (the checkbox, the agree line, the payload)
- Modify: `packages/mobile/components/recycling/recycling-screen.tsx` (hero: unspent)
- Modify: `packages/mobile/components/printing/job-screen.tsx` (cost line)
- Modify: `packages/web/app/get-involved/recycling/page.tsx` ("Print credit, unspent")
- Modify: `packages/web/app/dashboard/print-requests/[id]/page.tsx` (cost line)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/mobile/tests/unit/components/printing/request-screen.test.tsx` (batch 2 created it), `packages/mobile/tests/unit/components/recycling/recycling-screen.test.tsx`, `packages/mobile/tests/unit/components/printing/job-screen.test.tsx`, `packages/web/tests/unit/app/recycling.test.tsx` (new)

**Interfaces:**
- Consumes: Task 6's `GET /api/organizations/recycling/credit` → `RecyclingCredit[]`, `print_credit` on `POST /print`, `ToyTransaction.print_credit_grams`. Batch 2's request screen: `ticked` (parts with `quantity`), `agreeLine`, `printers: PrinterWithOwner[]`.
- Produces: nothing later tasks rely on.

Copy: MB request "Use {n} g of your credit at {org}", "You have {n} g from {kg} kg you dropped off. Only deducted if they are the one who takes it.", agree "I understand my recycling credit covers the filament on this job, and that any balance is settled with the printer, not through SPLAT."; MB hero "{n} g of print credit unspent"; WB "Print credit, unspent", "Spendable on filament at that organisation only. It comes off the cost panel when they take your print job."; MB/WB cost line "Your recycling credit ({n} g)".

- [ ] **Step 1: Write the failing tests**

`packages/mobile/tests/unit/components/printing/request-screen.test.tsx`:
- In `beforeEach`, the `mockGet` implementation becomes:

```tsx
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(path === '/api/printers' ? [PRINTER] : path === '/api/organizations/recycling/credit' ? [] : GUIDE)
  )
```

- Append:

```tsx
const ORG_PRINTER = { id: 'p2', owner_id: null, owner_org_id: 'north', owner_name: null, org_name: 'Northside Therapy', filament_cents_per_g: null }
const serveCredit = (grams: number) =>
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/api/printers'
        ? [ORG_PRINTER]
        : path === '/api/organizations/recycling/credit'
          ? [{ org_id: 'north', org_name: 'Northside Therapy', grams, weighed_grams: 3200 }]
          : GUIDE
    )
  )

it('offers credit at the organisation being asked, covering the job, and sends it', async () => {
  serveCredit(900)
  mockPost.mockResolvedValue({ id: 'j1' })
  render(<RequestPrintScreen guideId="g1" printerIds={['p2']} />)
  // 10 g + 4 g of parts.
  expect(await screen.findByText('Use 14 g of your credit at Northside Therapy')).toBeTruthy()
  expect(screen.getByText('You have 900 g from 3.2 kg you dropped off. Only deducted if they are the one who takes it.')).toBeTruthy()
  expect(
    screen.getByText('I understand my recycling credit covers the filament on this job, and that any balance is settled with the printer, not through SPLAT.')
  ).toBeTruthy()
  fireEvent.press(screen.getByRole('checkbox', { name: /I understand/ }))
  fireEvent.press(screen.getByText('Send request'))
  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/print', expect.objectContaining({ print_credit: { org_id: 'north', grams: 14 } }))
  )
})

it('sends no credit when it is unticked, and the agree line goes back to the filament', async () => {
  serveCredit(900)
  mockPost.mockResolvedValue({ id: 'j1' })
  render(<RequestPrintScreen guideId="g1" printerIds={['p2']} />)
  fireEvent.press(await screen.findByRole('checkbox', { name: /Use 14 g of your credit/ }))
  expect(screen.queryByText(/my recycling credit covers the filament/)).toBeNull()
  fireEvent.press(screen.getByRole('checkbox', { name: /I understand/ }))
  fireEvent.press(screen.getByText('Send request'))
  await waitFor(() => expect(mockPost).toHaveBeenCalled())
  expect(mockPost.mock.calls[0][1]).not.toHaveProperty('print_credit')
})

it('uses only what is left when the balance is smaller than the job', async () => {
  serveCredit(5)
  render(<RequestPrintScreen guideId="g1" printerIds={['p2']} />)
  expect(await screen.findByText('Use 5 g of your credit at Northside Therapy')).toBeTruthy()
  expect(screen.queryByText(/my recycling credit covers the filament/)).toBeNull()
})

it('offers nothing for a guide whose part has no grams, or a printer that is a person', async () => {
  serveCredit(900)
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/api/printers'
        ? [ORG_PRINTER, PRINTER]
        : path === '/api/organizations/recycling/credit'
          ? [{ org_id: 'north', org_name: 'Northside Therapy', grams: 900, weighed_grams: 3200 }]
          : { ...GUIDE, stl_files: [{ ...GUIDE.stl_files[0], filament_grams: null }] }
    )
  )
  render(<RequestPrintScreen guideId="g1" printerIds={['p2', 'p1']} />)
  await screen.findByText('Send request')
  expect(screen.queryByText(/of your credit at/)).toBeNull()
})
```

`packages/mobile/tests/unit/components/recycling/recycling-screen.test.tsx`:
- In `beforeEach`, the `mockGet` implementation gains `path === '/api/organizations/recycling/credit' ? [{ org_id: 'north', org_name: 'Northside Therapy', grams: 1900, weighed_grams: 3200 }] :` before the final `[]`.
- In 'lists only active organisations that take plastic, and your drop-offs', replace `expect(screen.getByText('2,400 g of print credit issued')).toBeTruthy()` with `expect(screen.getByText('1,900 g of print credit unspent')).toBeTruthy()`.

`packages/mobile/tests/unit/components/printing/job-screen.test.tsx` — append:

```tsx
it('puts the spent recycling credit on the family’s cost card', async () => {
  serve(job({ status: 'accepted', owner_org_id: 'north', owner_id: null, print_credit_grams: 120 }))
  render(<PrintJobScreen id="j1" />)
  expect(await screen.findByText('Your recycling credit (120 g)')).toBeTruthy()
})
```

`packages/web/tests/unit/app/recycling.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import RecyclingPage from '@/app/get-involved/recycling/page'

const { mockGetCapabilities, mockGet } = vi.hoisted(() => ({ mockGetCapabilities: vi.fn(), mockGet: vi.fn() }))
vi.mock('@/lib/capabilities', () => ({ getCapabilities: mockGetCapabilities }))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: mockGet } }))

beforeEach(() => {
  mockGetCapabilities.mockResolvedValue({ profile: { id: 'u1' } })
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/api/organizations/recycling/credit'
        ? [{ org_id: 'north', org_name: 'Northside Therapy', grams: 1900, weighed_grams: 3200 }]
        : []
    )
  )
})

describe('Recycling, signed in', () => {
  it('lists unspent print credit per organisation', async () => {
    render(await RecyclingPage())
    expect(screen.getByText('Print credit, unspent')).toBeInTheDocument()
    expect(screen.getByText('Northside Therapy')).toBeInTheDocument()
    expect(screen.getByText('1900 g')).toBeInTheDocument()
    expect(
      screen.getByText('Spendable on filament at that organisation only. It comes off the cost panel when they take your print job.')
    ).toBeInTheDocument()
  })

  it('draws nothing when there is no credit', async () => {
    mockGet.mockResolvedValue([])
    render(await RecyclingPage())
    expect(screen.queryByText('Print credit, unspent')).toBeNull()
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/printing/request-screen.test.tsx tests/unit/components/recycling/recycling-screen.test.tsx tests/unit/components/printing/job-screen.test.tsx` → FAIL.
Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/app/recycling.test.tsx` → FAIL.

- [ ] **Step 3: The request screen**

Re-read `request-screen.tsx` first; batch 2 has changed it. Anchors used below: `const [printers, setPrinters] = useState<PrinterWithOwner[]>([])`, the load `Promise.all([…])`, `const ticked = …` (with `quantity`), `const agreeLine = …`, the `send()` post body, the `<PendingRow pending="recycling-credit-spending" …>` line and the agree `Pressable`.

- Import `type RecyclingCredit` from `@splat-connect/types`; delete `import { PendingRow } from '../ui/pending'` if nothing else uses it.
- State, beside `printers`:

```tsx
  const [credit, setCredit] = useState<RecyclingCredit[]>([])
  // The board ticks it for you: credit is what most families would want spent.
  const [useCredit, setUseCredit] = useState(true)
```

- The load: add a third entry to the `Promise.all` array — `apiClient.get<RecyclingCredit[]>('/api/organizations/recycling/credit').catch(() => [] as RecyclingCredit[])` — and in its `.then`, take it as the third value and `setCredit(c)`. (Its own `catch`: a failed credit read must not hide the form.)
- After `const agreeLine = …`:

```tsx
  // 114: credit at the first organisation asked where the family has some.
  // Spent only if that organisation is the one that accepts; never more than
  // the job's filament, which is unknown if any part has no grams.
  const creditAt = printers.map((p) => credit.find((c) => c.org_id === p.owner_org_id)).find(Boolean) ?? null
  const jobGrams = ticked.some((f) => f.filament_grams == null)
    ? null
    : ticked.reduce((n, f) => n + f.filament_grams! * f.quantity, 0)
  const creditUse = creditAt && jobGrams ? Math.min(creditAt.grams, jobGrams) : 0
  const creditOn = useCredit && creditUse > 0
  const agreeText =
    creditOn && creditUse >= jobGrams!
      ? 'I understand my recycling credit covers the filament on this job, and that any balance is settled with the printer, not through SPLAT.'
      : agreeLine
```

- In `send()`'s post body, after the `files: …` line: `...(creditOn && creditAt ? { print_credit: { org_id: creditAt.org_id, grams: creditUse } } : {}),`
- Replace the `<PendingRow pending="recycling-credit-spending" … />` line with:

```tsx
        {creditUse > 0 && creditAt ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: creditOn }}
            accessibilityLabel={`Use ${creditUse} g of your credit at ${creditAt.org_name}`}
            onPress={() => setUseCredit((v) => !v)}
            style={[styles.part, creditOn && styles.agreeOn]}
          >
            <Ionicons
              name={creditOn ? 'checkbox' : 'square-outline'}
              size={24}
              color={creditOn ? theme.colors.success : theme.colors.muted}
            />
            <View style={styles.flex}>
              <Text style={styles.partName}>{`Use ${creditUse} g of your credit at ${creditAt.org_name}`}</Text>
              <Text style={styles.meta}>
                {`You have ${creditAt.grams} g from ${(creditAt.weighed_grams / 1000).toFixed(1)} kg you dropped off. Only deducted if they are the one who takes it.`}
              </Text>
            </View>
          </Pressable>
        ) : null}
```

- The agree `Pressable`'s `accessibilityLabel={agreeLine}` and its `<Text>` `{agreeLine}` become `agreeText`.

- [ ] **Step 4: Hero and cost lines**

`packages/mobile/components/recycling/recycling-screen.tsx`:
- State: `const [credit, setCredit] = useState<RecyclingCredit[]>([])` (import the type).
- `load`'s `Promise.all` gains `apiClient.get<RecyclingCredit[]>('/api/organizations/recycling/credit')` as a third entry; `setCredit(c)` beside `setDrops(mine)`.
- Delete the two hero comments (`{/* "Issued", not the board's "unspent" … */}` and `{/* PENDING(recycling-credit-spending) … */}`); the hero sub-line becomes:

```tsx
              <Text style={styles.heroSub}>
                {credit.reduce((n, c) => n + c.grams, 0).toLocaleString('en-AU')} g of print credit unspent
              </Text>
```

  (`total.credit` is no longer read; leave `diverted` returning it — `badges` and the kilos still use `total.grams`.)
- Header comment: "Credit is shown as the organisation recorded it and never computed here" becomes "Unspent credit comes from the API's balance (114); nothing here computes it".

`packages/mobile/components/printing/job-screen.tsx` — in the "What this print costs you" card, after the rate `<Text style={styles.strong}>`:

```tsx
              {tx.print_credit_grams != null && tx.status !== 'requested' ? (
                <Text style={styles.strong}>{`Your recycling credit (${tx.print_credit_grams} g)`}</Text>
              ) : null}
```

`packages/web/app/dashboard/print-requests/[id]/page.tsx` — after the `{costs && ( … )}` block:

```tsx
      {/* 114: grams spent at accept. Not money, so not a line on the panel's total. */}
      {!viewerIsPrinter && tx.print_credit_grams != null && tx.status !== 'requested' && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--tmint)] px-3 py-1 text-sm font-extrabold text-[var(--tink)]">
          Your recycling credit ({tx.print_credit_grams} g)
        </p>
      )}
```

`packages/web/app/get-involved/recycling/page.tsx`:
- Import `initials` and `type RecyclingCredit` from `@splat-connect/types`.
- In the signed-in branch, before its `return`:

```tsx
    const credit = await apiClient
      .get<RecyclingCredit[]>('/api/organizations/recycling/credit')
      .catch(() => [] as RecyclingCredit[])
```

- Replace the comment "The board's signed-in page leads with your own totals … so those panels are not drawn." with "The board's signed-in page leads with your own totals. Unspent credit per organisation is drawn (114); kilos diverted, badges and the drop-off list are not yet on web."
- After `<OrgsPanel takers={takers} />` in the signed-in branch:

```tsx
        {credit.length > 0 && (
          <div className="mt-6 flex flex-col gap-2 rounded-card bg-[var(--tmint)] px-[26px] py-[22px] text-[var(--tink)]">
            <p className="text-xs font-extrabold uppercase tracking-[.1em] opacity-75">Print credit, unspent</p>
            {credit.map((c) => (
              <span key={c.org_id} className="flex items-center gap-2.5">
                <span aria-hidden="true" className="grid h-8 w-8 flex-none place-items-center rounded-[14px] bg-[var(--surface)] text-xs font-extrabold">
                  {initials(c.org_name ?? '')}
                </span>
                <span className="flex-1 font-bold">{c.org_name}</span>
                <span className="font-display text-[17px] font-extrabold tabular-nums">{`${c.grams} g`}</span>
              </span>
            ))}
            <p className="mt-0.5 text-[13px] leading-[1.45] opacity-80">
              Spendable on filament at that organisation only. It comes off the cost panel when they take your print job.
            </p>
          </div>
        )}
```

- [ ] **Step 5: Run the tests to see them pass**

Run both Step 2 commands. Expected: PASS.

- [ ] **Step 6: Ship the item** — `shipped: true,` on `'recycling-credit-spending'`; `git grep -n "recycling-credit-spending" -- packages scripts ':!packages/types/src/pending.ts' ':!*report.json'` → no output; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 7: Commit**

```bash
git status --short
git add packages/mobile/components/printing/request-screen.tsx packages/mobile/components/recycling/recycling-screen.tsx packages/mobile/components/printing/job-screen.tsx packages/web/app/get-involved/recycling/page.tsx "packages/web/app/dashboard/print-requests/[id]/page.tsx" packages/mobile/tests/unit/components/printing/request-screen.test.tsx packages/mobile/tests/unit/components/recycling/recycling-screen.test.tsx packages/mobile/tests/unit/components/printing/job-screen.test.tsx packages/web/tests/unit/app/recycling.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(recycling): use your recycling credit on a print request, and see what is left

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 8: Full verification and graph update

No new code. Every check the spec names, in an order where a failure points at one thing.

**Files:**
- Modify (generated only): `graphify-out/*`, `scripts/parity/parity-report.json`, `scripts/parity/app-parity-report.json`, `scripts/parity/mobile-report.json`

- [ ] **Step 1: Registry and drift**

Run: `node scripts/pending.mjs --check`
Expected: `docs/PENDING.md is up to date`
Run: `git grep -nE 'PENDING\((recycling-photo-upload|recycling-intake-credit-rule|org-recycling-details|recycling-credit-spending)\)|pending="(recycling-photo-upload|recycling-intake-credit-rule|org-recycling-details|recycling-credit-spending)"' -- . ':!docs/**' ':!packages/types/src/pending.ts'`
Expected: no output.
Run the drift test. Expected: `Tests  11 passed (11)`.

- [ ] **Step 2: Types and unit suites**

Run: `pnpm typecheck` → exit 0.
Run: `pnpm --filter @splat-connect/api test:unit` → all pass.
Run: `pnpm --filter @splat-connect/web test:unit` → all pass.
Run: `pnpm --filter @splat-connect/mobile test:unit` → all pass.

- [ ] **Step 3: API integration against a clean local database**

Run: `supabase db reset` (applies every migration through 114 from scratch — proves 112's CHECK validates on an empty column, 113's grant, and 114's function replacement), then `pnpm --filter @splat-connect/api test:integration`.
Expected: all pass, including `tests/integration/orgs/{recycling-photo,recycling-intake,recycling-details}.test.ts`, `tests/integration/printers/recycling-credit.test.ts`, and the existing `account-deletion` suite (112's trigger runs inside `delete_account`).

- [ ] **Step 4: E2E** (web and mobile never at the same time)

Run: `pnpm --filter @splat-connect/web test:e2e` → PASS (a spec that reads the intake row's second box as kilos fails here: update it to grams, importing only from `tests/e2e/helpers.ts`).
Then: `pnpm --filter @splat-connect/mobile test:e2e` → PASS.

- [ ] **Step 5: Parity re-run**

Run: `./scripts/parity/stack.sh up`, then from `packages/web`: `node ../../scripts/parity/run.js` and `node ../../scripts/parity/app.js --id recycling,org_recycling,print_request,print_job,guide_org`.
Expected: web keeps its prior count with no new findings on `/get-involved/recycling`, `/get-involved/recycling/drop-off`, `/dashboard/organisation/recycling`, `/organizations/[id]/public`, `/dashboard/print-requests/[id]`; the app screens report no `pending` exemption errors. A new finding is a real divergence to fix or explain with `why: "intended"` and a reason — never `why: "pending"` naming a shipped id. Then `node scripts/parity/mobile.js --id recycling,recycle_new,org_recycling,org_public` for the 390px width check (the intake row's two number boxes and the editor's Minimum/Maximum pair must fit one row; fix with `max-sm:` only, per memory).

- [ ] **Step 6: Graph update**

Run: `graphify update .`
Expected: completes without error; `graphify-out/` updated.

- [ ] **Step 7: Commit the generated reports**

```bash
git add graphify-out scripts/parity/parity-report.json scripts/parity/app-parity-report.json scripts/parity/mobile-report.json
git commit -m "chore(recycling): parity reports and graph after the recycling batch

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

Hosted database: migrations 112–114 are **not** pushed by this plan. Pushing to the live "development" project is a separate step Byron approves (`supabase db push`, then `pnpm db:guards`, which now checks the 112 and 114 rows). Before pushing 114, confirm the hosted `accept_toy_transaction` body matches the one 114 was copied from (`select prosrc from pg_proc where proname = 'accept_toy_transaction'` against the file Controller ruling 1 named) — 114 replaces it wholesale.
