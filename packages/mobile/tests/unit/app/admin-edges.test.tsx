// journeys: Q17
import { render, screen } from '@testing-library/react-native'
import MyAdmin from '../../../app/(my)/admin'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))

jest.mock('../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: { isAdmin: true }, loading: false }) }))

const six ={ tutorials: 7, reports: 2, ideas: 3, spotCheck: 5, accounts: 57, organisations: 14 }
beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

describe('MyAdmin counts', () => {
  it('shows a genuine zero as 0, not as nothing', async () => {
    mockGet.mockResolvedValue({ ...six, reports: 0 })
    render(<MyAdmin />)
    expect(await screen.findByRole('button', { name: 'Reports from members, 0' })).toBeTruthy()
    expect(screen.getByText('0')).toBeTruthy()
  })

  it('shows five-figure counts whole', async () => {
    mockGet.mockResolvedValue({ ...six, accounts: 12345 })
    render(<MyAdmin />)
    expect(await screen.findByText('12345')).toBeTruthy()
  })

  it('leaves a card uncounted, never reading "undefined" or "null", when the API omits or nulls its count', async () => {
    mockGet.mockResolvedValue({ ...six, spotCheck: undefined, ideas: null })
    render(<MyAdmin />)
    expect(await screen.findByText('57')).toBeTruthy()
    expect(screen.queryByText('undefined')).toBeNull()
    expect(screen.queryByText('null')).toBeNull()
    expect(screen.getByRole('button', { name: 'Spot-check' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ideas awaiting review' })).toBeTruthy()
  })

  it('a non-admin (the API answers 403) sees six cards and not one number', async () => {
    mockGet.mockRejectedValue(new Error('Request failed with status 403: Admin only'))
    render(<MyAdmin />)
    expect(await screen.findAllByRole('button')).toHaveLength(6)
    expect(screen.queryByText(/^\d+$/)).toBeNull()
  })

  it('asks the counts endpoint exactly once', async () => {
    mockGet.mockResolvedValue(six)
    render(<MyAdmin />)
    await screen.findByText('57')
    expect(mockGet).toHaveBeenCalledTimes(1)
    expect(mockGet).toHaveBeenCalledWith('/api/admin/counts')
  })

  it('a late answer after leaving the screen does not throw', async () => {
    let resolve!: (v: unknown) => void
    mockGet.mockReturnValue(new Promise((r) => { resolve = r }))
    const view = render(<MyAdmin />)
    view.unmount()
    resolve(six)
    await Promise.resolve()
  })
})
