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
