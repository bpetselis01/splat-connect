// journeys: T10 T11
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { StepsSection } from '../../../../components/my-tutorials/sections/steps-section'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }))
const mockSign = jest.fn()
jest.mock('../../../../lib/supabase', () => ({ supabase: { storage: { from: () => ({ createSignedUrl: (...a: unknown[]) => mockSign(...a) }) } } }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
jest.mock('../../../../lib/api-client', () => ({ apiClient: {} }))

const mockUploadFile = jest.fn()
jest.mock('../../../../lib/upload', () => ({ uploadFile: (...a: unknown[]) => mockUploadFile(...a) }))

const mockRequestMedia = jest.fn()
const mockLaunchLibrary = jest.fn()
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: (...a: unknown[]) => mockRequestMedia(...a),
  launchImageLibraryAsync: (...a: unknown[]) => mockLaunchLibrary(...a),
}))

const mockDraft = {
  tutorial: null as Record<string, unknown> | null,
  loading: false,
  loadError: false,
  saveState: 'idle',
  saveError: null as string | null,
  replaceSteps: jest.fn(),
  flush: jest.fn().mockResolvedValue(undefined),
  reload: jest.fn(),
}
jest.mock('../../../../lib/use-tutorial-draft', () => ({ useDraft: () => mockDraft }))

const step = (n: number, over: object = {}) => ({ id: `s${n}`, tutorial_id: 't1', position: n, title: `Title ${n}`, body: `Body ${n}`, photo_url: null, ...over })
const withSteps = (steps: object[], pdf: string | null = null) => { mockDraft.tutorial = { id: 't1', tutorial_pdf_url: pdf, kind: 'toy_adaptation', status: 'draft', steps, parts: [], tools: [], stl_files: [], photo_urls: [], title: 'T', difficulty: 'easy', safety_declared_at: null, build_minutes: 5 } }
const lastRows = () => mockDraft.replaceSteps.mock.lastCall![0] as { title: string | null; body: string; photo_url: string | null; tip?: string | null; minutes?: number | null }[]

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockRequestMedia.mockResolvedValue({ granted: true })
  mockDraft.saveError = null
  withSteps([])
})
afterEach(() => jest.restoreAllMocks())

describe('adding, editing and removing steps', () => {
  it('invites the first step when the guide has none, and sends no write until something changes', () => {
    render(<StepsSection />)
    fireEvent.press(screen.getByText('Add the first step'))
    expect(screen.getByText(/One photo and one instruction per action/)).toBeTruthy()
    expect(mockDraft.replaceSteps).not.toHaveBeenCalled()
  })

  it('adds a blank step that names why it will not be saved yet', () => {
    render(<StepsSection />)
    fireEvent.press(screen.getByText('Add the first step'))
    fireEvent.press(screen.getByTestId('steps-add'))
    expect(screen.getByText('Add the instructions to save this step')).toBeTruthy()
    expect(lastRows()).toEqual([{ title: null, body: '', photo_url: null, tip: null, minutes: null }])
  })

  it('sends the whole list on every keystroke', () => {
    withSteps([step(1)])
    render(<StepsSection />)
    fireEvent.changeText(screen.getByLabelText('Step 1 instructions'), 'Twist the cap')
    expect(lastRows()).toEqual([{ title: 'Title 1', body: 'Twist the cap', photo_url: null, tip: null, minutes: null }])
  })

  it('keeps emoji, quotes and markup in a title and body', () => {
    withSteps([step(1)])
    render(<StepsSection />)
    fireEvent.changeText(screen.getByLabelText('Step 1 title'), '🧸 <Open> & "close"')
    fireEvent.changeText(screen.getByLabelText('Step 1 instructions'), "Don't <b>force</b> it 🚫")
    expect(lastRows()[0]).toMatchObject({ title: '🧸 <Open> & "close"', body: "Don't <b>force</b> it 🚫" })
  })

  it('caps title and instructions at the lengths the API accepts', () => {
    withSteps([step(1)])
    render(<StepsSection />)
    expect(screen.getByLabelText('Step 1 title').props.maxLength).toBe(120)
    expect(screen.getByLabelText('Step 1 instructions').props.maxLength).toBe(2000)
  })

  it('sends a tip and whole minutes, clamped to 1-600, blank as null', () => {
    withSteps([step(1)])
    render(<StepsSection />)
    expect(screen.getByLabelText('Step 1 tip').props.maxLength).toBe(300)
    fireEvent.changeText(screen.getByLabelText('Step 1 tip'), 'Mind the edge')
    expect(lastRows()[0]).toMatchObject({ tip: 'Mind the edge', minutes: null })
    fireEvent.changeText(screen.getByLabelText('Step 1 minutes'), '15')
    expect(lastRows()[0].minutes).toBe(15)
    fireEvent.changeText(screen.getByLabelText('Step 1 minutes'), '9999')
    expect(lastRows()[0].minutes).toBe(600)
    fireEvent.changeText(screen.getByLabelText('Step 1 minutes'), '')
    expect(lastRows()[0].minutes).toBeNull()
  })

  it('removes a step and renumbers the rest', () => {
    withSteps([step(1), step(2), step(3)])
    render(<StepsSection />)
    fireEvent.press(screen.getByTestId('step-remove-1'))
    expect(lastRows().map((r) => r.body)).toEqual(['Body 1', 'Body 3'])
    expect(screen.queryByTestId('step-row-2')).toBeNull()
    expect(screen.getByLabelText('Step 2 instructions').props.value).toBe('Body 3')
  })

  it('removing the last remaining step sends an empty list and keeps the editor open', () => {
    withSteps([step(1)])
    render(<StepsSection />)
    fireEvent.press(screen.getByTestId('step-remove-0'))
    expect(lastRows()).toEqual([])
    expect(screen.getByText('+ Add a step')).toBeTruthy()
    expect(screen.queryByText('Write the steps here')).toBeNull()
    expect(screen.queryByText('Your guide is the PDF')).toBeNull()
  })

  it('shows an existing blank-bodied step as unsaved, not as saved', () => {
    withSteps([step(1, { body: '   ' })])
    render(<StepsSection />)
    expect(screen.getByText('Add the instructions to save this step')).toBeTruthy()
  })
})

describe('ordering', () => {
  it('moves a step down and up', () => {
    withSteps([step(1), step(2), step(3)])
    render(<StepsSection />)
    fireEvent.press(screen.getByTestId('step-down-0'))
    expect(lastRows().map((r) => r.body)).toEqual(['Body 2', 'Body 1', 'Body 3'])
    fireEvent.press(screen.getByTestId('step-up-2'))
    expect(lastRows().map((r) => r.body)).toEqual(['Body 2', 'Body 3', 'Body 1'])
  })

  it('cannot move the first step up or the last one down', () => {
    withSteps([step(1), step(2)])
    render(<StepsSection />)
    expect(screen.getByTestId('step-up-0').props.accessibilityState.disabled).toBe(true)
    expect(screen.getByTestId('step-down-1').props.accessibilityState.disabled).toBe(true)
    fireEvent.press(screen.getByTestId('step-up-0'))
    fireEvent.press(screen.getByTestId('step-down-1'))
    expect(mockDraft.replaceSteps).not.toHaveBeenCalled()
  })

  it('a lone step has both arrows disabled', () => {
    withSteps([step(1)])
    render(<StepsSection />)
    expect(screen.getByTestId('step-up-0').props.accessibilityState.disabled).toBe(true)
    expect(screen.getByTestId('step-down-0').props.accessibilityState.disabled).toBe(true)
  })

  it('carries two steps with the same position through in the order the list holds them', () => {
    withSteps([step(1, { id: 'a', position: 1, body: 'first' }), step(2, { id: 'b', position: 1, body: 'second' })])
    render(<StepsSection />)
    fireEvent.press(screen.getByTestId('step-down-0'))
    expect(lastRows().map((r) => r.body)).toEqual(['second', 'first'])
  })
})

describe('many steps', () => {
  it('lists 100 steps already on the guide, and stops offering Add once it is past the limit', () => {
    withSteps(Array.from({ length: 100 }, (_, i) => step(i + 1)))
    render(<StepsSection />)
    expect(screen.getByTestId('step-row-99')).toBeTruthy()
    expect(screen.queryByTestId('steps-add')).toBeNull()
  })

  it('stops offering Add at exactly 60 steps and offers it at 59', () => {
    withSteps(Array.from({ length: 59 }, (_, i) => step(i + 1)))
    const { unmount } = render(<StepsSection />)
    expect(screen.getByTestId('steps-add')).toBeTruthy()
    fireEvent.press(screen.getByTestId('steps-add'))
    expect(screen.queryByTestId('steps-add')).toBeNull()
    expect(screen.getByTestId('step-row-59')).toBeTruthy()
    unmount()
  })

  it('does not drop steps past the limit when one of them is edited', () => {
    withSteps(Array.from({ length: 70 }, (_, i) => step(i + 1)))
    render(<StepsSection />)
    fireEvent.changeText(screen.getByLabelText('Step 70 instructions'), 'edited')
    expect(lastRows()).toHaveLength(70)
  })
})

describe('step photos', () => {
  const pick = { canceled: false, assets: [{ uri: 'file:///s.jpg', fileName: 's.jpg', mimeType: 'image/jpeg' }] }

  it('uploads to the step-photo route and attaches the url to that step', async () => {
    withSteps([step(1), step(2)])
    mockLaunchLibrary.mockResolvedValue(pick)
    mockUploadFile.mockResolvedValue({ url: 'photos/s.jpg' })
    render(<StepsSection />)
    fireEvent.press(screen.getByTestId('step-photo-1'))
    await waitFor(() => expect(lastRows()[1].photo_url).toBe('photos/s.jpg'))
    expect(lastRows()[0].photo_url).toBeNull()
    expect(mockUploadFile).toHaveBeenCalledWith('/api/upload/step-photo', 't1', { uri: 'file:///s.jpg', name: 's.jpg', mimeType: 'image/jpeg' })
  })

  it('falls back to step.jpg and image/jpeg when the picker names neither', async () => {
    withSteps([step(1)])
    mockLaunchLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///x' }] })
    mockUploadFile.mockResolvedValue({ url: 'u' })
    render(<StepsSection />)
    fireEvent.press(screen.getByTestId('step-photo-0'))
    await waitFor(() => expect(mockUploadFile).toHaveBeenCalled())
    expect(mockUploadFile.mock.calls[0][2]).toEqual({ uri: 'file:///x', name: 'step.jpg', mimeType: 'image/jpeg' })
  })

  it('does nothing when the picker is cancelled', async () => {
    withSteps([step(1)])
    mockLaunchLibrary.mockResolvedValue({ canceled: true })
    render(<StepsSection />)
    fireEvent.press(screen.getByTestId('step-photo-0'))
    await waitFor(() => expect(mockLaunchLibrary).toHaveBeenCalled())
    expect(mockUploadFile).not.toHaveBeenCalled()
    expect(mockDraft.replaceSteps).not.toHaveBeenCalled()
  })

  it('shows a retry sentence, keeps the step as it was, and lets a second try work', async () => {
    withSteps([step(1)])
    mockLaunchLibrary.mockResolvedValue(pick)
    mockUploadFile.mockRejectedValueOnce(new Error('Upload failed with status 413')).mockResolvedValueOnce({ url: 'ok.jpg' })
    render(<StepsSection />)
    fireEvent.press(screen.getByTestId('step-photo-0'))
    expect(await screen.findByText('Could not upload the photo. Please try again.')).toBeTruthy()
    expect(mockDraft.replaceSteps).not.toHaveBeenCalled()
    fireEvent.press(screen.getByTestId('step-photo-0'))
    await waitFor(() => expect(lastRows()[0].photo_url).toBe('ok.jpg'))
    expect(screen.queryByText('Could not upload the photo. Please try again.')).toBeNull()
  })

  it('ignores a second photo tap while one is uploading', async () => {
    withSteps([step(1), step(2)])
    mockLaunchLibrary.mockResolvedValue(pick)
    let finish!: (v: { url: string }) => void
    mockUploadFile.mockReturnValue(new Promise((r) => { finish = r }))
    render(<StepsSection />)
    fireEvent.press(screen.getByTestId('step-photo-0'))
    await waitFor(() => expect(screen.getByText('Uploading…')).toBeTruthy())
    fireEvent.press(screen.getByTestId('step-photo-1'))
    await act(async () => { finish({ url: 'a.jpg' }) })
    expect(mockUploadFile).toHaveBeenCalledTimes(1)
    expect(mockLaunchLibrary).toHaveBeenCalledTimes(1)
  })

  it('removes a photo without touching the step’s text', () => {
    withSteps([step(1, { photo_url: 'p.jpg' })])
    render(<StepsSection />)
    fireEvent.press(screen.getByText('Remove photo'))
    expect(lastRows()).toEqual([{ title: 'Title 1', body: 'Body 1', photo_url: null, tip: null, minutes: null }])
  })

  it('labels the button Replace photo once a step has one', () => {
    withSteps([step(1, { photo_url: 'p.jpg' })])
    render(<StepsSection />)
    expect(screen.getByText('Replace photo')).toBeTruthy()
  })

  it('keeps what was typed while the photo was uploading', async () => {
    withSteps([step(1, { body: '' })])
    mockLaunchLibrary.mockResolvedValue(pick)
    let finish!: (v: { url: string }) => void
    mockUploadFile.mockReturnValue(new Promise((r) => { finish = r }))
    render(<StepsSection />)
    fireEvent.press(screen.getByTestId('step-photo-0'))
    await waitFor(() => expect(screen.getByText('Uploading…')).toBeTruthy())
    fireEvent.changeText(screen.getByLabelText('Step 1 instructions'), 'Typed during the upload')
    await act(async () => { finish({ url: 'late.jpg' }) })
    expect(lastRows()[0]).toEqual({ title: 'Title 1', body: 'Typed during the upload', photo_url: 'late.jpg', tip: null, minutes: null })
    expect(screen.getByLabelText('Step 1 instructions').props.value).toBe('Typed during the upload')
  })

  it('puts the photo on the step it was chosen for when a step is removed above it mid-upload', async () => {
    withSteps([step(1), step(2)])
    mockLaunchLibrary.mockResolvedValue(pick)
    let finish!: (v: { url: string }) => void
    mockUploadFile.mockReturnValue(new Promise((r) => { finish = r }))
    render(<StepsSection />)
    fireEvent.press(screen.getByTestId('step-photo-1'))
    await waitFor(() => expect(screen.getByText('Uploading…')).toBeTruthy())
    fireEvent.press(screen.getByTestId('step-remove-0'))
    await act(async () => { finish({ url: 'late.jpg' }) })
    expect(lastRows()).toEqual([{ title: 'Title 2', body: 'Body 2', photo_url: 'late.jpg', tip: null, minutes: null }])
  })
})

describe('save errors', () => {
  it('shows the draft’s save error under the steps', () => {
    withSteps([step(1)])
    mockDraft.saveError = 'Could not save. Your changes are still here - try again.'
    render(<StepsSection />)
    expect(screen.getByText('Could not save. Your changes are still here - try again.')).toBeTruthy()
  })
})

describe('steps or a PDF', () => {
  const stepsLabel = '+ Add a step'
  it('offers a choice when the guide has neither steps nor a PDF', () => {
    render(<StepsSection />)
    expect(screen.getByText('Write the steps here')).toBeTruthy()
    expect(screen.getByText('Or upload a PDF guide')).toBeTruthy()
    expect(screen.getAllByTestId('section-progress')).toHaveLength(1)
  })

  it('shows the redirect card when there is a PDF and no steps', () => {
    withSteps([], 'a/guide.pdf')
    render(<StepsSection />)
    expect(screen.getByText('Your guide is the PDF')).toBeTruthy()
    expect(screen.getByText('View PDF')).toBeTruthy()
    expect(screen.queryByText(stepsLabel)).toBeNull()
  })

  it('"Add steps as well" opens the editor even with a PDF', () => {
    withSteps([], 'a/guide.pdf')
    render(<StepsSection />)
    fireEvent.press(screen.getByText('Add steps as well'))
    expect(screen.getByText(stepsLabel)).toBeTruthy()
    expect(screen.getAllByTestId('section-progress')).toHaveLength(1)
  })

  it('"Add the first step" opens the editor', () => {
    render(<StepsSection />)
    fireEvent.press(screen.getByText('Add the first step'))
    expect(screen.getByText(stepsLabel)).toBeTruthy()
  })

  it('"Upload a PDF" goes to Files', () => {
    render(<StepsSection />)
    fireEvent.press(screen.getByText('Upload a PDF'))
    expect(mockRouter.push).toHaveBeenCalledWith('/tutorials/t1/files')
  })

  it('"View PDF" signs the path and opens the preview', async () => {
    withSteps([], 'a/guide.pdf')
    mockSign.mockResolvedValue({ data: { signedUrl: 'https://signed' }, error: null })
    render(<StepsSection />)
    fireEvent.press(screen.getByText('View PDF'))
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/guides/[id]/preview', params: { id: 't1', pdfUrl: 'https://signed' } }))
    expect(mockSign).toHaveBeenCalledWith('a/guide.pdf', 60)
  })

  it.each([
    ['an error result', () => mockSign.mockResolvedValue({ data: null, error: { message: 'x' } })],
    ['a rejection', () => mockSign.mockRejectedValue(new Error('offline'))],
  ])('"View PDF" still opens the preview with an empty url on %s', async (_n, arrange) => {
    withSteps([], 'a/guide.pdf')
    arrange()
    render(<StepsSection />)
    fireEvent.press(screen.getByText('View PDF'))
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/guides/[id]/preview', params: { id: 't1', pdfUrl: '' } }))
  })

  it('shows the editor, not the card, when there are steps and a PDF', () => {
    withSteps([step(1)], 'a/guide.pdf')
    render(<StepsSection />)
    expect(screen.queryByText('Your guide is the PDF')).toBeNull()
    expect(screen.getByTestId('step-row-0')).toBeTruthy()
  })
})
