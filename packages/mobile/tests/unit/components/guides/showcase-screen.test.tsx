// packages/mobile/tests/unit/components/guides/showcase-screen.test.tsx
import { render, screen } from '@testing-library/react-native'
import { ShowcaseScreen } from '../../../../components/guides/showcase-screen'

// Ionicons loads its font asynchronously and setStates after the test ends;
// stub it to a host string so there's no act() warning noise, same as
// library-screen.test.tsx and detail-screen.test.tsx.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))

const tutorial = (over: object) => ({
  id: 't1', title: 'Build a Robot Arm', description: null, difficulty: 'easy', kind: 'toy_adaptation',
  status: 'approved', tutorial_pdf_url: null, toy_photo_url: null, rejection_note: null,
  created_at: '', updated_at: '', reviewed_at: null, reviewed_by: null, reviewed_for_org_id: null, ...over,
})

const toy = (over: object) => ({
  id: 'ty1', owner_id: null, owner_org_id: 'o1', quantity: 1, name: 'Bubble machine', description: null,
  condition: 5, switch_adapted: true, cover_photo_url: null, switch_photo_urls: [], status: 'published',
  offer_type: null, archived_at: null, created_at: '', updated_at: '', ...over,
})

const PERSON = {
  id: 'c1',
  name: 'Sam Taylor',
  tutorials: [tutorial({ id: 't1', title: 'Build a Robot Arm' })],
  toysShared: [],
  toysDelivered: [],
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
  })

  it('renders a contributor profile with their guides and no toys section', async () => {
    mockGet.mockResolvedValue(PERSON)
    render(<ShowcaseScreen kind="person" id="c1" />)
    expect(await screen.findByText('Sam Taylor')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/public/contributors/c1')
    expect(screen.getByText('Guides by Sam')).toBeTruthy()
    expect(screen.getByText('Build a Robot Arm')).toBeTruthy()
    expect(screen.getByText('1 guides · 0 toys shared')).toBeTruthy()
    expect(screen.queryByText('Toys on their shelf')).toBeNull()
    // Badges are hidden from the accessibility tree, same as library-screen's
    // TutorialRow — the row's hint carries difficulty and kind instead.
    expect(screen.queryByText('EASY')).toBeNull()
    expect(screen.getAllByText('EASY', { includeHiddenElements: true }).length).toBe(1)
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
    expect(screen.getByText('3 AVAILABLE')).toBeTruthy()
  })

  it('shows an error message when apiClient.get rejects', async () => {
    mockGet.mockRejectedValue(new Error('API GET failed with status 500'))
    render(<ShowcaseScreen kind="person" id="c1" />)
    expect(await screen.findByText("Couldn't load this profile.")).toBeTruthy()
  })
})
