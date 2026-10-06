import { act, render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { DetailScreen, linkSite, splitLead } from '../../../../components/home/detail-screen'
import { apiClient } from '../../../../lib/api-client'

// Ionicons loads its font asynchronously and setStates after the test ends;
// stub it to a host string so there's no act() warning noise, same as
// library-screen.test.tsx. The Provenance chip and the placeholder photo icon
// are what pull in more Icon instances than this file had before Task 3.
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

let mockTicks: string | null = null
jest.mock('../../../../lib/supabase-storage', () => ({
  resolveAuthStorage: () => ({ getItem: jest.fn(() => Promise.resolve(mockTicks)), setItem: jest.fn().mockResolvedValue(undefined), removeItem: jest.fn() }),
}))

jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }))

jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: { profile: { id: 'me' } } }) }))

const mockPush = jest.fn()
const mockFocus: (() => void)[] = []
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  // Runs on mount like a first focus; later focuses are fired by the test.
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = jest.requireActual('react')
    useEffect(() => {
      mockFocus.push(cb)
      cb()
    }, [])
  },
}))
const mockRecord = jest.fn()
jest.mock('../../../../lib/recents', () => ({ recordRecent: (...a: unknown[]) => mockRecord(...a) }))


const mockCreateSignedUrl = jest.fn()
jest.mock('../../../../lib/supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: (...a: unknown[]) => mockCreateSignedUrl(...a) }) } },
}))

const tab = (name: string) => fireEvent.press(screen.getByRole('tab', { name }))

const NO_SAVES = { tutorials: [], toys: [], challenges: [] }

const DETAIL = {
  id: '1',
  title: 'Build a Robot Arm',
  description: 'A fun beginner build.',
  difficulty: 'easy',
  kind: 'toy_adaptation',
  status: 'approved',
  maturity: 'complete',
  safety_declared_at: null,
  build_minutes: 30,
  // Object path (049), not a URL — the preview button signs it in-process.
  tutorial_pdf_url: '1/tutorial.pdf',
  photo_urls: [],
  toy_photo_url: null,
  rejection_note: null,
  created_at: '',
  reviewed_at: null,
  // Widened in Task 3 alongside the public embed's profile_id — provenance,
  // picks and the 3D-print placeholder all read one of these three.
  tutorial_contributors: [{ profile_id: 'c1', role: 'primary', profiles: { name: 'Sam T.' } }],
  tutorial_orgs: [],
  tutorial_recommendations: [],
  parts: [{ id: 'p1', tutorial_id: '1', name: 'Servo Motor', quantity: 2, is_optional: false, buy_links: [] }],
  tools: [{ id: 't1', tutorial_id: '1', name: 'Screwdriver', is_optional: false, buy_links: [] }],
  stl_files: [],
}

// The detail screen's own useSaves() fires a second, independent
// apiClient.get('/api/saves/ids') on mount — routed by path so a rejection
// aimed at the tutorial fetch doesn't also break the (silently-caught) saves
// fetch, same pattern as library-screen.test.tsx's mockEndpoints.
function mockEndpoints({
  detail = Promise.resolve(DETAIL),
  saves = Promise.resolve(NO_SAVES),
  children = Promise.resolve([]),
}: { detail?: Promise<unknown>; saves?: Promise<unknown>; children?: Promise<unknown> } = {}) {
  ;(apiClient.get as jest.Mock).mockImplementation((p: string) =>
    p === '/api/saves/ids' ? saves : p === '/api/child-profiles' ? children : p.endsWith('/notes') ? Promise.resolve([]) : detail
  )
}

describe('DetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEndpoints()
    mockCreateSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://supabase.test/signed.pdf' }, error: null })
  })

  it('renders tutorial detail with parts and tools', async () => {
    render(<DetailScreen id="1" />)
    expect(await screen.findByText('Build a Robot Arm')).toBeTruthy()
    expect(apiClient.get).toHaveBeenCalledWith('/api/public/tutorials/1')
    tab('You’ll need')
    expect(screen.getByText('Servo Motor ×2')).toBeTruthy()
    expect(screen.getByText('Screwdriver')).toBeTruthy()
  })

  it('counts the hero photos from the first, as the board does', async () => {
    mockEndpoints({ detail: Promise.resolve({ ...DETAIL, photo_urls: ['https://x.test/a.jpg', 'https://x.test/b.jpg'] }) })
    render(<DetailScreen id="1" />)
    expect(await screen.findByText('1/2 · Build a Robot Arm')).toBeTruthy()
  })

  it('shows an error message when apiClient.get rejects', async () => {
    mockEndpoints({ detail: Promise.reject(new Error('API GET failed with status 500')) })
    render(<DetailScreen id="1" />)
    expect(await screen.findByText("Couldn't load tutorial. Please try again.")).toBeTruthy()
  })

  it('signs the pdf path and pushes the preview route with the signed URL', async () => {
    render(<DetailScreen id="1" />)
    await screen.findByText('Build a Robot Arm')

    fireEvent.press(screen.getByText('Download PDF'))

    await waitFor(() => expect(mockPush).toHaveBeenCalled())
    expect(mockCreateSignedUrl).toHaveBeenCalledWith('1/tutorial.pdf', 60)
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/guides/[id]/preview',
      params: { id: '1', pdfUrl: 'https://supabase.test/signed.pdf' },
    })
  })

  it('pushes the preview route with an empty pdfUrl when signing fails', async () => {
    mockCreateSignedUrl.mockResolvedValue({ data: null, error: { message: 'Object not found' } })
    render(<DetailScreen id="1" />)
    await screen.findByText('Build a Robot Arm')

    fireEvent.press(screen.getByText('Download PDF'))

    await waitFor(() => expect(mockPush).toHaveBeenCalled())
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/guides/[id]/preview',
      params: { id: '1', pdfUrl: '' },
    })
  })

  it('prices each part and totals them once all are priced', async () => {
    mockEndpoints({
      detail: Promise.resolve({ ...DETAIL, prices_checked_on: '2026-08-02', parts: [{ ...DETAIL.parts[0], price_cents: 1250 }] }),
    })
    render(<DetailScreen id="1" />)
    await screen.findByText('Build a Robot Arm')
    tab('You’ll need')
    expect(await screen.findByText('Total')).toBeTruthy()
    expect(screen.getAllByText('$12.50')).toHaveLength(2)
    expect(screen.getByText('Prices checked 2 Aug 2026')).toBeTruthy()
  })

  it('shows the print settings when the guide has any', async () => {
    mockEndpoints({ detail: Promise.resolve({ ...DETAIL, layer_height_mm: 0.2, infill_percent: 25, material: 'PETG', print_minutes: null }) })
    render(<DetailScreen id="1" />)
    await screen.findByText('Build a Robot Arm')
    tab('Files')
    expect(await screen.findByText('Print settings')).toBeTruthy()
    expect(screen.getByText('0.2 mm')).toBeTruthy()
    expect(screen.queryByText('Print time')).toBeNull()
  })

  it('opens a hero photo full screen and closes back to the guide', async () => {
    mockEndpoints({ detail: Promise.resolve({ ...DETAIL, photo_urls: ['https://x.test/a.jpg', 'https://x.test/b.jpg'], photo_captions: ['The finished drum'] }) })
    render(<DetailScreen id="1" />)
    fireEvent.press(await screen.findByLabelText('Open photo 2 full screen'))
    expect(screen.getByLabelText('Close photo')).toBeTruthy()
    fireEvent.press(screen.getByLabelText('Close photo'))
    expect(screen.queryByLabelText('Close photo')).toBeNull()
    expect(screen.getByText('Build a Robot Arm')).toBeTruthy()
  })

  it('captions the photo in view, with no thumbnail strip under it', async () => {
    mockEndpoints({ detail: Promise.resolve({ ...DETAIL, photo_urls: ['https://x.test/a.jpg', 'https://x.test/b.jpg'], photo_captions: ['The finished drum'] }) })
    render(<DetailScreen id="1" />)
    expect(await screen.findByText('1/2 · The finished drum')).toBeTruthy()
    expect(screen.queryByLabelText('Show photo 1: The finished drum')).toBeNull()
  })

  it('opens Find a printer for this guide when it has printable parts', async () => {
    mockEndpoints({
      detail: Promise.resolve({
        ...DETAIL,
        stl_files: [{ id: 's1', tutorial_id: '1', filename: 'mount.stl', file_url: '1/mount.stl' }],
      }),
    })
    render(<DetailScreen id="1" />)
    await screen.findByText('Build a Robot Arm')
    tab('Files')

    mockPush.mockClear()
    fireEvent.press(screen.getByLabelText('Ask someone to print'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/printing', params: { guide: '1' } })
  })

  it('passes on the organisation it was opened to print with', async () => {
    mockEndpoints({
      detail: Promise.resolve({
        ...DETAIL,
        stl_files: [{ id: 's1', tutorial_id: '1', filename: 'mount.stl', file_url: '1/mount.stl' }],
      }),
    })
    render(<DetailScreen id="1" printWith="o1" tab="files" />)
    fireEvent.press(await screen.findByLabelText('Ask someone to print'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/printing', params: { guide: '1', printWith: 'o1' } })
  })

  it('asks a maker nearby with this guide already picked', async () => {
    render(<DetailScreen id="1" />)
    fireEvent.press(await screen.findByRole('button', { name: "Can't build it? Ask a maker nearby" }))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/explore/makers-wanted/new', params: { guide: '1' } })
  })

  it('offers no print for a guide with nothing to print', async () => {
    render(<DetailScreen id="1" />)
    await screen.findByText('Build a Robot Arm')
    tab('Files')

    expect(screen.queryByLabelText('Ask someone to print')).toBeNull()
    expect(screen.getByText('Nothing to print for this guide.')).toBeTruthy()
  })
})

// 080: numbered steps, and the fit callout only when the guide suits a child.
describe('DetailScreen steps and fit', () => {
  const tagged = {
    ...DETAIL,
    device_types: ['switch', 'mounting'],
    access: ['press'],
    press_force: ['light'],
    steps: [
      { id: 's1', tutorial_id: '1', position: 1, title: 'Open it', body: 'Unscrew the lid.', photo_url: null },
      { id: 's2', tutorial_id: '1', position: 2, title: null, body: 'Fit the interrupter.', photo_url: null },
    ],
  }
  const ollie = { name: 'Ollie', helps_with: null, access: ['press', 'eyes'], one_hand: false, press_force: 'light', enjoys: null }

  it('numbers the steps and says it suits the child', async () => {
    mockEndpoints({ detail: Promise.resolve(tagged), children: Promise.resolve([ollie]) })
    render(<DetailScreen id="1" />)
    expect(await screen.findByText('Open it')).toBeTruthy()
    expect(screen.getByText('Fit the interrupter.')).toBeTruthy()
    expect(await screen.findByText('Suits Ollie')).toBeTruthy()
    expect(screen.getByText('Switch · Mounting and positioning · Toy adaptation')).toBeTruthy()
  })

  it('says nothing when the guide does not suit the child', async () => {
    mockEndpoints({
      detail: Promise.resolve(tagged),
      children: Promise.resolve([{ ...ollie, access: ['voice'], press_force: 'full' }]),
    })
    render(<DetailScreen id="1" />)
    await screen.findByText('Open it')
    expect(screen.queryByTestId('fit-callout')).toBeNull()
  })
})

describe('splitLead', () => {
  it('takes the first sentence as the lead and leaves the rest for below', () => {
    expect(splitLead('A drum. It lights up! Easy.')).toEqual({ lead: 'A drum.', rest: 'It lights up! Easy.' })
  })
  it('keeps a single sentence, or one with no stop, whole', () => {
    expect(splitLead('Just one.')).toEqual({ lead: 'Just one.', rest: '' })
    expect(splitLead('no stop at all')).toEqual({ lead: 'no stop at all', rest: '' })
  })
})

describe('DetailScreen thanks', () => {
  function withThanks(thanks: unknown) {
    ;(apiClient.get as jest.Mock).mockImplementation((p: string) =>
      p === '/api/tutorials/1/thanks'
        ? Promise.resolve(thanks)
        : p === '/api/saves/ids'
          ? Promise.resolve(NO_SAVES)
          : p === '/api/child-profiles' || p.endsWith('/notes')
            ? Promise.resolve([])
            : Promise.resolve(DETAIL)
    )
  }

  it('offers Thanks to someone who has not thanked yet', async () => {
    withThanks({ thanked: false, own: false })
    render(<DetailScreen id="1" />)
    expect(await screen.findByRole('button', { name: 'Say thanks' })).toBeTruthy()
  })

  it('never offers it on your own guide', async () => {
    withThanks({ thanked: false, own: true })
    render(<DetailScreen id="1" />)
    await screen.findByText('Build a Robot Arm')
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/api/tutorials/1/thanks'))
    expect(screen.queryByRole('button', { name: 'Say thanks' })).toBeNull()
  })

  it('lists the author’s safety notes', async () => {
    mockEndpoints({ detail: Promise.resolve({ ...DETAIL, safety_notes: [{ id: 'n', tutorial_id: '1', position: 1, title: 'Battery door must be screwed shut', detail: 'Add the screw.' }] }) })
    render(<DetailScreen id="1" />)
    expect(await screen.findByText('Stay safe')).toBeTruthy()
    expect(screen.getByText('Battery door must be screwed shut')).toBeTruthy()
  })
})

describe('DetailScreen redesigned page', () => {
  const full = {
    ...DETAIL,
    age_min: 3,
    age_max: 8,
    toy_name: 'Light-up drum',
    toy_brand: 'Fisher-Price',
    works_with: 'Any 3.5mm switch',
    no_build_note: 'No soldering needed.',
    access: ['press'],
    device_types: ['switch'],
    steps: [
      { id: 's1', tutorial_id: '1', position: 1, title: 'Open it', body: 'One screw.', photo_url: null },
      { id: 's2', tutorial_id: '1', position: 2, title: 'Close it', body: 'Two screws.', photo_url: null },
    ],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockEndpoints({ detail: Promise.resolve(full) })
  })

  it('Start building opens the build route', async () => {
    render(<DetailScreen id="1" />)
    fireEvent.press(await screen.findByText('Start building'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/guides/[id]/build', params: { id: '1' } })
  })

  // Build mode ticks steps while the guide page stays mounted underneath.
  it('reads the step ticks again when the page comes back into focus', async () => {
    mockTicks = null
    render(<DetailScreen id="1" />)
    expect(await screen.findByText('Start building')).toBeTruthy()
    mockTicks = '["s1"]'
    act(() => mockFocus.at(-1)!())
    expect(await screen.findByText('Pick up at step 2')).toBeTruthy()
    mockTicks = null
  })

  it('offers the PDF as the primary action when there are no steps', async () => {
    mockEndpoints()
    render(<DetailScreen id="1" />)
    await screen.findByText('Build a Robot Arm')
    expect(screen.queryByText('Start building')).toBeNull()
    expect(screen.getByText('Download PDF')).toBeTruthy()
  })

  it('opens on the tab named by the route param', async () => {
    render(<DetailScreen id="1" tab="notes" />)
    await screen.findByText('Build a Robot Arm')
    expect(screen.getByRole('tab', { name: 'Notes' }).props.accessibilityState.selected).toBe(true)
    expect(screen.queryByText('Who it\'s for')).toBeNull()
  })

  it('shows the age range badge, who it is for and the toy on Overview', async () => {
    render(<DetailScreen id="1" />)
    expect(await screen.findByText(/· Age 3–8$/)).toBeTruthy()
    expect(screen.getByText("Who it's for")).toBeTruthy()
    expect(screen.getByText('How a child uses it')).toBeTruthy()
    expect(screen.getByText('The toy')).toBeTruthy()
    expect(screen.getByText('Light-up drum · Fisher-Price')).toBeTruthy()
    expect(screen.getByText('Works with: Any 3.5mm switch')).toBeTruthy()
    expect(screen.getByText('No soldering needed.')).toBeTruthy()
  })
})

describe('DetailScreen combined layout', () => {
  const guide = {
    ...DETAIL,
    access: ['press', 'head'],
    one_hand: true,
    safety_declared_at: '2026-08-01',
    parts: [
      { id: 'p1', tutorial_id: '1', name: 'Servo Motor', quantity: 2, is_optional: false, price_cents: 450, buy_links: [] },
      { id: 'p2', tutorial_id: '1', name: 'Glue', quantity: 1, is_optional: false, price_cents: 200, buy_links: [] },
    ],
    steps: [
      { id: 's1', tutorial_id: '1', position: 1, title: 'Open it', body: 'One screw.', photo_url: null, minutes: 5 },
      { id: 's2', tutorial_id: '1', position: 2, title: 'Close it', body: 'Two screws.', photo_url: null, minutes: 10 },
    ],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockTicks = null
  })

  it('sums up what you need and opens the You’ll need tab with one gathered bar', async () => {
    mockEndpoints({ detail: Promise.resolve(guide) })
    render(<DetailScreen id="1" />)
    expect(await screen.findByText('2 parts · about $6.50')).toBeTruthy()
    expect(screen.getByText('1 tool')).toBeTruthy()
    fireEvent.press(screen.getByLabelText("What you'll need"))
    expect(screen.getByRole('tab', { name: 'You’ll need' }).props.accessibilityState.selected).toBe(true)
    expect(screen.getByText('3 things left to gather')).toBeTruthy()
    fireEvent.press(screen.getByLabelText('Glue: gathered'))
    expect(screen.getByText('2 things left to gather')).toBeTruthy()
    expect(screen.getByText('1/2')).toBeTruthy()
  })

  it('opens build mode on the step you tap, and marks where you are', async () => {
    mockTicks = '["s1"]'
    mockEndpoints({ detail: Promise.resolve(guide) })
    render(<DetailScreen id="1" />)
    expect(await screen.findByText("You're here · 10 min")).toBeTruthy()
    expect(screen.getByText('1/2')).toBeTruthy()
    fireEvent.press(screen.getByLabelText('Step 2: Close it'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/guides/[id]/build', params: { id: '1', step: '2' } })
    mockTicks = null
  })

  it('folds the author’s safety checks behind one row', async () => {
    mockEndpoints({ detail: Promise.resolve(guide) })
    render(<DetailScreen id="1" />)
    fireEvent.press(await screen.findByText('6 safety checks passed'))
    expect(screen.getByText('No mains voltage anywhere in the design')).toBeTruthy()
  })

  it('ticks the answers the child shares in Who it’s for', async () => {
    const ollie = { name: 'Ollie', helps_with: null, access: ['head'], one_hand: false, press_force: null, enjoys: null }
    mockEndpoints({ detail: Promise.resolve(guide), children: Promise.resolve([ollie]) })
    render(<DetailScreen id="1" />)
    await screen.findByText('Suits Ollie')
    expect(screen.getByText('Head or chin')).toBeTruthy()
    expect(screen.UNSAFE_getAllByProps({ name: 'checkmark', size: 14 })).toHaveLength(1)
  })

  it('shows a pinned fix on Overview with a way to the rest', async () => {
    const pinned = { id: 'k', body: 'Use a longer screw', step_position: 2, pinned_at: '2026-09-01', pinned_by_name: 'Sam', author_name: 'Al' }
    ;(apiClient.get as jest.Mock).mockImplementation((p: string) =>
      p === '/api/saves/ids' ? Promise.resolve(NO_SAVES) : p === '/api/child-profiles' ? Promise.resolve([]) : p.endsWith('/notes') ? Promise.resolve([pinned]) : Promise.resolve(guide)
    )
    render(<DetailScreen id="1" />)
    expect(await screen.findByText('1 fix from builders')).toBeTruthy()
    expect(screen.getByText('Step 2: Use a longer screw')).toBeTruthy()
    fireEvent.press(screen.getByText('Read the fix'))
    expect(screen.getByRole('tab', { name: /^Notes/ }).props.accessibilityState.selected).toBe(true)
  })
})

describe('DetailScreen recents', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEndpoints()
  })

  it('records the guide once it has loaded, once per open', async () => {
    const { rerender } = render(<DetailScreen id="1" />)
    await screen.findByText('Build a Robot Arm')
    expect(mockRecord).toHaveBeenCalledTimes(1)
    expect(mockRecord).toHaveBeenCalledWith({
      id: '1', kind: 'guide', title: 'Build a Robot Arm', subtitle: 'Guide · 30 min build', badge: 'Easy', href: '/guides/1',
    })
    rerender(<DetailScreen id="1" />)
    expect(mockRecord).toHaveBeenCalledTimes(1)
  })

  it('records nothing when the guide fails to load', async () => {
    mockEndpoints({ detail: Promise.reject(new Error('boom')) })
    render(<DetailScreen id="1" />)
    await screen.findByText(/couldn.t load/i)
    expect(mockRecord).not.toHaveBeenCalled()
  })
})

describe('linkSite', () => {
  it('names the host a link opens, not the userinfo in front of it', () => {
    expect(linkSite('https://github.com/makersmakingchange/Light-Touch-Switch')).toBe('github.com')
    expect(linkSite('https://github.com@evil.example/x')).toBe('evil.example')
    expect(linkSite('https://user:pw@www.example.org:8080/a?b#c')).toBe('example.org')
    expect(linkSite('http://github.com.evil.example/')).toBe('github.com.evil.example')
  })
})
