import { Alert } from 'react-native'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
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
  saveError: null as string | null,
  save: jest.fn(),
  saveNow: jest.fn().mockResolvedValue(undefined),
  replaceItems: jest.fn(),
  flush: jest.fn().mockResolvedValue(undefined),
  reload: jest.fn(),
}
jest.mock('../../../../lib/use-tutorial-draft', () => ({ useDraft: () => mockDraft }))

const mockDelete = jest.fn()
// Pending by default: only the tests that read /orgs should see it answer.
const mockGet = jest.fn((..._a: unknown[]) => new Promise(() => {}))
jest.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
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
  build_minutes: 30,
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
    build_minutes: 30,
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
  mockDraft.saveError = null
  mockDraft.saveState = 'idle'
  mockDraft.saveNow.mockResolvedValue(undefined)
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

const alertSpy = () => jest.spyOn(Alert, 'alert').mockImplementation(() => {})

describe('submitting', () => {
  it('shows the reason on the hub when the submit could not be saved', () => {
    mockDraft.tutorial = complete()
    mockDraft.saveError = 'Could not save. Your changes are still here - try again.'
    render(<TutorialHub id="t1" />)
    expect(screen.getByText('Could not save. Your changes are still here - try again.')).toBeTruthy()
  })

  it('ignores a second tap while the first submit is still in flight', async () => {
    mockDraft.tutorial = complete()
    let finish!: () => void
    mockDraft.saveNow.mockReturnValue(new Promise<void>((r) => { finish = r }))
    render(<TutorialHub id="t1" />)
    fireEvent.press(screen.getByTestId('hub-submit'))
    fireEvent.press(screen.getByTestId('hub-submit'))
    expect(mockDraft.saveNow).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('hub-submit')).toBeDisabled()
    await act(async () => { finish() })
    expect(screen.getByTestId('hub-submit')).toBeEnabled()
  })

  it('can be tried again after a failed submit', async () => {
    mockDraft.tutorial = complete()
    render(<TutorialHub id="t1" />)
    fireEvent.press(screen.getByTestId('hub-submit'))
    await waitFor(() => expect(screen.getByTestId('hub-submit')).toBeEnabled())
    fireEvent.press(screen.getByTestId('hub-submit'))
    expect(mockDraft.saveNow).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['pending', 'Submitted - waiting for review'],
    ['approved', 'Approved - in Guides'],
  ] as const)('says %s in the footnote and disables Submit even when complete', (status, line) => {
    mockDraft.tutorial = complete({ status })
    render(<TutorialHub id="t1" />)
    expect(screen.getByText(line)).toBeTruthy()
    expect(screen.getByTestId('hub-submit')).toBeDisabled()
  })

  it('counts what is still needed in the singular and the plural, and says when it is all ready', () => {
    mockDraft.tutorial = complete({ safety_declared_at: null })
    const view = render(<TutorialHub id="t1" />)
    expect(screen.getByText('1 thing still needed')).toBeTruthy()
    mockDraft.tutorial = tutorial()
    view.rerender(<TutorialHub id="t1" />)
    expect(screen.getByText(/^\d+ things still needed$/)).toBeTruthy()
    mockDraft.tutorial = complete()
    view.rerender(<TutorialHub id="t1" />)
    expect(screen.getByText('Everything is ready')).toBeTruthy()
  })
})

describe('deleting a draft', () => {
  it('does nothing when the confirmation is cancelled', () => {
    const spy = alertSpy()
    render(<TutorialHub id="t1" />)
    fireEvent.press(screen.getByTestId('hub-menu-trigger'))
    fireEvent.press(screen.getByTestId('hub-menu-delete'))
    const cancel = spy.mock.calls[0][2]?.find((b) => b.text === 'Cancel')
    cancel?.onPress?.()
    expect(mockDelete).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('stays on the guide and tells the author when the delete fails', async () => {
    const spy = alertSpy()
    mockDelete.mockRejectedValue(new Error('500'))
    render(<TutorialHub id="t1" />)
    fireEvent.press(screen.getByTestId('hub-menu-trigger'))
    fireEvent.press(screen.getByTestId('hub-menu-delete'))
    const confirm = spy.mock.calls[0][2]?.find((b) => b.text === 'Delete')
    await act(async () => { await confirm?.onPress?.() })
    expect(mockReplace).not.toHaveBeenCalled()
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy.mock.calls[1][0]).toMatch(/delete/i)
  })

  it('closes the menu before it asks', () => {
    alertSpy()
    render(<TutorialHub id="t1" />)
    fireEvent.press(screen.getByTestId('hub-menu-trigger'))
    fireEvent.press(screen.getByTestId('hub-menu-delete'))
    expect(screen.queryByTestId('hub-menu-delete')).toBeNull()
  })

  it('previews as a reader from the menu', () => {
    render(<TutorialHub id="t1" />)
    fireEvent.press(screen.getByTestId('hub-menu-trigger'))
    fireEvent.press(screen.getByTestId('hub-menu-preview'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/guides/[id]', params: { id: 't1' } })
  })
})

describe('header and rows', () => {
  it('names an untitled or whitespace-only title as Untitled guide', () => {
    mockDraft.tutorial = tutorial({ title: '' })
    const view = render(<TutorialHub id="t1" />)
    expect(screen.getByText('Untitled guide')).toBeTruthy()
    mockDraft.tutorial = tutorial({ title: '   ' })
    view.rerender(<TutorialHub id="t1" />)
    expect(screen.getByText('Untitled guide')).toBeTruthy()
  })

  it('shows emoji, markup and a 300-character title as typed', () => {
    const t = `🧸 <b>"Big"</b> & ${'x'.repeat(300)}`
    mockDraft.tutorial = tutorial({ title: t })
    render(<TutorialHub id="t1" />)
    expect(screen.getByText(t)).toBeTruthy()
  })

  it('says saving while a write is in flight, and nothing about time for an unreadable timestamp', () => {
    mockDraft.tutorial = tutorial({ updated_at: 'not a date' })
    mockDraft.saveState = 'saving'
    render(<TutorialHub id="t1" />)
    expect(screen.getByText('Draft · saving')).toBeTruthy()
    mockDraft.saveState = 'idle'
    screen.rerender(<TutorialHub id="t1" />)
    expect(screen.getByText('Draft')).toBeTruthy()
  })

  it('opens every section’s own screen, steps and STL included', () => {
    render(<TutorialHub id="t1" />)
    for (const s of ['details', 'steps', 'parts', 'tools', 'safety', 'files', 'stl']) {
      fireEvent.press(screen.getByTestId(`hub-row-${s}`))
      expect(mockPush).toHaveBeenLastCalledWith(`/tutorials/t1/${s}`)
    }
  })

  it('counts 120 steps on the Steps row and checks it', () => {
    mockDraft.tutorial = tutorial({ steps: Array.from({ length: 120 }, (_, i) => ({ id: `s${i}` })) })
    render(<TutorialHub id="t1" />)
    expect(screen.getByLabelText(/^Steps\. 120 steps$/)).toBeTruthy()
    expect(screen.getByTestId('hub-done-steps')).toBeTruthy()
  })

  it('counts only the optional Steps row as ready on a bare draft', () => {
    mockDraft.tutorial = tutorial({ difficulty: null, build_minutes: null, safety_declared_at: null, title: '' })
    render(<TutorialHub id="t1" />)
    expect(screen.getByText('1 of 7 sections complete')).toBeTruthy()
    expect(screen.getByTestId('hub-progress-fill')).toHaveStyle({ width: `${(1 / 7) * 100}%` })
  })

  it('lists several collaborators, with emoji names, and says Just you with none', () => {
    mockDraft.tutorial = tutorial({ tutorial_contributors: [{ profiles: { name: 'Ada 🧸' } }, { profiles: { name: "O'Brien" } }] })
    const view = render(<TutorialHub id="t1" />)
    expect(screen.getByText("Ada 🧸, O'Brien - edit on the web")).toBeTruthy()
    mockDraft.tutorial = tutorial()
    view.rerender(<TutorialHub id="t1" />)
    expect(screen.getByText('Just you - edit on the web')).toBeTruthy()
  })
})

describe('backing summary', () => {
  const org = (id: string, name: string | null, status: string) => ({ id, org_id: id, status, organizations: name ? { id, name } : null })

  it('lists every backer, and what is still deciding', async () => {
    mockGet.mockResolvedValueOnce([org('a', 'North', 'accepted'), org('b', 'South', 'accepted'), org('c', 'East', 'pending'), org('d', 'West', 'pending')])
    render(<TutorialHub id="t1" />)
    expect(await screen.findByText('Backed by North, South · 2 still deciding')).toBeTruthy()
  })

  it('says only the deciding count when nobody has said yes', async () => {
    mockGet.mockResolvedValueOnce([org('c', 'East', 'pending')])
    render(<TutorialHub id="t1" />)
    expect(await screen.findByText('1 still deciding')).toBeTruthy()
  })

  it('names a backer whose organisation could not be read, and ignores declined ones', async () => {
    mockGet.mockResolvedValueOnce([org('a', null, 'accepted'), org('b', 'No', 'declined')])
    render(<TutorialHub id="t1" />)
    expect(await screen.findByText('Backed by An organisation')).toBeTruthy()
  })

  it('leaves the summary blank, without crashing, when /orgs fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('403'))
    render(<TutorialHub id="t1" />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: /^Backing/ })).toBeTruthy()
  })
})

describe('when the guide will not load', () => {
  it('offers a way to try again, not just advice to', () => {
    mockDraft.tutorial = null
    mockDraft.loadError = true
    render(<TutorialHub id="t1" />)
    fireEvent.press(screen.getByText('Try again'))
    expect(mockDraft.reload).toHaveBeenCalledTimes(1)
  })

  it('shows skeleton rows, not an error, while it loads', () => {
    mockDraft.tutorial = null
    mockDraft.loading = true
    render(<TutorialHub id="t1" />)
    expect(screen.queryByText("Couldn't load this guide.")).toBeNull()
  })
})
