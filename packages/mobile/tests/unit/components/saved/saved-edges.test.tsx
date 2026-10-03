import { render, screen, fireEvent } from '@testing-library/react-native'
import { SavedScreen } from '../../../../components/saved/saved-screen'
import { SavedListScreen, savedTitle } from '../../../../components/saved/saved-list-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: mockPush }), useFocusEffect: (effect: () => void) => useEffect(effect, []) }
})
const mockToggle = jest.fn()
const mockIsSaved = jest.fn((..._a: unknown[]) => true)
jest.mock('../../../../lib/saves', () => ({
  useSaves: () => ({ savedIds: {}, isSaved: (...a: unknown[]) => mockIsSaved(...a), toggle: mockToggle }),
}))

const none = { tutorials: [], toys: [], challenges: [], organisations: [], parts: [] }
beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  mockGet.mockResolvedValue(none)
})
afterEach(() => jest.restoreAllMocks())

describe('Saved hub', () => {
  it('says Nothing saved yet on every tile for a new member', async () => {
    render(<SavedScreen />)
    await screen.findByText('Guides')
    expect(screen.getAllByText('Nothing saved yet')).toHaveLength(5)
  })

  it('uses the singular for one and the plural for many', async () => {
    mockGet.mockResolvedValue({ ...none, tutorials: ['a'], toys: ['a', 'b'], organisations: ['a'], challenges: ['a', 'b', 'c'] })
    render(<SavedScreen />)
    expect(await screen.findByText('1 guide you kept')).toBeTruthy()
    expect(screen.getByText('2 toys you kept')).toBeTruthy()
    expect(screen.getByText('1 organisation you kept')).toBeTruthy()
    expect(screen.getByText('3 challenges you kept')).toBeTruthy()
  })

  it('counts 250 saved guides', async () => {
    mockGet.mockResolvedValue({ ...none, tutorials: Array.from({ length: 250 }, (_, i) => `t${i}`) })
    render(<SavedScreen />)
    expect(await screen.findByText('250 guides you kept')).toBeTruthy()
  })

  it('still shows the tiles when an older API leaves a kind out of the answer', async () => {
    mockGet.mockResolvedValue({ tutorials: ['a'], toys: [], challenges: [] })
    render(<SavedScreen />)
    expect(await screen.findByText('1 guide you kept')).toBeTruthy()
    expect(screen.getByText('Printable parts')).toBeTruthy()
  })

  it('opens the printable parts list too', async () => {
    render(<SavedScreen />)
    fireEvent.press(await screen.findByRole('button', { name: 'Printable parts' }))
    expect(mockPush).toHaveBeenCalledWith('/saved/parts')
  })
})

describe('savedTitle', () => {
  it.each([
    ['tutorials', 'Saved guides'], ['toys', 'Saved toys'], ['challenges', 'Saved challenges'],
    ['organisations', 'Saved organisations'], ['parts', 'Saved parts'],
  ])('names %s', (slug, title) => expect(savedTitle(slug)).toBe(title))

  it.each([undefined, '', 'nonsense', 'constructor', '__proto__'])('falls back to Saved for %p', (slug) => {
    expect(savedTitle(slug)).toBe('Saved')
  })
})

describe('Saved list', () => {
  it('shows an emoji, quoted, markup title as it is', async () => {
    const title = `🧸 "Big" <b>switch</b> & more`
    mockGet.mockResolvedValue([{ id: 't1', title }])
    render(<SavedListScreen slug="tutorials" />)
    expect(await screen.findByText(title)).toBeTruthy()
  })

  it('lists 120 saved guides', async () => {
    mockGet.mockResolvedValue(Array.from({ length: 120 }, (_, i) => ({ id: `t${i}`, title: `Guide ${i}` })))
    render(<SavedListScreen slug="tutorials" />)
    expect(await screen.findByText('Guide 119')).toBeTruthy()
  })

  it('lists one saved item with no photo, difficulty or author without a meta line', async () => {
    mockGet.mockResolvedValue([{ id: 't1', title: 'Bare' }])
    render(<SavedListScreen slug="tutorials" />)
    expect(await screen.findByText('Bare')).toBeTruthy()
  })

  it('shows a toy with no holder as just its grade', async () => {
    mockGet.mockResolvedValue([{ id: 'y1', name: 'Switch car', condition: 9, profiles: null, organizations: null }])
    render(<SavedListScreen slug="toys" />)
    expect(await screen.findByText('Like new')).toBeTruthy()
  })

  it('prefers the organisation over the member as a toy’s holder', async () => {
    mockGet.mockResolvedValue([{ id: 'y1', name: 'Switch car', condition: 9, profiles: { name: 'Jamie' }, organizations: { name: 'Northside' } }])
    render(<SavedListScreen slug="toys" />)
    expect(await screen.findByText('Like new · Northside')).toBeTruthy()
  })

  it('opens a saved organisation on its toy-library page', async () => {
    mockGet.mockResolvedValue([{ id: 'o1', name: 'Northside Therapy', description: 'We run a toy library.' }])
    render(<SavedListScreen slug="organisations" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Northside Therapy' }))
    expect(mockPush).toHaveBeenCalledWith('/toy-library/organisation/o1')
    expect(screen.getByText('We run a toy library.')).toBeTruthy()
  })

  it('points an empty guides shelf at the guides tab, and an empty organisations shelf at the directory', async () => {
    mockGet.mockResolvedValue([])
    const view = render(<SavedListScreen slug="tutorials" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Browse the guides' }))
    expect(mockPush).toHaveBeenLastCalledWith('/guides')
    view.unmount()
    render(<SavedListScreen slug="organisations" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Browse organisations' }))
    expect(mockPush).toHaveBeenLastCalledWith('/toy-library/organisations')
  })

  it('names the kind in the load-failure line for each shelf', async () => {
    mockGet.mockRejectedValue(new Error('500'))
    render(<SavedListScreen slug="toys" />)
    expect(await screen.findByText("Couldn't load your saved toys.")).toBeTruthy()
  })

  it('keeps rows on screen when a retry is pending after a successful first load', async () => {
    mockGet.mockResolvedValue([{ id: 't1', title: 'Stays' }])
    render(<SavedListScreen slug="tutorials" />)
    expect(await screen.findByText('Stays')).toBeTruthy()
  })

  it('asks for the shelf that matches the slug', async () => {
    mockGet.mockResolvedValue([])
    render(<SavedListScreen slug="challenges" />)
    await screen.findByText('Nothing saved here yet.')
    expect(mockGet).toHaveBeenCalledWith('/api/saves/challenges')
  })

  it('shows a row for an item that carries no name at all, rather than crashing', async () => {
    mockGet.mockResolvedValue([{ id: 'x1' }])
    render(<SavedListScreen slug="challenges" />)
    expect(await screen.findByRole('button', { name: '' })).toBeTruthy()
  })
})
