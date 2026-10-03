import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { FilesSection } from '../../../../components/my-tutorials/sections/files-section'
import { StlSection } from '../../../../components/my-tutorials/sections/stl-section'
import { apiClient } from '../../../../lib/api-client'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}))
jest.mock('../../../../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'u' }, error: null }),
      }),
    },
  },
}))

const mockUploadFile = jest.fn()
jest.mock('../../../../lib/upload', () => ({
  uploadFile: (...a: unknown[]) => mockUploadFile(...a),
}))

const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: (...a: unknown[]) => mockPost(...a),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}))

const mockRequestMedia = jest.fn()
const mockLaunchLibrary = jest.fn()
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  requestMediaLibraryPermissionsAsync: (...a: unknown[]) => mockRequestMedia(...a),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: (...a: unknown[]) => mockLaunchLibrary(...a),
}))

const mockGetDocument = jest.fn()
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: (...a: unknown[]) => mockGetDocument(...a),
}))

const mockDraft = {
  tutorial: {} as Record<string, unknown>,
  loading: false,
  loadError: false,
  saveState: 'idle',
  saveError: null as string | null,
  save: jest.fn(),
  saveNow: jest.fn().mockResolvedValue(undefined),
  replaceItems: jest.fn(),
  flush: jest.fn().mockResolvedValue(undefined),
  reload: jest.fn(),
}
jest.mock('../../../../lib/use-tutorial-draft', () => ({ useDraft: () => mockDraft }))

beforeEach(() => {
  jest.clearAllMocks()
  mockUploadFile.mockReset()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockRequestMedia.mockResolvedValue({ granted: true })
  mockDraft.saveNow.mockResolvedValue(undefined)
  mockDraft.saveError = null
  mockDraft.tutorial = {
    id: 't1',
    status: 'draft',
    tutorial_pdf_url: null,
    photo_urls: [],
    toy_photo_url: null,
    stl_files: [],
    kind: 'toy_adaptation',
    difficulty: 'easy',
    title: 'T',
    safety_declared_at: null,
    build_minutes: 30,
    parts: [],
    tools: [],
  }
})

afterEach(() => jest.restoreAllMocks())

const lib = (n: number) => ({ canceled: false, assets: Array.from({ length: n }, (_, i) => ({ uri: `file://${i}.jpg`, fileName: `${i}.jpg`, mimeType: 'image/jpeg' })) })
const withPhotos = (n: number, over: object = {}) => { mockDraft.tutorial = { ...mockDraft.tutorial, photo_urls: Array.from({ length: n }, (_, i) => `p${i + 1}`), ...over } }

describe('adding photos', () => {
  it('asks the library for only as many photos as there are slots left', async () => {
    withPhotos(3)
    mockLaunchLibrary.mockResolvedValue({ canceled: true })
    render(<FilesSection />)
    fireEvent.press(screen.getByText('Choose from library'))
    await waitFor(() => expect(mockLaunchLibrary).toHaveBeenCalled())
    expect(mockLaunchLibrary.mock.calls[0][0]).toMatchObject({ allowsMultipleSelection: true, selectionLimit: 2 })
  })

  it('asks for a single photo when one slot is left', async () => {
    withPhotos(4)
    mockLaunchLibrary.mockResolvedValue({ canceled: true })
    render(<FilesSection />)
    fireEvent.press(screen.getByText('Choose from library'))
    await waitFor(() => expect(mockLaunchLibrary).toHaveBeenCalled())
    expect(mockLaunchLibrary.mock.calls[0][0]).toMatchObject({ allowsMultipleSelection: false, selectionLimit: 1 })
  })

  it('uploads only as many as fit when the picker hands back more', async () => {
    withPhotos(4)
    mockLaunchLibrary.mockResolvedValue(lib(3))
    mockUploadFile.mockImplementation((_p: string, _id: string, f: { name: string }) => Promise.resolve({ url: `up/${f.name}` }))
    render(<FilesSection />)
    fireEvent.press(screen.getByText('Choose from library'))
    await waitFor(() => expect(mockDraft.saveNow).toHaveBeenCalled())
    expect(mockUploadFile).toHaveBeenCalledTimes(1)
    expect(mockDraft.saveNow.mock.calls[0][0].photo_urls).toEqual(['p1', 'p2', 'p3', 'p4', 'up/0.jpg'])
  })

  it('keeps the photos that did upload when a later one in the same batch fails', async () => {
    mockLaunchLibrary.mockResolvedValue(lib(3))
    mockUploadFile.mockResolvedValueOnce({ url: 'up/0.jpg' }).mockRejectedValueOnce(new Error('413')).mockResolvedValueOnce({ url: 'up/2.jpg' })
    render(<FilesSection />)
    fireEvent.press(screen.getByText('Choose from library'))
    expect(await screen.findByText('Could not upload the photo. Please try again.')).toBeTruthy()
    expect(mockDraft.saveNow).toHaveBeenCalledWith({ photo_urls: ['up/0.jpg'], photo_captions: [] })
  })

  it('saves nothing when the very first upload fails, and offers the buttons again', async () => {
    mockLaunchLibrary.mockResolvedValue(lib(1))
    mockUploadFile.mockRejectedValue(new Error('network'))
    render(<FilesSection />)
    fireEvent.press(screen.getByText('Choose from library'))
    expect(await screen.findByText('Could not upload the photo. Please try again.')).toBeTruthy()
    expect(mockDraft.saveNow).not.toHaveBeenCalled()
    expect(screen.getByText('Choose from library')).toBeTruthy()
  })

  it('does not upload when the picker is cancelled or returns nothing', async () => {
    mockLaunchLibrary.mockResolvedValueOnce({ canceled: true }).mockResolvedValueOnce({ canceled: false, assets: [] })
    render(<FilesSection />)
    fireEvent.press(screen.getByText('Choose from library'))
    await waitFor(() => expect(mockLaunchLibrary).toHaveBeenCalledTimes(1))
    fireEvent.press(screen.getByText('Choose from library'))
    await waitFor(() => expect(mockLaunchLibrary).toHaveBeenCalledTimes(2))
    expect(mockUploadFile).not.toHaveBeenCalled()
  })

  it('takes a photo with the camera and refuses without camera access', async () => {
    const ImagePicker = jest.requireMock('expo-image-picker')
    ImagePicker.requestCameraPermissionsAsync.mockResolvedValueOnce({ granted: false })
    render(<FilesSection />)
    fireEvent.press(screen.getByText('Take a photo'))
    expect(await screen.findByText('Camera access is needed to take a photo.')).toBeTruthy()
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled()
  })

  it('ignores a second pick while one is uploading', async () => {
    let finish!: (v: { url: string }) => void
    mockLaunchLibrary.mockResolvedValue(lib(1))
    mockUploadFile.mockReturnValue(new Promise((r) => { finish = r }))
    render(<FilesSection />)
    fireEvent.press(screen.getByText('Choose from library'))
    await waitFor(() => expect(mockUploadFile).toHaveBeenCalled())
    fireEvent.press(screen.getAllByRole('button', { name: /Choose from library/ })[0])
    expect(mockLaunchLibrary).toHaveBeenCalledTimes(1)
    await act(async () => { finish({ url: 'x' }) })
  })
})

describe('the photo list', () => {
  it('says that is all five and offers no more picks at the limit', () => {
    withPhotos(5)
    render(<FilesSection />)
    expect(screen.getByText(/That is all 5\. Remove one to add another\./)).toBeTruthy()
    expect(screen.queryByText('Choose from library')).toBeNull()
    expect(screen.queryByText('Take a photo')).toBeNull()
  })

  it('will not remove the only photo, and says to add another first', () => {
    withPhotos(1)
    render(<FilesSection />)
    expect(screen.getByText('Add another photo before you can remove this one.')).toBeTruthy()
    fireEvent.press(screen.getByLabelText('Remove photo 1 — add another photo first'))
    expect(mockDraft.saveNow).not.toHaveBeenCalled()
  })

  it('removes a photo and drops its caption, keeping the others’ in step', async () => {
    withPhotos(3, { photo_captions: ['one', 'two', 'three'] })
    render(<FilesSection />)
    fireEvent.press(screen.getByLabelText('Remove photo 2'))
    await waitFor(() => expect(mockDraft.saveNow).toHaveBeenCalledWith({ photo_urls: ['p1', 'p3'], photo_captions: ['one', 'three'] }))
  })

  it('flags the cover and offers Make cover on the rest only', () => {
    withPhotos(3)
    render(<FilesSection />)
    expect(screen.getByText('Cover')).toBeTruthy()
    expect(screen.queryByLabelText('Make photo 1 the cover')).toBeNull()
    expect(screen.getByLabelText('Make photo 3 the cover')).toBeTruthy()
  })

  it('moves a photo to the front as the cover and keeps its caption with it', async () => {
    withPhotos(3, { photo_captions: [null, null, 'The jack'] })
    render(<FilesSection />)
    fireEvent.press(screen.getByLabelText('Make photo 3 the cover'))
    await waitFor(() => expect(mockDraft.saveNow).toHaveBeenCalledWith({ photo_urls: ['p3', 'p1', 'p2'], photo_captions: ['The jack'] }))
  })

  it('turns an emptied caption into null, trims trailing nulls and caps the length at 60', () => {
    withPhotos(2, { photo_captions: ['one', null] })
    render(<FilesSection />)
    expect(screen.getByLabelText('Caption for photo 1').props.maxLength).toBe(60)
    fireEvent.changeText(screen.getByLabelText('Caption for photo 1'), '')
    expect(mockDraft.save).toHaveBeenLastCalledWith({ photo_captions: [] })
  })

  it('keeps emoji, quotes and markup in a caption', () => {
    withPhotos(1)
    render(<FilesSection />)
    fireEvent.changeText(screen.getByLabelText('Caption for photo 1'), '🧸 "red" <jack> & lead')
    expect(mockDraft.save).toHaveBeenLastCalledWith({ photo_captions: ['🧸 "red" <jack> & lead'] })
  })

  it('shows a placeholder, not an empty box, for a photo that will not decode', () => {
    withPhotos(2)
    const { UNSAFE_getAllByType } = render(<FilesSection />)
    const Image = jest.requireActual('react-native').Image
    act(() => { UNSAFE_getAllByType(Image)[0].props.onError() })
    expect(screen.getAllByText("Saved, but it can't be shown here.")).toHaveLength(1)
  })
})

describe('the guide PDF', () => {
  it('shows only the file name of the stored path, and No PDF yet when there is none', () => {
    const view = render(<FilesSection />)
    expect(screen.getByText('No PDF yet')).toBeTruthy()
    mockDraft.tutorial = { ...mockDraft.tutorial, tutorial_pdf_url: 't1/deep/folder/Big guide 🧸.pdf' }
    view.rerender(<FilesSection />)
    expect(screen.getByText('Big guide 🧸.pdf')).toBeTruthy()
    expect(screen.getByText('Preview')).toBeTruthy()
  })

  it('does nothing when the document picker is cancelled', async () => {
    mockGetDocument.mockResolvedValue({ canceled: true })
    render(<FilesSection />)
    fireEvent.press(screen.getByText('Choose PDF from Files'))
    await waitFor(() => expect(mockGetDocument).toHaveBeenCalled())
    expect(mockUploadFile).not.toHaveBeenCalled()
    expect(mockDraft.saveNow).not.toHaveBeenCalled()
  })

  it('asks the picker for PDFs only', async () => {
    mockGetDocument.mockResolvedValue({ canceled: true })
    render(<FilesSection />)
    fireEvent.press(screen.getByText('Choose PDF from Files'))
    await waitFor(() => expect(mockGetDocument).toHaveBeenCalledWith({ type: 'application/pdf' }))
  })

  it('says it could not upload when the server refuses the file as too big or the wrong type', async () => {
    mockGetDocument.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://x.exe', name: 'x.exe', mimeType: 'application/octet-stream' }] })
    mockUploadFile.mockRejectedValue(new Error('Upload to /api/upload/pdf failed with status 415: Only PDFs are accepted'))
    render(<FilesSection />)
    fireEvent.press(screen.getByText('Choose PDF from Files'))
    expect(await screen.findByText('Could not upload the PDF. Please try again.')).toBeTruthy()
    expect(mockDraft.saveNow).not.toHaveBeenCalled()
  })

  it('falls back to application/pdf when the picker gives no type', async () => {
    mockGetDocument.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://g.pdf', name: 'g.pdf' }] })
    mockUploadFile.mockResolvedValue({ url: 'p' })
    render(<FilesSection />)
    fireEvent.press(screen.getByText('Choose PDF from Files'))
    await waitFor(() => expect(mockUploadFile).toHaveBeenCalled())
    expect(mockUploadFile.mock.calls[0][2]).toEqual({ uri: 'file://g.pdf', name: 'g.pdf', mimeType: 'application/pdf' })
  })

  it('shows the draft’s save error when the PDF uploaded but the guide would not save', () => {
    mockDraft.saveError = 'Could not save. Your changes are still here - try again.'
    render(<FilesSection />)
    expect(screen.getByText(mockDraft.saveError)).toBeTruthy()
  })
})
