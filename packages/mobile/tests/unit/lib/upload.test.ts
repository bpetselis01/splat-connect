// packages/mobile/tests/unit/lib/upload.test.ts
import { Platform } from 'react-native'

const mockGetToken = jest.fn()
jest.mock('../../../lib/api-client', () => ({ getToken: (...a: unknown[]) => mockGetToken(...a) }))

// jsdom's real FormData stringifies a non-Blob value ("[object Object]"),
// which would hide the RN {uri,name,type} shape the native branch sends —
// a fake keeps those assertions honest by just recording what got appended.
// The web-branch tests below use the real FormData instead, un-faked: that
// stringification is exactly the bug this file guards against, so proving
// the fix means letting the real DOM behaviour run.
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
const RealFormData = globalThis.FormData

const fetchMock = jest.fn()
globalThis.fetch = fetchMock as unknown as typeof fetch

const { uploadFile } = require('../../../lib/upload')

function okResponse(body: unknown) {
  return { ok: true, json: () => Promise.resolve(body) }
}

describe('uploadFile — native', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.replaceProperty(Platform, 'OS', 'ios')
    ;(globalThis as unknown as { FormData: unknown }).FormData = FakeFormData
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

describe('uploadFile — web', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.replaceProperty(Platform, 'OS', 'web')
    ;(globalThis as unknown as { FormData: unknown }).FormData = RealFormData
    process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3101'
    mockGetToken.mockResolvedValue('test-token')
  })

  it('fetches the uri and appends a real Blob under the filename, instead of the RN object getting stringified', async () => {
    const blob = new Blob(['fake-bytes'], { type: 'image/jpeg' })
    fetchMock
      .mockResolvedValueOnce({ blob: () => Promise.resolve(blob) }) // fetch(file.uri)
      .mockResolvedValueOnce(okResponse({ url: 't1/photo.jpg' })) // the upload POST

    const result = await uploadFile('/api/upload/photo', 't1', {
      uri: 'blob:http://localhost/abcd-1234',
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toBe('blob:http://localhost/abcd-1234')

    const [url, opts] = fetchMock.mock.calls[1]
    expect(url).toBe('http://localhost:3101/api/upload/photo')
    expect(opts.headers).toEqual({ Authorization: 'Bearer test-token' })
    expect(opts.headers['Content-Type']).toBeUndefined()

    expect(opts.body).toBeInstanceOf(RealFormData)
    const body = opts.body as FormData
    const appended = body.get('file') as unknown as Blob & { name?: string }
    // A real Blob (surfaced as a File once named), not the "[object Object]"
    // a plain {uri,name,type} value would become under a real FormData.
    expect(appended).toBeInstanceOf(Blob)
    expect(appended.name).toBe('photo.jpg')
    expect(body.get('tutorialId')).toBe('t1')

    expect(result).toEqual({ url: 't1/photo.jpg' })
  })

  it('omits the Authorization header when there is no session', async () => {
    mockGetToken.mockResolvedValue(null)
    const blob = new Blob(['fake-bytes'], { type: 'application/pdf' })
    fetchMock
      .mockResolvedValueOnce({ blob: () => Promise.resolve(blob) })
      .mockResolvedValueOnce(okResponse({ url: 't1/tutorial.pdf' }))

    await uploadFile('/api/upload/pdf', 't1', { uri: 'blob:http://localhost/x', name: 'x.pdf' })

    const opts = fetchMock.mock.calls[1][1]
    expect(opts.headers.Authorization).toBeUndefined()
  })
})
