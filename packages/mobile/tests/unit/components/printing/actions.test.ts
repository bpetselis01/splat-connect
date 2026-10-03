// The writes the print screens share: the photo picker's three outcomes (no
// permission, backed out, picked) for the ready photo and the test print.
import { apiMessage } from '@splat-connect/types'
import { markReady, startPrint, submitTestPrint, withdrawRequest } from '../../../../components/printing/actions'

const mockPermission = jest.fn()
const mockLaunch = jest.fn()
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: (...a: unknown[]) => mockPermission(...a),
  launchImageLibraryAsync: (...a: unknown[]) => mockLaunch(...a),
}))
const mockUpload = jest.fn()
jest.mock('../../../../lib/upload', () => ({ uploadFile: (...a: unknown[]) => mockUpload(...a) }))
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { post: (...a: unknown[]) => mockPost(...a) } }))

beforeEach(() => {
  for (const m of [mockPermission, mockLaunch, mockUpload, mockPost]) m.mockReset()
  mockPermission.mockResolvedValue({ granted: true })
})

describe.each([
  ['markReady', (id: string) => markReady(id)],
  ['submitTestPrint', (id: string) => submitTestPrint(id)],
])('%s', (_name, run) => {
  it('throws a sentence the screen can show, in the API’s own form, when the library is refused', async () => {
    mockPermission.mockResolvedValue({ granted: false })
    const err = await run('x').catch((e) => e)
    expect(apiMessage(err, 'fallback')).toBe('Photo library access is needed to post the photo.')
    expect(mockLaunch).not.toHaveBeenCalled()
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('returns null and uploads nothing when the picker is cancelled', async () => {
    mockLaunch.mockResolvedValue({ canceled: true, assets: null })
    expect(await run('x')).toBeNull()
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('returns null when the picker answers with no assets', async () => {
    mockLaunch.mockResolvedValue({ canceled: false, assets: [] })
    expect(await run('x')).toBeNull()
    mockLaunch.mockResolvedValue({ canceled: false })
    expect(await run('x')).toBeNull()
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('asks the picker for one image at reduced quality', async () => {
    mockLaunch.mockResolvedValue({ canceled: true })
    await run('x')
    expect(mockLaunch).toHaveBeenCalledWith({ quality: 0.7, mediaTypes: ['images'] })
  })

  it('lets an upload refusal through unchanged, so a 413 reads as the API’s sentence and a 500 as a generic one', async () => {
    mockLaunch.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a.jpg' }] })
    mockUpload.mockRejectedValueOnce(new Error('Upload to /x failed with status 413: Photo must be under 10 MB.'))
    expect(apiMessage(await run('x').catch((e) => e), 'fallback')).toBe('Photo must be under 10 MB.')
    mockUpload.mockRejectedValueOnce(new Error('Upload to /x failed with status 500'))
    expect(apiMessage(await run('x').catch((e) => e), 'fallback')).toBe('fallback')
  })
})

describe('markReady', () => {
  it('uploads the picked photo to the job’s print-ready route and returns the job row', async () => {
    mockLaunch.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a.heic', fileName: 'IMG_1.HEIC', mimeType: 'image/heic' }] })
    mockUpload.mockResolvedValue({ id: 'j1', ready_at: 'now' })
    expect(await markReady('j1')).toEqual({ id: 'j1', ready_at: 'now' })
    expect(mockUpload).toHaveBeenCalledWith('/api/toy-transactions/j1/print-ready', 'j1', {
      uri: 'file:///a.heic',
      name: 'IMG_1.HEIC',
      mimeType: 'image/heic',
    })
  })

  it('names a photo that has no filename or type ready.jpg as image/jpeg', async () => {
    mockLaunch.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///a' }] })
    mockUpload.mockResolvedValue({})
    await markReady('j1')
    expect(mockUpload.mock.calls[0]![2]).toEqual({ uri: 'file:///a', name: 'ready.jpg', mimeType: 'image/jpeg' })
  })

  it('uploads only the first of several assets', async () => {
    mockLaunch.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///1' }, { uri: 'file:///2' }] })
    mockUpload.mockResolvedValue({})
    await markReady('j1')
    expect(mockUpload).toHaveBeenCalledTimes(1)
    expect(mockUpload.mock.calls[0]![2].uri).toBe('file:///1')
  })
})

describe('submitTestPrint', () => {
  it('uploads to the printer’s test-prints route with no id field, since the id is in the path', async () => {
    mockLaunch.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///t.png', fileName: 'arch.png', mimeType: 'image/png' }] })
    mockUpload.mockResolvedValue({ verdict: null })
    expect(await submitTestPrint('p9')).toEqual({ verdict: null })
    expect(mockUpload).toHaveBeenCalledWith(
      '/api/printers/p9/test-prints',
      'p9',
      { uri: 'file:///t.png', name: 'arch.png', mimeType: 'image/png' },
      null
    )
  })

  it('names an unnamed photo test-print.jpg', async () => {
    mockLaunch.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///t' }] })
    mockUpload.mockResolvedValue({})
    await submitTestPrint('p9')
    expect(mockUpload.mock.calls[0]![2]).toEqual({ uri: 'file:///t', name: 'test-print.jpg', mimeType: 'image/jpeg' })
  })
})

describe('the plain posts', () => {
  it('startPrint posts an empty body to print-started', async () => {
    mockPost.mockResolvedValue({ id: 'j1' })
    await startPrint('j1')
    expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/j1/print-started', {})
  })

  it('withdrawRequest withdraws the one job it is given and lets the API fold the group', async () => {
    mockPost.mockResolvedValue({})
    await withdrawRequest({ id: 'j1', print_group_id: 'g' })
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/j1/withdraw', {})
  })

  it('lets a failed withdraw reject, so the screen can show it', async () => {
    mockPost.mockRejectedValue(new Error('failed with status 409: Already collected.'))
    await expect(withdrawRequest({ id: 'j1', print_group_id: null })).rejects.toThrow('Already collected.')
  })
})
