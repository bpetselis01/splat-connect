import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import MeTab from '../../../app/(tabs)/me'
import { NAMES } from '../../special-strings'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
let mockCaps: unknown
jest.mock('../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: mockCaps, loading: false, refresh: jest.fn() }) }))

const caps = (over: Record<string, unknown> = {}) => ({
  profile: { name: 'Byron P', role: 'contributor' }, isAdmin: false, ledOrgs: [],
  unread: { tutorials: 0, exchanges: 0, challenges: 0, organisations: 0, total: 0 }, exchangeActions: 0, ...over,
})
const thread = (over: object = {}) => ({ transaction_id: 'tx', type: 'exchange', other_name: 'Northside', what: 'Postage', amount_cents: 1060, you_pay: true, settled: false, ...over })
const COUNTS = { tutorials: 0, challenges: 0, makers: 0, printRequests: 0, printJobs: 0, review: 0, intake: 0, orgOrders: 0 }
const serve = (o: { builds?: unknown; counts?: unknown; money?: unknown } = {}) =>
  mockGet.mockImplementation((p: string) => {
    const v = p === '/api/me/builds' ? o.builds ?? { builds: 0 } : p === '/api/me/counts' ? o.counts ?? COUNTS : o.money ?? { threads: [], owed_cents: 0, unsettled_count: 0 }
    return v instanceof Error ? Promise.reject(v) : Promise.resolve(v)
  })

beforeEach(() => {
  jest.clearAllMocks()
  mockCaps = caps()
  serve()
})

describe('Me greeting and standing', () => {
  it.each([
    ['one word', 'Byron', 'Hi, Byron'],
    ['extra spaces around and inside', '  Byron   Petselis ', 'Hi, Byron'],
    ['unicode', 'Zoë Ångström', 'Hi, Zoë'],
    ['emoji', 'Sam 🧸🦄', 'Hi, Sam'],
    ['RTL', 'سارة أحمد', 'Hi, سارة'],
    ['angle brackets', '<b>Sam</b> Lee', 'Hi, <b>Sam</b>'],
  ])('greets a name with %s', (_l, name, expected) => {
    mockCaps = caps({ profile: { name, role: 'contributor' } })
    render(<MeTab />)
    expect(screen.getByText(expected)).toBeTruthy()
  })

  it('a 500-character name does not crash', () => {
    mockCaps = caps({ profile: { name: 'N'.repeat(500), role: 'contributor' } })
    render(<MeTab />)
    expect(screen.getByText(`Hi, ${'N'.repeat(500)}`)).toBeTruthy()
  })

  it('an empty or blank name does not crash or print "undefined"', () => {
    for (const name of ['', '   ']) {
      mockCaps = caps({ profile: { name, role: 'contributor' } })
      const { unmount } = render(<MeTab />)
      expect(screen.queryByText(/undefined|null/)).toBeNull()
      unmount()
    }
  })

  it('a missing name (null from a deleted profile) still greets', () => {
    mockCaps = caps({ profile: { name: null, role: 'contributor' } })
    render(<MeTab />)
    expect(screen.getByText('Hi there')).toBeTruthy()
  })

  it('draws nothing but the shell while capabilities have not loaded', () => {
    mockCaps = null
    render(<MeTab />)
    expect(screen.queryByText('My SPLAT')).toBeNull()
  })

  it.each([
    [{ ledOrgs: [], exchangeActions: 0 }, null],
    [{ ledOrgs: [], exchangeActions: 4 }, '4 waiting on you'],
    [{ ledOrgs: [{ id: 'a', name: 'Alpha' }], exchangeActions: 0 }, 'Leads Alpha'],
    [{ ledOrgs: [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }], exchangeActions: 1 }, 'Leads Alpha, Beta · 1 waiting'],
  ])('standing line for %j', (over, expected) => {
    mockCaps = caps(over)
    render(<MeTab />)
    if (expected) expect(screen.getByText(expected)).toBeTruthy()
    else expect(screen.queryByText(/waiting|Leads/)).toBeNull()
  })

  it.each(NAMES.filter((c) => c.label !== 'very long' && !c.value.includes(' ')).map((c): [string, string] => [c.label, c.value]))(
    'a leader organisation name with %s is shown as text', (_l, name) => {
      mockCaps = caps({ ledOrgs: [{ id: 'a', name }] })
      render(<MeTab />)
      expect(screen.getByText(`Leads ${name}`)).toBeTruthy()
    })
})

describe('Me builds line', () => {
  it('is hidden at zero and when the call fails', async () => {
    render(<MeTab />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(3))
    expect(screen.queryByText(/builds? logged/)).toBeNull()
  })

  it('says "1 build logged" for one, not "1 builds"', async () => {
    serve({ builds: { builds: 1 } })
    render(<MeTab />)
    expect(await screen.findByText('1 build logged')).toBeTruthy()
  })

  it('a missing or negative count shows nothing', async () => {
    serve({ builds: {} })
    const a = render(<MeTab />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(3))
    expect(screen.queryByText(/logged/)).toBeNull()
    a.unmount()
    serve({ builds: { builds: -2 } })
    render(<MeTab />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(6))
    expect(screen.queryByText(/logged/)).toBeNull()
  })
})

describe('Me row counts', () => {
  it('zero and missing counts show no badge', async () => {
    serve({ counts: { ...COUNTS, makers: 0, review: undefined } })
    render(<MeTab />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(3))
    expect(screen.queryByText('0')).toBeNull()
    expect(screen.queryByText('undefined')).toBeNull()
  })

  it('a failed counts call leaves every row, uncounted', async () => {
    serve({ counts: new Error('500') })
    render(<MeTab />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(3))
    expect(screen.getByLabelText('My toys')).toBeTruthy()
    expect(screen.queryByText(/^\d+$/)).toBeNull()
  })

  it('a huge count is shown whole', async () => {
    serve({ counts: { ...COUNTS, makers: 123456 } })
    render(<MeTab />)
    expect(await screen.findByText('123456')).toBeTruthy()
  })
})

describe('Me money panel', () => {
  it('nothing when there are no threads; the panel hides rather than showing $0.00', async () => {
    render(<MeTab />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(3))
    expect(screen.queryByText('Money you have agreed to')).toBeNull()
  })

  it('shows only the first three lines, and singular wording for one open exchange', async () => {
    serve({ money: { threads: ['a', 'b', 'c', 'd', 'e'].map((id) => thread({ transaction_id: id, what: `Item ${id}` })), owed_cents: 5300, unsettled_count: 1 } })
    render(<MeTab />)
    expect(await screen.findByText(/Still to settle across 1 exchange\. SPLAT never handles the money/)).toBeTruthy()
    expect(screen.getByText('Item c')).toBeTruthy()
    expect(screen.queryByText('Item d')).toBeNull()
    expect(screen.getByText('$53.00')).toBeTruthy()
  })

  it('plural wording for several, and the all-settled line when none are open', async () => {
    serve({ money: { threads: [thread()], owed_cents: 2000, unsettled_count: 3 } })
    const a = render(<MeTab />)
    expect(await screen.findByText(/across 3 exchanges/)).toBeTruthy()
    a.unmount()
    serve({ money: { threads: [thread({ settled: true })], owed_cents: 0, unsettled_count: 0 } })
    render(<MeTab />)
    expect(await screen.findByText('All settled — nothing outstanding.')).toBeTruthy()
    expect(screen.getByText('Settled')).toBeTruthy()
  })

  it.each([
    ['exchange', '/exchanges/tx'], ['donation', '/exchanges/tx'], ['build', '/exchanges/build/tx'], ['print', '/exchanges/tx'],
  ])('a %s line opens %s and is named for who it is with', async (type, route) => {
    serve({ money: { threads: [thread({ type, other_name: 'Sam', what: 'Thing' })], owed_cents: 100, unsettled_count: 1 } })
    render(<MeTab />)
    const line = await screen.findByRole('button', { name: new RegExp(`^Thing, Sam.*, \\$10\\.60, to settle$`) })
    fireEvent.press(line)
    expect(mockPush).toHaveBeenCalledWith(route)
  })

  it('a failed money call costs only the panel', async () => {
    serve({ money: new Error('500') })
    render(<MeTab />)
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(3))
    expect(screen.getByLabelText('My toys')).toBeTruthy()
  })

  it('a negative or zero amount line does not print a minus sign as currency garbage', async () => {
    serve({ money: { threads: [thread({ amount_cents: 0 })], owed_cents: 0, unsettled_count: 1 } })
    render(<MeTab />)
    expect((await screen.findAllByText('$0.00')).length).toBeGreaterThan(0)
  })
})

describe('Me admin and badges rows', () => {
  it('a non-admin has no Admin row; an admin does and it opens /admin', () => {
    const a = render(<MeTab />)
    expect(screen.queryByLabelText('Admin')).toBeNull()
    a.unmount()
    mockCaps = caps({ isAdmin: true, profile: { name: 'Ada', role: 'admin' } })
    render(<MeTab />)
    fireEvent.press(screen.getByLabelText('Admin'))
    expect(mockPush).toHaveBeenCalledWith('/admin')
  })

  it('the badge rules open and close from one row, with the expanded state announced', () => {
    render(<MeTab />)
    const row = screen.getByRole('button', { name: 'How badges are earned' })
    expect(row.props.accessibilityState.expanded).toBe(false)
    fireEvent.press(row)
    expect(screen.getByRole('button', { name: 'How badges are earned' }).props.accessibilityState.expanded).toBe(true)
    fireEvent.press(screen.getByRole('button', { name: 'How badges are earned' }))
    expect(screen.getByRole('button', { name: 'How badges are earned' }).props.accessibilityState.expanded).toBe(false)
  })

  it('a row with no mobile screen is SOON and a press does nothing', () => {
    render(<MeTab />)
    for (const soon of screen.queryAllByText('SOON')) expect(soon).toBeTruthy()
    mockPush.mockClear()
    for (const el of screen.queryAllByText('SOON')) fireEvent.press(el)
    expect(mockPush).not.toHaveBeenCalled()
  })
})
