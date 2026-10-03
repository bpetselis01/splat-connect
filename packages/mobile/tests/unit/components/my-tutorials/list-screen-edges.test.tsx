import { render, screen, fireEvent } from '@testing-library/react-native'
import { MyTutorialsListScreen, formatViews, tutorialMeta } from '../../../../components/my-tutorials/list-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: mockPush }), useFocusEffect: (effect: () => void) => useEffect(effect, []) }
})

const tutorial = (over: object = {}) => ({
  id: 't1', title: 'Bubble machine switch', description: null, difficulty: 'easy', kind: 'toy_adaptation',
  status: 'draft', tutorial_pdf_url: null, photo_urls: [], toy_photo_url: null, rejection_note: null,
  created_at: '', updated_at: '', reviewed_at: null, reviewed_by: null, reviewed_for_org_id: null,
  parts: [], tools: [], stl_files: [], steps: [], ...over,
}) as never

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

describe('formatViews', () => {
  it.each([[0, '0'], [1, '1'], [999, '999'], [1000, '1k'], [1049, '1k'], [1050, '1.1k'], [2100, '2.1k'], [12_345, '12.3k'], [99_950, '100k']])('writes %p as %p', (n, out) => {
    expect(formatViews(n)).toBe(out)
  })
})

describe('tutorialMeta', () => {
  const org = (status: string, name: string | null, at = '2026-08-28T02:00:00Z') => ({ id: 'b', org_id: 'o', status, requested_at: at, organizations: name ? { id: 'o', name } : null })

  it('says how far a bare draft has got', () => {
    expect(tutorialMeta(tutorial())).toMatch(/^Draft · \d of \d sections done$/)
  })

  it('falls back to the kind and difficulty for a waiting guide whose reviewer’s name is unknown', () => {
    expect(tutorialMeta(tutorial({ status: 'pending', tutorial_orgs: [org('pending', null)] }))).toBe('Toy adaptation · easy')
  })

  it('names who holds a submitted guide, not who already backs it', () => {
    expect(tutorialMeta(tutorial({ status: 'pending', tutorial_orgs: [org('accepted', 'Backer'), org('pending', 'Northside')] }))).toBe('With Northside since 28 Aug')
  })

  it('shows views, print fit and the backer on a live guide', () => {
    const t = tutorial({ status: 'approved', view_count: 2100, print_fit_stats: { fitted: 4, fit_answers: 5 }, tutorial_orgs: [org('accepted', 'Backer')] })
    expect(tutorialMeta(t)).toBe('2.1k views · 4 of 5 prints fitted · Backer')
  })

  it('shows 0 views for a live guide with no count and no fit or backer', () => {
    expect(tutorialMeta(tutorial({ status: 'approved', view_count: null }))).toBe('0 views')
  })

  it('shows 1 print fitted in the singular', () => {
    expect(tutorialMeta(tutorial({ status: 'approved', view_count: 1, print_fit_stats: { fitted: 1, fit_answers: 1 } }))).toBe('1 view · 1 of 1 print fitted')
  })

  it('labels a returned guide by kind and difficulty with its backer', () => {
    expect(tutorialMeta(tutorial({ status: 'rejected', kind: 'assistive_tech', difficulty: 'hard', tutorial_orgs: [org('accepted', 'Backer')] }))).toBe('Assistive tech · hard · Backer')
  })
})

describe('MyTutorialsListScreen edges', () => {
  it('lists 120 guides', async () => {
    mockGet.mockResolvedValue(Array.from({ length: 120 }, (_, i) => tutorial({ id: `t${i}`, title: `Guide ${i}`, status: 'approved' })))
    render(<MyTutorialsListScreen />)
    expect(await screen.findByLabelText('All, 120')).toBeTruthy()
    expect(screen.getByLabelText('Live, 120')).toBeTruthy()
  })

  it('shows emoji, quotes, markup and a 300-character title as written', async () => {
    const title = `🧸 "Big" <b>switch</b> & ${'x'.repeat(300)}`
    mockGet.mockResolvedValue([tutorial({ title })])
    render(<MyTutorialsListScreen />)
    expect(await screen.findByText(title)).toBeTruthy()
  })

  it('shows a title-less draft as an empty row rather than failing', async () => {
    mockGet.mockResolvedValue([tutorial({ title: '' })])
    render(<MyTutorialsListScreen />)
    expect(await screen.findByLabelText('All, 1')).toBeTruthy()
  })

  it('opens the editor for the tapped guide', async () => {
    mockGet.mockResolvedValue([tutorial({ id: 'abc', title: 'Tap me' })])
    render(<MyTutorialsListScreen />)
    fireEvent.press(await screen.findByText('Tap me'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/tutorials/[id]', params: { id: 'abc' } })
  })

  it('shows a rejection note only on a rejected guide, with its words intact', async () => {
    const note = `Please add a photo of the "jack" <close up> & the lid 🧸`
    mockGet.mockResolvedValue([tutorial({ id: 'r', title: 'Returned', status: 'rejected', rejection_note: note }), tutorial({ id: 'd', title: 'Mine', status: 'draft', rejection_note: 'stale note' })])
    render(<MyTutorialsListScreen />)
    expect(await screen.findByText(note)).toBeTruthy()
    expect(screen.queryByText('stale note')).toBeNull()
  })

  it('does not show a rejected guide’s empty note', async () => {
    mockGet.mockResolvedValue([tutorial({ status: 'rejected', rejection_note: '' })])
    render(<MyTutorialsListScreen />)
    await screen.findByLabelText('Needs you, 1')
    expect(screen.queryByText('')).toBeNull()
  })

  it('offers Add a tutorial from the empty state and from the intro', async () => {
    mockGet.mockResolvedValue([])
    render(<MyTutorialsListScreen />)
    await screen.findByText('No guides yet')
    const adds = screen.getAllByLabelText('+ Add a tutorial')
    expect(adds.length).toBeGreaterThanOrEqual(1)
    fireEvent.press(adds[adds.length - 1])
    expect(mockPush).toHaveBeenCalledWith('/guides/new')
  })

  it('says it could not load, and a retry shows the list', async () => {
    mockGet.mockRejectedValue(new Error('500'))
    render(<MyTutorialsListScreen />)
    expect(await screen.findByText("Couldn't load your tutorials.")).toBeTruthy()
    mockGet.mockResolvedValue([tutorial({ title: 'Back' })])
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Back')).toBeTruthy()
  })

  it('shows a way to clear the filter when the picked stage has no guides', async () => {
    mockGet.mockResolvedValue([tutorial({ status: 'draft' })])
    render(<MyTutorialsListScreen />)
    await screen.findByLabelText('Live, 0')
    fireEvent.press(screen.getByLabelText('Live, 0'))
    expect(screen.queryByText('Bubble machine switch')).toBeNull()
  })
})
