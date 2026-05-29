# Test Annotations — Web Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add plain-English inline comments to all 13 unit test files in `packages/web` so a reader can understand what each test checks, how it works, and how the tested code connects to the rest of the app.

**Architecture:** Each task annotates one file. Comments follow a strict 3-line format (`// Tests:` / `// How:` / `// Chain:`) above every `it()` block, plus a `// --- Mock strategy ---` block before the `vi.mock()` calls where applicable. No production code is touched. One commit per file.

**Tech Stack:** Vitest, React Testing Library, Next.js (mocked), Supabase (mocked), TypeScript

---

### Task 1: Annotate `browser-api-client.test.ts`

**Files:**
- Modify: `packages/web/tests/unit/lib/browser-api-client.test.ts`

- [ ] **Step 1: Write the annotated file**

Replace the entire file with:

```ts
// packages/web/tests/unit/lib/browser-api-client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetSession = vi.fn()

// --- Mock strategy ---
// Two systems are mocked: the Supabase client (mockGetSession) provides a fake auth session
// token without a real Supabase connection, and global.fetch is replaced with fetchMock so
// no actual HTTP requests are made. The module is imported AFTER mocks are registered so the
// fake fetch is in place before the module initialises its internal references.
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getSession: mockGetSession } }),
}))

const fetchMock = vi.fn()
global.fetch = fetchMock

const { browserApiClient } = await import('@/lib/browser-api-client')

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

  // Tests: GET requests include the Bearer token from the current Supabase session
  // How:   fetchMock resolves with okResponse; checks fetch was called with Authorization header and correct URL
  // Chain: the API server's authMiddleware reads this header to authenticate the request →
  //        without it, all API calls from the browser would return 401
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

  // Tests: POST requests send the body as JSON with the correct Content-Type header
  // How:   fetchMock resolves with okResponse; checks method POST, Content-Type header, and body
  // Chain: the API server parses the JSON body to create or update records → without Content-Type,
  //        the server cannot identify the body format and would return a parsing error
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

  // Tests: PATCH requests use the correct HTTP method and send the body as JSON
  // How:   fetchMock resolves; inspects fetchMock.mock.calls[0] to check method and body
  // Chain: the tutorial route handler's PATCH endpoint receives the partial update → incremental
  //        wizard steps save only their own fields without overwriting other steps' data
  it('patch — sends PATCH method with JSON body', async () => {
    fetchMock.mockResolvedValue(okResponse({ status: 'pending' }))
    await browserApiClient.patch('/api/tutorials/1', { status: 'pending' })
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:3001/api/tutorials/1')
    expect(opts.method).toBe('PATCH')
    expect(opts.body).toBe(JSON.stringify({ status: 'pending' }))
  })

  // Tests: DELETE requests use the DELETE method and send no request body
  // How:   fetchMock resolves with okResponse(null); checks method is DELETE and body is undefined
  // Chain: the API route handler matches DELETE /:id and removes the record → the UI can
  //        confirm deletion and remove the item from its local list
  it('delete — sends DELETE method with no body', async () => {
    fetchMock.mockResolvedValue(okResponse(null))
    await browserApiClient.delete('/api/tutorials/1')
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.method).toBe('DELETE')
    expect(opts.body).toBeUndefined()
  })

  // Tests: postFormData sends FormData without a Content-Type header so the browser sets the multipart boundary
  // How:   checks opts.headers has no Content-Type but does have Authorization
  // Chain: the upload route receives a properly-formed multipart request → Hono can parse the
  //        FormData fields (file, tutorialId) without a malformed boundary in the Content-Type
  it('postFormData — omits Content-Type, sends FormData body', async () => {
    fetchMock.mockResolvedValue(okResponse({ url: 'https://example.com/file.pdf' }))
    const form = new FormData()
    form.append('file', new Blob(['pdf']), 'file.pdf')
    await browserApiClient.postFormData('/api/upload/pdf', form)
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.body).toBe(form)
    expect((opts.headers as Record<string, string>)?.['Content-Type']).toBeUndefined()
    expect((opts.headers as Record<string, string>)?.Authorization).toBe('Bearer test-token')
  })

  // Tests: a non-2xx response causes browserApiClient to throw an error containing the API's error message
  // How:   fetchMock returns errorResponse(400, { error: 'Title is required' }); checks thrown message
  // Chain: React components catch this error in a try/catch and display it to the user →
  //        API validation messages surface in the UI rather than being silently swallowed
  it('throws with API error detail on non-ok response', async () => {
    fetchMock.mockResolvedValue(errorResponse(400, { error: 'Title is required' }))
    await expect(browserApiClient.post('/api/tutorials', {})).rejects.toThrow('Title is required')
  })

  // Tests: a 204 No Content response (empty body) returns null rather than crashing on JSON.parse('')
  // How:   fetchMock returns okResponse(null) which produces an empty text body; checks result is null
  // Chain: DELETE calls in the upload wizard receive null and treat it as a successful no-data
  //        response, avoiding an "Unexpected end of JSON" crash
  it('returns null for empty-body (204) response', async () => {
    fetchMock.mockResolvedValue(okResponse(null))
    const result = await browserApiClient.delete('/api/tutorials/1')
    expect(result).toBeNull()
  })

  // Tests: when there is no active Supabase session, the Authorization header is omitted entirely
  // How:   mockGetSession returns { data: { session: null } }; checks opts.headers has no Authorization key
  // Chain: unauthenticated requests reach the API without a header → authMiddleware returns 401,
  //        which the browser can use to redirect the user to the login page
  it('omits Authorization header when session token is null', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    fetchMock.mockResolvedValue(okResponse([]))
    await browserApiClient.get('/api/tutorials')
    const [, opts] = fetchMock.mock.calls[0]
    expect((opts.headers as Record<string, string>)?.Authorization).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the test**

```
cd packages/web && pnpm test -- tests/unit/lib/browser-api-client.test.ts
```
Expected: 8 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```
git add packages/web/tests/unit/lib/browser-api-client.test.ts
git commit -m "docs(tests): annotate browser-api-client.test.ts"
```

---

### Task 2: Annotate `api-client.test.ts`

**Files:**
- Modify: `packages/web/tests/unit/lib/api-client.test.ts`

- [ ] **Step 1: Write the annotated file**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mock strategy ---
// Four modules are mocked: 'server-only' is a Next.js guard that throws if imported in the
// browser (mocked to a no-op so Vitest can import the module); 'next/headers' provides fake
// cookies; '@supabase/ssr' provides a fake Supabase client with a hardcoded session token;
// and global.fetch is replaced with fetchMock to avoid real HTTP calls.
vi.mock('server-only', () => ({}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({ getAll: () => [] })),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: { access_token: 'mock-token' } } })
      ),
    },
  })),
}))

const fetchMock = vi.fn()
global.fetch = fetchMock

const { apiClient } = await import('@/lib/api-client')

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.API_URL = 'http://localhost:3001'
  })

  // Tests: server-side GET requests include the Bearer token from the SSR Supabase session
  // How:   fetchMock resolves with a JSON response; checks Authorization header and returned data
  // Chain: the API server's authMiddleware reads the header → Next.js server components can
  //        fetch authenticated data during server-side rendering without exposing tokens to the browser
  it('GET attaches Authorization header and returns parsed JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: '1' }]),
    })

    const result = await apiClient.get('/api/tutorials')

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/tutorials',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer mock-token' }),
      })
    )
    expect(result).toEqual([{ id: '1' }])
  })

  // Tests: a non-2xx response causes apiClient to throw an error containing the HTTP status code
  // How:   fetchMock returns { ok: false, status: 403 }; checks thrown error message contains '403'
  // Chain: server components catch this error and can redirect to login or render an error page →
  //        the status code lets the server distinguish auth failures from server errors
  it('throws on non-ok response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 })
    await expect(apiClient.get('/api/admin/tutorials')).rejects.toThrow('403')
  })

  // Tests: POST requests send the payload as a JSON string in the request body
  // How:   fetchMock resolves; checks fetch was called with method POST and the JSON-stringified body
  // Chain: the API route handler parses the JSON body to create new records → server components
  //        can create tutorials on behalf of the user during server-side form submissions
  it('POST sends JSON body', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: 'new' }) })
    await apiClient.post('/api/tutorials', { title: 'Test' })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ title: 'Test' }),
      })
    )
  })

  // Tests: PATCH requests use the PATCH method and send the correct JSON body to the correct URL
  // How:   checks fetch was called with method PATCH, the full URL, and the JSON body
  // Chain: the API handler's PATCH route receives the partial update → server actions can
  //        update tutorial data without the client re-fetching the full record
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

  // Tests: DELETE requests use the DELETE method and send no request body
  // How:   checks opts.method is DELETE and opts.body is undefined
  // Chain: the API route handler matches DELETE /:id and removes the record → server
  //        components can trigger deletions during server actions
  it('DELETE sends correct method with no body', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(null) })
    await apiClient.delete('/api/tutorials/1')
    const [, opts] = fetchMock.mock.calls[0]
    expect(opts.method).toBe('DELETE')
    expect(opts.body).toBeUndefined()
  })

  // Tests: postFormData sends FormData without a manual Content-Type so the browser sets the multipart boundary
  // How:   checks opts.body is the FormData instance and opts.headers has no Content-Type
  // Chain: the upload route can parse the file and metadata from the multipart body → server
  //        components can upload files to Supabase storage during server-side form handling
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

  // Tests: the error thrown on non-ok responses always includes the HTTP status code in its message
  // How:   fetchMock returns { ok: false, status: 422 }; checks thrown message contains '422'
  // Chain: server components can inspect the error message for specific status codes (e.g. 403
  //        to redirect to login; 422 to show validation error) when catching API errors
  it('thrown error message includes status code', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 422, json: () => Promise.resolve({}) })
    await expect(apiClient.patch('/api/tutorials/1', {})).rejects.toThrow('422')
  })
})
```

- [ ] **Step 2: Run the test**

```
cd packages/web && pnpm test -- tests/unit/lib/api-client.test.ts
```
Expected: 7 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```
git add packages/web/tests/unit/lib/api-client.test.ts
git commit -m "docs(tests): annotate api-client.test.ts"
```

---

### Task 3: Annotate `validation.test.ts`

**Files:**
- Modify: `packages/web/tests/unit/lib/validation.test.ts`

- [ ] **Step 1: Write the annotated file**

No mock strategy comment needed (no `vi.mock()` calls — all tests are pure function calls against real validation logic).

```ts
import { describe, it, expect } from 'vitest'
import { canAdvanceFromStep, canSubmit, getMissingFields } from '@/lib/validation'
import type { UploadDraft, TutorialWithDetails } from '@splat-connect/types'

const baseDraft: UploadDraft = {
  title: 'Test Tutorial',
  description: '',
  difficulty: 'easy',
  tutorial_pdf_url: 'https://example.com/tutorial.pdf',
  toy_photo_url: 'https://example.com/photo.jpg',
  parts: [{ name: 'Screw', quantity: 2, is_optional: false, buy_links: [] }],
  tools: [{ name: 'Screwdriver', is_optional: false, buy_links: [] }],
  stl_files: [],
}

describe('canAdvanceFromStep', () => {
  describe('step 1', () => {
    // Tests: a draft with a non-empty title and a valid difficulty can advance from Step 1
    // How:   passes baseDraft (title 'Test Tutorial', difficulty 'easy') to canAdvanceFromStep(1); checks true
    // Chain: the upload wizard uses this return value to enable the Next button → users can only
    //        proceed to Step 2 after providing the two required Step 1 fields
    it('returns true with valid title and difficulty', () => {
      expect(canAdvanceFromStep(1, baseDraft)).toBe(true)
    })

    // Tests: a draft with an empty title cannot advance from Step 1
    // How:   spreads baseDraft with title: ''; checks canAdvanceFromStep(1) returns false
    // Chain: the Next button stays disabled → the wizard cannot POST a draft without a title,
    //        preventing incomplete records from being created in the database
    it('returns false with empty title', () => {
      expect(canAdvanceFromStep(1, { ...baseDraft, title: '' })).toBe(false)
    })

    // Tests: a title containing only whitespace is treated as empty and blocks Step 1 advancement
    // How:   spreads baseDraft with title: '   '; checks return is false
    // Chain: prevents tutorials with a whitespace-only title from reaching the API → database
    //        records always have a meaningful, non-blank title
    it('returns false with whitespace-only title', () => {
      expect(canAdvanceFromStep(1, { ...baseDraft, title: '   ' })).toBe(false)
    })

    // Tests: a difficulty value outside the allowed set (easy/medium/hard) blocks Step 1
    // How:   passes difficulty: 'extreme' as any; checks return is false
    // Chain: the difficulty buttons in the UI only emit valid values, but this check guards
    //        against programmatic misuse → the API always receives a valid difficulty enum value
    it('returns false with invalid difficulty', () => {
      expect(canAdvanceFromStep(1, { ...baseDraft, difficulty: 'extreme' as any })).toBe(false)
    })

    // Tests: each of the three valid difficulty values allows advancement from Step 1
    // How:   calls canAdvanceFromStep(1, ...) with easy, medium, and hard; all return true
    // Chain: the three difficulty buttons each produce a passing result → the wizard is not
    //        accidentally over-restrictive in what difficulty choices it accepts
    it('returns true for each valid difficulty', () => {
      expect(canAdvanceFromStep(1, { ...baseDraft, difficulty: 'easy' })).toBe(true)
      expect(canAdvanceFromStep(1, { ...baseDraft, difficulty: 'medium' })).toBe(true)
      expect(canAdvanceFromStep(1, { ...baseDraft, difficulty: 'hard' })).toBe(true)
    })
  })

  describe('step 2', () => {
    // Tests: a draft with both tutorial_pdf_url and toy_photo_url set can advance from Step 2
    // How:   passes baseDraft (both URLs set) to canAdvanceFromStep(2); checks true
    // Chain: the Next button enables only after both file uploads complete → the tutorial record
    //        always has both a PDF and a photo URL before the parts step begins
    it('returns true with both URLs present', () => {
      expect(canAdvanceFromStep(2, baseDraft)).toBe(true)
    })

    // Tests: a missing tutorial_pdf_url prevents advancement from Step 2
    // How:   spreads baseDraft with tutorial_pdf_url: null; checks return is false
    // Chain: the Next button stays disabled until the PDF upload API call returns a URL →
    //        ensures the PDF is persisted before the wizard moves on
    it('returns false with missing pdf URL', () => {
      expect(canAdvanceFromStep(2, { ...baseDraft, tutorial_pdf_url: null })).toBe(false)
    })

    // Tests: a missing toy_photo_url prevents advancement from Step 2
    // How:   spreads baseDraft with toy_photo_url: null; checks return is false
    // Chain: the Next button stays disabled until the photo upload completes → every tutorial
    //        has a cover image before reaching the parts step
    it('returns false with missing photo URL', () => {
      expect(canAdvanceFromStep(2, { ...baseDraft, toy_photo_url: null })).toBe(false)
    })
  })

  describe('step 3', () => {
    // Tests: a draft with at least one part with a non-empty name and positive quantity can advance from Step 3
    // How:   passes baseDraft (one valid part) to canAdvanceFromStep(3); checks true
    // Chain: enables the Step 3 Next button → the parts list is POSTed to the API only when
    //        at least one valid part exists
    it('returns true with at least one valid part', () => {
      expect(canAdvanceFromStep(3, baseDraft)).toBe(true)
    })

    // Tests: an empty parts array prevents advancement from Step 3
    // How:   spreads baseDraft with parts: []; checks return is false
    // Chain: the wizard cannot advance to Step 4 without at least one part → every published
    //        tutorial has a non-empty parts list for users to reference
    it('returns false with empty parts array', () => {
      expect(canAdvanceFromStep(3, { ...baseDraft, parts: [] })).toBe(false)
    })

    // Tests: a part with an empty name prevents advancement from Step 3
    // How:   passes a part with name: ''; checks return is false
    // Chain: prevents unnamed parts from reaching the API → every part in the database has
    //        a meaningful label visible on the tutorial detail page
    it('returns false when part name is empty', () => {
      expect(
        canAdvanceFromStep(3, {
          ...baseDraft,
          parts: [{ name: '', quantity: 1, is_optional: false, buy_links: [] }],
        })
      ).toBe(false)
    })

    // Tests: a part with quantity zero prevents advancement from Step 3
    // How:   passes quantity: 0; checks return is false
    // Chain: every part record has a quantity of at least 1 → the parts list on the tutorial
    //        detail page always shows actionable "how many to buy" counts
    it('returns false when quantity is zero', () => {
      expect(
        canAdvanceFromStep(3, {
          ...baseDraft,
          parts: [{ name: 'Screw', quantity: 0, is_optional: false, buy_links: [] }],
        })
      ).toBe(false)
    })

    // Tests: a part with a non-integer quantity (e.g. 1.5) prevents advancement from Step 3
    // How:   passes quantity: 1.5; checks return is false
    // Chain: part quantities are stored as integers in the DB → validation ensures the value
    //        is both positive and a whole number before it reaches the API
    it('returns false when quantity is non-integer', () => {
      expect(
        canAdvanceFromStep(3, {
          ...baseDraft,
          parts: [{ name: 'Screw', quantity: 1.5, is_optional: false, buy_links: [] }],
        })
      ).toBe(false)
    })
  })

  describe('step 4', () => {
    // Tests: a draft with at least one tool with a non-empty name can advance from Step 4
    // How:   passes baseDraft (one valid tool) to canAdvanceFromStep(4); checks true
    // Chain: enables the Step 4 Next button → the tools list is POSTed to the API only when
    //        at least one valid tool exists
    it('returns true with at least one valid tool', () => {
      expect(canAdvanceFromStep(4, baseDraft)).toBe(true)
    })

    // Tests: an empty tools array prevents advancement from Step 4
    // How:   spreads baseDraft with tools: []; checks return is false
    // Chain: every tutorial has at least one tool listed → users can see what equipment
    //        they need before starting the adaptation project
    it('returns false with empty tools array', () => {
      expect(canAdvanceFromStep(4, { ...baseDraft, tools: [] })).toBe(false)
    })

    // Tests: a tool with an empty name prevents advancement from Step 4
    // How:   passes a tool with name: ''; checks return is false
    // Chain: prevents unnamed tools from being saved to the DB → every tool record has a
    //        name that makes sense on the tutorial detail page
    it('returns false when tool name is empty', () => {
      expect(
        canAdvanceFromStep(4, {
          ...baseDraft,
          tools: [{ name: '', is_optional: false, buy_links: [] }],
        })
      ).toBe(false)
    })
  })

  describe('step 5', () => {
    // Tests: Step 5 always allows advancement regardless of the STL files array
    // How:   passes stl_files: [] to canAdvanceFromStep(5); checks true
    // Chain: STL files are optional — the wizard skips the stl-files API call when the array
    //        is empty → tutorials without printable parts don't require an STL file
    it('always returns true (STL files are optional)', () => {
      expect(canAdvanceFromStep(5, { ...baseDraft, stl_files: [] })).toBe(true)
    })
  })

  describe('step 6', () => {
    // Tests: Step 6 returns true when all required data from prior steps is present
    // How:   passes baseDraft (all required fields populated) to canAdvanceFromStep(6); checks true
    // Chain: enables the Submit button → the final submit only PATCHes status to 'pending',
    //        trusting that prior steps have already validated and saved all required data
    it('returns true when all required steps pass', () => {
      expect(canAdvanceFromStep(6, baseDraft)).toBe(true)
    })
  })

  describe('unknown step', () => {
    // Tests: an unrecognised step number returns false
    // How:   passes step 99 to canAdvanceFromStep; checks return is false
    // Chain: prevents the wizard from advancing if called with an out-of-range step number →
    //        a defensive fallback that keeps the wizard in a valid state
    it('returns false for unknown step numbers', () => {
      expect(canAdvanceFromStep(99, baseDraft)).toBe(false)
    })
  })
})

describe('canSubmit', () => {
  // Tests: canSubmit returns true when all required fields for submission are present
  // How:   passes baseDraft (all fields set) to canSubmit; checks true
  // Chain: enables the Submit for Review button on Step 6 → the user can only submit a
  //        tutorial that has all required data already saved
  it('returns true when all required fields are valid', () => {
    expect(canSubmit(baseDraft)).toBe(true)
  })

  // Tests: canSubmit returns false when the title is empty
  // How:   spreads baseDraft with title: ''; checks false
  // Chain: the Submit button remains disabled → the API is never called with a titleless
  //        tutorial, maintaining data quality in the pending review queue
  it('returns false when title is missing', () => {
    expect(canSubmit({ ...baseDraft, title: '' })).toBe(false)
  })

  // Tests: canSubmit returns false when the parts array is empty
  // How:   spreads baseDraft with parts: []; checks false
  // Chain: the Submit button stays disabled → tutorials cannot enter the review queue
  //        without at least one part, ensuring reviewers always see complete content
  it('returns false when parts are empty', () => {
    expect(canSubmit({ ...baseDraft, parts: [] })).toBe(false)
  })
})

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
  // Tests: getMissingFields returns an empty array when all required fields are populated
  // How:   passes baseTutorial (all fields set) to getMissingFields; checks result equals []
  // Chain: an empty array means no warning banner is shown on the tutorial edit page →
  //        the contributor sees a clean form when their tutorial is ready to submit
  it('returns empty array when all fields are present', () => {
    expect(getMissingFields(baseTutorial)).toEqual([])
  })

  // Tests: getMissingFields includes 'Title' when the title is empty
  // How:   spreads baseTutorial with title: ''; checks result contains 'Title'
  // Chain: the edit page renders a "Missing: Title" warning → the contributor knows which
  //        field to fill in before they can submit for review
  it('includes "Title" when title is empty', () => {
    expect(getMissingFields({ ...baseTutorial, title: '' })).toContain('Title')
  })

  // Tests: getMissingFields includes 'Tutorial PDF' when tutorial_pdf_url is null
  // How:   spreads baseTutorial with tutorial_pdf_url: null; checks result contains 'Tutorial PDF'
  // Chain: the edit page shows a missing-file warning → contributors are guided to upload
  //        the PDF before attempting to submit for review
  it('includes "Tutorial PDF" when tutorial_pdf_url is null', () => {
    expect(getMissingFields({ ...baseTutorial, tutorial_pdf_url: null })).toContain('Tutorial PDF')
  })

  // Tests: getMissingFields includes 'Toy photo' when toy_photo_url is null
  // How:   spreads baseTutorial with toy_photo_url: null; checks result contains 'Toy photo'
  // Chain: the edit page shows a missing-photo warning → tutorials in the review queue
  //        always have a cover image when admins evaluate them
  it('includes "Toy photo" when toy_photo_url is null', () => {
    expect(getMissingFields({ ...baseTutorial, toy_photo_url: null })).toContain('Toy photo')
  })

  // Tests: getMissingFields includes 'At least one part' when the parts array is empty
  // How:   spreads baseTutorial with parts: []; checks result contains 'At least one part'
  // Chain: the edit page shows a missing-parts warning → contributors know to add parts
  //        before the Submit button becomes active
  it('includes "At least one part" when parts array is empty', () => {
    expect(getMissingFields({ ...baseTutorial, parts: [] })).toContain('At least one part')
  })

  // Tests: getMissingFields includes 'At least one tool' when the tools array is empty
  // How:   spreads baseTutorial with tools: []; checks result contains 'At least one tool'
  // Chain: the edit page shows a missing-tools warning → contributors know to add tools,
  //        ensuring reviewers always see a complete equipment list
  it('includes "At least one tool" when tools array is empty', () => {
    expect(getMissingFields({ ...baseTutorial, tools: [] })).toContain('At least one tool')
  })
})
```

- [ ] **Step 2: Run the test**

```
cd packages/web && pnpm test -- tests/unit/lib/validation.test.ts
```
Expected: all tests pass, 0 fail.

- [ ] **Step 3: Commit**

```
git add packages/web/tests/unit/lib/validation.test.ts
git commit -m "docs(tests): annotate validation.test.ts"
```

---

### Task 4: Annotate `nav.test.tsx`

**Files:**
- Modify: `packages/web/tests/unit/components/nav.test.tsx`

- [ ] **Step 1: Write the annotated file**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Nav } from '@/components/nav'

const mockSignOut = vi.fn()

// --- Mock strategy ---
// Three things are mocked: next/link is replaced with a plain <a> tag so links render in
// jsdom without Next.js routing infrastructure; the Supabase client is replaced so mockSignOut
// can be inspected; and window.location is stubbed with a writable href so the post-sign-out
// redirect can be asserted without triggering real navigation.
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

  // Tests: the Library link is visible to users who are not signed in (role is null)
  // How:   renders <Nav role={null} />; checks a link with text "library" is in the document
  // Chain: unauthenticated visitors can browse the tutorial library → the landing experience
  //        works without requiring login for public content
  it('renders library link for unauthenticated users', () => {
    render(<Nav role={null} />)
    expect(screen.getByRole('link', { name: /library/i })).toBeInTheDocument()
  })

  // Tests: the Dashboard link is visible to contributors
  // How:   renders <Nav role="contributor" />; checks a link with text "dashboard"
  // Chain: contributors can navigate to their "My Tutorials" dashboard → they can track their
  //        submissions and access the upload wizard from the nav bar
  it('renders dashboard link for contributors', () => {
    render(<Nav role="contributor" />)
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
  })

  // Tests: the Admin link is visible to admin users
  // How:   renders <Nav role="admin" />; checks a link with text "admin"
  // Chain: admins can navigate to the admin panel → they can review pending tutorials and
  //        manage contributors from a dedicated admin interface
  it('renders admin link for admin users', () => {
    render(<Nav role="admin" />)
    expect(screen.getByRole('link', { name: /admin/i })).toBeInTheDocument()
  })

  // Tests: admin users do not see the Dashboard link (they have the Admin link instead)
  // How:   renders <Nav role="admin" />; checks no link with text "dashboard" is present
  // Chain: the nav is role-exclusive — admins only get admin navigation → keeps the UI
  //        uncluttered and prevents admins from accessing contributor-only pages
  it('does not render dashboard link for admin users', () => {
    render(<Nav role="admin" />)
    expect(screen.queryByRole('link', { name: /dashboard/i })).toBeNull()
  })

  // Tests: contributors do not see the Admin link
  // How:   renders <Nav role="contributor" />; checks no link with text "admin" is present
  // Chain: the admin panel is hidden from contributors at the UI level → combined with the
  //        server-side role guard, contributors cannot access admin pages at all
  it('does not render admin link for contributors', () => {
    render(<Nav role="contributor" />)
    expect(screen.queryByRole('link', { name: /admin/i })).toBeNull()
  })

  // Tests: unauthenticated users see a Contribute link and no Sign out button
  // How:   renders <Nav role={null} />; checks Contribute link exists and Sign out button is absent
  // Chain: visitors can navigate to the contributor sign-up/login flow → signed-in users
  //        see Sign out instead, keeping the nav contextually relevant
  it('shows Contribute link and no Sign out for unauthenticated users', () => {
    render(<Nav role={null} />)
    expect(screen.getByRole('link', { name: /contribute/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign out/i })).toBeNull()
  })

  // Tests: authenticated users (any role) see a Sign out button and no Contribute link
  // How:   renders <Nav role="contributor" />; checks Sign out button exists and Contribute link is absent
  // Chain: the nav hides the join-up link once signed in → the UI reflects the user's current
  //        authentication state without redundant calls-to-action
  it('shows Sign out button and no Contribute link for authenticated users', () => {
    render(<Nav role="contributor" />)
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /contribute/i })).toBeNull()
  })

  // Tests: clicking Sign out calls Supabase signOut and redirects to / via window.location.href
  // How:   fireEvent.click on the Sign out button; waitFor checks mockSignOut was called and
  //        window.location.href === '/'
  // Chain: the user's Supabase session is ended → they are redirected to the public home page
  //        and the nav re-renders in the unauthenticated state on next load
  it('calls signOut and sets window.location.href to / on sign out click', async () => {
    render(<Nav role="contributor" />)
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled()
      expect(window.location.href).toBe('/')
    })
  })

  // Tests: admin users also see a Sign out button
  // How:   renders <Nav role="admin" />; checks Sign out button is in the document
  // Chain: admins can sign out using the same button as contributors → the sign-out flow
  //        works identically regardless of role
  it('shows Sign out button for admin users', () => {
    render(<Nav role="admin" />)
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test**

```
cd packages/web && pnpm test -- tests/unit/components/nav.test.tsx
```
Expected: 9 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```
git add packages/web/tests/unit/components/nav.test.tsx
git commit -m "docs(tests): annotate nav.test.tsx"
```

---

### Task 5: Annotate `upload-page.test.tsx`

**Files:**
- Modify: `packages/web/tests/unit/components/upload-page.test.tsx`

- [ ] **Step 1: Write the annotated file**

```tsx
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import UploadPage from '@/app/upload/page'

// --- Mock strategy ---
// Four things are mocked: browserApiClient (all five methods as vi.fn()) intercepts all API
// calls without real HTTP; FileDropZone is replaced with a plain file input keyed by name so
// tests can trigger file selection without drag-and-drop; BuyLinksInput renders nothing to
// avoid rendering complexity; and crypto.randomUUID is spied on to always return 'test-id',
// making all API endpoint URL assertions deterministic. window.location is stubbed for the
// submit redirect. The advanceToStep(n) helper drives the wizard to any step by replaying
// the full interaction sequence for all preceding steps.
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    postFormData: vi.fn(),
  },
}))

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

import { browserApiClient } from '@/lib/browser-api-client'

async function advanceToStep(to: number) {
  if (to >= 2) {
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. fisher-price piano/i), {
      target: { value: 'My Tutorial' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^easy$/i }))
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => expect(screen.getByText(/step 2 of 6/i)).toBeInTheDocument())
  }
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
  if (to >= 4) {
    fireEvent.click(screen.getByRole('button', { name: /\+ add part/i }))
    fireEvent.change(screen.getByPlaceholderText(/part name \*/i), {
      target: { value: 'Screw' },
    })
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => expect(screen.getByText(/step 4 of 6/i)).toBeInTheDocument())
  }
  if (to >= 5) {
    fireEvent.click(screen.getByRole('button', { name: /\+ add tool/i }))
    fireEvent.change(screen.getByPlaceholderText(/tool name \*/i), {
      target: { value: 'Screwdriver' },
    })
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => expect(screen.getByText(/step 5 of 6/i)).toBeInTheDocument())
  }
  if (to >= 6) {
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => expect(screen.getByText(/step 6 of 6/i)).toBeInTheDocument())
  }
}

describe('UploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('test-id' as ReturnType<typeof crypto.randomUUID>)
    vi.stubGlobal('location', { href: '' })
    vi.mocked(browserApiClient.post).mockResolvedValue({} as any)
    vi.mocked(browserApiClient.patch).mockResolvedValue({} as any)
    vi.mocked(browserApiClient.postFormData).mockResolvedValue({ url: 'https://example.com/file' } as any)
  })

  // Tests: clicking Next on Step 1 for the first time POSTs a new tutorial draft and links the contributor
  // How:   fills in title and difficulty, clicks Next; waitFor checks post was called with /api/tutorials
  //        and /api/contributors/me/tutorials/test-id
  // Chain: the draft record is created in the DB with a deterministic ID → subsequent wizard
  //        steps PATCH the same record, and the link row connects the tutorial to the contributor's dashboard
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

  // Tests: navigating back to Step 1 and clicking Next again PATCHes the draft instead of POSTing a second time
  // How:   advances to Step 2, navigates back, clears mocks, clicks Next; verifies PATCH was called
  //        and POST /api/tutorials was not called again
  // Chain: the draftSaved flag prevents duplicate tutorial records in the DB → back-navigation
  //        is safe and the same draft ID is used throughout the entire wizard session
  it('Step 1 Next (second time): PATCHes instead of POSTing again', async () => {
    render(<UploadPage />)
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. fisher-price piano/i), {
      target: { value: 'My Tutorial' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^easy$/i }))
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => screen.getByText(/step 2 of 6/i))
    fireEvent.click(screen.getByRole('button', { name: /← back/i }))
    await waitFor(() => screen.getByText(/step 1 of 6/i))
    vi.clearAllMocks()
    vi.mocked(browserApiClient.patch).mockResolvedValue({} as any)
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => {
      expect(browserApiClient.patch).toHaveBeenCalledWith(
        '/api/tutorials/test-id',
        expect.objectContaining({ title: 'My Tutorial', difficulty: 'easy' })
      )
    })
    expect(browserApiClient.post).not.toHaveBeenCalledWith('/api/tutorials', expect.anything())
  })

  // Tests: clicking Next on Step 2 PATCHes the tutorial record with the uploaded PDF and photo URLs
  // How:   advances to Step 2, uploads both files, clicks Next; checks PATCH called with both URLs
  // Chain: the file URLs are persisted on the tutorial record → Step 6 submit does not need to
  //        re-upload files, only PATCHing the status field to 'pending'
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

  // Tests: clicking Next on Step 3 sends the parts list to the API
  // How:   advances to Step 3, adds a part named 'Screw', clicks Next; checks POST called with parts array
  // Chain: the parts are saved to the DB as individual rows → the tutorial detail page can
  //        list the complete parts with quantities and buy links
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

  // Tests: clicking Next on Step 4 sends the tools list to the API
  // How:   advances to Step 4, adds a tool named 'Screwdriver', clicks Next; checks POST called with tools array
  // Chain: the tools are saved to the DB → the tutorial detail page can display the equipment
  //        list with optional buy links for each tool
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

  // Tests: clicking Next on Step 5 with a file uploaded sends the STL file list to the API
  // How:   advances to Step 5, drops a .stl file, clicks Next; checks POST called with stl_files array
  // Chain: the STL file URL and filename are saved to the DB → users can download the printable
  //        files from the tutorial detail page
  it('Step 5 Next with STL files: POSTs stl-files', async () => {
    render(<UploadPage />)
    await advanceToStep(5)
    vi.clearAllMocks()
    vi.mocked(browserApiClient.post).mockResolvedValue({} as any)
    vi.mocked(browserApiClient.postFormData).mockResolvedValue({
      url: 'https://example.com/bracket.stl',
      filename: 'bracket.stl',
    } as any)
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

  // Tests: clicking Next on Step 5 with no STL files does NOT call the stl-files endpoint
  // How:   advances to Step 5 without uploading anything, clicks Next; checks POST was not called
  //        with the stl-files endpoint
  // Chain: tutorials without printable parts skip the stl_files API call → no empty stl_files
  //        rows are created and the tutorial detail page shows no download section
  it('Step 5 Next without STL files: does NOT call stl-files endpoint', async () => {
    render(<UploadPage />)
    await advanceToStep(5)
    vi.clearAllMocks()
    vi.mocked(browserApiClient.post).mockResolvedValue({} as any)
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    await waitFor(() => screen.getByText(/step 6 of 6/i))
    expect(browserApiClient.post).not.toHaveBeenCalledWith(
      '/api/tutorials/test-id/stl-files',
      expect.anything()
    )
  })

  // Tests: clicking Submit on Step 6 only PATCHes status to 'pending' (no re-saving other data) then redirects
  // How:   advances to Step 6, clicks Submit; checks PATCH called exactly once with { status: 'pending' }
  //        and window.location.href is '/my-tutorials'
  // Chain: the tutorial enters the admin review queue → the contributor is redirected to their
  //        dashboard where they can see the tutorial listed as 'pending'
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
    expect(browserApiClient.post).not.toHaveBeenCalled()
  })

  // Tests: when an API call throws, the error message is displayed on screen
  // How:   mocks browserApiClient.post to reject with 'Server unavailable'; clicks Next;
  //        waitFor checks the error text appears in the document
  // Chain: the user sees a plain-English error rather than a silent failure or crash →
  //        they can retry the step or check their connection
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

  // Tests: while an API call is in flight the Next button shows "Saving..." and is disabled
  // How:   mocks post with a manually-controlled Promise; clicks Next; checks button is disabled
  //        and labelled "Saving…"; then resolves the Promise and waits for Step 2
  // Chain: the user cannot double-click and create duplicate API calls → only one in-flight
  //        request runs at a time for each wizard step
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
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()
    )
    act(() => resolvePost({ id: 'test-id' }))
    await waitFor(() => screen.getByText(/step 2 of 6/i))
  })

  // Tests: the Next button on Step 1 is disabled when the title field is empty (no API call made)
  // How:   renders without filling in the title; checks the Next button has the disabled attribute
  // Chain: the wizard is gated by canAdvanceFromStep validation → no POST is ever made with an
  //        empty title, preventing incomplete draft records from being created in the DB
  it('Next button is disabled when step 1 title is empty', () => {
    render(<UploadPage />)
    fireEvent.click(screen.getByRole('button', { name: /^easy$/i }))
    expect(screen.getByRole('button', { name: /next →/i })).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run the test**

```
cd packages/web && pnpm test -- tests/unit/components/upload-page.test.tsx
```
Expected: 11 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```
git add packages/web/tests/unit/components/upload-page.test.tsx
git commit -m "docs(tests): annotate upload-page.test.tsx"
```

---

### Task 6: Annotate `buy-links-input.test.tsx`

**Files:**
- Modify: `packages/web/tests/unit/components/buy-links-input.test.tsx`

- [ ] **Step 1: Write the annotated file**

No mock strategy comment needed (no `vi.mock()` calls).

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BuyLinksInput } from '@/components/buy-links-input'

describe('BuyLinksInput', () => {
  // Tests: the BuyLinksInput component renders an "Add buy link" button by default
  // How:   renders <BuyLinksInput /> with no props; checks the button is in the document
  // Chain: the button is the entry point for adding buy links to a part or tool → users can
  //        optionally add purchase links without the component requiring any initial data
  it('renders add button', () => {
    render(<BuyLinksInput />)
    expect(screen.getByRole('button', { name: /add buy link/i })).toBeInTheDocument()
  })

  // Tests: clicking "Add buy link" calls the onChange callback with a new empty link entry
  // How:   passes a vi.fn() as onChange; clicks the button; checks onChange was called with
  //        an array containing an object with empty label and url fields
  // Chain: the parent component (upload wizard or edit form) receives the updated links array →
  //        it saves the new entry to local state before the step's Next/Save action
  it('calls onChange when a buy link is added', () => {
    const handleChange = vi.fn()
    render(<BuyLinksInput onChange={handleChange} />)
    fireEvent.click(screen.getByRole('button', { name: /add buy link/i }))
    expect(handleChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ label: '', url: '' })])
    )
  })

  // Tests: buy links provided via initialLinks are rendered as pre-filled input fields
  // How:   passes initialLinks with one link {label: 'Amazon', url: '...'}; checks both values appear in inputs
  // Chain: the edit form pre-populates links from the saved tutorial record → contributors
  //        can update or remove existing links without having to re-enter them from scratch
  it('renders existing buy links from initialLinks', () => {
    render(
      <BuyLinksInput
        initialLinks={[{ label: 'Amazon', url: 'https://amazon.com/product' }]}
        onChange={() => {}}
      />
    )
    expect(screen.getByDisplayValue('Amazon')).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://amazon.com/product')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test**

```
cd packages/web && pnpm test -- tests/unit/components/buy-links-input.test.tsx
```
Expected: 3 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```
git add packages/web/tests/unit/components/buy-links-input.test.tsx
git commit -m "docs(tests): annotate buy-links-input.test.tsx"
```

---

### Task 7: Annotate `difficulty-badge.test.tsx`

**Files:**
- Modify: `packages/web/tests/unit/components/difficulty-badge.test.tsx`

- [ ] **Step 1: Write the annotated file**

No mock strategy comment needed (no `vi.mock()` calls).

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DifficultyBadge } from '@/components/difficulty-badge'

describe('DifficultyBadge', () => {
  // Tests: DifficultyBadge renders the text "easy" when difficulty="easy" is passed
  // How:   renders <DifficultyBadge difficulty="easy" />; checks text "easy" is in the document
  // Chain: the badge appears on TutorialCard in the library → users can scan difficulty levels
  //        at a glance when browsing available tutorials
  it('renders easy badge', () => {
    render(<DifficultyBadge difficulty="easy" />)
    expect(screen.getByText(/easy/i)).toBeInTheDocument()
  })

  // Tests: DifficultyBadge renders "medium" for the medium difficulty level
  // How:   renders <DifficultyBadge difficulty="medium" />; checks text "medium" is present
  // Chain: medium difficulty tutorials display the correct label in the library and on the
  //        tutorial detail page header
  it('renders medium badge', () => {
    render(<DifficultyBadge difficulty="medium" />)
    expect(screen.getByText(/medium/i)).toBeInTheDocument()
  })

  // Tests: DifficultyBadge renders "hard" for the hard difficulty level
  // How:   renders <DifficultyBadge difficulty="hard" />; checks text "hard" is present
  // Chain: hard difficulty tutorials are clearly labelled → users can self-select appropriate
  //        projects based on their skill level before starting
  it('renders hard badge', () => {
    render(<DifficultyBadge difficulty="hard" />)
    expect(screen.getByText(/hard/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test**

```
cd packages/web && pnpm test -- tests/unit/components/difficulty-badge.test.tsx
```
Expected: 3 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```
git add packages/web/tests/unit/components/difficulty-badge.test.tsx
git commit -m "docs(tests): annotate difficulty-badge.test.tsx"
```

---

### Task 8: Annotate `tutorial-card.test.tsx`

**Files:**
- Modify: `packages/web/tests/unit/components/tutorial-card.test.tsx`

- [ ] **Step 1: Write the annotated file**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TutorialCard } from '@/components/tutorial-card'
import type { Tutorial } from '@splat-connect/types'

// --- Mock strategy ---
// Two Next.js components are mocked: next/link is replaced with a plain <a> tag so link
// href values can be inspected via the DOM without Next.js routing infrastructure, and
// next/image is replaced with a plain <img> tag so image src values can be checked without
// Next.js image optimisation.
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}))

const mockTutorial: Tutorial = {
  id: '1',
  title: 'Switch Adaptation Tutorial',
  difficulty: 'easy',
  status: 'approved',
  description: 'A helpful tutorial',
  tutorial_pdf_url: 'https://example.com/tutorial.pdf',
  toy_photo_url: 'https://example.com/photo.jpg',
  rejection_note: null,
  created_at: '2026-01-01T00:00:00Z',
  reviewed_at: null,
}

describe('TutorialCard', () => {
  // Tests: TutorialCard displays the tutorial title
  // How:   renders a card with the mock tutorial; checks text 'Switch Adaptation Tutorial' is present
  // Chain: the title is the primary identifier in the library grid → users can read and
  //        distinguish tutorials by name when browsing
  it('renders tutorial title', () => {
    render(<TutorialCard tutorial={mockTutorial} />)
    expect(screen.getByText('Switch Adaptation Tutorial')).toBeInTheDocument()
  })

  // Tests: TutorialCard includes a DifficultyBadge showing the tutorial's difficulty
  // How:   renders the card; checks text 'easy' is in the document (rendered by DifficultyBadge)
  // Chain: the badge is visible on every card in the library → users can filter or sort by
  //        difficulty when choosing which tutorial to follow
  it('renders difficulty badge', () => {
    render(<TutorialCard tutorial={mockTutorial} />)
    expect(screen.getByText(/easy/i)).toBeInTheDocument()
  })

  // Tests: TutorialCard wraps content in a link pointing to /tutorials/:id
  // How:   checks the single link element has href='/tutorials/1'
  // Chain: clicking the card navigates to the tutorial detail page → users can read the
  //        full tutorial including PDF, parts, tools, and STL files
  it('renders a link to the tutorial', () => {
    render(<TutorialCard tutorial={mockTutorial} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/tutorials/1')
  })

  // Tests: the tutorial description text is visible on the card
  // How:   checks text 'A helpful tutorial' is in the document
  // Chain: descriptions give users context before clicking through → they can assess whether
  //        a tutorial suits their needs from the library grid without opening each one
  it('renders description when present', () => {
    render(<TutorialCard tutorial={mockTutorial} />)
    expect(screen.getByText('A helpful tutorial')).toBeInTheDocument()
  })

  // Tests: when toy_photo_url is null, a fallback emoji is shown instead of an image
  // How:   renders with toy_photo_url: null; checks the fallback emoji character is present
  // Chain: cards without an uploaded photo still render correctly in the library →
  //        no broken-image icons appear for tutorials that skipped the photo step
  it('renders fallback emoji when toy_photo_url is null', () => {
    render(<TutorialCard tutorial={{ ...mockTutorial, toy_photo_url: null }} />)
    expect(screen.getByText('🦸')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test**

```
cd packages/web && pnpm test -- tests/unit/components/tutorial-card.test.tsx
```
Expected: 5 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```
git add packages/web/tests/unit/components/tutorial-card.test.tsx
git commit -m "docs(tests): annotate tutorial-card.test.tsx"
```

---

### Task 9: Annotate `file-drop-zone.test.tsx`

**Files:**
- Modify: `packages/web/tests/unit/components/file-drop-zone.test.tsx`

- [ ] **Step 1: Write the annotated file**

No mock strategy comment needed (no `vi.mock()` calls).

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FileDropZone } from '@/components/file-drop-zone'

describe('FileDropZone', () => {
  // Tests: FileDropZone shows the label text passed via the label prop
  // How:   renders with label="Upload PDF"; checks text 'Upload PDF' is in the document
  // Chain: the label tells the user what file type to drop → upload wizard steps use
  //        different labels ('Upload PDF', 'Upload photo') to guide the user
  it('renders label text in the drop prompt', () => {
    render(<FileDropZone name="file" label="Upload PDF" accept=".pdf" onChange={() => {}} />)
    expect(screen.getByText(/upload pdf/i)).toBeInTheDocument()
  })

  // Tests: selecting a file via the hidden file input triggers the onChange callback
  // How:   fires a change event on the file input with a fake PDF file; checks onChange was called
  // Chain: the upload wizard receives the File object in onChange → it calls postFormData to
  //        upload the file to Supabase storage and get back a public URL
  it('calls onChange when file is selected', () => {
    const handleChange = vi.fn()
    render(<FileDropZone name="file" label="Upload PDF" accept=".pdf" onChange={handleChange} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['content'], 'tutorial.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(handleChange).toHaveBeenCalled()
  })

  // Tests: after a file is selected, its name is displayed in the drop zone
  // How:   fires a change event with 'tutorial.pdf'; checks text 'tutorial.pdf' is in the document
  // Chain: the user can confirm which file they selected before clicking Next → reduces errors
  //        from accidentally selecting the wrong file
  it('shows selected filename after selection', () => {
    render(<FileDropZone name="file" label="Upload PDF" accept=".pdf" onChange={() => {}} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['content'], 'tutorial.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(screen.getByText('tutorial.pdf')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test**

```
cd packages/web && pnpm test -- tests/unit/components/file-drop-zone.test.tsx
```
Expected: 3 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```
git add packages/web/tests/unit/components/file-drop-zone.test.tsx
git commit -m "docs(tests): annotate file-drop-zone.test.tsx"
```

---

### Task 10: Annotate `edit-files-section.test.tsx`

**Files:**
- Modify: `packages/web/tests/unit/components/edit-files-section.test.tsx`

- [ ] **Step 1: Write the annotated file**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditFilesSection } from '@/components/edit-files-section'
import { browserApiClient } from '@/lib/browser-api-client'

// --- Mock strategy ---
// browserApiClient.postFormData is mocked via vi.mock so the component can be tested without
// real HTTP calls. The setup() helper renders the component with a default onSave spy and
// returns direct references to the photo input, PDF input, and Save button for convenient
// use in individual tests.
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

  // Tests: the Save button is disabled when neither a photo nor a PDF has been selected
  // How:   calls setup() with no file interactions; checks saveButton has disabled attribute
  // Chain: prevents an empty save call → the component only calls postFormData when at least
  //        one file is queued, avoiding a wasted API call
  it('Save button is disabled when no file is selected', () => {
    const { saveButton } = setup()
    expect(saveButton).toBeDisabled()
  })

  // Tests: selecting a photo file enables the Save button
  // How:   fires change on photoInput with a PNG file; checks saveButton is not disabled
  // Chain: the save state tracks whether any new file is pending → users get clear visual
  //        feedback that their selection is ready to upload
  it('Save button is enabled after selecting a photo', () => {
    const { photoInput, saveButton } = setup()
    fireEvent.change(photoInput, {
      target: { files: [new File(['img'], 'photo.png', { type: 'image/png' })] },
    })
    expect(saveButton).not.toBeDisabled()
  })

  // Tests: selecting a PDF file enables the Save button
  // How:   fires change on pdfInput with a PDF file; checks saveButton is not disabled
  // Chain: selecting either file type activates the Save path — the component tracks pending
  //        changes regardless of which file type was chosen
  it('Save button is enabled after selecting a PDF', () => {
    const { pdfInput, saveButton } = setup()
    fireEvent.change(pdfInput, {
      target: { files: [new File(['pdf'], 'tutorial.pdf', { type: 'application/pdf' })] },
    })
    expect(saveButton).not.toBeDisabled()
  })

  // Tests: file selection alone does not trigger an upload — it only queues the file
  // How:   fires change on photoInput; checks mockPostFormData was not called
  // Chain: uploads are deferred to the Save button click → the user can change their mind
  //        and select a different file without incurring an unnecessary upload
  it('selecting a photo does not call postFormData', () => {
    const { photoInput } = setup()
    fireEvent.change(photoInput, {
      target: { files: [new File(['img'], 'photo.png', { type: 'image/png' })] },
    })
    expect(mockPostFormData).not.toHaveBeenCalled()
  })

  // Tests: selecting a PDF does not trigger an upload until Save is clicked
  // How:   fires change on pdfInput; checks mockPostFormData was not called
  // Chain: same deferred-upload pattern as photo → selection queues, Save executes the upload
  it('selecting a PDF does not call postFormData', () => {
    const { pdfInput } = setup()
    fireEvent.change(pdfInput, {
      target: { files: [new File(['pdf'], 'tutorial.pdf', { type: 'application/pdf' })] },
    })
    expect(mockPostFormData).not.toHaveBeenCalled()
  })

  // Tests: clicking Save after selecting a photo calls postFormData with the photo upload endpoint
  // How:   fires change then saveButton click; waitFor checks mockPostFormData was called with '/api/upload/photo'
  // Chain: the photo is uploaded to Supabase storage → the returned URL is passed to onSave,
  //        which PATCHes the tutorial record so the new photo appears on the tutorial page
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

  // Tests: clicking Save after selecting a PDF calls postFormData with the PDF upload endpoint
  // How:   fires change on pdfInput then saveButton click; checks path is '/api/upload/pdf'
  // Chain: the PDF is uploaded to Supabase storage → the returned URL is PATCHed onto the
  //        tutorial record so viewers can download the updated PDF
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

  // Tests: when both files are selected and Save is clicked, onSave is called with both returned URLs
  // How:   mockPostFormData returns two different URLs; fires both inputs then clicks Save;
  //        checks onSave was called with (photoUrl, pdfUrl)
  // Chain: the parent component patches the tutorial record with both URLs in one PATCH call →
  //        photo and PDF are updated atomically without needing two separate save cycles
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

  // Tests: after a successful save the Save button becomes disabled again
  // How:   fires change + save; waitFor checks button returns to disabled state
  // Chain: the component resets to its "no pending changes" state after saving → the button
  //        signals there are no unsaved changes, preventing accidental double-saves
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

- [ ] **Step 2: Run the test**

```
cd packages/web && pnpm test -- tests/unit/components/edit-files-section.test.tsx
```
Expected: 9 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```
git add packages/web/tests/unit/components/edit-files-section.test.tsx
git commit -m "docs(tests): annotate edit-files-section.test.tsx"
```

---

### Task 11: Annotate `edit-parts-section.test.tsx`

**Files:**
- Modify: `packages/web/tests/unit/components/edit-parts-section.test.tsx`

- [ ] **Step 1: Write the annotated file**

No mock strategy comment needed (no `vi.mock()` calls — onSave is a prop passed directly in tests).

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditPartsSection } from '@/components/edit-parts-section'
import type { Part } from '@splat-connect/types'

const mockParts: Part[] = [
  {
    id: 'part-1',
    tutorial_id: 'tut-1',
    name: 'Solder Wire',
    quantity: 2,
    is_optional: false,
    buy_links: [],
  },
  {
    id: 'part-2',
    tutorial_id: 'tut-1',
    name: 'Heat Shrink',
    quantity: 10,
    is_optional: true,
    buy_links: [{ label: 'Jaycar', url: 'https://jaycar.com' }],
  },
]

function setup(onSave = vi.fn().mockResolvedValue(undefined), parts = mockParts) {
  return render(<EditPartsSection initialParts={parts} onSave={onSave} />)
}

describe('EditPartsSection', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: EditPartsSection displays the names of all parts passed via initialParts
  // How:   setup() renders with mockParts (Solder Wire, Heat Shrink); checks both names visible
  // Chain: the edit form pre-loads the tutorial's current parts → contributors see what
  //        they've already saved and can choose which ones to edit or delete
  it('renders existing part names', () => {
    setup()
    expect(screen.getByText(/Solder Wire/)).toBeInTheDocument()
    expect(screen.getByText(/Heat Shrink/)).toBeInTheDocument()
  })

  // Tests: each part row shows a chevron (▼) to indicate it's expandable
  // How:   checks screen.getAllByText('▼') has length 2 (one per mock part)
  // Chain: the chevron communicates the expand/collapse interaction pattern → users know
  //        to click a row to reveal the inline edit form
  it('renders a chevron indicator on each part row', () => {
    setup()
    const chevrons = screen.getAllByText('▼')
    expect(chevrons).toHaveLength(2)
  })

  // Tests: the edit form (with input fields) is hidden until a row is clicked
  // How:   checks queryByDisplayValue('Solder Wire') returns null before any click
  // Chain: all parts show as compact rows by default → the UI stays readable when there
  //        are many parts, expanding only the one being edited
  it('edit form is not visible before a row is expanded', () => {
    setup()
    expect(screen.queryByDisplayValue('Solder Wire')).not.toBeInTheDocument()
  })

  // Tests: clicking a part row expands it to show an edit form pre-filled with the part's current values
  // How:   fireEvent.click on the 'Solder Wire' button; checks inputs display 'Solder Wire' and '2'
  // Chain: contributors can see and modify the exact values stored for that part → they don't
  //        need to re-enter unchanged fields when making a small correction
  it('clicking a part row shows its edit form pre-filled with current values', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Solder Wire/ }))
    expect(screen.getByDisplayValue('Solder Wire')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2')).toBeInTheDocument()
  })

  // Tests: clicking Cancel collapses the edit form without saving changes
  // How:   expands a row, clicks Cancel; checks the input is no longer in the document
  // Chain: the row returns to its compact state with the original values unchanged →
  //        contributors can dismiss an accidental expand without triggering a save
  it('clicking Cancel hides the edit form', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Solder Wire/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByDisplayValue('Solder Wire')).not.toBeInTheDocument()
  })

  // Tests: editing a part name and clicking Save calls onSave with the updated parts array
  // How:   expands row, changes name to 'Solder Wire Thick', clicks Save; waitFor checks
  //        onSave was called with savedParts[0].name === 'Solder Wire Thick'
  // Chain: the parent component receives the updated array and calls the API to persist it →
  //        the tutorial detail page shows the new part name after the save
  it('clicking Save calls onSave with the updated part', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    setup(onSave)
    fireEvent.click(screen.getByRole('button', { name: /Solder Wire/ }))
    fireEvent.change(screen.getByDisplayValue('Solder Wire'), {
      target: { value: 'Solder Wire Thick' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const [savedParts] = onSave.mock.calls[0] as [{ name: string }[]]
    expect(savedParts[0].name).toBe('Solder Wire Thick')
  })

  // Tests: clicking Delete removes that part from the array and calls onSave with the remaining parts
  // How:   expands 'Solder Wire', clicks Delete; waitFor checks onSave called with array of length 1
  //        and the remaining part is 'Heat Shrink'
  // Chain: the parent component persists the reduced array → the deleted part no longer
  //        appears on the tutorial detail page after the save completes
  it('clicking Delete calls onSave without the deleted part', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    setup(onSave)
    fireEvent.click(screen.getByRole('button', { name: /Solder Wire/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const [savedParts] = onSave.mock.calls[0] as [{ name: string }[]]
    expect(savedParts).toHaveLength(1)
    expect(savedParts[0].name).toBe('Heat Shrink')
  })

  // Tests: filling the Add part form and clicking Add part appends a new part and calls onSave
  // How:   fills the Name input, clicks 'Add part'; waitFor checks onSave called with 3 parts
  //        and savedParts[2].name === 'New Part'
  // Chain: the new part is persisted immediately after add → contributors can add multiple
  //        parts in sequence without reloading the page
  it('submitting the Add part form calls onSave with the new part appended', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    setup(onSave)
    fireEvent.change(screen.getByPlaceholderText('Name'), {
      target: { value: 'New Part' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add part' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const [savedParts] = onSave.mock.calls[0] as [{ name: string }[]]
    expect(savedParts).toHaveLength(3)
    expect(savedParts[2].name).toBe('New Part')
  })

  // Tests: when onSave throws, an error message is shown in the UI
  // How:   setup() passes an onSave that rejects; expands a row and clicks Save; waitFor checks
  //        'Failed to save, please try again' is in the document
  // Chain: the contributor sees a retry prompt instead of a silent failure → they can attempt
  //        the save again or refresh the page if the error persists
  it('shows an error message when onSave throws during edit save', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Network error'))
    setup(onSave)
    fireEvent.click(screen.getByRole('button', { name: /Solder Wire/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(screen.getByText('Failed to save, please try again')).toBeInTheDocument()
    )
  })
})
```

- [ ] **Step 2: Run the test**

```
cd packages/web && pnpm test -- tests/unit/components/edit-parts-section.test.tsx
```
Expected: 8 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```
git add packages/web/tests/unit/components/edit-parts-section.test.tsx
git commit -m "docs(tests): annotate edit-parts-section.test.tsx"
```

---

### Task 12: Annotate `edit-tools-section.test.tsx`

**Files:**
- Modify: `packages/web/tests/unit/components/edit-tools-section.test.tsx`

- [ ] **Step 1: Write the annotated file**

No mock strategy comment needed (no `vi.mock()` calls).

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditToolsSection } from '@/components/edit-tools-section'
import type { Tool } from '@splat-connect/types'

const mockTools: Tool[] = [
  {
    id: 'tool-1',
    tutorial_id: 'tut-1',
    name: 'Soldering Iron',
    is_optional: false,
    buy_links: [],
  },
  {
    id: 'tool-2',
    tutorial_id: 'tut-1',
    name: 'Heat Gun',
    is_optional: true,
    buy_links: [{ label: 'Jaycar', url: 'https://jaycar.com' }],
  },
]

function setup(onSave = vi.fn().mockResolvedValue(undefined), tools = mockTools) {
  return render(<EditToolsSection initialTools={tools} onSave={onSave} />)
}

describe('EditToolsSection', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: EditToolsSection displays the names of all tools passed via initialTools
  // How:   setup() renders with mockTools (Soldering Iron, Heat Gun); checks both names visible
  // Chain: the edit form shows the tutorial's current tools → contributors can see what they
  //        saved and identify which tools to edit, delete, or leave as-is
  it('renders existing tool names', () => {
    setup()
    expect(screen.getByText(/Soldering Iron/)).toBeInTheDocument()
    expect(screen.getByText(/Heat Gun/)).toBeInTheDocument()
  })

  // Tests: each tool row shows a chevron (▼) expand indicator
  // How:   checks getAllByText('▼') has length 2
  // Chain: same expand/collapse pattern as the parts section → users click to reveal the
  //        inline edit form for a specific tool
  it('renders a chevron indicator on each tool row', () => {
    setup()
    const chevrons = screen.getAllByText('▼')
    expect(chevrons).toHaveLength(2)
  })

  // Tests: the tool edit form is hidden until its row is clicked
  // How:   checks queryByDisplayValue('Soldering Iron') is null before any click
  // Chain: the tools list stays compact until actively edited → the UI is readable even
  //        with many tools listed
  it('edit form is not visible before a row is expanded', () => {
    setup()
    expect(screen.queryByDisplayValue('Soldering Iron')).not.toBeInTheDocument()
  })

  // Tests: clicking a tool row shows an edit form pre-filled with the tool's current name
  // How:   fireEvent.click on 'Soldering Iron'; checks input displays 'Soldering Iron'
  // Chain: contributors can modify the exact saved value → the current name is the starting
  //        point for any edit, reducing re-entry effort
  it('clicking a tool row shows its edit form pre-filled with current values', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Soldering Iron/ }))
    expect(screen.getByDisplayValue('Soldering Iron')).toBeInTheDocument()
  })

  // Tests: clicking Cancel collapses the form without saving
  // How:   expands 'Soldering Iron', clicks Cancel; checks input is gone from document
  // Chain: contributors can dismiss the form with no changes → the tool list returns to
  //        its original compact state
  it('clicking Cancel hides the edit form', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Soldering Iron/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByDisplayValue('Soldering Iron')).not.toBeInTheDocument()
  })

  // Tests: changing a tool name and clicking Save calls onSave with the updated tools array
  // How:   changes value to 'Soldering Station', clicks Save; waitFor checks savedTools[0].name
  // Chain: the parent component persists the updated array → the tutorial detail page shows
  //        the corrected tool name after the save
  it('clicking Save calls onSave with the updated tool', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    setup(onSave)
    fireEvent.click(screen.getByRole('button', { name: /Soldering Iron/ }))
    fireEvent.change(screen.getByDisplayValue('Soldering Iron'), {
      target: { value: 'Soldering Station' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const [savedTools] = onSave.mock.calls[0] as [{ name: string }[]]
    expect(savedTools[0].name).toBe('Soldering Station')
  })

  // Tests: clicking Delete removes the tool and calls onSave with the remaining tools
  // How:   expands 'Soldering Iron', clicks Delete; waitFor checks array length is 1 and
  //        the remaining tool is 'Heat Gun'
  // Chain: the parent component persists the reduced array → the deleted tool no longer
  //        appears on the tutorial detail page
  it('clicking Delete calls onSave without the deleted tool', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    setup(onSave)
    fireEvent.click(screen.getByRole('button', { name: /Soldering Iron/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const [savedTools] = onSave.mock.calls[0] as [{ name: string }[]]
    expect(savedTools).toHaveLength(1)
    expect(savedTools[0].name).toBe('Heat Gun')
  })

  // Tests: filling the Add tool form and clicking Add tool calls onSave with the new tool appended
  // How:   fills Name input with 'New Tool', clicks 'Add tool'; checks onSave called with 3 tools
  // Chain: contributors can add multiple tools without a page reload → the tutorial's tools
  //        list grows immediately after each save
  it('submitting the Add tool form calls onSave with the new tool appended', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    setup(onSave)
    fireEvent.change(screen.getByPlaceholderText('Name'), {
      target: { value: 'New Tool' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add tool' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const [savedTools] = onSave.mock.calls[0] as [{ name: string }[]]
    expect(savedTools).toHaveLength(3)
    expect(savedTools[2].name).toBe('New Tool')
  })

  // Tests: when onSave throws, the error message is displayed in the UI
  // How:   passes an onSave that rejects; expands and clicks Save; waitFor checks the error text
  // Chain: the contributor sees a retry prompt → they can attempt the save again rather than
  //        not knowing whether the operation succeeded or failed
  it('shows an error message when onSave throws during edit save', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Network error'))
    setup(onSave)
    fireEvent.click(screen.getByRole('button', { name: /Soldering Iron/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(screen.getByText('Failed to save, please try again')).toBeInTheDocument()
    )
  })
})
```

- [ ] **Step 2: Run the test**

```
cd packages/web && pnpm test -- tests/unit/components/edit-tools-section.test.tsx
```
Expected: 8 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```
git add packages/web/tests/unit/components/edit-tools-section.test.tsx
git commit -m "docs(tests): annotate edit-tools-section.test.tsx"
```

---

### Task 13: Annotate `auth.test.ts` (web lib)

**Files:**
- Modify: `packages/web/tests/unit/lib/auth.test.ts`

- [ ] **Step 1: Write the annotated file**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { getUserRole } from '@/lib/auth'

// --- Mock strategy ---
// Two Next.js server-side modules are mocked: next/headers provides a fake cookies() function
// (the real one only works inside a server request context), and @supabase/ssr's createServerClient
// is replaced with a factory returning a fake Supabase client. This allows getUserRole to be
// called in a plain Vitest environment without a running Next.js server.
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}))

describe('getUserRole', () => {
  const mockGetUser = vi.fn()
  const mockSingle = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    vi.mocked(cookies).mockResolvedValue({
      getAll: () => [],
      set: vi.fn(),
    } as any)

    vi.mocked(createServerClient).mockReturnValue({
      auth: { getUser: mockGetUser },
      from: () => ({
        select: () => ({
          eq: () => ({ single: mockSingle }),
        }),
      }),
    } as any)
  })

  // Tests: getUserRole returns null when Supabase reports no authenticated user
  // How:   mockGetUser returns { data: { user: null } }; checks result is null
  // Chain: server components call getUserRole to determine the nav bar state and page access →
  //        a null role causes the layout to render as unauthenticated (Library + Contribute links)
  it('returns null when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    expect(await getUserRole()).toBeNull()
  })

  // Tests: getUserRole returns null when the user is authenticated but has no profile row
  // How:   mockGetUser returns a user; mockSingle returns { data: null, error: { code: 'PGRST116' } }; checks null
  // Chain: users who authenticated but were never given a profile are treated as unauthenticated →
  //        they cannot access contributor or admin pages until a profile is created for them
  it('returns null when profile row is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'no rows' } })
    expect(await getUserRole()).toBeNull()
  })

  // Tests: getUserRole returns 'contributor' when the user's profile has role='contributor'
  // How:   mockSingle returns { data: { role: 'contributor' } }; checks result is 'contributor'
  // Chain: the layout passes the role to the Nav component and server component page guards →
  //        contributors see the dashboard link and can access the upload wizard and their tutorials
  it('returns contributor for a contributor user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({ data: { role: 'contributor' } })
    expect(await getUserRole()).toBe('contributor')
  })

  // Tests: getUserRole returns 'admin' when the user's profile has role='admin'
  // How:   mockSingle returns { data: { role: 'admin' } }; checks result is 'admin'
  // Chain: the layout passes 'admin' to Nav and page guards → admin users see the Admin link
  //        and can access the pending tutorials review and contributor management pages
  it('returns admin for an admin user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({ data: { role: 'admin' } })
    expect(await getUserRole()).toBe('admin')
  })

  // Tests: getUserRole returns null (instead of throwing) if the Supabase call itself throws
  // How:   mockGetUser rejects with new Error('Supabase unavailable'); checks result is null
  // Chain: a Supabase outage causes all server components to treat the user as unauthenticated
  //        rather than crashing the entire page render with an uncaught promise rejection
  it('returns null when Supabase throws', async () => {
    mockGetUser.mockRejectedValue(new Error('Supabase unavailable'))
    expect(await getUserRole()).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test**

```
cd packages/web && pnpm test -- tests/unit/lib/auth.test.ts
```
Expected: 5 tests pass, 0 fail.

- [ ] **Step 3: Commit**

```
git add packages/web/tests/unit/lib/auth.test.ts
git commit -m "docs(tests): annotate auth.test.ts (web lib)"
```

---

### Final verification

- [ ] **Run the full web test suite to confirm all 109 tests still pass**

```
cd packages/web && pnpm test
```
Expected: 109 tests pass, 0 fail.
