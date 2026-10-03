// packages/mobile/tests/unit/components/guides/showcase-screen.test.tsx
import { fireEvent, render, screen } from '@testing-library/react-native'
import { ShowcaseScreen } from '../../../../components/guides/showcase-screen'

// Ionicons loads its font asynchronously and setStates after the test ends;
// stub it to a host string so there's no act() warning noise, same as
// library-screen.test.tsx and detail-screen.test.tsx.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
let mockUser: string | null = null
jest.mock('../../../../lib/auth-context', () => ({ useAuth: () => ({ session: mockUser ? { user: { id: mockUser } } : null }) }))

const tutorial = (over: object) => ({
  id: 't1', title: 'Build a Robot Arm', description: null, difficulty: 'easy', kind: 'toy_adaptation',
  status: 'approved', tutorial_pdf_url: null, photo_urls: [], toy_photo_url: null, rejection_note: null,
  created_at: '', updated_at: '', reviewed_at: null, reviewed_by: null, reviewed_for_org_id: null, ...over,
})

const toy = (over: object) => ({
  id: 'ty1', owner_id: null, owner_org_id: 'o1', quantity: 1, name: 'Bubble machine', description: null,
  condition: 5, switch_adapted: true, cover_photo_url: null, switch_photo_urls: [], status: 'published',
  offer_type: null, created_at: '', updated_at: '', ...over,
})

const PERSON = {
  id: 'c1',
  name: 'Sam Taylor',
  tutorials: [tutorial({ id: 't1', title: 'Build a Robot Arm', build_minutes: 20, view_count: 2100 })],
  toysShared: [],
  toysDelivered: [toy({ id: 'd1' }), toy({ id: 'd2' })],
  bio: 'I run a switch clinic on Thursdays.',
  thanks: 41,
  created_at: '2025-03-10T00:00:00Z',
}

const ORG = {
  id: 'o1',
  name: 'TAD Australia',
  status: 'approved',
  tutorialsBacked: [tutorial({ id: 't2', title: 'Head Switch Arm' })],
  tutorialsApproved: [],
  toysShared: [toy({ id: 'ty1', name: 'Bubble machine', quantity: 3 })],
  toysDelivered: [],
}

describe('ShowcaseScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUser = null
  })

  it('shows the next badge on your own profile only', async () => {
    mockGet.mockResolvedValue(PERSON)
    mockUser = 'c1'
    const own = render(<ShowcaseScreen kind="person" id="c1" />)
    expect(await screen.findByText('9 more guides for 10 guides')).toBeTruthy()
    own.unmount()
    mockUser = 'someone-else'
    render(<ShowcaseScreen kind="person" id="c1" />)
    await screen.findByText('Sam Taylor')
    expect(screen.queryByText('9 more guides for 10 guides')).toBeNull()
  })

  it('renders a contributor profile with their guides and no toys section', async () => {
    mockGet.mockResolvedValue(PERSON)
    render(<ShowcaseScreen kind="person" id="c1" />)
    expect(await screen.findByText('Sam Taylor')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/public/contributors/c1')
    expect(screen.getByText('Published guides')).toBeTruthy()
    expect(screen.getByText('Build a Robot Arm')).toBeTruthy()
    expect(screen.getByText('Joined March 2025')).toBeTruthy()
    expect(screen.getByText('1 guide')).toBeTruthy()
    expect(screen.getByText('2 toys delivered')).toBeTruthy()
    expect(screen.getByText('Thanked 41 times')).toBeTruthy()
    expect(screen.getByText('I run a switch clinic on Thursdays.')).toBeTruthy()
    expect(screen.getByText('Easy · 20 min · 2.1k views')).toBeTruthy()
    expect(screen.queryByText('Toys on their shelf')).toBeNull()
    // A person's rows carry the board's meta line in place of the badges.
    expect(screen.queryByText('Easy', { includeHiddenElements: true })).toBeNull()
    expect(screen.getByLabelText('Build a Robot Arm').props.accessibilityHint).toContain('Toy adaptation')
  })

  it('renders an organisation profile with the guides it backs and its toy shelf', async () => {
    mockGet.mockResolvedValue(ORG)
    render(<ShowcaseScreen kind="org" id="o1" />)
    expect(await screen.findByText('TAD Australia')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/public/organizations/o1')
    expect(screen.getByText('Guides they back')).toBeTruthy()
    expect(screen.getByText('Head Switch Arm')).toBeTruthy()
    expect(screen.getByText('1 guides · 1 toys shared')).toBeTruthy()
    expect(screen.getByText('Toys on their shelf')).toBeTruthy()
    expect(screen.getByText('Bubble machine')).toBeTruthy()
    expect(screen.getByText('3 available')).toBeTruthy()
    // Badges are hidden from the accessibility tree, same as library-screen's
    // TutorialRow — the row's hint carries difficulty and kind instead.
    expect(screen.queryByText('Easy')).toBeNull()
    expect(screen.getAllByText('Easy', { includeHiddenElements: true }).length).toBe(1)
  })

  it('shows an error message when apiClient.get rejects', async () => {
    mockGet.mockRejectedValue(new Error('API GET failed with status 500'))
    render(<ShowcaseScreen kind="person" id="c1" />)
    expect(await screen.findByText("Couldn't load this profile.")).toBeTruthy()
  })

  it('says nothing about a bio or a join date the profile does not have', async () => {
    mockGet.mockResolvedValue({ ...PERSON, bio: null, created_at: undefined, thanks: 1 })
    render(<ShowcaseScreen kind="person" id="c1" />)
    expect(await screen.findByText('Thanked 1 time')).toBeTruthy()
    expect(screen.queryByText(/^Joined/)).toBeNull()
    expect(screen.queryByLabelText(/^Organisation:/)).toBeNull()
  })

  it('says what they do and chips the organisation they lead', async () => {
    mockGet.mockResolvedValue({ ...PERSON, occupation: 'Occupational therapist', org: { id: 'o1', name: 'TAD Australia' } })
    render(<ShowcaseScreen kind="person" id="c1" />)
    expect(await screen.findByText('Occupational therapist')).toBeTruthy()
    fireEvent.press(screen.getByLabelText('Organisation: TAD Australia'))
    expect(mockPush).toHaveBeenCalledWith('/guides/organisation/o1')
  })
})
