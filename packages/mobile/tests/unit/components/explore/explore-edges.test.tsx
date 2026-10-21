import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { ExploreScreen } from '../../../../components/explore/explore-screen'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('../../../../lib/learn', () => ({ useLearnProgress: () => ({ count: 0 }) }))

type Sources = { tutorials?: unknown; toys?: unknown; orgs?: unknown; impact?: unknown }
const serve = ({ tutorials = [], toys = [], orgs = [], impact }: Sources = {}) =>
  mockGet.mockImplementation((p: string) => {
    const v = p === '/api/public/tutorials' ? tutorials : p === '/api/public/toys' ? toys : p === '/api/public/organizations' ? orgs : impact ?? Promise.reject(new Error('none'))
    return v instanceof Error ? Promise.reject(v) : Promise.resolve(v)
  })
const search = (q: string) => fireEvent.changeText(screen.getByPlaceholderText('Search guides, toys, organisations'), q)
const ready = () => waitFor(() => expect(mockGet).toHaveBeenCalledTimes(4))

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
  serve({ tutorials: [{ id: 'g1', title: 'Bubble machine' }], toys: [{ id: 't1', name: 'Switch car' }], orgs: [{ id: 'o1', name: 'TAD Australia' }] })
})

describe('Explore search', () => {
  it.each([['spaces', '    '], ['tabs and newlines', '\t\n ']])('Q13 whitespace-only (%s) searches for nothing', async (_l, q) => {
    render(<ExploreScreen />); await ready()
    search(q)
    expect(screen.queryByText('Guides')).toBeNull()
    expect(screen.queryByText('Switch car')).toBeNull()
  })

  it('Q13 matches case-insensitively and ignores leading and trailing spaces', async () => {
    render(<ExploreScreen />); await ready()
    search('  SWITCH CAR ')
    expect(await screen.findByText('Switch car')).toBeTruthy()
  })

  it('Q13 matches in the middle of a name', async () => {
    render(<ExploreScreen />); await ready()
    search('ubble mac')
    expect(await screen.findByText('Bubble machine')).toBeTruthy()
  })

  it.each([['.*'], ['('], ['['], ['\\'], ['^$'], ['a|b'], ['?']])('Q13 regex character %p is searched literally, not as a pattern', async (q) => {
    render(<ExploreScreen />); await ready()
    search(q)
    expect(screen.queryByText('Switch car')).toBeNull()
    expect(screen.queryByText('Bubble machine')).toBeNull()
  })

  it('Q13 a query with no match shows no groups at all, and the doors stay', async () => {
    render(<ExploreScreen />); await ready()
    search('zzzz')
    expect(screen.queryByText('Guides')).toBeNull()
    expect(screen.getByText('Learn')).toBeTruthy()
  })

  it('Q13 a 5,000-character query does not crash and matches nothing', async () => {
    render(<ExploreScreen />); await ready()
    search('x'.repeat(5000))
    expect(screen.queryByText('Switch car')).toBeNull()
  })

  it('Q13 finds names with apostrophes, ampersands, emoji, RTL and angle brackets', async () => {
    const names = ["O'Brien's toys", 'Tom & Jerry', 'Sam 🧸', 'سارة', '<b>Bold</b>']
    serve({ toys: names.map((name, i) => ({ id: `t${i}`, name })) })
    render(<ExploreScreen />); await ready()
    for (const n of names) {
      search(n)
      expect(await screen.findByText(n)).toBeTruthy()
    }
  })

  it.each(NAMES.filter((c) => c.label !== 'very long' && c.label !== 'leading/trailing spaces').map((c): [string, string] => [c.label, c.value]))(
    'Q13 a search for a %s organisation name finds that organisation', async (_l, name) => {
      serve({ orgs: [{ id: 'o9', name }] })
      render(<ExploreScreen />); await ready()
      search(name)
      fireEvent.press(await screen.findByLabelText(name))
      expect(mockPush).toHaveBeenCalledWith('/toy-library/organisation/o9')
    })

  it('Q13 shows every match from 1,000 toys and each opens its own page', async () => {
    serve({ toys: Array.from({ length: 1000 }, (_, i) => ({ id: `t${i}`, name: `Drum ${i}` })) })
    render(<ExploreScreen />); await ready()
    search('drum')
    expect(await screen.findByText('Drum 999')).toBeTruthy()
    fireEvent.press(screen.getByLabelText('Drum 500'))
    expect(mockPush).toHaveBeenCalledWith('/toy-library/t500')
  })

  it('Q13 two toys with the same name both appear and open different pages', async () => {
    serve({ toys: [{ id: 'a', name: 'Drum' }, { id: 'b', name: 'Drum' }] })
    render(<ExploreScreen />); await ready()
    search('drum')
    const rows = await screen.findAllByLabelText('Drum')
    fireEvent.press(rows[1])
    expect(mockPush).toHaveBeenCalledWith('/toy-library/b')
  })

  it('Q13 a record with a missing name or title is skipped, not a crash for everyone else', async () => {
    serve({
      tutorials: [{ id: 'g0', title: null }, { id: 'g1', title: 'Bubble machine' }],
      toys: [{ id: 't0', name: null }, { id: 't1', name: 'Switch car' }],
      orgs: [{ id: 'o0' }, { id: 'o1', name: 'TAD Australia' }],
    })
    render(<ExploreScreen />); await ready()
    search('a')
    expect(await screen.findByText('Switch car')).toBeTruthy()
    expect(screen.getByText('Bubble machine')).toBeTruthy()
    expect(screen.getByText('TAD Australia')).toBeTruthy()
  })

  it('all three sources failing shows the retry row and an empty search, not a crash', async () => {
    serve({ tutorials: new Error('500'), toys: new Error('500'), orgs: new Error('500') })
    render(<ExploreScreen />); await ready()
    expect(await screen.findByText("Couldn't load everything — try again.")).toBeTruthy()
    search('a')
    expect(screen.queryByText('Guides')).toBeNull()
  })

  it('Try again hides the error row while the reload is in flight, so it cannot be double-tapped', async () => {
    serve({ tutorials: new Error('500') })
    render(<ExploreScreen />); await ready()
    await screen.findByText("Couldn't load everything — try again.")
    let resolve!: (v: unknown) => void
    mockGet.mockImplementation(() => new Promise((r) => { resolve = r }))
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    resolve([])
  })
})

describe('Explore community stats', () => {
  const totals = (over: object = {}) => ({ totals: { tutorials: 142, toysShared: 20, toysDelivered: 318, contributors: 57, organisations: 14, ...over } })

  it('a brand-new community shows zeros, not blanks', async () => {
    serve({ impact: totals({ tutorials: 0, toysDelivered: 0, contributors: 0, organisations: 0 }) })
    render(<ExploreScreen />)
    expect(await screen.findByText('This community so far')).toBeTruthy()
    expect(screen.getAllByText('0')).toHaveLength(4)
  })

  it('large numbers show whole', async () => {
    serve({ impact: totals({ toysDelivered: 1234567 }) })
    render(<ExploreScreen />)
    expect(await screen.findByText('1234567')).toBeTruthy()
  })

  it('a count the API leaves out is not shown as "undefined" or "null"', async () => {
    serve({ impact: totals({ contributors: undefined, tutorials: null }) })
    render(<ExploreScreen />)
    expect(await screen.findByText('This community so far')).toBeTruthy()
    expect(screen.queryByText('undefined')).toBeNull()
    expect(screen.queryByText('null')).toBeNull()
    expect(screen.getByText('318')).toBeTruthy()
  })

  it('an impact response with no totals at all hides the block', async () => {
    serve({ impact: {} })
    render(<ExploreScreen />); await ready()
    expect(screen.queryByText('This community so far')).toBeNull()
  })
})
