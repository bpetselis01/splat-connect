// packages/mobile/tests/unit/lib/upload.test.ts
const mockGetToken = jest.fn()
jest.mock('../../../lib/api-client', () => ({ getToken: (...a: unknown[]) => mockGetToken(...a) }))

// jsdom's real FormData stringifies a non-Blob value ("[object Object]"),
// which would hide the RN {uri,name,type} shape this module actually sends
// on device. A tiny fake keeps the assertion honest: it just records what
// upload.ts appended.
class FakeFormData {
  static instances: FakeFormData[] = []
  parts: [string, unknown][] = []
  constructor() {
    FakeFormData.instances.push(this)
  }
  append(key: string, value: unknown) {
    this.parts.push([key, value])
  }
}
;(globalThis as unknown as { FormData: unknown }).FormData = FakeFormData

const fetchMock = jest.fn()
globalThis.fetch = fetchMock as unknown as typeof fetch

const { uploadFile } = require('../../../lib/upload')

function okResponse(body: unknown) {
  return { ok: true, json: () => Promise.resolve(body) }
}

describe('uploadFile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    FakeFormData.instances = []
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3101'
    mockGetToken.mockResolvedValue('test-token')
  })

  it('posts a multipart body with the RN file object, tutorialId, the auth header and no Content-Type', async () => {
    fetchMock.mockResolvedValue(okResponse({ url: 't1/photo.jpg' }))

    const result = await uploadFile('/api/upload/photo', 't1', {
      uri: 'file:///tmp/photo.jpg',
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:3101/api/upload/photo')
    expect(opts.method).toBe('POST')
    expect(opts.headers).toEqual({ Authorization: 'Bearer test-token' })
    expect(opts.headers['Content-Type']).toBeUndefined()

    expect(opts.body).toBeInstanceOf(FakeFormData)
    const parts = (opts.body as FakeFormData).parts
    expect(parts.find(([name]) => name === 'file')?.[1]).toEqual({
      uri: 'file:///tmp/photo.jpg',
      name: 'photo.jpg',
      type: 'image/jpeg',
    })
    expect(parts.find(([name]) => name === 'tutorialId')?.[1]).toBe('t1')

    expect(result).toEqual({ url: 't1/photo.jpg' })
  })

  it('defaults the mime type when none is given', async () => {
    fetchMock.mockResolvedValue(okResponse({ url: 't1/tutorial.pdf' }))
    await uploadFile('/api/upload/pdf', 't1', { uri: 'file:///tmp/x.pdf', name: 'x.pdf' })
    const parts = FakeFormData.instances[0].parts
    const file = parts.find(([name]) => name === 'file')?.[1] as { type: string }
    expect(file.type).toBe('application/octet-stream')
  })

  it('omits the Authorization header when there is no session', async () => {
    mockGetToken.mockResolvedValue(null)
    fetchMock.mockResolvedValue(okResponse({ url: 't1/x.stl', filename: 'x.stl' }))
    await uploadFile('/api/upload/stl', 't1', { uri: 'file:///tmp/x.stl', name: 'x.stl' })
    const opts = fetchMock.mock.calls[0][1]
    expect(opts.headers.Authorization).toBeUndefined()
  })

  it('throws on a non-ok response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({ error: 'boom' }) })
    await expect(
      uploadFile('/api/upload/photo', 't1', { uri: 'file:///x.jpg', name: 'x.jpg' })
    ).rejects.toThrow(/500/)
  })
})
