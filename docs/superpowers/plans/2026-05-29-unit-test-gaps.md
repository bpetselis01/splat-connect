# Unit Test Gaps — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill all untested and partially-tested code in the splat-connect monorepo with 29 new unit tests across 5 files.

**Architecture:** Full component render approach using `@testing-library/react` + `fireEvent` for React components; Hono test-app pattern for API routes; vitest module mocking throughout. All tests run in jsdom (web) or node (api) per existing vitest configs.

**Tech Stack:** Vitest, @testing-library/react, @testing-library/jest-dom, jsdom, Hono

---

## File Map

| File | Action |
|---|---|
| `packages/web/tests/unit/lib/browser-api-client.test.ts` | Create (8 tests) |
| `packages/web/tests/unit/components/nav.test.tsx` | Modify — remove stale mock, +4 tests |
| `packages/web/tests/unit/components/upload-page.test.tsx` | Create (11 tests) |
| `packages/web/tests/unit/lib/api-client.test.ts` | Modify — +4 tests |
| `packages/api/tests/unit/routes/tutorials.test.ts` | Modify — +2 tests |

**Note:** `app/upload/page.tsx` is outside the vitest coverage include (`lib/**`, `components/**`) so it won't appear in coverage reports, but the test will still run and pass.

---

## Task 1: browser-api-client.test.ts

**Files:**
- Create: `packages/web/tests/unit/lib/browser-api-client.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// packages/web/tests/unit/lib/browser-api-client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetSession = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getSession: mockGetSession } }),
}))

const fetchMock = vi.fn()
global.fetch = fetchMock

const { browserApiClient } = await import('@/lib/browser-api-client')

// Helpers to build fetch response mocks
function okResponse(body: unknown) {
  const text = body === null ? '' : JSON.stringify(body)
  return { ok: true, text: () => Promise.resolve(text), clone: () => ({ json: () => Promise.resolve({}) }) }
}
function errorResponse(status: number, errorBody: Record<string, string> = {}) {
  return { ok: false, status, clone: () => ({ json: () => Promise.resolve(errorBody) }) }
}

describe('browserApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001'
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'test-token' } } })
  })

  it('get — attaches Authorization header and returns parsed JSON', async () => {
    fetchMock.mockResolvedValue(okResponse([{ id: '1' }]))
    const result = await browserApiClient.get('/api/tutorials')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/tutorials',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    )
    expect(result).toEqual([{ id: '1' }])
  })

  it('post — sends JSON body with Content-Type header', async () => {
    fetchMock.mockResolvedValue(okResponse({ id: 'new' }))
    await browserApiClient.post('/api/tutorials', { title: 'Test' })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ title: 'Test' }),
      })
    )
  })

  it('patch — sends PATCH method with JSON body', async () => {
    fetchMock.mockResolvedValue(okResponse({ status: 'pending' }))
    await browserApiClient.patch('/api/tutorials/1', { status: 'pending' })
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:3001/api/tutorials/1')
    expect(opts.method).toBe('PATCH')
    expect(opts.body).toBe(JSON.stringify({ status: 'pending' }))
  })

  it('delete — sends DELETE method with no body', async () => {
    fetchMock.mockResolvedValue(okResponse(null))
    await browserApiClient.delete('/api/tutorials/1')
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.method).toBe('DELETE')
    expect(opts.body).toBeUndefined()
  })

  it('postFormData — omits Content-Type, sends FormData body', async () => {
    fetchMock.mockResolvedValue(okResponse({ url: 'https://example.com/file.pdf' }))
    const form = new FormData()
    form.append('file', new Blob(['pdf']), 'file.pdf')
    await browserApiClient.postFormData('/api/upload/pdf', form)
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.body).toBe(form)
    expect((opts.headers as Record<string, string>)?.['Content-Type']).toBeUndefined()
  })

  it('throws with API error detail on non-ok response', async () => {
    fetchMock.mockResolvedValue(errorResponse(400, { error: 'Title is required' }))
    await expect(browserApiClient.post('/api/tutorials', {})).rejects.toThrow('Title is required')
  })

  it('returns null for empty-body (204) response', async () => {
    fetchMock.mockResolvedValue(okResponse(null))
    const result = await browserApiClient.delete('/api/tutorials/1')
    expect(result).toBeNull()
  })

  it('omits Authorization header when session token is null', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    fetchMock.mockResolvedValue(okResponse([]))
    await browserApiClient.get('/api/tutorials')
    const [, opts] = fetchMock.mock.calls[0]
    expect((opts.headers as Record<string, string>)?.Authorization).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run and verify all 8 pass**

```
cd packages/web && pnpm exec vitest run tests/unit/lib/browser-api-client.test.ts
```

Expected: 8 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```
git add packages/web/tests/unit/lib/browser-api-client.test.ts
git commit -m "test(web): add browser-api-client unit tests"
```

---

## Task 2: nav.test.tsx — remove stale mock, add sign-out tests

**Files:**
- Modify: `packages/web/tests/unit/components/nav.test.tsx`

- [ ] **Step 1: Replace the entire file**

The current file has a stale `useRouter` mock (nav.tsx no longer uses it) and no sign-out behavioral tests. Replace it with:

```typescript
// packages/web/tests/unit/components/nav.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Nav } from '@/components/nav'

const mockSignOut = vi.fn()

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: mockSignOut } }),
}))

describe('Nav', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSignOut.mockResolvedValue({})
    vi.stubGlobal('location', { href: '' })
  })

  it('renders library link for unauthenticated users', () => {
    render(<Nav role={null} />)
    expect(screen.getByRole('link', { name: /library/i })).toBeInTheDocument()
  })

  it('renders dashboard link for contributors', () => {
    render(<Nav role="contributor" />)
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
  })

  it('renders admin link for admin users', () => {
    render(<Nav role="admin" />)
    expect(screen.getByRole('link', { name: /admin/i })).toBeInTheDocument()
  })

  it('does not render dashboard link for admin users', () => {
    render(<Nav role="admin" />)
    expect(screen.queryByRole('link', { name: /dashboard/i })).toBeNull()
  })

  it('does not render admin link for contributors', () => {
    render(<Nav role="contributor" />)
    expect(screen.queryByRole('link', { name: /admin/i })).toBeNull()
  })

  it('shows Contribute link and no Sign out for unauthenticated users', () => {
    render(<Nav role={null} />)
    expect(screen.getByRole('link', { name: /contribute/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull()
  })

  it('shows Sign out button and no Contribute link for authenticated users', () => {
    render(<Nav role="contributor" />)
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /contribute/i })).toBeNull()
  })

  it('calls signOut and sets window.location.href to / on sign out click', async () => {
    render(<Nav role="contributor" />)
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
      expect(window.location.href).toBe('/')
    })
  })

  it('shows Sign out button for admin users', () => {
    render(<Nav role="admin" />)
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run and verify all 9 pass**

```
cd packages/web && pnpm exec vitest run tests/unit/components/nav.test.tsx
```

Expected: 9 tests pass (5 existing + 4 new), 0 fail.

- [ ] **Step 3: Commit**

```
git add packages/web/tests/unit/components/nav.test.tsx
git commit -m "test(web): add nav sign-out behavior tests, remove stale useRouter mock"
```

---

## Task 3: upload-page.test.tsx

**Files:**
- Create: `packages/web/tests/unit/components/upload-page.test.tsx`

The upload page uses `browserApiClient` for all API calls, `FileDropZone` for file inputs, and `BuyLinksInput` for buy links. Mock all three. The `advanceToStep(n)` helper drives the wizard to step `n` with minimal required data, keeping individual tests focused on a single behaviour.

- [ ] **Step 1: Write the test file**

```typescript
// packages/web/tests/unit/components/upload-page.test.tsx
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import UploadPage from '@/app/upload/page'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    postFormData: vi.fn(),
  },
}))

// Render FileDropZone as a plain input so we can fire change events in tests.
// currentFileLabel is rendered as a span so tests can waitFor its appearance.
vi.mock('@/components/file-drop-zone', () => ({
  FileDropZone: ({
    onChange,
    name,
    currentFileLabel,
  }: {
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    name: string
    currentFileLabel?: string
  }) => (
    <>
      <input data-testid={`filedrop-${name}`} type="file" onChange={onChange} />
      {currentFileLabel && <span>{currentFileLabel}</span>}
    </>
  ),
}))

vi.mock('@/components/buy-links-input', () => ({
  BuyLinksInput: () => null,
}))

// ── Imports after mocks ────────────────────────────────────────────────────

import { browserApiClient } from '@/lib/browser-api-client'

// ── Helpers ────────────────────────────────────────────────────────────────

// Drive the wizard to `to` using minimal required data per step.
// Clears mock call history between steps is NOT done here — individual
// tests call vi.clearAllMocks() after advanceToStep if they need clean assertions.
async function advanceToStep(to: number) {
  // 1 → 2
  if (to >= 2) {
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. fisher-price piano/i), {
      target: { value: 'My Tutorial' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^easy$/i }))
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => expect(screen.getByText(/step 2 of 6/i)).toBeInTheDocument())
  }
  // 2 → 3
  if (to >= 3) {
    vi.mocked(browserApiClient.postFormData)
      .mockResolvedValueOnce({ url: 'https://example.com/tutorial.pdf' } as any)
      .mockResolvedValueOnce({ url: 'https://example.com/photo.jpg' } as any)
    fireEvent.change(screen.getByTestId('filedrop-tutorial_pdf'), {
      target: { files: [new File(['pdf'], 'tutorial.pdf', { type: 'application/pdf' })] },
    })
    await waitFor(() => expect(screen.getByText(/pdf uploaded/i)).toBeInTheDocument())
    fireEvent.change(screen.getByTestId('filedrop-toy_photo'), {
      target: { files: [new File(['img'], 'photo.jpg', { type: 'image/jpeg' })] },
    })
    await waitFor(() => expect(screen.getByText(/photo uploaded/i)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => expect(screen.getByText(/step 3 of 6/i)).toBeInTheDocument())
  }
  // 3 → 4
  if (to >= 4) {
    fireEvent.click(screen.getByRole('button', { name: /\+ add part/i }))
    fireEvent.change(screen.getByPlaceholderText(/part name \*/i), {
      target: { value: 'Screw' },
    })
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => expect(screen.getByText(/step 4 of 6/i)).toBeInTheDocument())
  }
  // 4 → 5
  if (to >= 5) {
    fireEvent.click(screen.getByRole('button', { name: /\+ add tool/i }))
    fireEvent.change(screen.getByPlaceholderText(/tool name \*/i), {
      target: { value: 'Screwdriver' },
    })
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => expect(screen.getByText(/step 5 of 6/i)).toBeInTheDocument())
  }
  // 5 → 6
  if (to >= 6) {
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => expect(screen.getByText(/step 6 of 6/i)).toBeInTheDocument())
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('UploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('test-id' as ReturnType<typeof crypto.randomUUID>)
    vi.stubGlobal('location', { href: '' })
    vi.mocked(browserApiClient.post).mockResolvedValue({} as any)
    vi.mocked(browserApiClient.patch).mockResolvedValue({} as any)
    vi.mocked(browserApiClient.postFormData).mockResolvedValue({ url: 'https://example.com/file' } as any)
  })

  // ── Step 1 ──

  it('Step 1 Next (first time): creates draft and links contributor', async () => {
    render(<UploadPage />)

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. fisher-price piano/i), {
      target: { value: 'My Tutorial' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^easy$/i }))
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))

    await waitFor(() => {
      expect(browserApiClient.post).toHaveBeenCalledWith(
        '/api/tutorials',
        expect.objectContaining({ id: 'test-id', title: 'My Tutorial', difficulty: 'easy' })
      )
      expect(browserApiClient.post).toHaveBeenCalledWith(
        '/api/contributors/me/tutorials/test-id',
        {}
      )
    })
    expect(screen.getByText(/step 2 of 6/i)).toBeInTheDocument()
  })

  it('Step 1 Next (second time): PATCHes instead of POSTing again', async () => {
    render(<UploadPage />)

    // Advance to step 2 (sets draftSaved=true)
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. fisher-price piano/i), {
      target: { value: 'My Tutorial' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^easy$/i }))
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => screen.getByText(/step 2 of 6/i))

    // Go back to step 1
    fireEvent.click(screen.getByRole('button', { name: /← back/i }))
    await waitFor(() => screen.getByText(/step 1 of 6/i))

    // Clear prior call history
    vi.clearAllMocks()
    vi.mocked(browserApiClient.patch).mockResolvedValue({} as any)

    // Click Next again — must PATCH, not POST
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))

    await waitFor(() => {
      expect(browserApiClient.patch).toHaveBeenCalledWith(
        '/api/tutorials/test-id',
        expect.objectContaining({ title: 'My Tutorial', difficulty: 'easy' })
      )
    })
    expect(browserApiClient.post).not.toHaveBeenCalledWith('/api/tutorials', expect.anything())
  })

  // ── Step 2 ──

  it('Step 2 Next: PATCHes tutorial with file URLs', async () => {
    render(<UploadPage />)
    await advanceToStep(2)
    vi.clearAllMocks()
    vi.mocked(browserApiClient.patch).mockResolvedValue({} as any)

    vi.mocked(browserApiClient.postFormData)
      .mockResolvedValueOnce({ url: 'https://example.com/tutorial.pdf' } as any)
      .mockResolvedValueOnce({ url: 'https://example.com/photo.jpg' } as any)

    fireEvent.change(screen.getByTestId('filedrop-tutorial_pdf'), {
      target: { files: [new File(['pdf'], 'tutorial.pdf', { type: 'application/pdf' })] },
    })
    await waitFor(() => screen.getByText(/pdf uploaded/i))

    fireEvent.change(screen.getByTestId('filedrop-toy_photo'), {
      target: { files: [new File(['img'], 'photo.jpg', { type: 'image/jpeg' })] },
    })
    await waitFor(() => screen.getByText(/photo uploaded/i))

    fireEvent.click(screen.getByRole('button', { name: /next →/i }))

    await waitFor(() => {
      expect(browserApiClient.patch).toHaveBeenCalledWith(
        '/api/tutorials/test-id',
        expect.objectContaining({
          tutorial_pdf_url: 'https://example.com/tutorial.pdf',
          toy_photo_url: 'https://example.com/photo.jpg',
        })
      )
    })
  })

  // ── Step 3 ──

  it('Step 3 Next: POSTs parts', async () => {
    render(<UploadPage />)
    await advanceToStep(3)
    vi.clearAllMocks()
    vi.mocked(browserApiClient.post).mockResolvedValue({} as any)

    fireEvent.click(screen.getByRole('button', { name: /\+ add part/i }))
    fireEvent.change(screen.getByPlaceholderText(/part name \*/i), {
      target: { value: 'Screw' },
    })
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))

    await waitFor(() => {
      expect(browserApiClient.post).toHaveBeenCalledWith(
        '/api/tutorials/test-id/parts',
        expect.objectContaining({
          parts: expect.arrayContaining([expect.objectContaining({ name: 'Screw' })]),
        })
      )
    })
  })

  // ── Step 4 ──

  it('Step 4 Next: POSTs tools', async () => {
    render(<UploadPage />)
    await advanceToStep(4)
    vi.clearAllMocks()
    vi.mocked(browserApiClient.post).mockResolvedValue({} as any)

    fireEvent.click(screen.getByRole('button', { name: /\+ add tool/i }))
    fireEvent.change(screen.getByPlaceholderText(/tool name \*/i), {
      target: { value: 'Screwdriver' },
    })
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))

    await waitFor(() => {
      expect(browserApiClient.post).toHaveBeenCalledWith(
        '/api/tutorials/test-id/tools',
        expect.objectContaining({
          tools: expect.arrayContaining([expect.objectContaining({ name: 'Screwdriver' })]),
        })
      )
    })
  })

  // ── Step 5 ──

  it('Step 5 Next with STL files: POSTs stl-files', async () => {
    render(<UploadPage />)
    await advanceToStep(5)
    vi.clearAllMocks()
    vi.mocked(browserApiClient.post).mockResolvedValue({} as any)
    vi.mocked(browserApiClient.postFormData).mockResolvedValue({
      url: 'https://example.com/bracket.stl',
      filename: 'bracket.stl',
    } as any)

    // Upload an STL file (populates stl_files in local state)
    fireEvent.change(screen.getByTestId('filedrop-stl_files'), {
      target: { files: [new File(['stl'], 'bracket.stl', { type: 'model/stl' })] },
    })
    await waitFor(() => expect(screen.getByText(/bracket\.stl/i)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /next →/i }))

    await waitFor(() => {
      expect(browserApiClient.post).toHaveBeenCalledWith(
        '/api/tutorials/test-id/stl-files',
        expect.objectContaining({
          stl_files: expect.arrayContaining([
            expect.objectContaining({ filename: 'bracket.stl' }),
          ]),
        })
      )
    })
  })

  it('Step 5 Next without STL files: does NOT call stl-files endpoint', async () => {
    render(<UploadPage />)
    await advanceToStep(5)
    vi.clearAllMocks()
    vi.mocked(browserApiClient.post).mockResolvedValue({} as any)

    // No STL files added — just click Next
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))

    await waitFor(() => screen.getByText(/step 6 of 6/i))
    expect(browserApiClient.post).not.toHaveBeenCalledWith(
      '/api/tutorials/test-id/stl-files',
      expect.anything()
    )
  })

  // ── Step 6 submit ──

  it('Submit: only PATCHes status to pending then redirects', async () => {
    render(<UploadPage />)
    await advanceToStep(6)
    vi.clearAllMocks()
    vi.mocked(browserApiClient.patch).mockResolvedValue({} as any)

    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))

    await waitFor(() => {
      expect(browserApiClient.patch).toHaveBeenCalledWith(
        '/api/tutorials/test-id',
        { status: 'pending' }
      )
      expect(browserApiClient.patch).toHaveBeenCalledTimes(1)
      expect(window.location.href).toBe('/my-tutorials')
    })
    // Parts, tools, stl-files must NOT be called at submit time
    expect(browserApiClient.post).not.toHaveBeenCalled()
  })

  // ── Error handling ──

  it('shows error message when API call fails', async () => {
    vi.mocked(browserApiClient.post).mockRejectedValue(new Error('Server unavailable'))
    render(<UploadPage />)

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. fisher-price piano/i), {
      target: { value: 'My Tutorial' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^easy$/i }))
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))

    await waitFor(() =>
      expect(screen.getByText(/server unavailable/i)).toBeInTheDocument()
    )
  })

  // ── Saving state ──

  it('Next button shows "Saving…" and is disabled during API call', async () => {
    let resolvePost!: (v: unknown) => void
    vi.mocked(browserApiClient.post)
      .mockImplementationOnce(() => new Promise(r => { resolvePost = r }))
      .mockResolvedValue({} as any)

    render(<UploadPage />)
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. fisher-price piano/i), {
      target: { value: 'My Tutorial' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^easy$/i }))
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))

    // While the first post is pending, button shows saving state
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()
    )

    // Resolve the deferred promise
    act(() => resolvePost({ id: 'test-id' }))

    // Step advances once saving completes
    await waitFor(() => screen.getByText(/step 2 of 6/i))
  })

  // ── Validation gate ──

  it('Next button is disabled when step 1 title is empty', () => {
    render(<UploadPage />)
    // Select difficulty but leave title empty
    fireEvent.click(screen.getByRole('button', { name: /^easy$/i }))
    expect(screen.getByRole('button', { name: /next →/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run and verify all 11 pass**

```
cd packages/web && pnpm exec vitest run tests/unit/components/upload-page.test.tsx
```

Expected: 11 tests pass, 0 fail.  
If you see `TypeError: crypto.randomUUID is not a function`, check that `vi.spyOn(crypto, 'randomUUID')` is in `beforeEach` (it is — vitest resets spies between tests).  
If you see `Cannot find module '@/app/upload/page'`, confirm the vitest alias `@` → `packages/web/` is in vitest.config.ts (it is).

- [ ] **Step 3: Commit**

```
git add packages/web/tests/unit/components/upload-page.test.tsx
git commit -m "test(web): add upload page component tests for step-by-step draft saving"
```

---

## Task 4: api-client.test.ts — missing method and edge-case coverage

**Files:**
- Modify: `packages/web/tests/unit/lib/api-client.test.ts`

- [ ] **Step 1: Add 4 tests inside the existing `describe('apiClient')` block**

`api-client.ts` uses `res.json()` directly (unlike `browser-api-client.ts` which uses `res.text()`). This means 204 empty-body responses throw a SyntaxError, and error bodies are not extracted — the tests below document actual current behaviour.

Append these four `it` blocks after the existing `'POST sends JSON body'` test:

```typescript
  it('PATCH sends correct method and JSON body', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ status: 'pending' }) })
    await apiClient.patch('/api/tutorials/1', { status: 'pending' })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/tutorials/1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'pending' }),
      })
    )
  })

  it('DELETE sends correct method with no body', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(null) })
    await apiClient.delete('/api/tutorials/1')
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.method).toBe('DELETE')
    expect(opts.body).toBeUndefined()
  })

  it('postFormData omits Content-Type and sends FormData body', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ url: 'https://example.com/file.pdf' }) })
    const form = new FormData()
    form.append('file', new Blob(['pdf']), 'file.pdf')
    await apiClient.postFormData('/api/upload/pdf', form)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:3001/api/upload/pdf')
    expect(opts.body).toBe(form)
    expect((opts.headers as Record<string, string>)?.['Content-Type']).toBeUndefined()
  })

  it('thrown error message includes status code', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 422, json: () => Promise.resolve({}) })
    await expect(apiClient.patch('/api/tutorials/1', {})).rejects.toThrow('422')
  })
```

- [ ] **Step 2: Run and verify tests pass**

```
cd packages/web && pnpm exec vitest run tests/unit/lib/api-client.test.ts
```

Expected: all existing tests still pass + at minimum 3 of the 4 new tests pass (204 test may need assertion tuning — see note above).

- [ ] **Step 3: Commit**

```
git add packages/web/tests/unit/lib/api-client.test.ts
git commit -m "test(web): add PATCH, DELETE, and error-detail tests for api-client"
```

---

## Task 5: tutorials.test.ts — missing 500 paths

**Files:**
- Modify: `packages/api/tests/unit/routes/tutorials.test.ts`

- [ ] **Step 1: Add 2 tests to existing describe blocks**

In `describe('GET /mine')`, add after the existing success test:

```typescript
  it('returns 500 on DB error', async () => {
    mockUserClient.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({ data: null, error: { message: 'DB error' } }),
        }),
      }),
    })
    const res = await makeApp().request('/mine')
    expect(res.status).toBe(500)
  })
```

In `describe('PATCH /:id')`, add after the existing success test:

```typescript
  it('returns 500 on DB error', async () => {
    mockUserClient.from.mockReturnValue({
      update: () => ({
        eq: () => ({
          select: () => ({ single: () => ({ data: null, error: { message: 'DB error' } }) }),
        }),
      }),
    })
    const res = await makeApp().request('/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending' }),
    })
    expect(res.status).toBe(500)
  })
```

- [ ] **Step 2: Run and verify all tests pass**

```
cd packages/api && pnpm exec vitest run tests/unit/routes/tutorials.test.ts
```

Expected: all existing tests pass + 2 new tests pass.

- [ ] **Step 3: Commit**

```
git add packages/api/tests/unit/routes/tutorials.test.ts
git commit -m "test(api): add missing 500 error paths for GET /mine and PATCH /:id"
```

---

## Final Verification

- [ ] **Run all web unit tests**

```
cd packages/web && pnpm test:unit
```

Expected: all tests pass. Coverage for `lib/browser-api-client.ts` and `components/nav.tsx` now shows in the report.

- [ ] **Run all API unit tests**

```
cd packages/api && pnpm test:unit
```

Expected: all tests pass.
