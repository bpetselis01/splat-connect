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
// Two Supabase storage clients are mocked: the admin client (mockAdminList, mockAdminRemove)
// is used by the photo route to list and delete existing photos before uploading a replacement;
// the user client (mockUpload, mockGetPublicUrl) is used by all three upload routes to upload
// files and retrieve their public CDN URLs. No real files are sent to Supabase in any test.
// The user client also stubs `.from('toys')` (mockToysFrom/mockToysMaybeSingle) so the
// toy-cover/toy-switch-photo ownership check can be driven per-test.
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
    mockToysMaybeSingle.mockResolvedValue({ data: { tutorial_id: 'tid-1' }, error: null })
    mockAdminList.mockResolvedValue({ data: [], error: null })
    mockAdminRemove.mockResolvedValue({ error: null })
    mockUpload.mockResolvedValue({ data: { path: 'tid-1/photo.png' }, error: null })
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/tid-1/photo.png' } })
  })

  // Tests: POST /photo returns 400 when no photo file is in the form data
  // How:   sends FormData with only tutorialId; checks status 400
  // Chain: the upload wizard keeps the user on Step 2 until a photo is provided →
  //        every published tutorial has a visible cover image
  it('returns 400 when file is missing', async () => {
    const form = new FormData()
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/photo', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  // Tests: POST /photo returns 400 when tutorialId is missing from the form data
  // How:   sends FormData with only the file; checks status 400
  // Chain: prevents photos from being stored in Supabase storage with no tutorial to attach to
  it('returns 400 when tutorialId is missing', async () => {
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/png' }), 'photo.png')
    const res = await makeApp().request('/photo', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  // Tests: POST /photo lists and deletes any existing photos before uploading the new one
  // How:   mockAdminList returns one existing file; verifies mockAdminRemove was called with the correct path
  // Chain: ensures each tutorial has exactly one cover photo at a time → prevents orphaned
  //        old images from accumulating in Supabase storage
  it('calls remove with correct paths when existing files are present', async () => {
    mockAdminList.mockResolvedValue({ data: [{ name: 'photo.jpg' }], error: null })
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/png' }), 'photo.png')
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/photo', { method: 'POST', body: form })
    expect(res.status).toBe(200)
    expect(mockAdminList).toHaveBeenCalledWith('tid-1')
    expect(mockAdminRemove).toHaveBeenCalledWith(['tid-1/photo.jpg'])
  })

  // Tests: POST /photo skips the delete step when there are no existing photos for the tutorial
  // How:   mockAdminList returns an empty array; verifies mockAdminRemove was not called
  // Chain: avoids an unnecessary storage API call on the first upload → the route handles
  //        both first-time uploads and replacements without branching logic in the caller
  it('does not call remove when no existing files', async () => {
    mockAdminList.mockResolvedValue({ data: [], error: null })
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/png' }), 'photo.png')
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/photo', { method: 'POST', body: form })
    expect(res.status).toBe(200)
    expect(mockAdminRemove).not.toHaveBeenCalled()
  })

  // Tests: POST /photo returns 500 when the Supabase storage upload fails
  // How:   mockUpload resolves with { data: null, error: { message: 'Storage error' } }; checks status 500
  // Chain: the upload wizard receives 500 → the UI displays the error message and keeps the
  //        user on Step 2 so they can retry the photo upload
  it('returns 500 when upload fails', async () => {
    mockUpload.mockResolvedValue({ data: null, error: { message: 'Storage error' } })
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/png' }), 'photo.png')
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/photo', { method: 'POST', body: form })
    expect(res.status).toBe(500)
  })

  // Tests: POST /photo uploads with the correct storage path pattern and returns 200 with url
  // How:   verifies mockUpload was called with 'tid-1/photo.png' and upsert:false; checks body.url
  // Chain: the URL is stored on the tutorial record and served as the cover image → users see
  //        the tutorial photo in the library card and on the tutorial detail page
  it('returns 200 with url on success', async () => {
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/png' }), 'photo.png')
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/photo', { method: 'POST', body: form })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.url).toBe('https://example.com/tid-1/photo.png')
    expect(mockUpload).toHaveBeenCalledWith(
      'tid-1/photo.png',
      expect.any(Blob),
      { upsert: false }
    )
  })

  it('returns 404 when the caller is not a contributor on the tutorial', async () => {
    mockToysMaybeSingle.mockResolvedValue({ data: null, error: null })
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/png' }), 'photo.png')
    form.append('tutorialId', 'tid-1')
    const res = await makeApp().request('/photo', { method: 'POST', body: form })
    expect(res.status).toBe(404)
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('returns 404 when tutorialId is malformed', async () => {
    mockToysMaybeSingle.mockResolvedValue({ data: null, error: { code: '22P02' } })
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/png' }), 'photo.png')
    form.append('tutorialId', 'not-a-uuid')
    const res = await makeApp().request('/photo', { method: 'POST', body: form })
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

describe('POST /toy-cover', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockToysMaybeSingle.mockResolvedValue({ data: { id: 'toy-1' }, error: null })
    mockUserList.mockResolvedValue({ data: [], error: null })
    mockUserRemove.mockResolvedValue({ error: null })
    mockUpload.mockResolvedValue({ data: { path: 'toy-1/cover.png' }, error: null })
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/toy-1/cover.png' } })
  })

  it('returns 400 when file is missing', async () => {
    const form = new FormData()
    form.append('toyId', 'toy-1')
    const res = await makeApp().request('/toy-cover', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  it('returns 400 when toyId is missing', async () => {
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/png' }), 'cover.png')
    const res = await makeApp().request('/toy-cover', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  it('removes only existing cover files, leaving switch photos alone', async () => {
    mockUserList.mockResolvedValue({
      data: [{ name: 'cover.jpg' }, { name: 'switch-abc.jpg' }],
      error: null,
    })
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/png' }), 'cover.png')
    form.append('toyId', 'toy-1')
    const res = await makeApp().request('/toy-cover', { method: 'POST', body: form })
    expect(res.status).toBe(200)
    expect(mockUserList).toHaveBeenCalledWith('toy-1')
    expect(mockUserRemove).toHaveBeenCalledWith(['toy-1/cover.jpg'])
  })

  it('returns 500 when upload fails', async () => {
    mockUpload.mockResolvedValue({ data: null, error: { message: 'Storage error' } })
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/png' }), 'cover.png')
    form.append('toyId', 'toy-1')
    const res = await makeApp().request('/toy-cover', { method: 'POST', body: form })
    expect(res.status).toBe(500)
  })

  it('returns 200 with url on success', async () => {
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/png' }), 'cover.png')
    form.append('toyId', 'toy-1')
    const res = await makeApp().request('/toy-cover', { method: 'POST', body: form })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { url: string }
    expect(body.url).toBe('https://example.com/toy-1/cover.png')
    expect(mockUpload).toHaveBeenCalledWith('toy-1/cover.png', expect.any(Blob), { upsert: false })
  })

  it('returns 404 when the toy is not owned by the caller', async () => {
    mockToysMaybeSingle.mockResolvedValue({ data: null, error: null })
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/png' }), 'cover.png')
    form.append('toyId', 'toy-1')
    const res = await makeApp().request('/toy-cover', { method: 'POST', body: form })
    expect(res.status).toBe(404)
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('returns 404 when toyId is malformed', async () => {
    mockToysMaybeSingle.mockResolvedValue({ data: null, error: { code: '22P02' } })
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/png' }), 'cover.png')
    form.append('toyId', 'not-a-uuid')
    const res = await makeApp().request('/toy-cover', { method: 'POST', body: form })
    expect(res.status).toBe(404)
    expect(mockUpload).not.toHaveBeenCalled()
  })
})

describe('POST /toy-switch-photo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockToysMaybeSingle.mockResolvedValue({ data: { id: 'toy-1' }, error: null })
    mockUpload.mockResolvedValue({ data: { path: 'toy-1/switch-uuid.jpg' }, error: null })
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/toy-1/switch-uuid.jpg' } })
  })

  it('returns 400 when file is missing', async () => {
    const form = new FormData()
    form.append('toyId', 'toy-1')
    const res = await makeApp().request('/toy-switch-photo', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  it('returns 400 when toyId is missing', async () => {
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/jpeg' }), 'switch.jpg')
    const res = await makeApp().request('/toy-switch-photo', { method: 'POST', body: form })
    expect(res.status).toBe(400)
  })

  it('never lists or removes existing files — always appends', async () => {
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/jpeg' }), 'switch.jpg')
    form.append('toyId', 'toy-1')
    const res = await makeApp().request('/toy-switch-photo', { method: 'POST', body: form })
    expect(res.status).toBe(200)
    expect(mockUserList).not.toHaveBeenCalled()
    expect(mockUserRemove).not.toHaveBeenCalled()
  })

  it('returns 500 when upload fails', async () => {
    mockUpload.mockResolvedValue({ data: null, error: { message: 'Storage error' } })
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/jpeg' }), 'switch.jpg')
    form.append('toyId', 'toy-1')
    const res = await makeApp().request('/toy-switch-photo', { method: 'POST', body: form })
    expect(res.status).toBe(500)
  })

  it('returns 200 with url on success', async () => {
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/jpeg' }), 'switch.jpg')
    form.append('toyId', 'toy-1')
    const res = await makeApp().request('/toy-switch-photo', { method: 'POST', body: form })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { url: string }
    expect(body.url).toBe('https://example.com/toy-1/switch-uuid.jpg')
  })

  it('returns 404 when the toy is not owned by the caller', async () => {
    mockToysMaybeSingle.mockResolvedValue({ data: null, error: null })
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/jpeg' }), 'switch.jpg')
    form.append('toyId', 'toy-1')
    const res = await makeApp().request('/toy-switch-photo', { method: 'POST', body: form })
    expect(res.status).toBe(404)
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('returns 404 when toyId is malformed', async () => {
    mockToysMaybeSingle.mockResolvedValue({ data: null, error: { code: '22P02' } })
    const form = new FormData()
    form.append('file', new Blob(['img'], { type: 'image/jpeg' }), 'switch.jpg')
    form.append('toyId', 'not-a-uuid')
    const res = await makeApp().request('/toy-switch-photo', { method: 'POST', body: form })
    expect(res.status).toBe(404)
    expect(mockUpload).not.toHaveBeenCalled()
  })
})
