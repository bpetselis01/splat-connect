import { Alert } from 'react-native'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { TutorialHub } from '../../../../components/my-tutorials/hub'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockPush = jest.fn()
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  // The hub retires its created note when it loses focus; in a test there is
  // no navigator, so run the effect and ignore the cleanup.
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = jest.requireActual('react')
    useEffect(() => {
      cb()
    }, [cb])
  },
}))

const mockDraft = {
  tutorial: null as unknown,
  loading: false,
  loadError: false,
  saveState: 'idle',
  saveError: null,
  save: jest.fn(),
  saveNow: jest.fn().mockResolvedValue(undefined),
  replaceItems: jest.fn(),
  flush: jest.fn().mockResolvedValue(undefined),
  reload: jest.fn(),
}
jest.mock('../../../../lib/use-tutorial-draft', () => ({ useDraft: () => mockDraft }))

const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}))

const tutorial = (over: Record<string, unknown> = {}) => ({
  id: 't1',
  title: 'Roaring dinosaur',
  kind: 'assistive_tech',
  difficulty: 'medium',
  maturity: 'complete',
  status: 'draft',
  updated_at: 'v1',
  safety_declared_at: null,
  tutorial_pdf_url: null,
  photo_urls: [],
  toy_photo_url: null,
  parts: [],
  tools: [],
  stl_files: [],
  tutorial_contributors: [],
  tutorial_recommendations: [],
  ...over,
})

const complete = (over: Record<string, unknown> = {}) =>
  tutorial({
    safety_declared_at: '2026-09-02',
    tutorial_pdf_url: 'p.pdf',
    photo_urls: ['p.jpg'],
    toy_photo_url: 'p.jpg',
    parts: [{ name: 'a' }],
    tools: [{ name: 'b' }],
    stl_files: [{ id: 's', filename: 'a.stl' }],
    ...over,
  })

beforeEach(() => {
  jest.clearAllMocks()
  mockDraft.tutorial = tutorial()
  mockDraft.loading = false
  mockDraft.loadError = false
})

it('shows a row per section with what each still needs', () => {
  render(<TutorialHub id="t1" />)
  expect(screen.getByTestId('hub-row-details')).toBeTruthy()
  expect(screen.getByTestId('hub-row-safety')).toBeTruthy()
  expect(screen.getAllByText('None yet - at least one')).toHaveLength(2)
  expect(screen.getByText('Guide PDF and a photo')).toBeTruthy()
})

it('omits the STL row for a toy adaptation', () => {
  mockDraft.tutorial = tutorial({ kind: 'toy_adaptation' })
  render(<TutorialHub id="t1" />)
  expect(screen.queryByTestId('hub-row-stl')).toBeNull()
  expect(screen.getByTestId('hub-row-files')).toBeTruthy()
})

it('opens a section when its row is tapped', () => {
  render(<TutorialHub id="t1" />)
  fireEvent.press(screen.getByTestId('hub-row-parts'))
  expect(mockPush).toHaveBeenCalledWith('/tutorials/t1/parts')
})

it('counts what is ready and what is left', () => {
  mockDraft.tutorial = tutorial({ safety_declared_at: '2026-09-02', parts: [{ name: 'a' }] })
  render(<TutorialHub id="t1" />)
  // details + safety + parts done, of six sections
  expect(screen.getByText('3 of 6 ready')).toBeTruthy()
  expect(screen.getByText('4 things still needed')).toBeTruthy()
})

it('disables submit while anything is missing and enables it when nothing is', () => {
  render(<TutorialHub id="t1" />)
  expect(screen.getByTestId('hub-submit')).toBeDisabled()

  mockDraft.tutorial = complete()
  screen.rerender(<TutorialHub id="t1" />)
  expect(screen.getByTestId('hub-submit')).toBeEnabled()
})

it('submits for review through the draft hook', async () => {
  mockDraft.tutorial = complete()
  render(<TutorialHub id="t1" />)
  fireEvent.press(screen.getByTestId('hub-submit'))
  await waitFor(() => expect(mockDraft.saveNow).toHaveBeenCalledWith({ status: 'pending' }))
})

it('offers Delete draft on a draft', () => {
  render(<TutorialHub id="t1" />)
  fireEvent.press(screen.getByTestId('hub-menu-trigger'))
  expect(screen.getByTestId('hub-menu-delete')).toBeTruthy()
  expect(screen.getByText('Delete draft')).toBeTruthy()
})

// Absent, not disabled: a control that can never work should not be drawn.
it.each(['pending', 'approved', 'rejected'] as const)(
  'omits Delete draft entirely on a %s guide',
  (status) => {
    mockDraft.tutorial = tutorial({ status })
    render(<TutorialHub id="t1" />)
    fireEvent.press(screen.getByTestId('hub-menu-trigger'))
    expect(screen.queryByTestId('hub-menu-delete')).toBeNull()
    expect(screen.getByTestId('hub-menu-my-tutorials')).toBeTruthy()
  }
)

it('deletes a draft after confirmation and returns to the list', async () => {
  const spy = jest.spyOn(Alert, 'alert')
  mockDelete.mockResolvedValue(undefined)
  render(<TutorialHub id="t1" />)
  fireEvent.press(screen.getByTestId('hub-menu-trigger'))
  fireEvent.press(screen.getByTestId('hub-menu-delete'))

  const confirm = spy.mock.calls[0][2]?.find((b) => b.text === 'Delete')
  await confirm?.onPress?.()

  expect(mockDelete).toHaveBeenCalledWith('/api/tutorials/t1')
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/tutorials'))
  spy.mockRestore()
})

it('leaves for My tutorials from the menu', () => {
  render(<TutorialHub id="t1" />)
  fireEvent.press(screen.getByTestId('hub-menu-trigger'))
  fireEvent.press(screen.getByTestId('hub-menu-my-tutorials'))
  expect(mockReplace).toHaveBeenCalledWith('/tutorials')
})

it('reassures a contributor once, only just after creation', () => {
  const view = render(<TutorialHub id="t1" justCreated />)
  expect(screen.getByTestId('hub-created-note')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Dismiss'))
  expect(screen.queryByTestId('hub-created-note')).toBeNull()

  view.rerender(<TutorialHub id="t1" />)
  expect(screen.queryByTestId('hub-created-note')).toBeNull()
})

// The spec's "More" section: read-only facts, below the checklist. Not in the
// menu, which holds actions.
it('lists the three things that are edited on the web', () => {
  mockDraft.tutorial = tutorial({
    tutorial_contributors: [{ profiles: { name: 'Ada' } }],
    tutorial_recommendations: [{ id: 'r1' }],
  })
  render(<TutorialHub id="t1" />)
  expect(screen.getByText('Backed by')).toBeTruthy()
  expect(screen.getByText('Collaborators')).toBeTruthy()
  expect(screen.getByText(/Ada - edit on the web/)).toBeTruthy()
  expect(screen.getByText('Recommendations')).toBeTruthy()
  expect(screen.getByText('1 of 3 - edit on the web')).toBeTruthy()
})

it('shows a load failure rather than an empty hub', () => {
  mockDraft.tutorial = null
  mockDraft.loadError = true
  render(<TutorialHub id="t1" />)
  expect(screen.getByText("Couldn't load this guide.")).toBeTruthy()
})
