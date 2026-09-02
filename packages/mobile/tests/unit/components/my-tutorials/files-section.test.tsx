import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { FilesSection } from '../../../../components/my-tutorials/sections/files-section'
import { StlSection } from '../../../../components/my-tutorials/sections/stl-section'

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
    toy_photo_url: null,
    stl_files: [],
    kind: 'toy_adaptation',
    difficulty: 'easy',
    title: 'T',
    safety_declared_at: null,
    parts: [],
    tools: [],
  }
})

it('uploads a chosen photo and records its url immediately', async () => {
  mockRequestMedia.mockResolvedValue({ granted: true })
  mockLaunchLibrary.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://a.jpg', fileName: 'a.jpg', mimeType: 'image/jpeg' }],
  })
  mockUploadFile.mockResolvedValue({ url: 'photos/a.jpg' })

  render(<FilesSection />)
  fireEvent.press(screen.getByText('Choose from library'))

  await waitFor(() =>
    expect(mockDraft.saveNow).toHaveBeenCalledWith({ toy_photo_url: 'photos/a.jpg' })
  )
})

it('explains a refused permission rather than failing silently', async () => {
  mockRequestMedia.mockResolvedValue({ granted: false })
  render(<FilesSection />)
  fireEvent.press(screen.getByText('Choose from library'))
  await waitFor(() =>
    expect(screen.getByText('Photo library access is needed to choose a photo.')).toBeTruthy()
  )
  expect(mockUploadFile).not.toHaveBeenCalled()
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
    toy_photo_url: null,
    stl_files: [{ id: 's1', filename: 'old.stl', file_url: 'stl/old.stl' }],
    kind: 'toy_adaptation',
    difficulty: 'easy',
    title: 'T',
    safety_declared_at: null,
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
