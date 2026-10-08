// packages/mobile/tests/unit/app/guides-new.test.tsx
// journeys: N02 N03
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import NewGuideRoute from '../../../app/(tabs)/guides/new'
import { useAuth } from '../../../lib/auth-context'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid-1' }))

const mockReplace = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }))

const mockPost = jest.fn()
const mockGet = jest.fn()
const mockPatch = jest.fn()
const mockPut = jest.fn()
jest.mock('../../../lib/api-client', () => ({
  apiClient: {
    post: (...a: unknown[]) => mockPost(...a),
    get: (...a: unknown[]) => mockGet(...a),
    patch: (...a: unknown[]) => mockPatch(...a),
    put: (...a: unknown[]) => mockPut(...a),
  },
}))

const mockUpload = jest.fn()
jest.mock('../../../lib/upload', () => ({ uploadFile: (...a: unknown[]) => mockUpload(...a) }))
const mockPick = jest.fn()
jest.mock('expo-document-picker', () => ({ getDocumentAsync: (...a: unknown[]) => mockPick(...a) }))

const mockLibrary = jest.fn()
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: (...a: unknown[]) => mockLibrary(...a),
}))

jest.mock('../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

const mockAccept = jest.fn()

const draft = {
  title: null as string | null, summary: null, kind: 'toy_adaptation', difficulty: null, build_minutes: null, age_min: null, age_max: null,
  parts: [], tools: [], steps: [], print_settings: {}, warnings: [], confidence: { title: 'none', summary: 'none', kind: 'none', parts: 'none', tools: 'none', steps: 'none', print_settings: 'none' }, page_count: 1,
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockPost.mockReset().mockResolvedValue({})
  mockGet.mockReset().mockResolvedValue({ updated_at: 'T1' })
  mockPatch.mockReset().mockResolvedValue({})
  mockPut.mockReset().mockResolvedValue({})
  mockUpload.mockReset().mockResolvedValue({ url: 'u.jpg' })
  mockPick.mockReset()
  mockLibrary.mockReset()
  ;(useAuth as jest.Mock).mockReturnValue({ acceptContributorTerms: mockAccept.mockReset() })
})
afterEach(() => jest.restoreAllMocks())

const type = (t: string) => fireEvent.changeText(screen.getByPlaceholderText('Title'), t)
const create = () => fireEvent.press(screen.getByLabelText('Create draft'))
const created = () => mockPost.mock.calls.find((c) => c[0] === '/api/tutorials')?.[1]

describe('the title', () => {
  it.each([['spaces', '    '], ['tabs and newlines', ' \t\n ']])('keeps Create draft off for %s', (_l, t) => {
    render(<NewGuideRoute />)
    type(t)
    expect(screen.getByLabelText('Create draft').props.accessibilityState.disabled).toBe(true)
  })

  it('creates a draft with an emoji, quoted, markup, RTL or 500-character title as typed', async () => {
    for (const t of ['🧸🦄 Dino', `"Roar" <b>&</b> 'x'`, 'سارة', 'N'.repeat(500)]) {
      mockPost.mockClear()
      const view = render(<NewGuideRoute />)
      type(t)
      create()
      await waitFor(() => expect(created()).toBeTruthy())
      expect(created().title).toBe(t)
      view.unmount()
    }
  })

  it('creates exactly one draft when Create is tapped twice while it is running', async () => {
    let finish!: (v?: unknown) => void
    mockPost.mockReturnValueOnce(new Promise((r) => { finish = r }))
    render(<NewGuideRoute />)
    type('Once')
    create()
    create()
    expect(mockPost.mock.calls.filter((c) => c[0] === '/api/tutorials')).toHaveLength(1)
    await act(async () => { finish({}) })
  })
})

describe('creating', () => {
  it('shows a retry sentence and re-uses the same id when linking the author fails after the draft was created', async () => {
    mockPost.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('API POST failed with status 500'))
    render(<NewGuideRoute />)
    type('Retry me')
    create()
    expect(await screen.findByText('Could not create this guide. Please try again.')).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
    create()
    await waitFor(() => expect(mockReplace).toHaveBeenCalled())
    const creates = mockPost.mock.calls.filter((c) => c[0] === '/api/tutorials')
    expect(creates).toHaveLength(2)
    expect(creates[0][1].id).toBe(creates[1][1].id)
  })

  it('does not show the terms gate for an offline failure', async () => {
    mockPost.mockRejectedValue(new TypeError('Network request failed'))
    render(<NewGuideRoute />)
    type('Offline')
    create()
    expect(await screen.findByText('Could not create this guide. Please try again.')).toBeTruthy()
    expect(screen.queryByText('Accept and continue')).toBeNull()
  })

  it('keeps Accept and continue off until the terms box is ticked', async () => {
    mockPost.mockRejectedValue(new Error('API POST /api/tutorials failed with status 403'))
    render(<NewGuideRoute />)
    type('Gate')
    create()
    await screen.findByText('Accept and continue')
    expect(screen.getByLabelText('Accept and continue').props.accessibilityState.disabled).toBe(true)
  })

  it('shows the terms error and does not retry when accepting the terms fails', async () => {
    mockPost.mockRejectedValue(new Error('API POST /api/tutorials failed with status 403'))
    mockAccept.mockResolvedValue({ error: 'Could not record your acceptance.' })
    render(<NewGuideRoute />)
    type('Gate')
    create()
    await screen.findByText('Accept and continue')
    fireEvent.press(screen.getByTestId('new-guide-accept-terms'))
    fireEvent.press(screen.getByLabelText('Accept and continue'))
    expect(await screen.findByText('Could not record your acceptance.')).toBeTruthy()
    expect(mockPost.mock.calls.filter((c) => c[0] === '/api/tutorials')).toHaveLength(1)
  })
})

describe('extras', () => {
  it('sends nothing when no extras are filled, and no longer asks a switch type', async () => {
    render(<NewGuideRoute />)
    type('No extras')
    expect(screen.queryByText('Switch type')).toBeNull()
    create()
    await waitFor(() => expect(mockReplace).toHaveBeenCalled())
    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('sends an age range of 0 as 0, not as nothing', async () => {
    render(<NewGuideRoute />)
    type('Zero')
    fireEvent.changeText(screen.getByLabelText('Youngest age'), '0')
    create()
    await waitFor(() => expect(mockPatch).toHaveBeenCalled())
    expect(mockPatch.mock.calls[0][1]).toMatchObject({ age_min: 0 })
  })

  it.each(['abc', '-', ' ', '.'])('never sends NaN or an invented zero for pasted age %p', async (text) => {
    render(<NewGuideRoute />)
    type('Paste')
    fireEvent.changeText(screen.getByLabelText('Youngest age'), text)
    create()
    await waitFor(() => expect(mockReplace).toHaveBeenCalled())
    const sent = mockPatch.mock.calls[0]?.[1] ?? {}
    expect(Number.isNaN(sent.age_min)).toBe(false)
    expect(sent.age_min).toBeUndefined()
  })

  it('opens the system photo picker without asking for library permission', async () => {
    const ImagePicker = jest.requireMock('expo-image-picker')
    mockLibrary.mockResolvedValueOnce({ canceled: true })
    render(<NewGuideRoute />)
    fireEvent.press(screen.getByLabelText('Add a cover photo'))
    await waitFor(() => expect(mockLibrary).toHaveBeenCalled())
    expect(ImagePicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled()
  })

  it('is one scrolling form that closes the keyboard on a tap or a drag', () => {
    const { UNSAFE_getByType } = render(<NewGuideRoute />)
    const form = UNSAFE_getByType(require('react-native').ScrollView)
    expect(form.props.keyboardDismissMode).toBe('on-drag')
    expect(form.props.keyboardShouldPersistTaps).toBe('handled')
  })

  it('shows Cover photo chosen after a pick, and still creates when the picker is cancelled', async () => {
    mockLibrary.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file://c.jpg' }] })
    render(<NewGuideRoute />)
    fireEvent.press(screen.getByLabelText('Add a cover photo'))
    expect(await screen.findByText('Cover photo chosen')).toBeTruthy()
  })

  it('uploads the cover under its fallback name and type when the picker gives none', async () => {
    mockLibrary.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file://c.jpg' }] })
    render(<NewGuideRoute />)
    type('Cover')
    fireEvent.press(screen.getByLabelText('Add a cover photo'))
    await screen.findByText('Cover photo chosen')
    create()
    await waitFor(() => expect(mockPatch).toHaveBeenCalled())
    expect(mockUpload).toHaveBeenCalledWith('/api/upload/photo', 'uuid-1', { uri: 'file://c.jpg', name: 'photo.jpg', mimeType: 'image/jpeg' })
    expect(mockPatch.mock.calls[0][1]).toMatchObject({ photo_urls: ['u.jpg'] })
  })

  it('still opens the editor, with no photo claimed, when the cover upload is refused as too big', async () => {
    mockLibrary.mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file://c.jpg' }] })
    mockUpload.mockRejectedValue(new Error('Upload to /api/upload/photo failed with status 413'))
    render(<NewGuideRoute />)
    type('Big')
    fireEvent.press(screen.getByLabelText('Add a cover photo'))
    await screen.findByText('Cover photo chosen')
    create()
    await waitFor(() => expect(mockReplace).toHaveBeenCalled())
    expect(mockPatch).not.toHaveBeenCalled()
  })
})

describe('starting from a PDF', () => {
  const asset = { uri: 'file:///g.pdf', name: 'g.pdf', mimeType: 'application/pdf', size: 1000 }
  const start = () => { render(<NewGuideRoute />); fireEvent.press(screen.getByLabelText('Start from a PDF')) }

  it('does nothing when the document picker is cancelled', async () => {
    mockPick.mockResolvedValue({ canceled: true })
    start()
    fireEvent.press(screen.getByLabelText('Choose PDF'))
    await waitFor(() => expect(mockPick).toHaveBeenCalled())
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('refuses a PDF over the size limit before uploading it', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [{ ...asset, size: 1024 * 1024 * 1024 }] })
    start()
    fireEvent.press(screen.getByLabelText('Choose PDF'))
    expect(await screen.findByText(/That PDF is over/)).toBeTruthy()
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('accepts a PDF whose size the picker does not report', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [{ uri: asset.uri, name: asset.name }] })
    mockUpload.mockResolvedValue(draft)
    start()
    fireEvent.press(screen.getByLabelText('Choose PDF'))
    await screen.findByTestId('new-guide-pdf-found')
    expect(mockUpload.mock.calls[0][2].mimeType).toBe('application/pdf')
  })

  it('leaves the title empty and Create off when the PDF has no recognisable title', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [asset] })
    mockUpload.mockResolvedValue({ ...draft, title: null })
    start()
    fireEvent.press(screen.getByLabelText('Choose PDF'))
    await screen.findByTestId('new-guide-pdf-found')
    expect(screen.getByPlaceholderText('Title').props.value).toBe('')
    expect(screen.getByLabelText('Create draft').props.accessibilityState.disabled).toBe(true)
  })

  it('shows what was found and lets the author correct the title before creating', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [asset] })
    mockUpload.mockImplementation(async (p: string) => (p === '/api/tutorials/import-pdf' ? { ...draft, title: 'Read from PDF' } : { url: 'x/tutorial.pdf' }))
    start()
    fireEvent.press(screen.getByLabelText('Choose PDF'))
    await screen.findByTestId('new-guide-pdf-found')
    type('Corrected title')
    create()
    await waitFor(() => expect(created()).toBeTruthy())
    expect(created().title).toBe('Corrected title')
  })

  it('names the parts that could not be saved on the hub', async () => {
    mockPick.mockResolvedValue({ canceled: false, assets: [asset] })
    mockUpload.mockImplementation(async (p: string) => (p === '/api/tutorials/import-pdf' ? { ...draft, title: 'T', parts: [{ name: 'a', quantity: 1 }] } : { url: 'x/tutorial.pdf' }))
    mockPost.mockImplementation(async (path: string) => { if (path.endsWith('/parts')) throw new Error('500'); return {} })
    start()
    fireEvent.press(screen.getByLabelText('Choose PDF'))
    await screen.findByTestId('new-guide-pdf-found')
    create()
    await waitFor(() => expect(mockReplace).toHaveBeenCalled())
    expect(mockReplace.mock.calls[0][0].params.missed).toBeTruthy()
  })
})
