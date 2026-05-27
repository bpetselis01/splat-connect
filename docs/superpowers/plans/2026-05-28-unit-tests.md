# Unit Test Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 42 new test cases across 9 files, create one new test file, and wire both packages into CI on every branch.

**Architecture:** All tests use existing Vitest + `vi.mock()` patterns already present in the codebase — no new dependencies. API tests use Hono `makeApp()` + `.request()`. Web component tests use React Testing Library `render` + `fireEvent`. CI gets a `test` job parallel to the existing `check` job.

**Tech Stack:** Vitest, @testing-library/react, fireEvent (NOT userEvent — not installed), Hono, pnpm monorepo with `--filter`

---

### Task 1: Update `upload.test.ts` mock structure and add photo route tests

**Files:**
- Modify: `packages/api/tests/unit/routes/upload.test.ts`

The existing file only mocks `createUserClient` and only tests the PDF route. The photo route now uses `createAdminClient` for list/remove, so both must be mocked at the top level. The PDF describe block stays unchanged as a regression guard.

- [ ] **Step 1: Write the 6 failing photo tests**

Replace the entire contents of `packages/api/tests/unit/routes/upload.test.ts` with:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

// Admin client mocks (used by photo route for list/remove)
const mockAdminList = vi.fn()
const mockAdminRemove = vi.fn()
const mockAdminStorageBucket = { list: mockAdminList, remove: mockAdminRemove }
const mockAdminStorage = { from: vi.fn(() => mockAdminStorageBucket) }

vi.mock('../../../src/supabase/client.js', () => ({
  createAdminClient: () => ({ storage: mockAdminStorage }),
}))

// User client mocks (used by all routes for upload/getPublicUrl)
const mockUpload = vi.fn()
const mockGetPublicUrl = vi.fn()
const mockUserStorageBucket = { upload: mockUpload, getPublicUrl: mockGetPublicUrl }
const mockUserStorage = { from: vi.fn(() => mockUserStorageBucket) }

vi.mock('../../../src/supabase/user-client.js', () => ({
  createUserClient: () => ({ storage: mockUserStorage }),
}))

const { default: upload } = await import('../../../src/routes/upload.js')

function makeApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1')
    c.set('role', 'contributor')
    c.set('token', 'test-token')
    await next()
  })
  app.route('/', upload)
  return app
}

describe('POST /pdf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpload.mockResolvedValue({ data: { path: 'tid-1/tutorial.pdf' }, error: null })
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/tid-1/tutorial.pdf' } })
  })

  it('returns 400 when file is missing', async () => {
    const form = new FormData()
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/pdf', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  it('returns 400 when tutorialId is missing', async () => {
    const form = new FormData()
    form.append('file', new Blob(['pdf'], { type: 'application/pdf' }), 'file.pdf')
    const res = await makeApp().request('/pdf', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  it('uploads file and returns public URL', async () => {
    const form = new FormData()
    form.append('file', new Blob(['pdf'], { type: 'application/pdf' }), 'file.pdf')
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/pdf', { method: 'POST', body: form })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.url).toBe('https://example.com/tid-1/tutorial.pdf')
  })
})

describe('POST /photo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminList.mockResolvedValue({ data: [], error: null })
    mockAdminRemove.mockResolvedValue({ error: null })
    mockUpload.mockResolvedValue({ data: { path: 'tid-1/photo.png' }, error: null })
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/tid-1/photo.png' } })
  })

  it('returns 400 when file is missing', async () => {
    const form = new FormData()
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/photo', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  it('returns 400 when tutorialId is missing', async () => {
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/png' }), 'photo.png')
    const res = await makeApp().request('/photo', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  it('calls remove with correct paths when existing files are present', async () => {
    mockAdminList.mockResolvedValue({ data: [{ name: 'photo.jpg' }], error: null })
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/png' }), 'photo.png')
    form.append('tutorialId', 'tid-1')
    await makeApp().request('/photo', { method: 'POST', body: form })
    expect(mockAdminRemove).toHaveBeenCalledWith(['tid-1/photo.jpg'])
  })

  it('does not call remove when no existing files', async () => {
    mockAdminList.mockResolvedValue({ data: [], error: null })
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/png' }), 'photo.png')
    form.append('tutorialId', 'tid-1')
    await makeApp().request('/photo', { method: 'POST', body: form })
    expect(mockAdminRemove).not.toHaveBeenCalled()
  })

  it('returns 500 when upload fails', async () => {
    mockUpload.mockResolvedValue({ data: null, error: { message: 'Storage error' } })
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/png' }), 'photo.png')
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/photo', { method: 'POST', body: form })
    expect(res.status).toBe(500)
  })

  it('returns 200 with url on success', async () => {
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/png' }), 'photo.png')
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/photo', { method: 'POST', body: form })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.url).toBe('https://example.com/tid-1/photo.png')
  })
})
```

- [ ] **Step 2: Run to verify the new photo tests fail (module not yet mocked for admin)**

```
pnpm --filter @splat-connect/api test:unit -- upload
```

Expected: 6 photo tests exist and pass (the route already exists — mocks are new). If any fail, check that `vi.mock('../../../src/supabase/client.js')` path matches the import in `upload.ts`.

- [ ] **Step 3: Commit**

```bash
git add packages/api/tests/unit/routes/upload.test.ts
git commit -m "test(api): add photo route tests and dual-client mock to upload.test.ts"
```

---

### Task 2: Add STL route tests to `upload.test.ts`

**Files:**
- Modify: `packages/api/tests/unit/routes/upload.test.ts`

The STL route uses only `createUserClient` (same as PDF). Append the following `describe` block after the photo block from Task 1.

- [ ] **Step 1: Append the STL describe block**

Add to the bottom of `packages/api/tests/unit/routes/upload.test.ts`:

```typescript
describe('POST /stl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpload.mockResolvedValue({ data: { path: 'tid-1/bracket.stl' }, error: null })
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/tid-1/bracket.stl' } })
  })

  it('returns 400 when file is missing', async () => {
    const form = new FormData()
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/stl', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  it('returns 400 when tutorialId is missing', async () => {
    const form = new FormData()
    form.append('file', new Blob(['stl'], { type: 'model/stl' }), 'bracket.stl')
    const res = await makeApp().request('/stl', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  it('returns 500 when upload fails', async () => {
    mockUpload.mockResolvedValue({ data: null, error: { message: 'Storage error' } })
    const form = new FormData()
    form.append('file', new Blob(['stl'], { type: 'model/stl' }), 'bracket.stl')
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/stl', { method: 'POST', body: form })
    expect(res.status).toBe(500)
  })

  it('returns 200 with url and filename on success', async () => {
    const form = new FormData()
    form.append('file', new Blob(['stl'], { type: 'model/stl' }), 'bracket.stl')
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/stl', { method: 'POST', body: form })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.url).toBe('https://example.com/tid-1/bracket.stl')
    expect(body.filename).toBe('bracket.stl')
  })
})
```

- [ ] **Step 2: Run to verify all upload tests pass**

```
pnpm --filter @splat-connect/api test:unit -- upload
```

Expected: 13 tests pass (3 PDF + 6 photo + 4 STL).

- [ ] **Step 3: Commit**

```bash
git add packages/api/tests/unit/routes/upload.test.ts
git commit -m "test(api): add STL route tests to upload.test.ts"
```

---

### Task 3: Create `edit-files-section.test.tsx`

**Files:**
- Create: `packages/web/tests/unit/components/edit-files-section.test.tsx`

This is the most complex test file. The component (`EditFilesSection`) holds files in state and only uploads on Save. Tests verify the deferred-upload behavior using `fireEvent` (not `userEvent` — it is not installed).

Key pattern for file selection: `fireEvent.change(input, { target: { files: [new File(...)] } })`. The `postFormData` spy returns a resolved promise with a URL. The `onSave` prop must also resolve.

- [ ] **Step 1: Verify the component file to confirm input names**

The photo input uses `name="toy_photo"` and the PDF input uses `name="tutorial_pdf"` (from `FileDropZone`'s `name` prop passed by `EditFilesSection`). Confirm in `packages/web/components/edit-files-section.tsx`: `<FileDropZone name="toy_photo" ...>` and `<FileDropZone name="tutorial_pdf" ...>`.

- [ ] **Step 2: Write the test file**

Create `packages/web/tests/unit/components/edit-files-section.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditFilesSection } from '@/components/edit-files-section'
import { browserApiClient } from '@/lib/browser-api-client'

vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { postFormData: vi.fn() },
}))

const mockPostFormData = vi.mocked(browserApiClient.postFormData)

function setup(onSave = vi.fn().mockResolvedValue(undefined)) {
  const result = render(
    <EditFilesSection
      tutorialId="tid-1"
      currentPhotoUrl="https://example.com/photo.jpg"
      currentPdfUrl="https://example.com/tutorial.pdf"
      onSave={onSave}
    />
  )
  const photoInput = result.container.querySelector('input[name="toy_photo"]') as HTMLInputElement
  const pdfInput = result.container.querySelector('input[name="tutorial_pdf"]') as HTMLInputElement
  const saveButton = screen.getByRole('button', { name: 'Save files' })
  return { ...result, photoInput, pdfInput, saveButton, onSave }
}

describe('EditFilesSection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('Save button is disabled when no file is selected', () => {
    const { saveButton } = setup()
    expect(saveButton).toBeDisabled()
  })

  it('Save button is enabled after selecting a photo', () => {
    const { photoInput, saveButton } = setup()
    fireEvent.change(photoInput, {
      target: { files: [new File(['img'], 'photo.png', { type: 'image/png' })] },
    })
    expect(saveButton).not.toBeDisabled()
  })

  it('Save button is enabled after selecting a PDF', () => {
    const { pdfInput, saveButton } = setup()
    fireEvent.change(pdfInput, {
      target: { files: [new File(['pdf'], 'tutorial.pdf', { type: 'application/pdf' })] },
    })
    expect(saveButton).not.toBeDisabled()
  })

  it('selecting a photo does not call postFormData', () => {
    const { photoInput } = setup()
    fireEvent.change(photoInput, {
      target: { files: [new File(['img'], 'photo.png', { type: 'image/png' })] },
    })
    expect(mockPostFormData).not.toHaveBeenCalled()
  })

  it('selecting a PDF does not call postFormData', () => {
    const { pdfInput } = setup()
    fireEvent.change(pdfInput, {
      target: { files: [new File(['pdf'], 'tutorial.pdf', { type: 'application/pdf' })] },
    })
    expect(mockPostFormData).not.toHaveBeenCalled()
  })

  it('clicking Save after selecting photo calls postFormData with /api/upload/photo', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/new-photo.png' })
    const { photoInput, saveButton } = setup()
    fireEvent.change(photoInput, {
      target: { files: [new File(['img'], 'photo.png', { type: 'image/png' })] },
    })
    fireEvent.click(saveButton)
    await waitFor(() => expect(mockPostFormData).toHaveBeenCalledTimes(1))
    const [calledPath] = mockPostFormData.mock.calls[0] as [string, FormData]
    expect(calledPath).toBe('/api/upload/photo')
  })

  it('clicking Save after selecting PDF calls postFormData with /api/upload/pdf', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/new-tutorial.pdf' })
    const { pdfInput, saveButton } = setup()
    fireEvent.change(pdfInput, {
      target: { files: [new File(['pdf'], 'tutorial.pdf', { type: 'application/pdf' })] },
    })
    fireEvent.click(saveButton)
    await waitFor(() => expect(mockPostFormData).toHaveBeenCalledTimes(1))
    const [calledPath] = mockPostFormData.mock.calls[0] as [string, FormData]
    expect(calledPath).toBe('/api/upload/pdf')
  })

  it('clicking Save with both files selected calls onSave with correct URLs', async () => {
    mockPostFormData
      .mockResolvedValueOnce({ url: 'https://example.com/new-photo.png' })
      .mockResolvedValueOnce({ url: 'https://example.com/new-tutorial.pdf' })
    const onSave = vi.fn().mockResolvedValue(undefined)
    const { photoInput, pdfInput, saveButton } = setup(onSave)
    fireEvent.change(photoInput, {
      target: { files: [new File(['img'], 'photo.png', { type: 'image/png' })] },
    })
    fireEvent.change(pdfInput, {
      target: { files: [new File(['pdf'], 'tutorial.pdf', { type: 'application/pdf' })] },
    })
    fireEvent.click(saveButton)
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave).toHaveBeenCalledWith(
      'https://example.com/new-photo.png',
      'https://example.com/new-tutorial.pdf'
    )
  })

  it('Save button is disabled again after a successful save', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/new-photo.png' })
    const { photoInput, saveButton } = setup()
    fireEvent.change(photoInput, {
      target: { files: [new File(['img'], 'photo.png', { type: 'image/png' })] },
    })
    fireEvent.click(saveButton)
    await waitFor(() => expect(saveButton).toBeDisabled())
  })
})
```

- [ ] **Step 3: Run to verify all 9 tests pass**

```
pnpm --filter @splat-connect/web test:unit -- edit-files-section
```

Expected: 9 tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/web/tests/unit/components/edit-files-section.test.tsx
git commit -m "test(web): add EditFilesSection unit tests for deferred-upload behaviour"
```

---

### Task 4: Add gap tests to `tutorials.test.ts`

**Files:**
- Modify: `packages/api/tests/unit/routes/tutorials.test.ts`

Three cases are missing: `GET /mine`, `POST /` with unapproved user (→ 403), and `POST /` idempotent retry (error code `23505` → 200 with `{ id }`).

- [ ] **Step 1: Add GET /mine describe block**

Append after the existing `describe('GET /:id')` block in `packages/api/tests/unit/routes/tutorials.test.ts`:

```typescript
describe('GET /mine', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns tutorials for current user', async () => {
    mockUserClient.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({ data: [{ id: '1', title: 'Mine' }], error: null }),
        }),
      }),
    })
    const res = await makeApp().request('/mine')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body).toHaveLength(1)
    expect(body[0].title).toBe('Mine')
  })
})
```

- [ ] **Step 2: Add unapproved and idempotent retry cases to existing POST / describe block**

Inside the existing `describe('POST /', () => { ... })` block, add after the existing `it('inserts tutorial and returns 201'...)` test:

```typescript
  it('returns 403 when user is not approved', async () => {
    const res = await makeApp('contributor', false).request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'new-id', title: 'New Tutorial', difficulty: 'easy' }),
    })
    expect(res.status).toBe(403)
  })

  it('returns 200 with id on duplicate key (idempotent retry)', async () => {
    mockAdminClient.from.mockReturnValue({
      insert: () => ({
        select: () => ({
          single: () => ({ data: null, error: { code: '23505', message: 'duplicate' } }),
        }),
      }),
    })
    const res = await makeApp().request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'existing-id', title: 'Existing', difficulty: 'hard' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.id).toBe('existing-id')
  })
```

- [ ] **Step 3: Run to verify**

```
pnpm --filter @splat-connect/api test:unit -- tutorials
```

Expected: All existing tests pass plus 3 new ones.

- [ ] **Step 4: Commit**

```bash
git add packages/api/tests/unit/routes/tutorials.test.ts
git commit -m "test(api): add GET /mine, unapproved 403, and idempotent retry cases to tutorials.test.ts"
```

---

### Task 5: Update mock and add 5 new cases in `admin.test.ts`

**Files:**
- Modify: `packages/api/tests/unit/routes/admin.test.ts`

The existing mock only exposes `from`. The `DELETE /contributors/:id` route uses `supabase.auth.admin.deleteUser()`, so the mock needs an `auth.admin.deleteUser` method added. Also add: `GET /contributors` (happy path + DB error), `PATCH /contributors/:id/approve`, `DELETE /contributors/:id`, and `PATCH /tutorials/:id/status` with a `rejection_note`.

- [ ] **Step 1: Rewrite the mock and add new tests**

Replace the entire contents of `packages/api/tests/unit/routes/admin.test.ts` with:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockAdminFrom = vi.fn()
const mockDeleteUser = vi.fn()

vi.mock('../../../src/supabase/client.js', () => ({
  createAdminClient: () => ({
    from: mockAdminFrom,
    auth: { admin: { deleteUser: mockDeleteUser } },
  }),
}))

const { default: admin } = await import('../../../src/routes/admin.js')

function makeApp(role: 'contributor' | 'admin') {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1')
    c.set('role', role)
    c.set('token', 'test-token')
    await next()
  })
  app.route('/', admin)
  return app
}

describe('admin role guard', () => {
  it('returns 403 for contributors', async () => {
    const res = await makeApp('contributor').request('/tutorials')
    expect(res.status).toBe(403)
  })
})

describe('GET /tutorials', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns pending tutorials for admin', async () => {
    mockAdminFrom.mockReturnValue({
      select: () => ({ eq: () => ({ order: () => ({ data: [{ id: '1' }], error: null }) }) }),
    })
    const res = await makeApp('admin').request('/tutorials')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body).toHaveLength(1)
  })
})

describe('PATCH /tutorials/:id/status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates status', async () => {
    mockAdminFrom.mockReturnValue({
      update: () => ({
        eq: () => ({
          select: () => ({ single: () => ({ data: { id: '1', status: 'approved' }, error: null }) }),
        }),
      }),
    })
    const res = await makeApp('admin').request('/tutorials/1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.status).toBe('approved')
  })

  it('includes rejection_note in update payload when provided', async () => {
    let capturedPayload: any = null
    mockAdminFrom.mockReturnValue({
      update: (payload: any) => {
        capturedPayload = payload
        return {
          eq: () => ({
            select: () => ({
              single: () => ({
                data: { id: '1', status: 'rejected', rejection_note: 'Needs more detail' },
                error: null,
              }),
            }),
          }),
        }
      },
    })
    await makeApp('admin').request('/tutorials/1/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected', rejection_note: 'Needs more detail' }),
    })
    expect(capturedPayload).toMatchObject({ rejection_note: 'Needs more detail' })
  })
})

describe('GET /contributors', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns contributor list for admin', async () => {
    mockAdminFrom.mockReturnValue({
      select: () => ({ eq: () => ({ order: () => ({ data: [{ id: 'c-1', role: 'contributor' }], error: null }) }) }),
    })
    const res = await makeApp('admin').request('/contributors')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body).toHaveLength(1)
    expect(body[0].role).toBe('contributor')
  })

  it('returns 500 on DB error', async () => {
    mockAdminFrom.mockReturnValue({
      select: () => ({ eq: () => ({ order: () => ({ data: null, error: { message: 'DB error' } }) }) }),
    })
    const res = await makeApp('admin').request('/contributors')
    expect(res.status).toBe(500)
  })
})

describe('PATCH /contributors/:id/approve', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets approved=true and returns updated profile', async () => {
    mockAdminFrom.mockReturnValue({
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => ({ data: { id: 'c-1', approved: true }, error: null }),
          }),
        }),
      }),
    })
    const res = await makeApp('admin').request('/contributors/c-1/approve', { method: 'PATCH' })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.approved).toBe(true)
  })
})

describe('DELETE /contributors/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes user and returns 204', async () => {
    mockDeleteUser.mockResolvedValue({ error: null })
    const res = await makeApp('admin').request('/contributors/c-1', { method: 'DELETE' })
    expect(res.status).toBe(204)
    expect(mockDeleteUser).toHaveBeenCalledWith('c-1')
  })
})
```

- [ ] **Step 2: Run to verify**

```
pnpm --filter @splat-connect/api test:unit -- admin
```

Expected: All tests pass (original 3 + 5 new).

- [ ] **Step 3: Commit**

```bash
git add packages/api/tests/unit/routes/admin.test.ts
git commit -m "test(api): add contributors and rejection_note tests to admin.test.ts"
```

---

### Task 6: Add 3 new cases to `contributors.test.ts`

**Files:**
- Modify: `packages/api/tests/unit/routes/contributors.test.ts`

The `POST /me/tutorials/:tutorialId` route is completely untested. It returns 201 on success, 200 on duplicate key (`23505`), and 500 on any other error.

- [ ] **Step 1: Append the new describe block**

Add after the existing `describe('GET /me')` block in `packages/api/tests/unit/routes/contributors.test.ts`:

```typescript
describe('POST /me/tutorials/:tutorialId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('links tutorial to current user and returns 201', async () => {
    mockUserFrom.mockReturnValue({
      insert: () => ({ error: null }),
    })
    const res = await makeApp().request('/me/tutorials/tut-1', { method: 'POST' })
    expect(res.status).toBe(201)
  })

  it('returns 200 on duplicate key (idempotent retry)', async () => {
    mockUserFrom.mockReturnValue({
      insert: () => ({ error: { code: '23505', message: 'duplicate' } }),
    })
    const res = await makeApp().request('/me/tutorials/tut-1', { method: 'POST' })
    expect(res.status).toBe(200)
  })

  it('returns 500 on unexpected DB error', async () => {
    mockUserFrom.mockReturnValue({
      insert: () => ({ error: { code: '42501', message: 'permission denied' } }),
    })
    const res = await makeApp().request('/me/tutorials/tut-1', { method: 'POST' })
    expect(res.status).toBe(500)
  })
})
```

- [ ] **Step 2: Run to verify**

```
pnpm --filter @splat-connect/api test:unit -- contributors
```

Expected: All tests pass (original 2 + 3 new).

- [ ] **Step 3: Commit**

```bash
git add packages/api/tests/unit/routes/contributors.test.ts
git commit -m "test(api): add POST /me/tutorials/:tutorialId tests to contributors.test.ts"
```

---

### Task 7: Add `getMissingFields` tests to `validation.test.ts`

**Files:**
- Modify: `packages/web/tests/unit/lib/validation.test.ts`

`getMissingFields` takes a `TutorialWithDetails`, not an `UploadDraft`. The existing test file only tests `canAdvanceFromStep` and `canSubmit`. A `TutorialWithDetails` fixture is needed — it must include `parts`, `tools`, `stl_files`, `tutorial_contributors`, and all `Tutorial` fields.

- [ ] **Step 1: Add the import and fixture then append the describe block**

Add `getMissingFields` to the import line and append a fixture + describe block at the bottom of `packages/web/tests/unit/lib/validation.test.ts`:

First, update the import line at the top:
```typescript
import { canAdvanceFromStep, canSubmit, getMissingFields } from '@/lib/validation'
import type { UploadDraft, TutorialWithDetails } from '@splat-connect/types'
```

Then append after the existing `describe('canSubmit')` block:

```typescript
const baseTutorial: TutorialWithDetails = {
  id: 'tut-1',
  title: 'My Tutorial',
  description: null,
  difficulty: 'easy',
  status: 'draft',
  tutorial_pdf_url: 'https://example.com/tutorial.pdf',
  toy_photo_url: 'https://example.com/photo.jpg',
  rejection_note: null,
  created_at: '2026-01-01T00:00:00Z',
  reviewed_at: null,
  parts: [{ id: 'p-1', tutorial_id: 'tut-1', name: 'Screw', quantity: 4, is_optional: false, buy_links: [] }],
  tools: [{ id: 't-1', tutorial_id: 'tut-1', name: 'Screwdriver', is_optional: false, buy_links: [] }],
  stl_files: [],
  tutorial_contributors: [],
}

describe('getMissingFields', () => {
  it('returns empty array when all fields are present', () => {
    expect(getMissingFields(baseTutorial)).toEqual([])
  })

  it('includes "Title" when title is empty', () => {
    expect(getMissingFields({ ...baseTutorial, title: '' })).toContain('Title')
  })

  it('includes "Tutorial PDF" when tutorial_pdf_url is null', () => {
    expect(getMissingFields({ ...baseTutorial, tutorial_pdf_url: null })).toContain('Tutorial PDF')
  })

  it('includes "Toy photo" when toy_photo_url is null', () => {
    expect(getMissingFields({ ...baseTutorial, toy_photo_url: null })).toContain('Toy photo')
  })

  it('includes "At least one part" when parts array is empty', () => {
    expect(getMissingFields({ ...baseTutorial, parts: [] })).toContain('At least one part')
  })

  it('includes "At least one tool" when tools array is empty', () => {
    expect(getMissingFields({ ...baseTutorial, tools: [] })).toContain('At least one tool')
  })
})
```

- [ ] **Step 2: Run to verify**

```
pnpm --filter @splat-connect/web test:unit -- validation
```

Expected: All existing tests pass plus 6 new ones.

- [ ] **Step 3: Commit**

```bash
git add packages/web/tests/unit/lib/validation.test.ts
git commit -m "test(web): add getMissingFields tests to validation.test.ts"
```

---

### Task 8: Add DB error paths to `parts.test.ts`, `tools.test.ts`, `stl-files.test.ts`

**Files:**
- Modify: `packages/api/tests/unit/routes/parts.test.ts`
- Modify: `packages/api/tests/unit/routes/tools.test.ts`
- Modify: `packages/api/tests/unit/routes/stl-files.test.ts`

Each route performs `delete().eq(...)` then `insert(...).select()`. The POST route returns 500 when the insert fails. The DELETE route returns 500 when the delete fails. The existing mock returns `{ error: null }` by default — tests must override to `{ error: { message: '...' } }`.

- [ ] **Step 1: Add error cases to `parts.test.ts`**

Inside `describe('POST /:id/parts')` in `packages/api/tests/unit/routes/parts.test.ts`, add after the existing happy-path test:

```typescript
  it('returns 500 when insert fails', async () => {
    mockInsertParts.mockReturnValue({ select: vi.fn(() => ({ data: null, error: { message: 'insert error' } })) })
    const newParts = [{ name: 'Screw', quantity: 4, is_optional: false, buy_links: [] }]
    const res = await makeApp().request('/tutorial-1/parts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parts: newParts }),
    })
    expect(res.status).toBe(500)
  })
```

Inside `describe('DELETE /:id/parts')`, add after the existing happy-path test:

```typescript
  it('returns 500 when delete fails', async () => {
    mockDeleteParts.mockReturnValue({ eq: vi.fn(() => ({ error: { message: 'delete error' } })) })
    const res = await makeApp().request('/tutorial-1/parts', { method: 'DELETE' })
    expect(res.status).toBe(500)
  })
```

- [ ] **Step 2: Add error cases to `tools.test.ts`**

Inside `describe('POST /:id/tools')` in `packages/api/tests/unit/routes/tools.test.ts`, add:

```typescript
  it('returns 500 when insert fails', async () => {
    mockInsertTools.mockReturnValue({ select: vi.fn(() => ({ data: null, error: { message: 'insert error' } })) })
    const newTools = [{ name: 'Screwdriver', is_optional: false, buy_links: [] }]
    const res = await makeApp().request('/tutorial-1/tools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tools: newTools }),
    })
    expect(res.status).toBe(500)
  })
```

Inside `describe('DELETE /:id/tools')`, add:

```typescript
  it('returns 500 when delete fails', async () => {
    mockDeleteTools.mockReturnValue({ eq: vi.fn(() => ({ error: { message: 'delete error' } })) })
    const res = await makeApp().request('/tutorial-1/tools', { method: 'DELETE' })
    expect(res.status).toBe(500)
  })
```

- [ ] **Step 3: Add error cases to `stl-files.test.ts`**

Inside `describe('POST /:id/stl-files')` in `packages/api/tests/unit/routes/stl-files.test.ts`, add:

```typescript
  it('returns 500 when insert fails', async () => {
    mockInsertStl.mockReturnValue({ select: vi.fn(() => ({ data: null, error: { message: 'insert error' } })) })
    const files = [{ filename: 'bracket.stl', file_url: 'https://example.com/bracket.stl' }]
    const res = await makeApp().request('/tutorial-1/stl-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stl_files: files }),
    })
    expect(res.status).toBe(500)
  })
```

Inside `describe('DELETE /:id/stl-files')`, add:

```typescript
  it('returns 500 when delete fails', async () => {
    mockDeleteStl.mockReturnValue({ eq: vi.fn(() => ({ error: { message: 'delete error' } })) })
    const res = await makeApp().request('/tutorial-1/stl-files', { method: 'DELETE' })
    expect(res.status).toBe(500)
  })
```

- [ ] **Step 4: Run all three to verify**

```
pnpm --filter @splat-connect/api test:unit -- parts
pnpm --filter @splat-connect/api test:unit -- tools
pnpm --filter @splat-connect/api test:unit -- stl-files
```

Expected: Each file: 3 tests pass (1 original + 2 new error paths per describe block = 2 POST tests + 2 DELETE tests).

- [ ] **Step 5: Commit**

```bash
git add packages/api/tests/unit/routes/parts.test.ts packages/api/tests/unit/routes/tools.test.ts packages/api/tests/unit/routes/stl-files.test.ts
git commit -m "test(api): add DB error path tests to parts, tools, and stl-files routes"
```

---

### Task 9: Update CI pipeline

**Files:**
- Modify: `.github/workflows/ci.yml`

Two changes: (1) remove the branch filter from `on.push` and `on.pull_request` so CI runs on all branches; (2) add a `test` job that runs in parallel with the existing `check` job using the same setup steps.

- [ ] **Step 1: Replace the CI file**

Replace the entire contents of `.github/workflows/ci.yml` with:

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  check:
    name: Type Check
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 11

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Type check all packages
        run: pnpm -r typecheck

  test:
    name: Unit Tests
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 11

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install

      - name: Test API
        run: pnpm --filter @splat-connect/api test:unit

      - name: Test Web
        run: pnpm --filter @splat-connect/web test:unit
```

- [ ] **Step 2: Run the full test suite locally to confirm everything passes before pushing**

```
pnpm --filter @splat-connect/api test:unit
pnpm --filter @splat-connect/web test:unit
```

Expected: All 42 new tests pass alongside the existing tests. Zero failures.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run on all branches and add unit test job"
```

---

## Summary of test counts

| File | New cases |
|---|---|
| `upload.test.ts` | +10 (6 photo, 4 STL) |
| `edit-files-section.test.tsx` | +9 (new file) |
| `tutorials.test.ts` | +3 |
| `admin.test.ts` | +5 |
| `contributors.test.ts` | +3 |
| `validation.test.ts` | +6 |
| `parts.test.ts` | +2 |
| `tools.test.ts` | +2 |
| `stl-files.test.ts` | +2 |
| **Total** | **+42** |
