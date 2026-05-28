import { describe, it, expect, vi, beforeEach } from 'vitest'

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

  it('throws on non-ok response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 })
    await expect(apiClient.get('/api/admin/tutorials')).rejects.toThrow('403')
  })

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
})
