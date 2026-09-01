// packages/mobile/tests/unit/components/profile/child-profile-home.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { ChildProfileHome } from '../../../../components/profile/child-profile-home'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

// ErrorRow arrives via components/auth-screen, whose auth-context import
// reaches the live supabase client — same mock, same reason, as the other
// suites that borrow it.
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
}))

const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (effect: () => void) => useEffect(effect, []),
  }
})

const child = (over: object) => ({
  id: 'cp1',
  parent_id: 'u1',
  name: null,
  age: null,
  macs_level: null,
  macs_source: 'manual',
  hand_involvement: null,
  assist_hand: null,
  bfmf_score: null,
  bfmf_source: 'manual',
  challenges: [],
  challenge_other: null,
  grip_type: null,
  env_context: null,
  palm_width_mm: null,
  wrist_circ_mm: null,
  needs_arm_attachment: false,
  forearm_length_mm: null,
  hand_dominance: null,
  sensory_preferences: [],
  created_at: '',
  updated_at: '',
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue([])
})

describe('ChildProfileHome', () => {
  it('lists each child with its one-line summary, falling back per the spec', async () => {
    mockGet.mockResolvedValue([
      child({ id: 'cp1', name: 'Maya', age: 5 }),
      child({ id: 'cp2', name: null }),
    ])
    render(<ChildProfileHome />)

    expect(await screen.findByText('Maya')).toBeTruthy()
    expect(screen.getByText('Age 5')).toBeTruthy()
    // Unnamed children take their position; a blank profile says so plainly.
    expect(screen.getByText('Child 2')).toBeTruthy()
    expect(screen.getByText('Not set yet')).toBeTruthy()
  })

  it("opens a child's own editor", async () => {
    mockGet.mockResolvedValue([child({ id: 'cp7', name: 'Maya' })])
    render(<ChildProfileHome />)

    fireEvent.press(await screen.findByRole('button', { name: 'Maya' }))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/account/child/[id]', params: { id: 'cp7' } })
  })

  it('creates an empty profile and goes straight into it', async () => {
    mockPost.mockResolvedValue(child({ id: 'fresh' }))
    render(<ChildProfileHome />)

    fireEvent.press(await screen.findByRole('button', { name: '+ Add child' }))

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/child-profiles', {}))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/account/child/[id]', params: { id: 'fresh' } })
  })

  it('reports a failed load rather than claiming there are no children', async () => {
    mockGet.mockRejectedValue(new Error('down'))
    render(<ChildProfileHome />)

    expect(await screen.findByText("Couldn't load your child profiles — try again.")).toBeTruthy()
    expect(screen.queryByText(/No child profiles yet/)).toBeNull()
  })

  it('invites the first profile when there are none', async () => {
    render(<ChildProfileHome />)
    expect(await screen.findByText(/No child profiles yet/)).toBeTruthy()
  })
})
