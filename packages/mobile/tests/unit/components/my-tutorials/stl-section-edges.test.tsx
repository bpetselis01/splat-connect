import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
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

const stl = (n: number, over: object = {}) => ({ id: `s${n}`, filename: `part${n}.stl`, file_url: `stl/part${n}.stl`, size_x_mm: null, size_y_mm: null, size_z_mm: null, ...over })
const open = (files: object[] = []) => {
  mockDraft.tutorial = { id: 't1', status: 'draft', tutorial_pdf_url: null, photo_urls: [], stl_files: files, kind: 'assistive_tech', difficulty: 'easy', title: 'T', safety_declared_at: null, build_minutes: 30, parts: [], tools: [], layer_height_mm: null, infill_percent: null, print_minutes: null, material: null }
}
const saved = () => mockDraft.save.mock.lastCall![0] as Record<string, unknown>
const asset = (name: string) => ({ canceled: false, assets: [{ uri: `file://${name}`, name }] })

beforeEach(() => {
  jest.clearAllMocks()
  mockUploadFile.mockReset()
  mockPost.mockReset()
  ;(apiClient.patch as jest.Mock).mockReset()
  mockGetDocument.mockReset()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockDraft.saveError = null
  open()
})
afterEach(() => jest.restoreAllMocks())

describe('picking an STL', () => {
  it.each(['model.stl', 'MODEL.STL', 'Part 🧸 <1> & "2".stl', 'a.b.c.stl'])('accepts %s', async (name) => {
    mockGetDocument.mockResolvedValue(asset(name))
    mockUploadFile.mockResolvedValue({ url: 'stl/x', filename: name })
    mockPost.mockResolvedValue([stl(1)])
    render(<StlSection />)
    fireEvent.press(screen.getByText('Choose STL from Files'))
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(mockPost.mock.calls[0][1].stl_files.at(-1).filename).toBe(name)
  })

  it.each(['model.stl.txt', 'model', 'stl', 'model.obj', '.stl.zip', ''])('refuses %p without uploading', async (name) => {
    mockGetDocument.mockResolvedValue(asset(name))
    render(<StlSection />)
    fireEvent.press(screen.getByText('Choose STL from Files'))
    expect(await screen.findByText('Please choose a .stl file.')).toBeTruthy()
    expect(mockUploadFile).not.toHaveBeenCalled()
  })

  it('does nothing when the picker is cancelled', async () => {
    mockGetDocument.mockResolvedValue({ canceled: true })
    render(<StlSection />)
    fireEvent.press(screen.getByText('Choose STL from Files'))
    await waitFor(() => expect(mockGetDocument).toHaveBeenCalled())
    expect(mockUploadFile).not.toHaveBeenCalled()
  })

  it('names the file the server stored, falling back to the picked name', async () => {
    mockGetDocument.mockResolvedValue(asset('picked.stl'))
    mockUploadFile.mockResolvedValue({ url: 'stl/p' })
    mockPost.mockResolvedValue([])
    render(<StlSection />)
    fireEvent.press(screen.getByText('Choose STL from Files'))
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(mockPost.mock.calls[0][1].stl_files).toEqual([{ filename: 'picked.stl', file_url: 'stl/p' }])
  })

  it('says it could not upload when the server refuses the file, and adds nothing', async () => {
    mockGetDocument.mockResolvedValue(asset('big.stl'))
    mockUploadFile.mockRejectedValue(new Error('Upload to /api/upload/stl failed with status 413'))
    render(<StlSection />)
    fireEvent.press(screen.getByText('Choose STL from Files'))
    expect(await screen.findByText('Could not upload the STL file. Please try again.')).toBeTruthy()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('says it could not upload when the file stored but the guide would not record it', async () => {
    mockGetDocument.mockResolvedValue(asset('a.stl'))
    mockUploadFile.mockResolvedValue({ url: 'stl/a', filename: 'a.stl' })
    mockPost.mockRejectedValue(new Error('409'))
    render(<StlSection />)
    fireEvent.press(screen.getByText('Choose STL from Files'))
    expect(await screen.findByText('Could not upload the STL file. Please try again.')).toBeTruthy()
  })

  it('adds a third file after two without losing either', async () => {
    open([stl(1), stl(2)])
    mockGetDocument.mockResolvedValue(asset('c.stl'))
    mockUploadFile.mockResolvedValue({ url: 'stl/c', filename: 'c.stl' })
    mockPost.mockResolvedValue([stl(1), stl(2), stl(3)])
    render(<StlSection />)
    fireEvent.press(screen.getByText('Choose STL from Files'))
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(mockPost.mock.calls[0][1].stl_files.map((f: { filename: string }) => f.filename)).toEqual(['part1.stl', 'part2.stl', 'c.stl'])
    expect(await screen.findByText('part3.stl')).toBeTruthy()
  })
})

describe('part sizes', () => {
  it('says there are no files yet, and offers no size fields', () => {
    render(<StlSection />)
    expect(screen.getByText('No 3D-print files yet.')).toBeTruthy()
    expect(screen.queryByText('Save sizes')).toBeNull()
  })

  it('sends blank sizes as null and shows saved ones to the millimetre', async () => {
    open([stl(1, { size_x_mm: 40 })])
    ;(apiClient.patch as jest.Mock).mockResolvedValue(stl(1, { size_x_mm: 40 }))
    render(<StlSection />)
    expect(screen.getByLabelText('Width (mm) for part1.stl').props.value).toBe('40')
    expect(screen.getByLabelText('Depth (mm) for part1.stl').props.value).toBe('')
    fireEvent.press(screen.getByText('Save sizes'))
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith('/api/tutorials/t1/stl-files/s1', { size_x_mm: 40, size_y_mm: null, size_z_mm: null }))
  })

  it('does not send NaN for text that is not a number, and says so', async () => {
    open([stl(1)])
    render(<StlSection />)
    fireEvent.changeText(screen.getByLabelText('Width (mm) for part1.stl'), 'abc')
    fireEvent.press(screen.getByText('Save sizes'))
    expect(await screen.findByText('Sizes must be numbers, in millimetres.')).toBeTruthy()
    expect(apiClient.patch).not.toHaveBeenCalled()
  })

  it('shows the server’s sentence when it refuses a size', async () => {
    open([stl(1)])
    ;(apiClient.patch as jest.Mock).mockRejectedValue(Object.assign(new Error('API PATCH failed with status 400: Size must be under 1000 mm'), { status: 400 }))
    render(<StlSection />)
    fireEvent.changeText(screen.getByLabelText('Width (mm) for part1.stl'), '5000')
    fireEvent.press(screen.getByText('Save sizes'))
    expect(await screen.findByText(/Size must be under 1000 mm|Could not save the sizes/)).toBeTruthy()
  })

  it('saves each file’s sizes on its own, leaving the other untouched', async () => {
    open([stl(1), stl(2)])
    ;(apiClient.patch as jest.Mock).mockResolvedValue(stl(2))
    render(<StlSection />)
    fireEvent.changeText(screen.getByLabelText('Height (mm) for part2.stl'), '12')
    fireEvent.press(screen.getAllByText('Save sizes')[1])
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith('/api/tutorials/t1/stl-files/s2', { size_x_mm: null, size_y_mm: null, size_z_mm: 12 }))
    expect(apiClient.patch).toHaveBeenCalledTimes(1)
  })
})

describe('print settings', () => {
  it('saves a decimal layer height, an integer infill and a blank as null', () => {
    render(<StlSection />)
    fireEvent.changeText(screen.getByLabelText('Layer height (mm)'), '0.2')
    expect(saved()).toEqual({ layer_height_mm: 0.2 })
    fireEvent.changeText(screen.getByLabelText('Infill (%)'), '20')
    expect(saved()).toEqual({ infill_percent: 20 })
    fireEvent.changeText(screen.getByLabelText('Infill (%)'), '')
    expect(saved()).toEqual({ infill_percent: null })
  })

  it.each(['abc', '.', '1,5', '-'])('never saves NaN for %p', (text) => {
    render(<StlSection />)
    fireEvent.changeText(screen.getByLabelText('Layer height (mm)'), text)
    const calls = mockDraft.save.mock.calls.map((c) => c[0].layer_height_mm)
    expect(calls.some((v) => Number.isNaN(v))).toBe(false)
  })

  it('saves a zero print time as 0, not as nothing', () => {
    render(<StlSection />)
    fireEvent.changeText(screen.getByLabelText('Print time (minutes)'), '0')
    expect(saved()).toEqual({ print_minutes: 0 })
  })

  it('turns a blank material into null, keeps emoji and markup, and caps it at 40', () => {
    render(<StlSection />)
    expect(screen.getByLabelText('Material').props.maxLength).toBe(40)
    fireEvent.changeText(screen.getByLabelText('Material'), '   ')
    expect(saved()).toEqual({ material: null })
    fireEvent.changeText(screen.getByLabelText('Material'), 'PETG 🧸 <a> & "b"')
    expect(saved()).toEqual({ material: 'PETG 🧸 <a> & "b"' })
  })

  it('shows the saved settings in their fields', () => {
    open()
    mockDraft.tutorial = { ...(mockDraft.tutorial as object), layer_height_mm: 0.2, infill_percent: 0, print_minutes: 90, material: 'PLA' }
    render(<StlSection />)
    expect(screen.getByLabelText('Layer height (mm)').props.defaultValue).toBe('0.2')
    expect(screen.getByLabelText('Infill (%)').props.defaultValue).toBe('0')
    expect(screen.getByLabelText('Print time (minutes)').props.defaultValue).toBe('90')
    expect(screen.getByLabelText('Material').props.defaultValue).toBe('PLA')
  })
})
