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
