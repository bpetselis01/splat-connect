import { render, screen, fireEvent } from '@testing-library/react-native'
import { MemberReportsScreen } from '../../../../components/admin/member-reports-screen'
import { IdeaReportDetailScreen } from '../../../../components/admin/idea-report-detail-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
const mockPatch = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), patch: (...a: unknown[]) => mockPatch(...a) },
}))
const mockBack = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: jest.fn(), back: mockBack }), useFocusEffect: (effect: () => void) => useEffect(effect, [effect]) }
})

const forbidden = Object.assign(new Error('GET failed with status 403: Forbidden'), { status: 403 })
const row = {
  id: 'ir1', idea_id: 'i1', reported_profile_id: 'p1', reason: 'Rude.', created_at: '2026-10-01T00:00:00Z',
  resolved_at: null, resolution_note: null, removed: false,
  toy_ideas: { title: 'Ladybug switch' }, reported_profile: { name: 'Sam' }, reporter: { name: 'Priya' },
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

describe('idea reports failures', () => {
  it('shows "Admins only" on the tab when the read is forbidden', async () => {
    mockGet.mockRejectedValue(forbidden)
    render(<MemberReportsScreen />)
    fireEvent.press(await screen.findByRole('tab', { name: 'Idea reports' }))
    expect((await screen.findAllByText('Admins only')).length).toBeGreaterThan(0)
  })

  it('shows the server sentence word for word when removing the author is refused', async () => {
    mockGet.mockResolvedValue([row])
    mockPatch.mockRejectedValue(
      new Error("PATCH failed with status 409: The reported person wrote this challenge and can't be removed. Dismiss the report instead."),
    )
    render(<IdeaReportDetailScreen reportId="ir1" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Remove' }))
    expect(await screen.findByText("The reported person wrote this challenge and can't be removed. Dismiss the report instead.")).toBeTruthy()
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('says so when the report is gone', async () => {
    mockGet.mockResolvedValue([])
    render(<IdeaReportDetailScreen reportId="ir1" />)
    expect(await screen.findByText("That report isn't here any more.")).toBeTruthy()
  })

  it('offline: says so, logs nothing, and Try again fetches it again', async () => {
    let failed = false
    mockGet.mockImplementation((path: string) => {
      if (path !== '/api/admin/reports') return Promise.resolve([])
      if (failed) return Promise.resolve([row])
      failed = true
      return Promise.reject(new TypeError('Network request failed'))
    })
    render(<MemberReportsScreen />)
    fireEvent.press(await screen.findByRole('tab', { name: 'Idea reports' }))
    expect(await screen.findByText("Couldn't load the queue.")).toBeTruthy()
    expect(console.error).not.toHaveBeenCalled()
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Sam in Ladybug switch')).toBeTruthy()
  })
})
