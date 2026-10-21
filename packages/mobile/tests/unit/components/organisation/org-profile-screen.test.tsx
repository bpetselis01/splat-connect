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
const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}))
const mockPush = jest.fn()
const mockRecord = jest.fn()
jest.mock('../../../../lib/recents', () => ({ recordRecent: (...a: unknown[]) => mockRecord(...a) }))

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
  it('P01 draws the counted profile in the board’s order', async () => {
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

  it('P02 P04 follows, and signs a thanks with a first name', async () => {
    load(relationship())
    // Two families thanked since this page loaded (2 then): the count is the server's, not 2 + 1.
    mockPost.mockResolvedValue({ thanks_count: 4 })
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
    expect(await screen.findByText('Thanked 4 times')).toBeTruthy()
  })

  it('P02 unfollows from Following with a DELETE and goes back to Follow', async () => {
    load(relationship({ following: true }))
    mockDelete.mockResolvedValue({})
    render(<OrgProfileScreen id="o1" />)
    fireEvent.press(await screen.findByText('Following'))
    await waitFor(() => expect(screen.getByText('Follow')).toBeTruthy())
    expect(mockDelete).toHaveBeenCalledWith('/api/organizations/o1/follow')
  })

  it('P05 asks a printing organisation to print with it already chosen', async () => {
    mockGet.mockImplementation((path: string) =>
      Promise.resolve(path.startsWith('/api/public') ? { ...ORG, printers: [{ id: 'p1', name: 'Prusa', materials: ['PETG'] }] } : relationship())
    )
    render(<OrgProfileScreen id="o1" />)
    fireEvent.press(await screen.findByText('Ask them to print'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/printing', params: { printWith: 'o1' } })
  })

  it('draws what the recycler takes in the board’s terms', async () => {
    mockGet.mockImplementation((path: string) =>
      Promise.resolve(
        path.startsWith('/api/public')
          ? {
              ...ORG,
              recycling_materials: ['PLA', 'PETG'],
              recycling_forms: ['Offcuts'],
              recycling_max_kg: 8,
              recycling_turnaround: 'About 3 weeks',
              recycling_gives: 'either',
              recycling_hours: 'Tue and Thu, 9am–4pm',
            }
          : relationship()
      )
    )
    render(<OrgProfileScreen id="o1" />)
    expect(await screen.findByText('They take waste plastic')).toBeTruthy()
    expect(screen.getByText('Offcuts')).toBeTruthy()
    expect(screen.getByText('2–8 kg · About 3 weeks')).toBeTruthy()
    expect(screen.getByText('Credit, or a spool')).toBeTruthy()
    expect(screen.getByText('Tue and Thu, 9am–4pm')).toBeTruthy()
  })

  it('P08 reads guide, toy and leader rows the way the board does, and expands past four', async () => {
    const guide = (i: number) => ({
      id: `g${i}`, title: `Guide ${i}`, difficulty: 'easy', build_minutes: 20, parts_total_cents: 2400,
      author_name: 'Rachel Kaur', toy_photo_url: null, status: 'approved',
    })
    load(null)
    mockGet.mockImplementation((path: string) =>
      Promise.resolve(
        path.startsWith('/api/public')
          ? {
              ...ORG,
              tutorialsBacked: [1, 2, 3, 4, 5].map(guide),
              toysShared: [{ id: 'y1', name: 'Light-up drum', condition: 9, offer_type: 'donation', quantity: 1, cover_photo_url: null }],
            }
          : null
      )
    )
    render(<OrgProfileScreen id="o1" />)
    expect(await screen.findByText('Guide 1')).toBeTruthy()
    expect(screen.getAllByText('Easy · 20 min · $24.00\nRachel Kaur')).toHaveLength(4)
    expect(screen.queryByText('Guide 5')).toBeNull()
    fireEvent.press(screen.getByRole('button', { name: 'All 5 →' }))
    expect(screen.getByText('Guide 5')).toBeTruthy()
    expect(screen.getByText('Gift · Like new')).toBeTruthy()
    expect(screen.getByText('3 guides backed')).toBeTruthy()
    expect(screen.getByText('RK')).toBeTruthy()
  })
})

describe('OrgProfileScreen report', () => {
  it('P09 Report a problem files an organisation report naming this organisation', async () => {
    mockPost.mockResolvedValue({})
    load(relationship())
    render(<OrgProfileScreen id="o1" />)
    await screen.findByText('Northbank Makerspace')
    fireEvent.press(screen.getByRole('button', { name: /Report a problem$/ }))
    expect(screen.getByText('About Northbank Makerspace profile. Goes to the SPLAT team only.')).toBeTruthy()
    fireEvent.press(screen.getByRole('radio', { name: 'Wrong or missing info' }))
    fireEvent.changeText(screen.getByLabelText('What happened?'), 'Wrong opening hours.')
    fireEvent.press(screen.getByRole('button', { name: 'Send report' }))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/reports', {
        subject_kind: 'organisation',
        subject_id: 'o1',
        subject_label: 'Northbank Makerspace',
        category: 'wrong_info',
        body: 'Wrong opening hours.',
        ok_to_contact: true,
      })
    )
    expect(await screen.findByText('Sent to SPLAT. You will hear back within two days.')).toBeTruthy()
  })
})

describe('org-profile helpers', () => {
  it('P07 routes a message door to the conversation and leaves events unlinked', () => {
    expect(doorRoute('message', 'o1')).toBe('/messages/org/o1')
    expect(doorRoute('events', 'o1')).toBeNull()
  })

  it('takes a first name and a year', () => {
    expect(firstName('Priya Nair')).toBe('Priya')
    expect(sinceYear('2024-03-01T00:00:00Z')).toBe(2024)
    expect(sinceYear(null)).toBeNull()
  })
})

describe('OrgProfileScreen recents', () => {
  it('records the organisation once, with its toy count and Verified badge', async () => {
    mockGet.mockImplementation((path: string) =>
      Promise.resolve(path.startsWith('/api/public') ? { ...ORG, toysShared: [{ id: 't1' }, { id: 't2' }] } : null)
    )
    render(<OrgProfileScreen id="o1" />)
    await screen.findByText('Northbank Makerspace')
    expect(mockRecord).toHaveBeenCalledTimes(1)
    expect(mockRecord).toHaveBeenCalledWith({
      id: 'o1', kind: 'organisation', title: 'Northbank Makerspace', subtitle: 'Organisation · 2 toys', badge: 'Verified',
      href: '/toy-library/organisation/o1',
    })
  })
})
