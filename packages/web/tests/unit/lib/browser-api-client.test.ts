// packages/web/tests/unit/lib/browser-api-client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetSession = vi.fn()

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
