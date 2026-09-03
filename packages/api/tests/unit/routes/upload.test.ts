import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockAdminList = vi.fn()
const mockAdminRemove = vi.fn()
const mockAdminStorageBucket = { list: mockAdminList, remove: mockAdminRemove }
const mockAdminStorage = { from: vi.fn(() => mockAdminStorageBucket) }

const mockUpload = vi.fn()
const mockGetPublicUrl = vi.fn()
const mockUserList = vi.fn()
const mockUserRemove = vi.fn()
const mockUserStorageBucket = {
  upload: mockUpload,
  getPublicUrl: mockGetPublicUrl,
  list: mockUserList,
  remove: mockUserRemove,
}
const mockUserStorage = { from: vi.fn(() => mockUserStorageBucket) }

const mockToysMaybeSingle = vi.fn()
const mockToysQuery = {
  select: vi.fn(() => mockToysQuery),
  eq: vi.fn(() => mockToysQuery),
  // The ownership check widened to "mine, or my organisation's" in 033, so it
  // filters with .or() rather than a second .eq().
  or: vi.fn(() => mockToysQuery),
  maybeSingle: mockToysMaybeSingle,
}
// The check first asks which orgs the caller leads. These cases are all about a
// person's own toy, where the answer is none — the org path is covered by
// tests/integration/storage/org-toy-photos.test.ts against real policies.
const mockOrgLeadersQuery = {
  select: vi.fn(() => mockOrgLeadersQuery),
  eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
}
const mockToysFrom = vi.fn((table: string) =>
  table === 'org_leaders' ? mockOrgLeadersQuery : mockToysQuery
)

// --- Mock strategy ---
// The user client (mockUpload, mockGetPublicUrl) is used by all four upload routes to
// upload files and retrieve their public CDN URLs. No real files are sent to Supabase.
// The user client also stubs `.from(...)` (mockToysFrom/mockToysMaybeSingle), which answers
// both reads a photo upload makes: the ownership check, and the photo count behind the cap.
//
// The admin client's list/remove are still mocked, but only so a test can assert they are
// NOT called: /photo used to delete every existing file before writing, and that delete
// going away is what lets a tutorial hold five photos.
vi.mock('../../../src/supabase/client.js', () => ({
  createAdminClient: () => ({ storage: mockAdminStorage }),
  createUserClient: () => ({ storage: mockUserStorage, from: mockToysFrom }),
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
    mockToysMaybeSingle.mockResolvedValue({ data: { tutorial_id: 'tid-1' }, error: null })
    mockUpload.mockResolvedValue({ data: { path: 'tid-1/tutorial.pdf' }, error: null })
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/tid-1/tutorial.pdf' } })
  })

  // Tests: POST /pdf returns 400 when no file is included in the form data
  // How:   sends FormData with only tutorialId; checks status 400
  // Chain: the upload wizard receives 400 → the UI keeps the user on Step 2 and prompts
  //        them to select a file before allowing Next
  it('returns 400 when file is missing', async () => {
    const form = new FormData()
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/pdf', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  // Tests: POST /pdf returns 400 when the tutorialId field is missing from the form data
  // How:   sends FormData with only the file; checks status 400
  // Chain: prevents orphaned PDF files from being stored in Supabase storage with no
  //        tutorial record to link them to
  it('returns 400 when tutorialId is missing', async () => {
    const form = new FormData()
    form.append('file', new Blob(['pdf'], { type: 'application/pdf' }), 'file.pdf')
    const res = await makeApp().request('/pdf', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  // Tests: POST /pdf uploads the file to Supabase storage and returns the object path
  // How:   mockUpload and mockGetPublicUrl resolve successfully; checks status 200 and body.url
  // Chain: the returned path is PATCHed onto the tutorial record via the next API call →
  //        the web app serves it through /files/tutorial-pdfs/<path>, which signs a
  //        short-lived URL per click rather than exposing the bucket publicly
  it('returns the object path, not a public URL', async () => {
    const form = new FormData()
    form.append('file', new Blob(['pdf'], { type: 'application/pdf' }), 'file.pdf')
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/pdf', { method: 'POST', body: form })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    // Since 049 the bucket is private: a public URL would be a dead link, so
    // the response carries the object path for /files/tutorial-pdfs/<path>.
    expect(body.url).toBe('tid-1/tutorial.pdf')
    expect(mockGetPublicUrl).not.toHaveBeenCalled()
  })

  it('returns 404 when the caller is not a contributor on the tutorial', async () => {
    mockToysMaybeSingle.mockResolvedValue({ data: null, error: null })
    const form = new FormData()
    form.append('file', new Blob(['pdf'], { type: 'application/pdf' }), 'file.pdf')
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/pdf', { method: 'POST', body: form })
    expect(res.status).toBe(404)
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('returns 404 when tutorialId is malformed', async () => {
    mockToysMaybeSingle.mockResolvedValue({ data: null, error: { code: '22P02' } })
    const form = new FormData()
    form.append('file', new Blob(['pdf'], { type: 'application/pdf' }), 'file.pdf')
    form.append('tutorialId', 'not-a-uuid')
    const res = await makeApp().request('/pdf', { method: 'POST', body: form })
    expect(res.status).toBe(404)
    expect(mockUpload).not.toHaveBeenCalled()
  })
})

describe('POST /photo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // One value serves both reads the route makes: the contributor check and
    // the photo count that enforces the cap before anything is written.
    mockToysMaybeSingle.mockResolvedValue({
      data: { tutorial_id: 'tid-1', photo_urls: [] },
      error: null,
    })
    mockUpload.mockResolvedValue({ data: { path: 'tid-1/uuid.png' }, error: null })
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/tid-1/uuid.png' } })
  })

  function photoForm(overrides: { type?: string; name?: string; bytes?: number } = {}) {
    const form = new FormData()
    const size = overrides.bytes ?? 3
    form.append(
      'file',
      new Blob([new Uint8Array(size)], { type: overrides.type ?? 'image/png' }),
      overrides.name ?? 'photo.png'
    )
    form.append('tutorialId', 'tid-1')
    return form
  }

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

  // Tests: a file that is not an image is refused before it reaches storage
  // How:   posts a PDF; checks the 400 and that nothing was uploaded
  // Chain: 053 set allowed_mime_types on the bucket too, so this is the second
  //        of two guards — the one that can say what to do about it, since
  //        storage answers with a sentence about the bucket
  it('returns 400 for a file that is not an image', async () => {
    const res = await makeApp().request('/photo', {
      method: 'POST',
      body: photoForm({ type: 'application/pdf', name: 'guide.pdf' }),
    })
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toMatch(/JPEG, PNG, WebP or HEIC/)
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('returns 400 for a photo over 10 MB', async () => {
    const res = await makeApp().request('/photo', {
      method: 'POST',
      body: photoForm({ bytes: 10 * 1024 * 1024 + 1 }),
    })
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toMatch(/under 10 MB/)
    expect(mockUpload).not.toHaveBeenCalled()
  })

  // Tests: the sixth photo is refused BEFORE the upload, not after
  // How:   the row already holds five; checks the 400 and that mockUpload never ran
  // Chain: rejecting it after the write would leave an object in the bucket
  //        with nothing in photo_urls pointing at it — an orphan no UI can reach
  it('returns 400 when the tutorial already holds five photos', async () => {
    mockToysMaybeSingle.mockResolvedValue({
      data: { tutorial_id: 'tid-1', photo_urls: ['a', 'b', 'c', 'd', 'e'] },
      error: null,
    })
    const res = await makeApp().request('/photo', { method: 'POST', body: photoForm() })
    expect(res.status).toBe(400)
    expect((await res.json() as any).error).toMatch(/5 photos is the limit/)
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('returns 500 when upload fails', async () => {
    mockUpload.mockResolvedValue({ data: null, error: { message: 'Storage error' } })
    const res = await makeApp().request('/photo', { method: 'POST', body: photoForm() })
    expect(res.status).toBe(500)
  })

  // Tests: a photo is APPENDED under its own name rather than overwriting
  // How:   checks the object path is <tutorialId>/<uuid>.<ext>, and that nothing
  //        in the tutorial's folder was listed or removed first
  // Chain: the route this replaced deleted every existing file before writing,
  //        which is what capped a tutorial at one photo. Five photos need five
  //        objects, so that delete had to go — and its absence is the assertion
  it('appends a uniquely named object without removing the existing ones', async () => {
    const res = await makeApp().request('/photo', { method: 'POST', body: photoForm() })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: 'https://example.com/tid-1/uuid.png' })
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^tid-1\/[0-9a-f-]{36}\.png$/),
      expect.any(Blob),
      { upsert: false }
    )
    expect(mockAdminRemove).not.toHaveBeenCalled()
    expect(mockUserRemove).not.toHaveBeenCalled()
  })

  it('returns 404 when the caller is not a contributor on the tutorial', async () => {
    mockToysMaybeSingle.mockResolvedValue({ data: null, error: null })
    const res = await makeApp().request('/photo', { method: 'POST', body: photoForm() })
    expect(res.status).toBe(404)
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('returns 404 when tutorialId is malformed', async () => {
    mockToysMaybeSingle.mockResolvedValue({ data: null, error: { code: '22P02' } })
    const res = await makeApp().request('/photo', { method: 'POST', body: photoForm() })
    expect(res.status).toBe(404)
    expect(mockUpload).not.toHaveBeenCalled()
  })
})

describe('POST /stl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockToysMaybeSingle.mockResolvedValue({ data: { tutorial_id: 'tid-1' }, error: null })
    mockUpload.mockResolvedValue({ data: { path: 'tid-1/bracket.stl' }, error: null })
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/tid-1/bracket.stl' } })
  })

  // Tests: POST /stl returns 400 when no STL file is in the form data
  // How:   sends FormData with only tutorialId; checks status 400
  // Chain: the upload wizard skips this endpoint when no STL files were added (it checks
  //        the array length) — this 400 is a safety net for direct API misuse
  it('returns 400 when file is missing', async () => {
    const form = new FormData()
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/stl', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  // Tests: POST /stl returns 400 when tutorialId is missing
  // How:   sends FormData with only the file; checks status 400
  // Chain: prevents STL files from being orphaned in storage with no tutorial to link them to
  it('returns 400 when tutorialId is missing', async () => {
    const form = new FormData()
    form.append('file', new Blob(['stl'], { type: 'model/stl' }), 'bracket.stl')
    const res = await makeApp().request('/stl', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  // Tests: POST /stl returns 500 when the Supabase storage upload fails
  // How:   mockUpload resolves with { data: null, error }; checks status 500
  // Chain: the upload wizard receives 500 → the STL URL is not stored, preventing a broken
  //        download link from appearing on the tutorial detail page
  it('returns 500 when upload fails', async () => {
    mockUpload.mockResolvedValue({ data: null, error: { message: 'Storage error' } })
    const form = new FormData()
    form.append('file', new Blob(['stl'], { type: 'model/stl' }), 'bracket.stl')
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/stl', { method: 'POST', body: form })
    expect(res.status).toBe(500)
  })

  // Tests: POST /stl uploads the file and returns 200 with both the object path and original filename
  // How:   mockUpload and mockGetPublicUrl resolve successfully; checks body.url and body.filename
  // Chain: both values are stored in the stl_files table → the tutorial detail page serves
  //        the download through /files/stl-files/<path>, which signs a short-lived URL and
  //        forces the original filename as the attachment name
  it('returns the object path, not a public URL', async () => {
    const form = new FormData()
    form.append('file', new Blob(['stl'], { type: 'model/stl' }), 'bracket.stl')
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/stl', { method: 'POST', body: form })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.url).toBe('tid-1/bracket.stl')
    expect(body.filename).toBe('bracket.stl')
    expect(mockGetPublicUrl).not.toHaveBeenCalled()
  })

  it('returns 404 when the caller is not a contributor on the tutorial', async () => {
    mockToysMaybeSingle.mockResolvedValue({ data: null, error: null })
    const form = new FormData()
    form.append('file', new Blob(['stl'], { type: 'model/stl' }), 'bracket.stl')
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/stl', { method: 'POST', body: form })
    expect(res.status).toBe(404)
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('returns 404 when tutorialId is malformed', async () => {
    mockToysMaybeSingle.mockResolvedValue({ data: null, error: { code: '22P02' } })
    const form = new FormData()
    form.append('file', new Blob(['stl'], { type: 'model/stl' }), 'bracket.stl')
    form.append('tutorialId', 'not-a-uuid')
    const res = await makeApp().request('/stl', { method: 'POST', body: form })
    expect(res.status).toBe(404)
    expect(mockUpload).not.toHaveBeenCalled()
  })
})

describe('POST /toy-photo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockToysMaybeSingle.mockResolvedValue({ data: { id: 'toy-1', photo_urls: [] }, error: null })
    mockUpload.mockResolvedValue({ data: { path: 'toy-1/uuid.png' }, error: null })
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/toy-1/uuid.png' } })
  })

  function toyForm(type = 'image/png') {
    const form = new FormData()
    form.append('file', new Blob(['img'], { type }), 'photo.png')
    form.append('toyId', 'toy-1')
    return form
  }

  it('returns 400 when file is missing', async () => {
    const form = new FormData()
    form.append('toyId', 'toy-1')
    const res = await makeApp().request('/toy-photo', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  it('returns 400 when toyId is missing', async () => {
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/png' }), 'photo.png')
    const res = await makeApp().request('/toy-photo', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  it('returns 400 for a file that is not an image', async () => {
    const res = await makeApp().request('/toy-photo', {
      method: 'POST',
      body: toyForm('application/pdf'),
    })
    expect(res.status).toBe(400)
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('returns 400 when the toy already holds five photos', async () => {
    mockToysMaybeSingle.mockResolvedValue({
      data: { id: 'toy-1', photo_urls: ['a', 'b', 'c', 'd', 'e'] },
      error: null,
    })
    const res = await makeApp().request('/toy-photo', { method: 'POST', body: toyForm() })
    expect(res.status).toBe(400)
    expect(mockUpload).not.toHaveBeenCalled()
  })

  // Tests: the cover and the switch shot come through this one route now
  // How:   checks the uuid object path and that no cover.* was listed or removed
  // Chain: /toy-cover replaced cover.* on every upload and /toy-switch-photo
  //        appended switch-*.*; one upload box means one route, and which photo
  //        is the cover is photo_urls[0], not a filename
  it('appends a uniquely named object, replacing nothing', async () => {
    const res = await makeApp().request('/toy-photo', { method: 'POST', body: toyForm() })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: 'https://example.com/toy-1/uuid.png' })
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^toy-1\/[0-9a-f-]{36}\.png$/),
      expect.any(Blob),
      { upsert: false }
    )
    expect(mockUserList).not.toHaveBeenCalled()
    expect(mockUserRemove).not.toHaveBeenCalled()
  })

  it('returns 500 when upload fails', async () => {
    mockUpload.mockResolvedValue({ data: null, error: { message: 'Storage error' } })
    const res = await makeApp().request('/toy-photo', { method: 'POST', body: toyForm() })
    expect(res.status).toBe(500)
  })

  it('returns 404 when the caller does not own the toy', async () => {
    mockToysMaybeSingle.mockResolvedValue({ data: null, error: null })
    const res = await makeApp().request('/toy-photo', { method: 'POST', body: toyForm() })
    expect(res.status).toBe(404)
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('returns 404 when toyId is malformed', async () => {
    mockToysMaybeSingle.mockResolvedValue({ data: null, error: { code: '22P02' } })
    const res = await makeApp().request('/toy-photo', { method: 'POST', body: toyForm() })
    expect(res.status).toBe(404)
    expect(mockUpload).not.toHaveBeenCalled()
  })
})