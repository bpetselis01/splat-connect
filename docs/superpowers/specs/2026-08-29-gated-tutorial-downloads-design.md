# Gated tutorial downloads

**Date:** 2026-08-29
**Status:** Implemented 2026-08-30; 049 live on the development project. Not committed.
**Touches:** two storage buckets (one migration), `upload.ts`, one new web route
handler, `tutorial-view.tsx`, the edit page's STL rows, `signup/page.tsx`,
`seed.sql`, `SCHEMA.md`, test fixtures — and `packages/mobile`'s detail screen
(added in review, see decision 8).

## Why

A tutorial's PDF and its STL files are SPLAT's own artefacts — the thing a
parent or maker actually came for. Today anyone with the page open can take
them: the `tutorial-pdfs` and `stl-files` buckets are `public: true`
(`001_schema.sql:329`), the public API returns the file URLs to unauthenticated
callers, and the page renders them as plain `<a href>`s. There is no moment at
which SPLAT asks for an account.

Makers Making Change draws the line at design files: parts sourcing is open,
downloads need a login. SPLAT follows that line exactly.

## Decisions taken

All Byron's, 2026-08-29.

1. **PDF and STL downloads require an account.** A signed-out visitor who
   clicks either is sent to `/signup` and returned to the tutorial afterwards.
2. **Parts and tools buy links stay open.** They point at someone else's shop;
   gating them protects nothing of SPLAT's and punishes a parent doing
   five minutes of "can I afford this" research.
3. **Hard gate, not soft.** The file itself refuses to serve without a session.
   A UI-only redirect would leave the bucket public: a signed-in user could
   copy the link and hand it to anyone, and the public API would keep handing
   out working URLs. Rejected.
4. **Sign on click, not at render.** A route handler mints a 60-second signed
   URL when the link is followed. Signing at page render was rejected: a
   1-hour URL in the HTML is shareable for an hour and breaks in a tab left
   open past it. Streaming bytes through the API was rejected as machinery
   out of proportion to the goal (Bearer auth forces fetch-to-blob downloads;
   STLs can be large).
5. **`toy-photos` stays public.** Cover photos are on every card and the
   browse grid is for signed-out parents.
6. **The public API keeps returning the file references.** After the bucket
   flip the stored value is an object path of the form `<tutorialId>/tutorial.pdf`
   — guessable and inert behind a private bucket. Hiding it buys nothing, and
   the page needs to know a file *exists* to show the gated button to the
   very audience the gate is for.
7. **Columns keep their names.** `tutorials.tutorial_pdf_url` and
   `stl_files.file_url` now hold a storage object path, not a URL. A rename
   touches types, the API's `EDITABLE` list, the editor, seed, and every
   fixture, for no change in behaviour. SCHEMA.md documents the semantics.
8. **The mobile app signs in-process.** Found in final review, 2026-08-30: the
   spec above listed every web consumer of the two columns and none of the
   mobile ones. `packages/mobile/components/home/detail-screen.tsx` handed
   `tutorial_pdf_url` straight to a WebView, so 049 broke its preview. The
   mobile app holds its own Supabase session, so it calls
   `createSignedUrl(path, 60)` before navigating and falls back to the
   existing "nothing to open" state on error — the same gate as the web,
   without a route handler. Lesson for the next column-semantics change:
   grep `packages/mobile` too.
9. **The gate is an account gate, not an authorship gate.** The SELECT policy
   is `auth.uid() is not null`: any signed-in user who knows a tutorial id can
   sign that tutorial's files whatever its status. That is what "needs an
   account" means; SCHEMA.md's 049 note says so, so nobody reads more into
   the policy than it delivers.

## Data — migration `049_gate_tutorial_files.sql`

```sql
update storage.buckets set public = false where id in ('tutorial-pdfs', 'stl-files');

drop policy if exists "Public read tutorial-pdfs" on storage.objects;
drop policy if exists "Public read stl-files" on storage.objects;

create policy "Signed-in read tutorial-pdfs"
  on storage.objects for select
  using (bucket_id = 'tutorial-pdfs' and auth.uid() is not null);

create policy "Signed-in read stl-files"
  on storage.objects for select
  using (bucket_id = 'stl-files' and auth.uid() is not null);

-- Existing rows hold the public URL. Keep only the object path.
update public.tutorials
  set tutorial_pdf_url = substring(tutorial_pdf_url from '/object/public/tutorial-pdfs/(.*)$')
  where tutorial_pdf_url like '%/object/public/tutorial-pdfs/%';

update public.stl_files
  set file_url = substring(file_url from '/object/public/stl-files/(.*)$')
  where file_url like '%/object/public/stl-files/%';
```

The select policy is what lets a user's own JWT create a signed URL: Supabase
Storage checks `select` on the object before signing with anything other than
the service key. Upload and update policies from 032 are untouched.

Verified on the linked development project 2026-08-29 before writing this:
all four buckets `public = true`; 7 `tutorial_pdf_url` rows, every one in the
exact `https://<ref>.supabase.co/storage/v1/object/public/tutorial-pdfs/<id>/tutorial.pdf`
shape; 0 `stl_files` rows (purged earlier the same day); ledger in sync at 048.
The rewrite has one shape to handle.

`seed.sql`: `tutorial_pdf_url` values become `'<tutorial id>/tutorial.pdf'`,
`stl_files.file_url` becomes `'<tutorial id>/mount.stl'`. Placeholder domains
would otherwise survive the migration's `like` guard and be sent to the route
handler as paths.

`SCHEMA.md`: the bucket table notes which buckets are private and why; the two
columns are annotated "storage object path within `<bucket>`, not a URL — see
049".

## Upload — `packages/api/src/routes/upload.ts`

The PDF and STL handlers return `data.path` in place of
`getPublicUrl(data.path).publicUrl`. The response key stays `url` so the
editor's plumbing (`edit/page.tsx:103`, `:144`) is unchanged; a comment on
each says the value is a path. `toy-photos` and `toy-photos-library` handlers
are untouched.

## Route handler — `packages/web/app/files/[bucket]/[...path]/route.ts`

The web app's first route handler. `GET /files/<bucket>/<tutorialId>/<file>`.

1. `bucket` must be `tutorial-pdfs` or `stl-files`; anything else is 404. The
   allowlist is the whole reason the handler is not a generic proxy.
2. Build the cookie-session Supabase client. `lib/auth.ts` and
   `lib/api-client.ts` each construct one inline today; the construction moves
   to `lib/supabase/server.ts` and `lib/auth.ts` becomes its first caller
   alongside the handler. `api-client.ts` is left alone — not this change's
   job.
3. `supabase.auth.getUser()`. No user → `redirect('/signup?next=/tutorials/<path[0]>&reason=download')`.
   The first path segment is the tutorial id by the bucket layout 032
   enforces.
4. `supabase.storage.from(bucket).createSignedUrl(path.join('/'), 60, opts)`,
   where `opts` is `{ download: <last segment> }` for `stl-files` (a browser
   would otherwise try to render an STL) and nothing for `tutorial-pdfs` (the
   PDF opens inline, as it does today). Error or no data → 404.
5. `redirect(signedUrl)`.

Sixty seconds is the click-through window, not a viewing window; the redirect
is followed immediately. A copied `/files/…` link is useless without a session
and never goes stale.

## Rendering

`TutorialView` gains a required `signedIn: boolean` prop. Required, not
defaulted: a gate that defaults open is the wrong default, and there are only
three callers.

- Signed in: PDF button `href="/files/tutorial-pdfs/<path>"`, each STL row
  `href="/files/stl-files/<path>"`. PDF keeps `target="_blank"`; STL rows drop
  it, since the signed URL forces a download.
- Signed out: both `href="/signup?next=/tutorials/<id>&reason=download"`, no
  `target`. Same element, different destination, no client JavaScript — the
  same move `save-button.tsx` makes for saves.
- Buy links: unchanged in both states.

Callers: `tutorials/[id]/page.tsx` passes `saved !== null` (already computed
for `SaveButton`); the leader project page and the admin review page pass
`true`.

The editor's STL rows (`edit/page.tsx:236`) link to `/files/stl-files/<path>`.
`EditFilesSection` only tests `currentPdfUrl` for presence and needs no change.
`lib/validation.ts` likewise.

`signup/page.tsx` gets a second banner beside the `save` one:
`reason === 'download'` → "You need an account to download tutorial files.
Create one and we'll take you back." The existing `next` handling returns
them to the tutorial.

## Error handling

- Unknown bucket, storage error, missing object: 404 from the handler. There is
  no partial state to explain; the link came from a page that believed the
  file existed.
- Signed URL expired between redirect and fetch: Supabase's own error page.
  At 60 seconds this needs a paused browser to reach.
- Legacy value that survived the migration (a placeholder domain in a dev
  database): the handler treats it as a path, storage says no such object,
  404. Seed is updated so local databases do not produce this.

## Tests

Web unit:
- `tutorial-view.test.tsx`: signed out → PDF and STL hrefs point at `/signup`
  with `next` and `reason=download`, buy links still point at the shop;
  signed in → hrefs point at `/files/<bucket>/<path>`.
- `app/files/route.test.ts`: unknown bucket → 404; no session → redirect to
  signup with the tutorial id in `next`; session → redirect to the signed URL,
  with `download` set for STL and unset for PDF.
- `signup` page test: the `download` banner renders for `reason=download`.

API unit:
- `upload.test.ts`: PDF and STL responses carry the object path, not a URL.

API integration (local Supabase):
- `storage-gate.test.ts`: anon client cannot `createSignedUrl` or download
  from either bucket; an authenticated client can do both. This proves the
  policy and the bucket flag, which no unit test can.

E2E:
- Fixtures in `helpers.ts` switch to paths.
- Public tutorial page, signed out: click Download Tutorial PDF → lands on
  `/signup` with the banner; complete signup → back on the tutorial.
- `upload-flow.spec.ts` uploads a real PDF and never asserts its URL; it
  needs no change, and passing it after the migration is the proof that
  upload → path → editor still round-trips against a private bucket.

## Rollout

Apply 049 to the linked development project the way 048 was. Existing PDF rows
are rewritten by the same migration, so the seven live PDFs keep working for
signed-in users the moment it lands and stop working for everyone else at the
same moment.

## Out of scope, on purpose

- Renaming the two columns (decision 7).
- Stripping file references from the public API (decision 6).
- Gating buy links (decision 2).
- Rate-limiting or logging downloads. Nothing asked for it.
- Touching `api-client.ts`'s inline client construction.
