// packages/mobile/tests/unit/app/admin.test.tsx
// journeys: Q17
import { render, screen, fireEvent } from '@testing-library/react-native'
import { Linking } from 'react-native'
import MyAdmin from '../../../app/(my)/admin'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
const mockGet = jest.fn()
jest.mock('../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))

let mockCaps: unknown = { isAdmin: true }
jest.mock('../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: mockCaps, loading: false }) }))

beforeEach(() => {
  mockCaps = { isAdmin: true }
  jest.clearAllMocks()
  mockGet.mockResolvedValue({ tutorials: 7, reports: 2, ideas: 3, spotCheck: 5, accounts: 57, organisations: 14 })
})

describe('MyAdmin seat guard (S7)', () => {
  it('a non-admin deep link shows no cards and never asks for the counts', () => {
    mockCaps = { isAdmin: false }
    render(<MyAdmin />)
    expect(screen.queryByRole('button', { name: /Reports from members/ })).toBeNull()
    expect(screen.getByText(/belongs to admins/)).toBeTruthy()
    expect(mockGet).not.toHaveBeenCalled()
  })
})

describe('MyAdmin', () => {
  it('opens the review queue on the phone, not the web', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    render(<MyAdmin />)
    fireEvent.press(await screen.findByRole('button', { name: 'Tutorials awaiting review, 7' }))
    expect(mockPush).toHaveBeenCalledWith('/admin/review')
    expect(open).not.toHaveBeenCalled()
    open.mockRestore()
  })

  it("shows the board's six counts, reports and ideas opening on the phone, the other three on the web", async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    render(<MyAdmin />)
    expect(await screen.findByText('57')).toBeTruthy()
    expect(screen.getByText('7')).toBeTruthy()
    for (const [label, count, route] of [
      ['Reports from members', '2', '/admin/reports'],
      ['Ideas awaiting review', '3', '/admin/ideas'],
    ] as const) {
      fireEvent.press(screen.getByRole('button', { name: `${label}, ${count}` }))
      expect(mockPush).toHaveBeenCalledWith(route)
    }
    expect(open).not.toHaveBeenCalled()
    for (const [label, count, path] of [
      ['Spot-check', '5', '/admin/spot-check'],
      ['Accounts', '57', '/admin/contributors'],
      ['Organisations', '14', '/admin/organizations'],
    ] as const) {
      expect(screen.getByText(count)).toBeTruthy()
      fireEvent.press(screen.getByRole('button', { name: `${label}, ${count}` }))
      expect(open).toHaveBeenCalledWith(`${process.env.EXPO_PUBLIC_WEB_URL}${path}`)
    }
    open.mockRestore()
  })

  it('still lists the six queues, uncounted, when the counts fail', async () => {
    mockGet.mockRejectedValue(new Error('500'))
    render(<MyAdmin />)
    expect(await screen.findByRole('button', { name: 'Reports from members' })).toBeTruthy()
  })
})
