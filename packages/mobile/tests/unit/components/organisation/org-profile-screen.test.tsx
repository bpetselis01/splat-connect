// packages/mobile/tests/unit/components/organisation/org-profile-screen.test.tsx
// The board's organisation profile on the phone (076/077): the counted stats,
// the doors, "From families", and the three buttons — a leader sees none of
// them, a signed-out visitor goes to sign-in, and a thanks is signed with a
// first name unless they type something else.
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { OrgProfileScreen } from '../../../../components/organisation/org-profile-screen'
import { doorRoute, sinceYear } from '../../../../lib/org-profile'
import { useAuth } from '../../../../lib/auth-context'
import { firstName } from '@splat-connect/types'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { profile: { id: 'u1', name: 'Priya Nair' } } }),
}))

const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    delete: jest.fn(),
  },
}))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

const ORG = {
  id: 'o1',
  name: 'Northbank Makerspace',
  status: 'active',
  kind: 'University makerspace',
  suburb: 'Callaghan',
  state: 'NSW',
  created_at: '2024-03-01T00:00:00Z',
  verified_at: '2026-09-01T00:00:00Z',
  thanks_count: 2,
  about: 'Students adapting toys.',
  tutorialsBacked: [],
  tutorialsApproved: [],
  toysShared: [],
  toysDelivered: [],
  counts: { guidesBacked: 4, toysDelivered: 1, partsPrinted: 30, familiesHelped: 12 },
  doors: [{ id: 'd1', org_id: 'o1', position: 1, title: 'Message us', body: 'Any question.', target: 'message' }],
  fromFamilies: [{ quote: 'Changed our Thursdays.', by: 'Sam', source: 'thanks', at: '2026-09-01' }],
  leaders: [{ name: 'Rachel Kaur', guides_backed: 3 }],
}

const relationship = (over: object = {}) => ({ leads: false, following: false, thanks: null, conversation_id: null, ...over })

beforeEach(() => {
  jest.clearAllMocks()
  ;(useAuth as jest.Mock).mockReturnValue({ session: { user: { id: 'u1' } } })
})

function load(me: object | null) {
  mockGet.mockImplementation((path: string) => Promise.resolve(path.startsWith('/api/public') ? ORG : me))
}

describe('OrgProfileScreen', () => {
  it('draws the counted profile in the board’s order', async () => {
    load(relationship())
    render(<OrgProfileScreen id="o1" />)
    expect(await screen.findByText('Northbank Makerspace')).toBeTruthy()
    expect(screen.getByText('Verified by SPLAT')).toBeTruthy()
    expect(screen.getByText('University makerspace · Callaghan, NSW · On SPLAT since 2024')).toBeTruthy()
    expect(screen.getByText('Thanked 2 times')).toBeTruthy()
    expect(screen.getByText('families helped')).toBeTruthy()
    expect(screen.getByText('30')).toBeTruthy()
    expect(screen.getByText('“Changed our Thursdays.”')).toBeTruthy()
    expect(screen.getByText('3 guides backed')).toBeTruthy()
  })

  it('shows a leader no buttons', async () => {
    load(relationship({ leads: true }))
    render(<OrgProfileScreen id="o1" />)
    expect(await screen.findByText('You lead Northbank Makerspace.')).toBeTruthy()
    expect(screen.queryByText('Follow')).toBeNull()
  })

  it('sends a signed-out visitor to sign in', async () => {
    ;(useAuth as jest.Mock).mockReturnValue({ session: null })
    load(null)
    render(<OrgProfileScreen id="o1" />)
    fireEvent.press(await screen.findByText('Follow'))
    expect(mockPush).toHaveBeenCalledWith('/sign-in')
    expect(mockGet).not.toHaveBeenCalledWith('/api/organizations/o1/me')
  })

  it('follows, and signs a thanks with a first name', async () => {
    load(relationship())
    mockPost.mockResolvedValue({})
    render(<OrgProfileScreen id="o1" />)
    fireEvent.press(await screen.findByText('Follow'))
    await waitFor(() => expect(screen.getByText('Following')).toBeTruthy())
    expect(mockPost).toHaveBeenCalledWith('/api/organizations/o1/follow', {})

    fireEvent.press(screen.getByText('Say thanks to Northbank Makerspace'))
    expect(screen.getByDisplayValue('Priya')).toBeTruthy()
    fireEvent.changeText(screen.getByPlaceholderText('What they did, in a sentence.'), 'Thank you.')
    fireEvent.press(screen.getByText('Send thanks'))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/organizations/o1/thanks', {
        note: 'Thank you.',
        byline: 'Priya',
        show_note: true,
      })
    )
    expect(await screen.findByText('Thanked 3 times')).toBeTruthy()
  })
})

describe('org-profile helpers', () => {
  it('routes a message door to the conversation and leaves events unlinked', () => {
    expect(doorRoute('message', 'o1')).toBe('/messages/org/o1')
    expect(doorRoute('events', 'o1')).toBeNull()
  })

  it('takes a first name and a year', () => {
    expect(firstName('Priya Nair')).toBe('Priya')
    expect(sinceYear('2024-03-01T00:00:00Z')).toBe(2024)
    expect(sinceYear(null)).toBeNull()
  })
})
