import { Platform } from 'react-native'

const mockGetToken = jest.fn()
jest.mock('../../../lib/api-client', () => ({ getToken: (...a: unknown[]) => mockGetToken(...a) }))

const mockPermission = jest.fn()
const mockLaunch = jest.fn()
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: (...a: unknown[]) => mockPermission(...a),
  launchImageLibraryAsync: (...a: unknown[]) => mockLaunch(...a),
}))

class FakeFormData {
  parts: [string, unknown][] = []
  append(key: string, value: unknown) { this.parts.push([key, value]) }
}
const RealFormData = globalThis.FormData
const fetchMock = jest.fn()
globalThis.fetch = fetchMock as unknown as typeof fetch

const { uploadFile, pickAndUploadPhoto } = require('../../../lib/upload')

const file = { uri: 'file:///x.jpg', name: 'x.jpg', mimeType: 'image/jpeg' }
const fail = (status: number, body: unknown) => ({ ok: false, status, json: () => (body === undefined ? Promise.reject(new SyntaxError('Unexpected token <')) : Promise.resolve(body)) })

beforeEach(() => {
  jest.clearAllMocks()
  jest.replaceProperty(Platform, 'OS', 'ios')
  ;(globalThis as unknown as { FormData: unknown }).FormData = FakeFormData
  process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3101'
  mockGetToken.mockResolvedValue('tok')
  mockPermission.mockResolvedValue({ granted: true })
})
afterAll(() => { (globalThis as unknown as { FormData: unknown }).FormData = RealFormData })

describe('uploadFile rejections', () => {
  it.each([
    [413, 'File is too large', /413.*File is too large/],
    [415, 'Unsupported file type', /415.*Unsupported file type/],
    [429, 'Too many requests', /429.*Too many requests/],
    [401, 'Unauthorized', /401.*Unauthorized/],
  ])('names status %i and the API’s sentence', async (status, error, re) => {
    fetchMock.mockResolvedValue(fail(status, { error }))
    await expect(uploadFile('/api/upload/photo', 't1', file)).rejects.toThrow(re)
  })

  it('still names the status when the body is not JSON, such as a proxy’s HTML 502', async () => {
    fetchMock.mockResolvedValue(fail(502, undefined))
    const err = await uploadFile('/api/upload/photo', 't1', file).catch((e: Error) => e)
    expect((err as Error).message).toBe('Upload to /api/upload/photo failed with status 502')
  })

  it('leaves the detail off when the JSON body carries no error', async () => {
    fetchMock.mockResolvedValue(fail(500, {}))
    await expect(uploadFile('/api/upload/pdf', 't1', file)).rejects.toThrow(/^Upload to \/api\/upload\/pdf failed with status 500$/)
  })

  it('rejects when the network is down', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'))
    await expect(uploadFile('/api/upload/photo', 't1', file)).rejects.toThrow('Network request failed')
  })

  it('does not try to read a JSON result from a failed response twice', async () => {
    const json = jest.fn().mockResolvedValue({ error: 'x' })
    fetchMock.mockResolvedValue({ ok: false, status: 400, json })
    await uploadFile('/api/upload/photo', 't1', file).catch(() => {})
    expect(json).toHaveBeenCalledTimes(1)
  })

  it('on web, rejects without posting when the picked uri can no longer be fetched', async () => {
    jest.replaceProperty(Platform, 'OS', 'web')
    ;(globalThis as unknown as { FormData: unknown }).FormData = RealFormData
    fetchMock.mockRejectedValueOnce(new TypeError('blob revoked'))
    await expect(uploadFile('/api/upload/photo', 't1', { uri: 'blob:gone', name: 'a.jpg' })).rejects.toThrow('blob revoked')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('uploadFile request shape', () => {
  const sent = () => (fetchMock.mock.calls[0][1].body as FakeFormData).parts

  it('sends the file alone when the id is in the path', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    await uploadFile('/api/toy-transactions/tx-1/working-shot', 'tx-1', file, null)
    expect(sent().map(([k]) => k)).toEqual(['file'])
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3101/api/toy-transactions/tx-1/working-shot')
  })

  it('keeps an emoji, quoted, angle-bracketed filename exactly as picked', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    const name = `🧸 "big" <switch> & co.jpg`
    await uploadFile('/api/upload/photo', 't1', { ...file, name })
    expect((sent()[0][1] as { name: string }).name).toBe(name)
  })

  it.each(['application/pdf', 'model/stl', 'image/avif'])('sends the declared type %s', async (mimeType) => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    await uploadFile('/api/upload/photo', 't1', { ...file, mimeType })
    expect((sent()[0][1] as { type: string }).type).toBe(mimeType)
  })

  it('sends a guide id with odd characters untouched in the form part', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    await uploadFile('/api/upload/photo', 'a b&c', file)
    expect(sent()).toContainEqual(['tutorialId', 'a b&c'])
  })

  it('answers with exactly the JSON the route returned, extra fields included', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ url: 'u', path: 'p', filename: 'f', extra: 1 }) })
    await expect(uploadFile('/api/upload/note-photo', 'g', file)).resolves.toEqual({ url: 'u', path: 'p', filename: 'f', extra: 1 })
  })
})

describe('pickAndUploadPhoto outliers', () => {
  it('answers null when the picker returns no assets at all', async () => {
    mockLaunch.mockResolvedValue({ canceled: false, assets: [] })
    await expect(pickAndUploadPhoto('/api/upload/photo', 't1')).resolves.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('answers null when assets is missing', async () => {
    mockLaunch.mockResolvedValue({ canceled: false })
    await expect(pickAndUploadPhoto('/api/upload/photo', 't1')).resolves.toBeNull()
  })

  it('does not even open the picker when library access is refused', async () => {
    mockPermission.mockResolvedValue({ granted: false })
    await expect(pickAndUploadPhoto('/api/upload/photo', 't1')).rejects.toThrow('Photo library access is needed to choose a photo.')
    expect(mockLaunch).not.toHaveBeenCalled()
  })

  it.each([413, 415, 500])('hides a %i behind the one retry sentence', async (status) => {
    mockLaunch.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a.jpg' }] })
    fetchMock.mockResolvedValue(fail(status, { error: 'secret server detail' }))
    await expect(pickAndUploadPhoto('/api/upload/photo', 't1')).rejects.toThrow('Could not upload the photo. Please try again.')
  })

  it('hides a dropped connection mid-upload behind the same sentence', async () => {
    mockLaunch.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a.jpg' }] })
    fetchMock.mockRejectedValue(new TypeError('Network request failed'))
    await expect(pickAndUploadPhoto('/api/upload/photo', 't1')).rejects.toThrow('Could not upload the photo. Please try again.')
  })

  it('lets a second attempt succeed after a failed one', async () => {
    mockLaunch.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a.jpg' }] })
    fetchMock.mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ url: 'u' }) })
    await expect(pickAndUploadPhoto('/api/upload/photo', 't1')).rejects.toThrow()
    await expect(pickAndUploadPhoto('/api/upload/photo', 't1')).resolves.toEqual({ url: 'u' })
  })

  it('asks the picker for images only, at reduced quality', async () => {
    mockLaunch.mockResolvedValue({ canceled: true })
    await pickAndUploadPhoto('/api/upload/photo', 't1')
    expect(mockLaunch).toHaveBeenCalledWith({ quality: 0.7, mediaTypes: ['images'] })
  })
})
