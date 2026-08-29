# Gated Tutorial Downloads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tutorial's PDF and STL files download only for a signed-in user; a signed-out visitor who clicks either is sent to sign up and returned to the tutorial. Buy links stay open.

**Architecture:** The `tutorial-pdfs` and `stl-files` buckets go private and the stored file references become object paths. A new web route handler `GET /files/[bucket]/[...path]` reads the session cookie and either mints a 60-second signed URL and redirects to it, or redirects to `/signup?next=…&reason=download`. `TutorialView` points its file links at that handler when signed in and at signup when not.

**Tech Stack:** Supabase Storage + Postgres migrations, Hono API (`packages/api`), Next.js 15 App Router route handler (`packages/web`), `@supabase/ssr`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-29-gated-tutorial-downloads-design.md`

## Global Constraints

- **No commits.** Byron commits when he asks to. Every task ends at "tests pass", not at a commit.
- Only `tutorial-pdfs` and `stl-files` change. `toy-photos` and `toy-photos-library` stay public and untouched.
- `tutorials.tutorial_pdf_url` and `stl_files.file_url` keep their names and now hold a storage object path of the form `<tutorialId>/<file>` — never a URL. Do not rename them.
- The upload responses keep the key `url`; only the value changes (a path).
- Signed URL lifetime is exactly `60` seconds.
- Signup detour is exactly `/signup?next=/tutorials/<tutorialId>&reason=download` (before URL-encoding). Banner copy is exactly: `You need an account to download tutorial files. Create one and we'll take you back.`
- Migration applies to the local stack (`supabase migration up --local`) in Task 1 and to the linked cloud project (`supabase db push`) only in Task 6.
- Commands: API unit `pnpm --filter @splat-connect/api test:unit`; API integration `pnpm --filter @splat-connect/api test:integration` (needs `supabase start`); web unit `pnpm --filter @splat-connect/web test:unit`; web lint `pnpm --filter @splat-connect/web lint`; typecheck `pnpm typecheck`; e2e `pnpm --filter @splat-connect/web test:e2e` (needs the local stack, API and web dev servers per `packages/web/playwright.config.ts`).

---

### Task 1: Migration 049, schema doc, seed, and the policy proof

**Files:**
- Create: `supabase/migrations/049_gate_tutorial_files.sql`
- Create: `packages/api/tests/integration/storage/storage-gate.test.ts`
- Modify: `supabase/SCHEMA.md:20` (migration index), `supabase/SCHEMA.md:852-880` (section 4 Storage), `supabase/SCHEMA.md` `tutorials` and `stl_files` column tables
- Modify: `supabase/seed.sql:72-74`, `supabase/seed.sql:86-87`, `supabase/seed.sql:93-97`

**Interfaces:**
- Produces: two private buckets with select policy `auth.uid() is not null`; every stored file reference is `<tutorialId>/<file>`.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/049_gate_tutorial_files.sql
-- WHY: a tutorial's PDF and STL files are the thing a parent or maker came
--      for, and until now anyone with the page open could take them: both
--      buckets were public (001), the public API handed out the URLs, and the
--      page rendered them as plain links. Makers Making Change gates exactly
--      these — design files behind a login, parts sourcing open — and SPLAT
--      follows that line. toy-photos stays public: cover photos are on every
--      card in a browse grid built for signed-out parents.
-- HOW: flip the two buckets private and replace "anyone reads" with "a
--      signed-in user reads". That select policy is what lets a user's own
--      JWT mint a signed URL (Storage checks select before signing with
--      anything but the service key); the web route handler at
--      /files/<bucket>/<path> does the minting. The stored values change from
--      the public URL to the object path, because a public URL to a private
--      bucket is a dead link and the path is what the signer needs. Verified
--      on the linked project before writing this: every existing value is in
--      the one shape the rewrite below handles; stl_files was empty.

update storage.buckets set public = false where id in ('tutorial-pdfs', 'stl-files');

drop policy if exists "Public read tutorial-pdfs" on storage.objects;
drop policy if exists "Public read stl-files" on storage.objects;

create policy "Signed-in read tutorial-pdfs"
  on storage.objects for select
  using (bucket_id = 'tutorial-pdfs' and auth.uid() is not null);

create policy "Signed-in read stl-files"
  on storage.objects for select
  using (bucket_id = 'stl-files' and auth.uid() is not null);

update public.tutorials
  set tutorial_pdf_url = substring(tutorial_pdf_url from '/object/public/tutorial-pdfs/(.*)$')
  where tutorial_pdf_url like '%/object/public/tutorial-pdfs/%';

update public.stl_files
  set file_url = substring(file_url from '/object/public/stl-files/(.*)$')
  where file_url like '%/object/public/stl-files/%';
```

- [ ] **Step 2: Update the seed so local databases hold paths, not placeholder URLs**

In `supabase/seed.sql`, the approved tutorial (`aaaaaaaa-…`) — replace the `tutorial_pdf_url` value:

```sql
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/tutorial.pdf', 'https://placeholder.invalid/photo.jpg',
```

Its STL row:

```sql
insert into public.stl_files (tutorial_id, filename, file_url)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'mount.stl', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/mount.stl');
```

The pending tutorial (`bbbbbbbb-…`):

```sql
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/tutorial.pdf', 'https://placeholder.invalid/photo2.jpg');
```

Update the comment above the approved tutorial from `File URLs are placeholders: E2E asserts page rendering, not downloads.` to:

```sql
-- PDF and STL values are storage paths (049) with no object behind them: E2E
-- asserts page rendering; the one download E2E uploads its own file.
-- toy_photo_url stays a placeholder URL — toy-photos is still a public bucket.
```

Leave every `toy_photo_url` as it is.

- [ ] **Step 3: Update SCHEMA.md**

Add to the migration index after the 048 row:

```markdown
| 049 | `049_gate_tutorial_files.sql` | Makes `tutorial-pdfs` and `stl-files` private with a signed-in-only SELECT policy; rewrites `tutorials.tutorial_pdf_url` and `stl_files.file_url` from public URLs to object paths. |
```

In the `tutorials` column table, change the `tutorial_pdf_url` row's constraints cell to:

```markdown
| `tutorial_pdf_url` | text | nullable — since 049 a storage object path in `tutorial-pdfs` (`<tutorial id>/tutorial.pdf`), not a URL; served via `GET /files/tutorial-pdfs/<path>` |
```

In the `stl_files` column table, change the `file_url` row to:

```markdown
| `file_url` | text | not null — since 049 a storage object path in `stl-files` (`<tutorial id>/<filename>`), not a URL; served via `GET /files/stl-files/<path>` |
```

Replace the opening of section 4 (`Three **public** buckets …` through the buckets `insert`) with:

```markdown
Three buckets were created public in 001. Since 049, `tutorial-pdfs` and `stl-files` are **private** — a tutorial's files need an account, the way Makers Making Change gates design files — and only `toy-photos` is still public (cover photos are on every browse card).

```sql
insert into storage.buckets (id, name, public) values
  ('tutorial-pdfs', 'tutorial-pdfs', true),   -- flipped to false in 049
  ('toy-photos',    'toy-photos',    true),
  ('stl-files',     'stl-files',     true);   -- flipped to false in 049
```

Per bucket there are three policies — **SELECT** (public for `toy-photos`; `auth.uid() is not null` for the other two since 049), contributor **INSERT**, and contributor **UPDATE** (file replacement). …
```

Keep the rest of the paragraph and the policy code block as they are, but change the code block's first policy to:

```sql
-- shown for tutorial-pdfs; stl-files is identical with the bucket id swapped.
-- toy-photos keeps the original "Public read" policy with no auth.uid() test.
create policy "Signed-in read tutorial-pdfs"
  on storage.objects for select
  using (bucket_id = 'tutorial-pdfs' and auth.uid() is not null);
```

Add after the 002 note:

```markdown
> **049 note:** signed-in users never fetch these two buckets directly. The web route handler `packages/web/app/files/[bucket]/[...path]/route.ts` checks the session cookie, creates a 60-second signed URL with the user's own JWT (which is why the SELECT policy exists — Storage checks it before signing), and redirects. A signed-out visitor is redirected to `/signup?next=/tutorials/<id>&reason=download` instead.
```

- [ ] **Step 4: Apply the migration locally and reset the seed**

Run: `supabase migration up --local && supabase db reset`
Expected: 049 listed as applied; reset completes with no error. (`db reset` re-runs every migration plus the seed, which is what the E2E suite expects.)

Then confirm the flags flipped:

Run: `supabase db query --local "select id, public from storage.buckets order by id"`
Expected: `stl-files` false, `toy-photos` true, `toy-photos-library` true, `tutorial-pdfs` false.

- [ ] **Step 5: Write the integration test that proves the policy**

```ts
// packages/api/tests/integration/storage/storage-gate.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createUserClient } from '../../../src/supabase/user-client.js'
import { createAnonClient } from '../../../src/supabase/client.js'

/**
 * 049 made tutorial-pdfs and stl-files private with a signed-in-only SELECT
 * policy. This is the only test that exercises the bucket flag and the policy
 * together — a unit test mocks the storage client and would pass against a
 * public bucket.
 */
let user: TestUser
const tutorialId = crypto.randomUUID()
const pdfPath = `${tutorialId}/tutorial.pdf`
const stlPath = `${tutorialId}/bracket.stl`

beforeAll(async () => {
  user = await createTestUser('contributor')
  const admin = adminClient()
  await admin.storage.from('tutorial-pdfs').upload(pdfPath, new Blob(['%PDF-1.4 gate']), { upsert: true })
  await admin.storage.from('stl-files').upload(stlPath, new Blob(['solid gate']), { upsert: true })
})

afterAll(async () => {
  const admin = adminClient()
  await admin.storage.from('tutorial-pdfs').remove([pdfPath])
  await admin.storage.from('stl-files').remove([stlPath])
  await deleteTestUser(user.id)
})

describe.each([
  ['tutorial-pdfs', pdfPath],
  ['stl-files', stlPath],
])('%s', (bucket, path) => {
  it('is not served at its old public URL', async () => {
    const { data } = createAnonClient().storage.from(bucket).getPublicUrl(path)
    const res = await fetch(data.publicUrl)
    expect(res.ok).toBe(false)
  })

  it('cannot be signed by an anonymous client', async () => {
    const { data, error } = await createAnonClient().storage.from(bucket).createSignedUrl(path, 60)
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  it('is signed and served for a signed-in user', async () => {
    const { data, error } = await createUserClient(user.token).storage.from(bucket).createSignedUrl(path, 60)
    expect(error).toBeNull()
    const res = await fetch(data!.signedUrl)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 6: Run the integration test**

Run: `pnpm --filter @splat-connect/api test:integration -- storage-gate`
Expected: 6 passing. If "is not served at its old public URL" fails with `res.ok === true`, the bucket flag did not flip — check Step 4 before touching the test.

Also run the existing storage suite so nothing else regressed:

Run: `pnpm --filter @splat-connect/api test:integration -- storage`
Expected: all passing. (`storage/upload.test.ts` asserts `url` *contains* `/tutorial-pdfs/`, which the current public URL still does; Task 2 changes that assertion.)

---

### Task 2: Upload returns the object path

**Files:**
- Modify: `packages/api/src/routes/upload.ts:87-92` (PDF), `packages/api/src/routes/upload.ts:156-161` (STL)
- Modify: `packages/api/tests/unit/routes/upload.test.ts:76,112,254,302`
- Modify: `packages/api/tests/integration/storage/upload.test.ts:58-68` and the STL case in the same file
- Modify: `packages/types/src/index.ts:540`, `packages/types/src/index.ts:590` (doc comments only)

**Interfaces:**
- Produces: `POST /api/upload/pdf` → `{ url: '<tutorialId>/tutorial.pdf' }`; `POST /api/upload/stl` → `{ url: '<tutorialId>/<file.name>', filename }`. The web editor stores `url` unchanged into `tutorial_pdf_url` / `file_url`.

- [ ] **Step 1: Change the unit test expectations to the path**

In `packages/api/tests/unit/routes/upload.test.ts`, the `POST /pdf` success case at line 112:

```ts
    // Since 049 the bucket is private: a public URL would be a dead link, so
    // the response carries the object path for /files/tutorial-pdfs/<path>.
    expect(body.url).toBe('tid-1/tutorial.pdf')
    expect(mockGetPublicUrl).not.toHaveBeenCalled()
```

The `POST /stl` success case at line 302:

```ts
    expect(body.url).toBe('tid-1/bracket.stl')
    expect(body.filename).toBe('bracket.stl')
    expect(mockGetPublicUrl).not.toHaveBeenCalled()
```

Leave the `mockGetPublicUrl.mockReturnValue(...)` lines in both `beforeEach` blocks — deleting them is fine too, but the `not.toHaveBeenCalled` assertion is the one that matters.

- [ ] **Step 2: Run the two cases to see them fail**

Run: `pnpm --filter @splat-connect/api test:unit -- upload`
Expected: the PDF and STL success cases FAIL — `body.url` is `https://example.com/tid-1/tutorial.pdf` and `mockGetPublicUrl` was called.

- [ ] **Step 3: Return the path**

In `packages/api/src/routes/upload.ts`, replace lines 87–92 (PDF) with:

```ts
  if (error) return c.json({ error: error.message }, 500)

  // The object path, not a URL: the bucket has been private since 049, and
  // the web serves this through /files/tutorial-pdfs/<path> with a signed
  // URL minted per click. The key stays `url` so the editor is unchanged.
  return c.json({ url: data.path })
```

Replace lines 156–161 (STL) with:

```ts
  if (error) return c.json({ error: error.message }, 500)

  // Path, not URL — see /pdf above; served via /files/stl-files/<path>.
  return c.json({ url: data.path, filename: file.name })
```

Do not touch `/photo` or `/toy-cover`.

- [ ] **Step 4: Run the unit tests**

Run: `pnpm --filter @splat-connect/api test:unit -- upload`
Expected: all passing.

- [ ] **Step 5: Update the integration assertion**

In `packages/api/tests/integration/storage/upload.test.ts`, the PDF case (lines 58–68) — rename and reassert:

```ts
  it('uploads a PDF to the tutorial-pdfs bucket and returns its path', async () => {
    const res = await uploadRequest(
      '/api/upload/pdf',
      user.token,
      new File(['%PDF-1.4 test'], 'tutorial.pdf', { type: 'application/pdf' })
    )
    expect(res.status).toBe(200)
    const { url } = (await res.json()) as { url: string }
    expect(url).toBe(`${tutorialId}/tutorial.pdf`)
  })
```

The STL case at lines 90–100 (`'uploads an STL to the stl-files bucket and returns url + filename'`) — rename it to `'… returns path + filename'` and replace line 98 `expect(body.url).toContain('/stl-files/')` with:

```ts
    expect(body.url).toBe(`${tutorialId}/bracket.stl`)
```

- [ ] **Step 6: Annotate the types**

In `packages/types/src/index.ts`, above line 540:

```ts
  /** Storage object path in `tutorial-pdfs` (`<id>/tutorial.pdf`), not a URL — served via /files/tutorial-pdfs/<path>. Null until uploaded. */
  tutorial_pdf_url: string | null
```

Above line 590:

```ts
  /** Storage object path in `stl-files` (`<tutorial id>/<filename>`), not a URL — served via /files/stl-files/<path>. */
  file_url: string
```

- [ ] **Step 7: Run integration, unit, typecheck**

Run: `pnpm --filter @splat-connect/api test:integration -- storage && pnpm --filter @splat-connect/api test:unit && pnpm typecheck`
Expected: all passing, zero type errors.

---

### Task 3: The `/files` route handler

**Files:**
- Create: `packages/web/lib/supabase/server.ts`
- Modify: `packages/web/lib/auth.ts:1-24`
- Create: `packages/web/app/files/[bucket]/[...path]/route.ts`
- Create: `packages/web/tests/unit/app/files-route.test.ts`

**Interfaces:**
- Produces: `createServerSupabase(): Promise<SupabaseClient>` in `lib/supabase/server.ts` — cookie-session client for server components and route handlers.
- Produces: `GET /files/<bucket>/<tutorialId>/<file>` — 302 to a signed URL, 302 to signup, or 404. This is the only URL Task 4 links to.

- [ ] **Step 1: Extract the server client from `lib/auth.ts`**

Create `packages/web/lib/supabase/server.ts`:

```ts
/**
 * Cookie-session Supabase client for server components and route handlers.
 *
 * Extracted from lib/auth.ts when the /files route handler became the second
 * caller. The setAll try/catch is load-bearing: a Server Component cannot set
 * cookies, and the middleware owns the refresh.
 *
 * Related files:
 * - lib/auth.ts: getUserRole, the first caller
 * - app/files/[bucket]/[...path]/route.ts: signs storage URLs with this
 */
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function createServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component cannot set cookies — middleware handles refresh
          }
        },
      },
    }
  )
}
```

Then in `packages/web/lib/auth.ts`, replace lines 1–24 (imports through the closing `)` of `createServerClient(...)`) with:

```ts
import { createServerSupabase } from '@/lib/supabase/server'
import type { Role } from '@splat-connect/types'

export async function getUserRole(): Promise<Role | null> {
  try {
    const supabase = await createServerSupabase()
```

The rest of the function is unchanged. `lib/api-client.ts` keeps its own inline client — out of scope.

- [ ] **Step 2: Run the existing web unit tests to confirm nothing broke**

Run: `pnpm --filter @splat-connect/web test:unit && pnpm typecheck`
Expected: all passing. If a test mocks `next/headers` for `lib/auth.ts`, it still works because `server.ts` imports the same module.

- [ ] **Step 3: Write the failing route handler test**

```ts
// @vitest-environment node
// packages/web/tests/unit/app/files-route.test.ts
// node, not jsdom: the handler returns a NextResponse, and jsdom's Response
// is not the one next/server builds on.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/files/[bucket]/[...path]/route'

const getUser = vi.fn()
const createSignedUrl = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: async () => ({
    auth: { getUser },
    storage: { from: () => ({ createSignedUrl }) },
  }),
}))

function call(bucket: string, path: string[]) {
  return GET(new Request(`http://web.test/files/${bucket}/${path.join('/')}`), {
    params: Promise.resolve({ bucket, path }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  getUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://supabase.test/signed' }, error: null })
})

describe('GET /files/[bucket]/[...path]', () => {
  it('refuses any bucket but the two gated ones', async () => {
    const res = await call('toy-photos', ['t1', 'photo.jpg'])
    expect(res.status).toBe(404)
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  // The detour carries the tutorial, which is the first path segment by the
  // folder layout 032 enforces — the visitor comes back to the page they left.
  it('sends a signed-out visitor to sign up, pointed back at the tutorial', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const res = await call('tutorial-pdfs', ['t1', 'tutorial.pdf'])
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(
      'http://web.test/signup?next=%2Ftutorials%2Ft1&reason=download'
    )
    expect(createSignedUrl).not.toHaveBeenCalled()
  })

  it('redirects a signed-in user to a 60-second signed URL for a PDF, opened inline', async () => {
    const res = await call('tutorial-pdfs', ['t1', 'tutorial.pdf'])
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://supabase.test/signed')
    expect(createSignedUrl).toHaveBeenCalledWith('t1/tutorial.pdf', 60, undefined)
  })

  // A browser would try to render an STL as text; the download option makes
  // Storage answer with Content-Disposition: attachment and the real name.
  it('forces a download with the original filename for an STL', async () => {
    const res = await call('stl-files', ['t1', 'bracket.stl'])
    expect(res.status).toBe(302)
    expect(createSignedUrl).toHaveBeenCalledWith('t1/bracket.stl', 60, { download: 'bracket.stl' })
  })

  it('404s when storage cannot sign the object', async () => {
    createSignedUrl.mockResolvedValue({ data: null, error: { message: 'Object not found' } })
    const res = await call('tutorial-pdfs', ['t1', 'tutorial.pdf'])
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 4: Run it to see it fail**

Run: `pnpm --filter @splat-connect/web test:unit -- files-route`
Expected: FAIL — cannot resolve `@/app/files/[bucket]/[...path]/route`.

- [ ] **Step 5: Write the handler**

```ts
// packages/web/app/files/[bucket]/[...path]/route.ts
/**
 * The gate on a tutorial's files.
 *
 * tutorial-pdfs and stl-files have been private buckets since 049, so a file
 * is never linked directly. The page links here instead, and this handler
 * either mints a 60-second signed URL with the visitor's own session and
 * redirects to it, or — with no session — redirects to signup pointed back at
 * the tutorial. Sixty seconds is the click-through window: the redirect is
 * followed immediately, so a copied /files link never goes stale and is
 * useless to anyone without an account.
 *
 * Signing on click rather than at page render is the whole design: a signed
 * URL in the HTML would be shareable for its lifetime and would break in a
 * tab left open past it.
 *
 * Related files:
 * - components/tutorial-view.tsx: builds the /files hrefs, or the signup
 *   href when it already knows the visitor is signed out
 * - supabase/migrations/049_gate_tutorial_files.sql: the bucket flip and the
 *   select policy that lets a user JWT sign
 * - app/signup/page.tsx: reads ?reason=download
 */
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

// The allowlist is why this is not a generic storage proxy. STLs are sent as
// an attachment under their own name; a PDF opens inline, as it always has.
const GATED = {
  'tutorial-pdfs': { download: false },
  'stl-files': { download: true },
} as const

export async function GET(
  req: Request,
  { params }: { params: Promise<{ bucket: string; path: string[] }> }
) {
  const { bucket, path } = await params
  const rule = GATED[bucket as keyof typeof GATED]
  if (!rule || path.length < 2) return new NextResponse(null, { status: 404 })

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    // path[0] is the tutorial id: every object in these buckets lives under
    // its tutorial's folder (032).
    const next = encodeURIComponent(`/tutorials/${path[0]}`)
    return NextResponse.redirect(new URL(`/signup?next=${next}&reason=download`, req.url), 302)
  }

  const objectPath = path.join('/')
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, 60, rule.download ? { download: path[path.length - 1] } : undefined)
  if (error || !data) return new NextResponse(null, { status: 404 })

  return NextResponse.redirect(data.signedUrl, 302)
}
```

- [ ] **Step 6: Run the test**

Run: `pnpm --filter @splat-connect/web test:unit -- files-route`
Expected: 5 passing.

- [ ] **Step 7: Lint and typecheck**

Run: `pnpm --filter @splat-connect/web lint && pnpm typecheck`
Expected: clean. If the linter objects to the `[bucket]` import path in the test, that is a real Next segment name — keep it.

---

### Task 4: Page rendering and the signup banner

**Files:**
- Modify: `packages/web/components/tutorial-view.tsx:40-49` (props), `:103-112` (PDF), `:192-206` (STL)
- Modify: `packages/web/app/tutorials/[id]/page.tsx:27-40`
- Modify: `packages/web/app/organizations/[id]/projects/[tutorialId]/page.tsx:118`
- Modify: `packages/web/app/admin/review/[id]/page.tsx:97`
- Modify: `packages/web/app/tutorials/[id]/edit/page.tsx:235-241`
- Modify: `packages/web/app/signup/page.tsx:93-97`
- Modify: `packages/web/tests/unit/components/tutorial-view.test.tsx`
- Modify: `packages/web/tests/unit/pages/signup.test.tsx`

**Interfaces:**
- Consumes: `GET /files/<bucket>/<path>` from Task 3.
- Produces: `TutorialView` prop `signedIn: boolean` (required).

- [ ] **Step 1: Write the failing `TutorialView` tests**

In `packages/web/tests/unit/components/tutorial-view.test.tsx`, every existing `render(<TutorialView tutorial={…} />)` gains `signedIn` — the prop is required, so typecheck forces this. Use `signedIn` on all five existing renders (they are about kind and recommendations; the value does not matter to them). Then add:

```ts
  const files = { kind: 'assistive_tech' as const, tutorial_pdf_url: 't1/tutorial.pdf', stl_files: stl }

  // The link is the gate the visitor sees. Same <a>, a different destination
  // — no client JavaScript, the way save-button.tsx sends a signed-out saver
  // to signup.
  it('sends a signed-out visitor to sign up from the PDF and each STL', () => {
    render(<TutorialView tutorial={tutorial(files)} signedIn={false} />)
    const detour = '/signup?next=%2Ftutorials%2Ft1&reason=download'
    expect(screen.getByRole('link', { name: 'Download Tutorial PDF' })).toHaveAttribute('href', detour)
    expect(screen.getByRole('link', { name: 'bracket.stl' })).toHaveAttribute('href', detour)
    expect(screen.getByRole('link', { name: 'Download Tutorial PDF' })).not.toHaveAttribute('target')
  })

  it('links a signed-in visitor through /files, which signs on click', () => {
    render(<TutorialView tutorial={tutorial(files)} signedIn />)
    expect(screen.getByRole('link', { name: 'Download Tutorial PDF' })).toHaveAttribute(
      'href',
      '/files/tutorial-pdfs/t1/tutorial.pdf'
    )
    expect(screen.getByRole('link', { name: 'Download Tutorial PDF' })).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('link', { name: 'bracket.stl' })).toHaveAttribute('href', '/files/stl-files/t1/bracket.stl')
    expect(screen.getByRole('link', { name: 'bracket.stl' })).not.toHaveAttribute('target')
  })

  // Parts sourcing is open in both states: it is someone else's shop, and a
  // parent pricing a build should not need an account to do it.
  it('leaves buy links open either way', () => {
    const parts = [{ id: 'p1', tutorial_id: 't1', name: 'Switch', quantity: 1, is_optional: false, buy_links: [{ label: 'Jaycar', url: 'https://shop.test/switch' }] }]
    render(<TutorialView tutorial={tutorial({ parts })} signedIn={false} />)
    expect(screen.getByRole('link', { name: 'Buy Switch from Jaycar' })).toHaveAttribute('href', 'https://shop.test/switch')
  })
```

Also update the `stl` fixture at the top of the file to hold a path: `file_url: 't1/bracket.stl'`.

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @splat-connect/web test:unit -- tutorial-view`
Expected: the three new cases FAIL (hrefs are `t1/tutorial.pdf` / `t1/bracket.stl`).

- [ ] **Step 3: Implement in `tutorial-view.tsx`**

Extend the props (lines 40–49):

```tsx
export function TutorialView({
  tutorial,
  backing,
  headerAction,
  signedIn,
}: {
  tutorial: Viewable
  /** The leader page fetches backing separately; everyone else has it embedded. */
  backing?: TutorialOrg[]
  headerAction?: ReactNode
  /**
   * Whether file links go to /files (signs on click) or to signup. Required,
   * not defaulted: a gate that defaults open is the wrong default, and there
   * are three callers.
   */
  signedIn: boolean
}) {
```

Just inside the function body, after the `collaborators` line:

```tsx
  // A signed-out visitor is sent to sign up from the same <a>; the route
  // handler behind /files would do the same, but the page already knows and
  // should not hand out a link it knows will bounce.
  const signupHref = `/signup?next=${encodeURIComponent(`/tutorials/${tutorial.id}`)}&reason=download`
  const fileHref = (bucket: 'tutorial-pdfs' | 'stl-files', path: string) =>
    signedIn ? `/files/${bucket}/${path}` : signupHref
  // Only a link to a file opens in a new tab; the signup detour is this tab.
  const newTab = signedIn ? { target: '_blank', rel: 'noopener noreferrer' } : {}
```

Replace the PDF block (lines 103–112):

```tsx
        {tutorial.tutorial_pdf_url && (
          <a
            href={fileHref('tutorial-pdfs', tutorial.tutorial_pdf_url)}
            {...newTab}
            className="btn btn-primary btn-block mt-6"
          >
            <FileText /> Download Tutorial PDF
          </a>
        )}
```

Replace the STL `<a>` (lines 196–204) — no `target` in either state, since the signed URL is served as an attachment:

```tsx
              <a
                key={f.id}
                href={fileHref('stl-files', f.file_url)}
                className="ref-row flex items-center gap-2 text-sm font-semibold text-brand-dark hover:underline"
              >
                <Download /> {f.filename}
              </a>
```

Update the header comment's "Related files" list to add:

```
 * - app/files/[bucket]/[...path]/route.ts: where the file links go
```

- [ ] **Step 4: Pass `signedIn` from the three callers**

`packages/web/app/tutorials/[id]/page.tsx` — inside the `<TutorialView` element (line 27 onward) add, before `headerAction=`:

```tsx
      signedIn={saved !== null}
```

`packages/web/app/organizations/[id]/projects/[tutorialId]/page.tsx:118`:

```tsx
      <TutorialView tutorial={tutorial!} backing={backingRows} signedIn />
```

`packages/web/app/admin/review/[id]/page.tsx:97`:

```tsx
      <TutorialView tutorial={tutorial!} signedIn />
```

- [ ] **Step 5: Route the editor's STL rows through `/files`**

`packages/web/app/tutorials/[id]/edit/page.tsx:235-241` — the contributor is always signed in here:

```tsx
                  <a
                    href={`/files/stl-files/${f.file_url}`}
                    className="font-semibold text-brand-dark hover:underline"
                  >
                    {f.filename}
                  </a>
```

(`target` and `rel` are dropped: the signed URL is an attachment.)

- [ ] **Step 6: Run the view tests, the page tests, and typecheck**

Run: `pnpm --filter @splat-connect/web test:unit && pnpm typecheck`
Expected: all passing, zero type errors. `tutorial-view.test.tsx` is the only test that renders `TutorialView` directly (verified 2026-08-29); the page tests render pages, which now pass the prop themselves. `edit-tutorial.test.tsx` asserts nothing about STL hrefs.

- [ ] **Step 7: Write the failing signup banner test**

In `packages/web/tests/unit/pages/signup.test.tsx`, make the `useSearchParams` mock configurable and add a case:

```ts
let search = ''
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search),
}))
```

(Replace the existing `useSearchParams: () => new URLSearchParams()` mock with this.) Then add to the `describe`:

```ts
  // The download detour says why the visitor is here, the way the save one
  // does — a signup page with no explanation reads as a paywall.
  it('explains the download detour', () => {
    search = 'next=%2Ftutorials%2Ft1&reason=download'
    render(<SignupPage />)
    expect(
      screen.getByText("You need an account to download tutorial files. Create one and we'll take you back.")
    ).toBeInTheDocument()
    search = ''
  })
```

- [ ] **Step 8: Run it to see it fail**

Run: `pnpm --filter @splat-connect/web test:unit -- signup`
Expected: the new case FAILS — text not found.

- [ ] **Step 9: Add the banner**

`packages/web/app/signup/page.tsx`, directly after the `reason === 'save'` block (lines 93–97):

```tsx
        {reason === 'download' && (
          <p className="alert mb-4 bg-brand-tint text-ink">
            You need an account to download tutorial files. Create one and we&apos;ll take you back.
          </p>
        )}
```

- [ ] **Step 10: Run everything for the web package**

Run: `pnpm --filter @splat-connect/web test:unit && pnpm --filter @splat-connect/web lint && pnpm typecheck`
Expected: all passing, lint clean, zero type errors.

---

### Task 5: E2E — fixtures, the detour, and a real download

**Files:**
- Modify: `packages/web/tests/e2e/helpers.ts:150-151`, `:177-181`
- Modify: `packages/web/tests/e2e/public/tutorial-detail.spec.ts:16-20`
- Create: `packages/web/tests/e2e/public/tutorial-downloads.spec.ts`

**Interfaces:**
- Consumes: `createContributor()`, `createTutorial(id, overrides)`, `signIn(page, email, password)`, `deleteUser(id)`, `uniqueTitle()` from `helpers.ts`; `adminClient()` from the same file.

- [ ] **Step 1: Fixtures become paths**

`packages/web/tests/e2e/helpers.ts:150-151`:

```ts
    tutorial_pdf_url:
      overrides.withPdf === false ? null : `${id}/tutorial.pdf`,
```

(`id` is the tutorial id already in scope in `createTutorial`.) Lines 177–181:

```ts
    await admin.from('stl_files').insert({
      tutorial_id: id,
      filename: 'e2e-mount.stl',
      file_url: `${id}/e2e-mount.stl`,
    })
```

- [ ] **Step 2: The detail page now links a signed-out visitor to signup**

`packages/web/tests/e2e/public/tutorial-detail.spec.ts:16-20`:

```ts
  // Signed out: the file links are the gate (049). The download itself is
  // covered in tutorial-downloads.spec.ts.
  const detour = `/signup?next=%2Ftutorials%2F${tutorialId}&reason=download`
  await expect(page.getByRole('link', { name: 'Download Tutorial PDF' })).toHaveAttribute('href', detour)
  await expect(page.getByRole('link', { name: 'e2e-mount.stl' })).toHaveAttribute('href', detour)
```

- [ ] **Step 3: Write the downloads spec**

```ts
// packages/web/tests/e2e/public/tutorial-downloads.spec.ts
import { test, expect } from '@playwright/test'
import path from 'path'
import { readFileSync } from 'fs'
import { adminClient, createContributor, createTutorial, deleteUser, signIn, uniqueTitle } from '../helpers'

const PDF_FIXTURE = path.join(__dirname, '..', 'fixtures', 'test.pdf')

/**
 * The gate on tutorial files, end to end: a signed-out click is a detour to
 * signup that says why; a signed-in request comes back with the PDF bytes,
 * which means the bucket flip, the select policy, the route handler and the
 * signed URL all held. Signup itself is not completed here — it needs an
 * email confirmation, the same reason saves.spec.ts stops at the detour.
 */
test('a signed-out visitor is sent to sign up, pointed back at the tutorial', async ({ page }) => {
  const contributor = await createContributor()
  const tutorialId = await createTutorial(contributor.id, { title: uniqueTitle('E2E Gate'), status: 'approved' })

  try {
    await page.goto(`/tutorials/${tutorialId}`)
    await page.getByRole('link', { name: 'Download Tutorial PDF' }).click()

    await expect(page).toHaveURL(new RegExp(`/signup\\?next=%2Ftutorials%2F${tutorialId}&reason=download`))
    await expect(page.getByText('You need an account to download tutorial files')).toBeVisible()
  } finally {
    await deleteUser(contributor.id)
  }
})

test('a signed-in visitor gets the PDF', async ({ page }) => {
  const contributor = await createContributor()
  const tutorialId = await createTutorial(contributor.id, { title: uniqueTitle('E2E Download'), status: 'approved' })
  const objectPath = `${tutorialId}/tutorial.pdf`
  const admin = adminClient()
  const { error } = await admin.storage
    .from('tutorial-pdfs')
    .upload(objectPath, readFileSync(PDF_FIXTURE), { contentType: 'application/pdf', upsert: true })
  expect(error).toBeNull()

  try {
    await signIn(page, contributor.email, contributor.password)
    await page.goto(`/tutorials/${tutorialId}`)
    const href = await page.getByRole('link', { name: 'Download Tutorial PDF' }).getAttribute('href')
    expect(href).toBe(`/files/tutorial-pdfs/${objectPath}`)

    // page.request shares the browser context's cookies, so this is the same
    // session the page has — and it follows the 302 to the signed URL.
    const res = await page.request.get(href!)
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('application/pdf')
    expect((await res.body()).length).toBeGreaterThan(0)
  } finally {
    await admin.storage.from('tutorial-pdfs').remove([objectPath])
    await deleteUser(contributor.id)
  }
})
```

- [ ] **Step 4: Run the three affected specs**

Run: `pnpm --filter @splat-connect/web test:e2e -- tutorial-detail tutorial-downloads upload-flow`
Expected: all passing. `upload-flow.spec.ts` uploads a real PDF through the editor and is unchanged; it passing is the proof that upload → path → editor still round-trips against a private bucket. If `signIn` lands somewhere other than the tutorial, that is fine — the test navigates explicitly afterwards.

- [ ] **Step 5: Run the whole E2E suite once**

Run: `pnpm --filter @splat-connect/web test:e2e`
Expected: all passing. The only other spec that names a file is `admin/review-flow.spec.ts:79`, which asserts `e2e-mount.stl` is visible — the filename is unchanged, so it needs nothing. No spec asserts a `placeholder.invalid` file href other than `tutorial-detail`, fixed in Step 2.

---

### Task 6: Apply to the linked project and verify

**Files:** none.

- [ ] **Step 1: Confirm the ledger is where it was**

Run: `supabase migration list --linked`
Expected: local and remote both end at 048; 049 shows local only.

- [ ] **Step 2: Push**

Run: `supabase db push`
Expected: applies `049_gate_tutorial_files.sql` and nothing else.

- [ ] **Step 3: Assert the objects, not the ledger**

Run: `supabase db query --linked "select id, public from storage.buckets order by id"`
Expected: `stl-files` false, `tutorial-pdfs` false, both `toy-photos*` true.

Run: `supabase db query --linked "select count(*) filter (where tutorial_pdf_url like 'http%') as urls, count(*) filter (where tutorial_pdf_url ~ '^[0-9a-f-]{36}/tutorial\\.pdf$') as paths from public.tutorials where tutorial_pdf_url is not null"`
Expected: `urls` 0, `paths` 7.

Run: `supabase db query --linked "select policyname from pg_policies where tablename = 'objects' and policyname like '%read%' order by 1"`
Expected: includes `Signed-in read stl-files` and `Signed-in read tutorial-pdfs`; does not include `Public read stl-files` or `Public read tutorial-pdfs`; still includes `Public read toy-photos`.

- [ ] **Step 4: Prove the old link is dead**

Run: `curl -s -o /dev/null -w "%{http_code}\n" "https://napjjvnriegcszcvkysj.supabase.co/storage/v1/object/public/tutorial-pdfs/790484ec-f341-42ac-8e05-f91495366515/tutorial.pdf"`
Expected: `400` (Supabase answers "Bucket not found"/"Object not found" for a private bucket on the public path), not `200`.

- [ ] **Step 5: Refresh the knowledge graph**

Run: `graphify update .`
Expected: completes; the new route handler and `lib/supabase/server.ts` appear in `graphify-out/`.
