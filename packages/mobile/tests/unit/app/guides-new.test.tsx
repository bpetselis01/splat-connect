// packages/mobile/tests/unit/app/guides-new.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
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

jest.mock('../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

const mockAccept = jest.fn()

beforeEach(() => {
  mockPost.mockReset()
  mockReplace.mockReset()
  mockAccept.mockReset()
  ;(useAuth as jest.Mock).mockReturnValue({ acceptContributorTerms: mockAccept })
})

describe('NewGuideRoute', () => {
  it('disables Create draft until a title is entered', () => {
    render(<NewGuideRoute />)
    expect(screen.getByLabelText('Create draft').props.accessibilityState.disabled).toBe(true)
    fireEvent.changeText(screen.getByPlaceholderText('Title'), 'Bubble machine')
    expect(screen.getByLabelText('Create draft').props.accessibilityState.disabled).toBe(false)
  })

  it('posts the uuid, title and the default kind/difficulty, then replaces into the editor', async () => {
    mockPost.mockResolvedValue({ id: 'uuid-1' })
    render(<NewGuideRoute />)
    fireEvent.changeText(screen.getByPlaceholderText('Title'), 'Bubble machine')
    fireEvent.press(screen.getByLabelText('Create draft'))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/tutorials', {
        id: 'uuid-1',
        title: 'Bubble machine',
        difficulty: 'easy',
        kind: 'toy_adaptation',
      })
    )
    // The second POST is the author's own contributor row. POST /api/tutorials
    // writes the tutorials row alone, and every RLS policy on a draft reads
    // through tutorial_contributors — without this the editor 404s on load.
    expect(mockPost).toHaveBeenCalledWith('/api/contributors/me/tutorials/uuid-1', {})
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/tutorials/[id]',
      // justCreated is what lets the hub reassure once, and only on the first
      // landing — keying it off status would show it on every visit to an
      // untouched draft.
      params: { id: 'uuid-1', justCreated: '1' },
    })
  })

  it('posts the picked kind and difficulty when the chips are changed', async () => {
    mockPost.mockResolvedValue({ id: 'uuid-1' })
    render(<NewGuideRoute />)
    fireEvent.changeText(screen.getByPlaceholderText('Title'), 'Head switch arm')
    fireEvent.press(screen.getByLabelText('Assistive tech'))
    fireEvent.press(screen.getByLabelText('Hard'))
    fireEvent.press(screen.getByLabelText('Create draft'))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/tutorials', {
        id: 'uuid-1',
        title: 'Head switch arm',
        difficulty: 'hard',
        kind: 'assistive_tech',
      })
    )
  })

  it('reveals the terms gate on a 403, then accepts and retries the SAME id', async () => {
    mockPost
      .mockRejectedValueOnce(
        new Error(
          "API POST /api/tutorials failed with status 403: You must accept the contributor terms before contributing"
        )
      )
      .mockResolvedValueOnce({ id: 'uuid-1' })
    mockAccept.mockResolvedValue({ error: null })

    render(<NewGuideRoute />)
    fireEvent.changeText(screen.getByPlaceholderText('Title'), 'Bubble machine')
    fireEvent.press(screen.getByLabelText('Create draft'))

    expect(
      await screen.findByText('You must accept the contributor terms before contributing.')
    ).toBeTruthy()

    fireEvent.press(screen.getByTestId('new-guide-accept-terms'))
    fireEvent.press(screen.getByLabelText('Accept and continue'))

    await waitFor(() => expect(mockAccept).toHaveBeenCalledTimes(1))
    // Filtered by path rather than counted: createDraft also claims the
    // contributor row, so the total is three calls, two of them creates.
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(3))
    const creates = mockPost.mock.calls.filter((call) => call[0] === '/api/tutorials')
    // Both attempts carry the same id — a retry must not mint a second draft.
    expect(creates).toHaveLength(2)
    expect(creates[0][1].id).toBe('uuid-1')
    expect(creates[1][1].id).toBe('uuid-1')
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/tutorials/[id]',
      // justCreated is what lets the hub reassure once, and only on the first
      // landing — keying it off status would show it on every visit to an
      // untouched draft.
      params: { id: 'uuid-1', justCreated: '1' },
    })
  })

  it('shows a generic error on a non-403 failure, without revealing the terms gate', async () => {
    mockPost.mockRejectedValue(new Error('API POST /api/tutorials failed with status 500'))
    render(<NewGuideRoute />)
    fireEvent.changeText(screen.getByPlaceholderText('Title'), 'Bubble machine')
    fireEvent.press(screen.getByLabelText('Create draft'))
    expect(await screen.findByText('Could not create this guide. Please try again.')).toBeTruthy()
    expect(screen.queryByText(/contributor terms/i)).toBeNull()
  })
})

describe('NewGuideRoute — Start from a PDF', () => {
  const draft = {
    title: 'Switch Adapted Penguin Toy',
    summary: null,
    kind: 'toy_adaptation',
    difficulty: null,
    build_minutes: null,
    age_min: null,
    age_max: null,
    parts: [{ name: 'Mono jack', quantity: 2 }],
    tools: [{ name: 'Soldering Iron' }],
    steps: [{ body: 'Remove the screws.' }],
    print_settings: {},
    warnings: ['Photos and diagrams inside the PDF are not copied — add them to the guide yourself.'],
    confidence: { title: 'high', summary: 'none', kind: 'high', parts: 'high', tools: 'high', steps: 'high', print_settings: 'none' },
    page_count: 4,
  }
  const asset = { uri: 'file:///penguin.pdf', name: 'penguin.pdf', mimeType: 'application/pdf', size: 1000 }

  beforeEach(() => {
    mockPost.mockReset().mockResolvedValue({})
    mockGet.mockReset().mockResolvedValue({ updated_at: 'T1' })
    mockPatch.mockReset().mockResolvedValue({})
    mockPut.mockReset().mockResolvedValue({})
    mockPick.mockReset().mockResolvedValue({ canceled: false, assets: [asset] })
    mockUpload.mockReset().mockImplementation(async (path: string) =>
      path === '/api/tutorials/import-pdf' ? draft : { url: 'uuid-1/tutorial.pdf' }
    )
  })

  async function readPdf() {
    render(<NewGuideRoute />)
    fireEvent.press(screen.getByLabelText('Start from a PDF'))
    fireEvent.press(screen.getByLabelText('Choose PDF'))
    await screen.findByTestId('new-guide-pdf-found')
  }

  it('shows what was found and prefills the title before saving anything', async () => {
    await readPdf()
    expect(mockUpload).toHaveBeenCalledWith(
      '/api/tutorials/import-pdf',
      '',
      { uri: asset.uri, name: asset.name, mimeType: 'application/pdf' },
      null
    )
    expect(screen.getByText('✓ Parts: 1 part')).toBeTruthy()
    expect(screen.getByText('– Description: not found')).toBeTruthy()
    expect(screen.getByText(/Photos and diagrams inside the PDF are not copied/)).toBeTruthy()
    expect(screen.getByPlaceholderText('Title').props.value).toBe('Switch Adapted Penguin Toy')
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('creates the guide, stores the PDF, fills parts, tools and steps, and lands on the hub', async () => {
    await readPdf()
    fireEvent.press(screen.getByLabelText('Create draft'))
    await waitFor(() => expect(mockReplace).toHaveBeenCalled())
    expect(mockPost).toHaveBeenCalledWith('/api/tutorials', expect.objectContaining({ id: 'uuid-1', title: 'Switch Adapted Penguin Toy' }))
    expect(mockUpload).toHaveBeenCalledWith('/api/upload/pdf', 'uuid-1', expect.objectContaining({ name: 'penguin.pdf' }))
    expect(mockPatch).toHaveBeenCalledWith('/api/tutorials/uuid-1', { tutorial_pdf_url: 'uuid-1/tutorial.pdf', updated_at: 'T1' })
    expect(mockPost).toHaveBeenCalledWith('/api/tutorials/uuid-1/parts', expect.anything())
    expect(mockPut).toHaveBeenCalledWith('/api/tutorials/uuid-1/steps', { steps: draft.steps })
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/tutorials/[id]', params: { id: 'uuid-1', fromPdf: '1' } })
  })

  it('skips the steps with a note when the steps endpoint answers 404', async () => {
    mockPut.mockRejectedValue(new Error('API PUT /api/tutorials/uuid-1/steps failed with status 404'))
    await readPdf()
    fireEvent.press(screen.getByLabelText('Create draft'))
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/tutorials/[id]',
        params: { id: 'uuid-1', fromPdf: '1', stepsLater: '1' },
      })
    )
  })

  it('says why when the PDF cannot be read', async () => {
    mockUpload.mockRejectedValue(new Error('Upload to /api/tutorials/import-pdf failed with status 415: That file is not a PDF.'))
    render(<NewGuideRoute />)
    fireEvent.press(screen.getByLabelText('Start from a PDF'))
    fireEvent.press(screen.getByLabelText('Choose PDF'))
    expect(await screen.findByText('That file is not a PDF.')).toBeTruthy()
  })
})
