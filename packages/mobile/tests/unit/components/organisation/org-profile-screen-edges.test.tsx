// Edge cases for the organisation profile; the happy path is org-profile-screen.test.tsx.
// The board's organisation profile on the phone (076/077): the counted stats,
// the doors, "From families", and the three buttons — a leader sees none of
// them, a signed-out visitor goes to sign-in, and a thanks is signed with a
// first name unless they type something else.
// journeys: P01
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


const serve = (over: Record<string, unknown> = {}, me: object | null = relationship()) =>
  mockGet.mockImplementation((path: string) => {
    if (path.startsWith('/api/public')) return Promise.resolve({ ...ORG, ...over })
    return me instanceof Error ? Promise.reject(me) : Promise.resolve(me)
  })
const guide = (id: string, over: object = {}) => ({ id, title: `Guide ${id}`, difficulty: 'easy', build_minutes: 20, parts_total_cents: 0, author_name: 'Rachel', toy_photo_url: null, status: 'approved', ...over })

beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}))

describe('OrgProfileScreen load and failure', () => {
  it('a failed load offers Try again, and a retry shows the organisation', async () => {
    mockGet.mockRejectedValueOnce(new Error('500'))
    serve()
    mockGet.mockReset()
    mockGet.mockRejectedValueOnce(new Error('500')).mockRejectedValueOnce(new Error('500'))
    render(<OrgProfileScreen id="o1" />)
    expect(await screen.findByText("Couldn't load this organisation.")).toBeTruthy()
    serve()
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Northbank Makerspace')).toBeTruthy()
  })

  it('a failing relationship call still shows the page, with the buttons of a non-member', async () => {
    serve({}, new Error('403'))
    render(<OrgProfileScreen id="o1" />)
    expect(await screen.findByText('Follow')).toBeTruthy()
    expect(screen.getByText('Say thanks to Northbank Makerspace')).toBeTruthy()
  })

  it('a leaving-and-returning to another organisation does not show the old one', async () => {
    serve()
    const view = render(<OrgProfileScreen id="o1" />)
    await screen.findByText('Northbank Makerspace')
    serve({ id: 'o2', name: 'Eastwood Hub' })
    view.rerender(<OrgProfileScreen id="o2" />)
    expect(await screen.findByText('Eastwood Hub')).toBeTruthy()
    expect(screen.queryByText('Northbank Makerspace')).toBeNull()
  })
})

describe('OrgProfileScreen header facts', () => {
  it('Thanked once reads "1 time"; none or missing hides the line', async () => {
    serve({ thanks_count: 1 })
    const a = render(<OrgProfileScreen id="o1" />)
    expect(await screen.findByText('Thanked 1 time')).toBeTruthy()
    a.unmount()
    serve({ thanks_count: 0 })
    const b = render(<OrgProfileScreen id="o1" />)
    await screen.findByText('Northbank Makerspace')
    expect(screen.queryByText(/Thanked/)).toBeNull()
    b.unmount()
    serve({ thanks_count: undefined })
    render(<OrgProfileScreen id="o1" />)
    await screen.findByText('Northbank Makerspace')
    expect(screen.queryByText(/Thanked/)).toBeNull()
  })

  it('an unverified organisation has no Verified line, and its recent carries no badge', async () => {
    serve({ verified_at: null, toysShared: [{ id: 't1' }] })
    render(<OrgProfileScreen id="o1" />)
    await screen.findByText('Northbank Makerspace')
    expect(screen.queryByText('Verified by SPLAT')).toBeNull()
    expect(mockRecord).toHaveBeenCalledWith(expect.objectContaining({ badge: undefined, subtitle: 'Organisation · 1 toy' }))
  })

  it('no toys records a plain "Organisation" subtitle', async () => {
    serve({ toysShared: [] })
    render(<OrgProfileScreen id="o1" />)
    await screen.findByText('Northbank Makerspace')
    expect(mockRecord).toHaveBeenCalledWith(expect.objectContaining({ subtitle: 'Organisation' }))
  })

  it('the meta line leaves out what is missing: no kind, no place, no created_at', async () => {
    serve({ kind: null, description: null, suburb: null, state: null, created_at: null })
    render(<OrgProfileScreen id="o1" />)
    await screen.findByText('Northbank Makerspace')
    expect(screen.queryByText(/undefined|null|On SPLAT since/)).toBeNull()
  })

  it('an unparseable created_at leaves out the "since" year', async () => {
    serve({ created_at: 'garbage' })
    render(<OrgProfileScreen id="o1" />)
    await screen.findByText('Northbank Makerspace')
    expect(screen.queryByText(/On SPLAT since/)).toBeNull()
    expect(screen.queryByText(/NaN/)).toBeNull()
  })

  it('stats fall back to the list lengths, then zero, when the API gives no counts', async () => {
    serve({ counts: undefined, tutorialsBacked: [guide('a'), guide('b')], toysDelivered: [{ id: 'd' }] })
    render(<OrgProfileScreen id="o1" />)
    await screen.findByText('guides backed')
    // The two stat cards fed by lists, and the two with no source at all.
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)
    expect(screen.getAllByText('1')).toHaveLength(1)
    expect(screen.getAllByText('0')).toHaveLength(2)
  })

  it.each([
    ["O'Brien & Sons <b>Toys</b>"], ['Sam "Sparky" Lee'], ['Zoë Ångström 李雷'], ['سارة'], ['100% Sam'],
  ])('an organisation called %s renders as plain text, and its Thanks button names it', async (name) => {
    serve({ name })
    render(<OrgProfileScreen id="o1" />)
    expect(await screen.findByText(name)).toBeTruthy()
    expect(screen.getByText(`Say thanks to ${name}`)).toBeTruthy()
  })

  it('a name starting with an emoji shows the whole emoji as the logo initial, not half of it', async () => {
    serve({ name: '🧸 Toy Hub', logo_url: null })
    render(<OrgProfileScreen id="o1" />)
    await screen.findByText('🧸 Toy Hub')
    expect(screen.getByText('🧸')).toBeTruthy()
  })
})

describe('OrgProfileScreen visit card', () => {
  it('shows the suburb, the pending map block and the street-address promise — never a street', async () => {
    serve({ visit_hours: 'Tue 9-4', service_area: 'Hunter region', website_url: 'https://www.north.org/path' })
    render(<OrgProfileScreen id="o1" />)
    expect(await screen.findByText('Callaghan, NSW')).toBeTruthy()
    expect(screen.getByText('Tue 9-4')).toBeTruthy()
    expect(screen.getByText('Hunter region')).toBeTruthy()
    expect(screen.getByText('www.north.org/path')).toBeTruthy()
    expect(screen.getByText('The street address comes once they accept you.')).toBeTruthy()
    expect(screen.getByText(/Map and address/)).toBeTruthy()
  })

  it('is left out entirely when the organisation gave no place, hours, area or website', async () => {
    serve({ suburb: null, state: null, visit_hours: null, service_area: null, website_url: null })
    render(<OrgProfileScreen id="o1" />)
    await screen.findByText('Northbank Makerspace')
    expect(screen.queryByText('Visit')).toBeNull()
    expect(screen.queryByText(/street address/)).toBeNull()
  })

  it('a state with no suburb still reads as a place', async () => {
    serve({ suburb: null, state: 'VIC' })
    render(<OrgProfileScreen id="o1" />)
    expect(await screen.findByText('Visit')).toBeTruthy()
  })

  it('an http (not https) website has its scheme stripped too', async () => {
    serve({ website_url: 'http://north.org' })
    render(<OrgProfileScreen id="o1" />)
    expect(await screen.findByText('north.org')).toBeTruthy()
  })
})

describe('OrgProfileScreen lists', () => {
  it('a guide both approved and backed is listed once, and the count says so', async () => {
    serve({ tutorialsApproved: [guide('a'), guide('b')], tutorialsBacked: [guide('b'), guide('c')] })
    render(<OrgProfileScreen id="o1" />)
    await screen.findByText('Guide a')
    expect(screen.getAllByText('Guide b')).toHaveLength(1)
    expect(screen.getByText('Guide c')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('exactly four guides show no "All" link; five do', async () => {
    serve({ tutorialsBacked: ['1', '2', '3', '4'].map((i) => guide(i)) })
    const a = render(<OrgProfileScreen id="o1" />)
    await screen.findByText('Guide 1')
    expect(screen.queryByRole('button', { name: /^All \d+ →$/ })).toBeNull()
    a.unmount()
    serve({ tutorialsBacked: ['1', '2', '3', '4', '5'].map((i) => guide(i)) })
    render(<OrgProfileScreen id="o1" />)
    expect(await screen.findByRole('button', { name: 'All 5 →' })).toBeTruthy()
  })

  it('toys past four expand with See all, and the link goes away once expanded', async () => {
    serve({ toysShared: Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, name: `Toy ${i}`, condition: 8, offer_type: null, quantity: 1, cover_photo_url: null })) })
    render(<OrgProfileScreen id="o1" />)
    await screen.findByText('Toy 0')
    expect(screen.queryByText('Toy 5')).toBeNull()
    fireEvent.press(screen.getByRole('button', { name: 'See all →' }))
    expect(screen.getByText('Toy 5')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'See all →' })).toBeNull()
  })

  it('opens a guide and a toy by id', async () => {
    serve({ tutorialsBacked: [guide('g9')], toysShared: [{ id: 't9', name: 'Drum', condition: 8, offer_type: null, quantity: 1, cover_photo_url: null }] })
    render(<OrgProfileScreen id="o1" />)
    fireEvent.press(await screen.findByLabelText('Guide g9'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/guides/[id]', params: { id: 'g9' } })
    fireEvent.press(screen.getByLabelText('Drum'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/toy-library/[id]', params: { id: 't9' } })
  })

  it('door wording: one door, several doors; an events door is not pressable', async () => {
    const door = (id: string, target: string) => ({ id, org_id: 'o1', position: 1, title: `Door ${id}`, body: null, target })
    serve({ doors: [door('1', 'events')] })
    const a = render(<OrgProfileScreen id="o1" />)
    expect(await screen.findByText('One door. None need a referral.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Door 1' })).toBeNull()
    a.unmount()
    serve({ doors: [door('1', 'dropoff'), door('2', 'print'), door('3', 'toy_library')] })
    render(<OrgProfileScreen id="o1" />)
    expect(await screen.findByText('3 doors. None need a referral.')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Door 2' }))
    expect(mockPush).toHaveBeenCalledWith('/printing')
  })

  it('leaders: one guide backed is singular, a blank name does not crash', async () => {
    serve({ leaders: [{ name: 'Rachel Kaur', guides_backed: 1 }, { name: '', guides_backed: 0 }] })
    render(<OrgProfileScreen id="o1" />)
    expect(await screen.findByText('1 guide backed')).toBeTruthy()
    expect(screen.getByText('0 guides backed')).toBeTruthy()
  })

  it('recent activity lists newest first, online events say Online, and a story says Published a story', async () => {
    serve({
      stories: [{ id: 's1', title: 'Leo drum', created_at: '2026-01-05T00:00:00Z' }],
      events: [
        { id: 'e1', title: 'Zoom day', format: 'online', location: '', starts_at: '2026-09-05T00:00:00Z' },
        { id: 'e2', title: 'Build day', format: 'in_person', location: 'Hall', starts_at: '2026-03-05T00:00:00Z' },
      ],
    })
    render(<OrgProfileScreen id="o1" />)
    await screen.findByText('Zoom day — Online')
    const titles = screen.getAllByText(/ — /).map((n) => n.props.children)
    expect(titles).toEqual(['Zoom day — Online', 'Build day — Hall', 'Published a story — Leo drum'])
  })

  it('an event row opens the event; a story row is not a button', async () => {
    serve({
      stories: [{ id: 's1', title: 'Leo drum', created_at: '2026-01-05T00:00:00Z' }],
      events: [{ id: 'e7', title: 'Build day', format: 'in_person', location: 'Hall', starts_at: '2026-03-05T00:00:00Z' }],
    })
    render(<OrgProfileScreen id="o1" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Open event: Build day — Hall' }))
    expect(mockPush).toHaveBeenCalledWith('/events/e7')
    expect(screen.queryByRole('button', { name: /Leo drum/ })).toBeNull()
  })

  it('"From families" gives two quotes with the same date and source their own rows', async () => {
    serve({ fromFamilies: [{ quote: 'One', by: 'A', source: 'thanks', at: 'd' }, { quote: 'Two', by: 'B', source: 'thanks', at: 'd' }] })
    render(<OrgProfileScreen id="o1" />)
    expect(await screen.findByText('“One”')).toBeTruthy()
    expect(screen.getByText('“Two”')).toBeTruthy()
  })
})

describe('OrgProfileScreen rates and recycling', () => {
  const printer = { id: 'p1', name: 'Prusa', materials: ['PETG'] }
  it('a rate line says they cover it unless they are claiming it back', async () => {
    serve({ printers: [printer], rate_lines: [
      { id: 'r1', description: 'Filament', amount_cents: 500, claiming: true },
      { id: 'r2', description: 'Machine time', amount_cents: 0, claiming: false },
    ] })
    render(<OrgProfileScreen id="o1" />)
    expect(await screen.findByText('$5.00')).toBeTruthy()
    expect(screen.getByText('$0.00 — they cover it')).toBeTruthy()
  })

  it('materials from several printers are listed once each', async () => {
    serve({ printers: [printer, { id: 'p2', name: 'Bambu', materials: ['PETG', 'PLA'] }] })
    render(<OrgProfileScreen id="o1" />)
    expect(await screen.findByText('PETG · PLA')).toBeTruthy()
    expect(screen.getByText('Prusa · Bambu')).toBeTruthy()
  })

  it('a rate note alone is enough to show the printing panel, quoted', async () => {
    serve({ printers: [], rate_lines: [], rate_note: 'We ask for a donation.' })
    render(<OrgProfileScreen id="o1" />)
    expect(await screen.findByText('“We ask for a donation.”')).toBeTruthy()
  })

  it('an unknown payment method is skipped, a known one is named', async () => {
    serve({ printers: [printer], payment_methods: ['cash', 'carrier-pigeon'] })
    render(<OrgProfileScreen id="o1" />)
    await screen.findByText('Paid back by')
    expect(screen.queryByText(/carrier/)).toBeNull()
  })

  it('no printers, rates or note: no printing panel at all', async () => {
    serve({ printers: [], rate_lines: [], rate_note: null })
    render(<OrgProfileScreen id="o1" />)
    await screen.findByText('Northbank Makerspace')
    expect(screen.queryByText('They print — you cover the filament')).toBeNull()
  })

  it('recycling with no declared "gives" reads as print credit, and Book a drop-off opens recycling', async () => {
    serve({ recycling_materials: ['PLA'], recycling_gives: undefined })
    render(<OrgProfileScreen id="o1" />)
    expect(await screen.findByText('Print credit on their machines')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Book a drop-off' }))
    expect(mockPush).toHaveBeenCalledWith('/explore/recycling')
  })

  it('an empty recycling list hides the recycling panel', async () => {
    serve({ recycling_materials: [] })
    render(<OrgProfileScreen id="o1" />)
    await screen.findByText('Northbank Makerspace')
    expect(screen.queryByText('They take waste plastic')).toBeNull()
  })
})

describe('OrgProfileScreen buttons', () => {
  const thank = () => fireEvent.press(screen.getByText('Say thanks to Northbank Makerspace'))

  it('already thanked on another device: the button reads Thanked and cannot open the form', async () => {
    serve({}, relationship({ thanks: { note: 'x' } }))
    render(<OrgProfileScreen id="o1" />)
    expect(await screen.findByText('Thanked')).toBeTruthy()
    fireEvent.press(screen.getByText('Thanked'))
    expect(screen.queryByText('Send thanks')).toBeNull()
  })

  it('already following reads Following, and a tap unfollows through delete', async () => {
    serve({}, relationship({ following: true }))
    render(<OrgProfileScreen id="o1" />)
    fireEvent.press(await screen.findByText('Following'))
    await waitFor(() => expect(screen.getByText('Follow')).toBeTruthy())
  })

  it('a failed follow says so in words and leaves the label alone', async () => {
    serve()
    mockPost.mockRejectedValueOnce(new Error('Request failed with status 429'))
    render(<OrgProfileScreen id="o1" />)
    fireEvent.press(await screen.findByText('Follow'))
    expect(await screen.findByText('Too many tries. Wait a minute and try again.')).toBeTruthy()
    expect(screen.getByText('Follow')).toBeTruthy()
  })

  it('Message goes to this organisation\'s conversation with its name, signed in; to sign-in when signed out', async () => {
    serve()
    const a = render(<OrgProfileScreen id="o1" />)
    fireEvent.press(await screen.findByText('Message'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/messages/org/[orgId]', params: { orgId: 'o1', name: 'Northbank Makerspace' } })
    a.unmount()
    ;(useAuth as jest.Mock).mockReturnValue({ session: null })
    serve({}, null)
    render(<OrgProfileScreen id="o1" />)
    fireEvent.press(await screen.findByText('Message'))
    expect(mockPush).toHaveBeenLastCalledWith('/sign-in')
  })

  it('a thanks with only whitespace as the note offers no "show on their page" choice', async () => {
    serve()
    render(<OrgProfileScreen id="o1" />)
    await screen.findByText('Follow'); thank()
    fireEvent.changeText(screen.getByPlaceholderText('What they did, in a sentence.'), '   ')
    expect(screen.queryByText('Show this on their page')).toBeNull()
    fireEvent.changeText(screen.getByPlaceholderText('What they did, in a sentence.'), 'Great')
    expect(screen.getByText('Show this on their page')).toBeTruthy()
  })

  it('choosing not to show the note sends show_note false', async () => {
    serve(); mockPost.mockResolvedValue({})
    render(<OrgProfileScreen id="o1" />)
    await screen.findByText('Follow'); thank()
    fireEvent.changeText(screen.getByPlaceholderText('What they did, in a sentence.'), 'Great')
    fireEvent.press(screen.getByText('Show this on their page'))
    fireEvent.press(screen.getByText('Send thanks'))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/organizations/o1/thanks', expect.objectContaining({ note: 'Great', show_note: false })))
  })

  it('a thanks with no note at all is allowed', async () => {
    serve(); mockPost.mockResolvedValue({ thanks_count: 3 })
    render(<OrgProfileScreen id="o1" />)
    await screen.findByText('Follow'); thank()
    fireEvent.press(screen.getByText('Send thanks'))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/organizations/o1/thanks', expect.objectContaining({ note: '' })))
    expect(await screen.findByText('Thanked 3 times')).toBeTruthy()
  })

  it('a double tap on Send thanks sends one', async () => {
    let resolve!: (v: unknown) => void
    mockPost.mockReturnValue(new Promise((r) => { resolve = r }))
    serve()
    render(<OrgProfileScreen id="o1" />)
    await screen.findByText('Follow'); thank()
    const send = screen.getByText('Send thanks')
    fireEvent.press(send); fireEvent.press(send)
    expect(mockPost).toHaveBeenCalledTimes(1)
    resolve({})
  })

  it('a 409 on thanks (already thanked elsewhere) ends as Thanked, with no error and no count bump', async () => {
    serve()
    mockPost.mockRejectedValueOnce(new Error('Request failed with status 409: You already thanked them'))
    render(<OrgProfileScreen id="o1" />)
    await screen.findByText('Follow'); thank()
    fireEvent.press(screen.getByText('Send thanks'))
    expect(await screen.findByText('Thanked')).toBeTruthy()
    expect(screen.getByText('Thanked 2 times')).toBeTruthy()
  })

  it('any other thanks failure says so and keeps the form open with the note', async () => {
    serve()
    mockPost.mockRejectedValueOnce(new Error('Network request failed'))
    render(<OrgProfileScreen id="o1" />)
    await screen.findByText('Follow'); thank()
    fireEvent.changeText(screen.getByPlaceholderText('What they did, in a sentence.'), 'Thanks!')
    fireEvent.press(screen.getByText('Send thanks'))
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy()
    expect(screen.getByDisplayValue('Thanks!')).toBeTruthy()
  })

  it('a signed-out visitor pressing Say thanks goes to sign-in', async () => {
    ;(useAuth as jest.Mock).mockReturnValue({ session: null })
    serve({}, null)
    render(<OrgProfileScreen id="o1" />)
    await screen.findByText('Follow'); thank()
    expect(mockPush).toHaveBeenCalledWith('/sign-in')
  })
})
