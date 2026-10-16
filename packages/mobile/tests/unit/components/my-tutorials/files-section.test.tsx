// journeys: T13 T14
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { FilesSection } from '../../../../components/my-tutorials/sections/files-section'
import { PhotosSection } from '../../../../components/my-tutorials/sections/photos-section'
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

it('uploads a chosen photo and appends it to the guide immediately', async () => {
  mockRequestMedia.mockResolvedValue({ granted: true })
  mockLaunchLibrary.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://a.jpg', fileName: 'a.jpg', mimeType: 'image/jpeg' }],
  })
  mockUploadFile.mockResolvedValue({ url: 'photos/a.jpg' })

  render(<PhotosSection />)
  fireEvent.press(screen.getByText('Choose from library'))

  await waitFor(() =>
    expect(mockDraft.saveNow).toHaveBeenCalledWith({ photo_urls: ['photos/a.jpg'], photo_captions: [] })
  )
})

it('captions a photo, and the caption follows it to the cover', async () => {
  mockDraft.tutorial = { ...mockDraft.tutorial, photo_urls: ['a', 'b'], photo_captions: [null, 'The jack'] }
  mockDraft.save.mockImplementation((f: Record<string, unknown>) => {
    mockDraft.tutorial = { ...mockDraft.tutorial, ...f }
  })
  const view = render(<PhotosSection />)
  fireEvent.changeText(screen.getByLabelText('Caption for photo 1'), 'The drum')
  expect(mockDraft.save).toHaveBeenLastCalledWith({ photo_captions: ['The drum', 'The jack'] })
  view.rerender(<PhotosSection />)
  fireEvent.press(screen.getByLabelText('Make photo 2 the cover'))
  await waitFor(() =>
    expect(mockDraft.saveNow).toHaveBeenLastCalledWith({ photo_urls: ['b', 'a'], photo_captions: ['The jack', 'The drum'] })
  )
})

it('calls the PDF optional when the guide already has steps', () => {
  mockDraft.tutorial = { ...mockDraft.tutorial, steps: [{ id: 's1' }] }
  render(<FilesSection />)
  expect(screen.getByText('Guide PDF (optional)')).toBeTruthy()
})

it('does not call it optional when there are no steps', () => {
  mockDraft.tutorial = { ...mockDraft.tutorial, steps: [] }
  render(<FilesSection />)
  expect(screen.getByText('Guide PDF')).toBeTruthy()
})

it('uploads a chosen PDF', async () => {
  mockGetDocument.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://g.pdf', name: 'g.pdf', mimeType: 'application/pdf' }],
  })
  mockUploadFile.mockResolvedValue({ url: 'pdfs/g.pdf' })

  render(<FilesSection />)
  fireEvent.press(screen.getByText('Choose PDF from Files'))
  await waitFor(() =>
    expect(mockDraft.saveNow).toHaveBeenCalledWith({ tutorial_pdf_url: 'pdfs/g.pdf' })
  )
})

it('refuses anything that is not a .stl', async () => {
  mockGetDocument.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://x.txt', name: 'x.txt' }],
  })
  render(<StlSection />)
  fireEvent.press(screen.getByText('Choose STL from Files'))
  await waitFor(() => expect(screen.getByText('Please choose a .stl file.')).toBeTruthy())
  expect(mockUploadFile).not.toHaveBeenCalled()
})

// /api/upload/stl writes the storage object only; the row is this POST's job.
it('appends an uploaded STL to the replace-set', async () => {
  mockDraft.tutorial = {
    id: 't1',
    status: 'draft',
    tutorial_pdf_url: null,
    photo_urls: [],
    toy_photo_url: null,
    stl_files: [{ id: 's1', filename: 'old.stl', file_url: 'stl/old.stl' }],
    kind: 'toy_adaptation',
    difficulty: 'easy',
    title: 'T',
    safety_declared_at: null,
    build_minutes: 30,
    parts: [],
    tools: [],
  }
  mockGetDocument.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://n.stl', name: 'n.stl' }],
  })
  mockUploadFile.mockResolvedValue({ url: 'stl/n.stl', filename: 'n.stl' })
  mockPost.mockResolvedValue([])

  render(<StlSection />)
  fireEvent.press(screen.getByText('Choose STL from Files'))

  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith('/api/tutorials/t1/stl-files', {
      stl_files: [
        { filename: 'old.stl', file_url: 'stl/old.stl' },
        { filename: 'n.stl', file_url: 'stl/n.stl' },
      ],
    })
  )
})

it('carries part sizes through the replace-set, and saves them per file', async () => {
  const sized = { id: 's1', filename: 'old.stl', file_url: 'stl/old.stl', print_minutes: 60, filament_grams: 10, material: 'PETG', size_x_mm: 40, size_y_mm: 30, size_z_mm: 20 }
  mockDraft.tutorial = { ...mockDraft.tutorial, stl_files: [sized] }
  ;(apiClient.patch as jest.Mock).mockResolvedValue({ ...sized, size_x_mm: 45 })
  render(<StlSection />)
  fireEvent.changeText(screen.getByLabelText('Width (mm) for old.stl'), '45')
  fireEvent.press(screen.getByText('Save sizes'))
  await waitFor(() =>
    // Only the sizes: the PATCH writes what it is sent, and this button edits sizes.
    expect(apiClient.patch).toHaveBeenCalledWith('/api/tutorials/t1/stl-files/s1', {
      size_x_mm: 45, size_y_mm: 30, size_z_mm: 20,
    })
  )

  mockGetDocument.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://n.stl', name: 'n.stl' }] })
  mockUploadFile.mockResolvedValue({ url: 'stl/n.stl', filename: 'n.stl' })
  mockPost.mockResolvedValue([])
  fireEvent.press(screen.getByText('Choose STL from Files'))
  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith('/api/tutorials/t1/stl-files', {
      stl_files: [
        { filename: 'old.stl', file_url: 'stl/old.stl', print_minutes: 60, filament_grams: 10, material: 'PETG', size_x_mm: 45, size_y_mm: 30, size_z_mm: 20 },
        { filename: 'n.stl', file_url: 'stl/n.stl' },
      ],
    })
  )
})

it('holds Save sizes busy while the save is in flight', async () => {
  const sized = { id: 's1', filename: 'old.stl', file_url: 'stl/old.stl', size_x_mm: 40, size_y_mm: 30, size_z_mm: 20 }
  mockDraft.tutorial = { ...mockDraft.tutorial, stl_files: [sized] }
  let resolve: (v: unknown) => void = () => {}
  ;(apiClient.patch as jest.Mock).mockReturnValue(new Promise((r) => (resolve = r)))
  render(<StlSection />)
  fireEvent.press(screen.getByLabelText('Save sizes'))
  fireEvent.press(screen.getByLabelText('Save sizes'))
  expect(apiClient.patch).toHaveBeenCalledTimes(1)
  resolve(sized)
  await waitFor(() => expect(screen.getByText('Save sizes')).toBeTruthy())
})
