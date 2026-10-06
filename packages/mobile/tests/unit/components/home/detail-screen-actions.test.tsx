import { Linking } from 'react-native'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { DetailScreen } from '../../../../components/home/detail-screen'
import { apiClient } from '../../../../lib/api-client'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}))
jest.mock('../../../../lib/supabase-storage', () => ({
  resolveAuthStorage: () => ({ getItem: jest.fn(() => Promise.resolve(null)), setItem: jest.fn().mockResolvedValue(undefined), removeItem: jest.fn() }),
}))
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), delete: jest.fn() } }))
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: { profile: { id: 'me' } } }) }))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = jest.requireActual('react')
    useEffect(() => { cb() }, [])
  },
}))
jest.mock('../../../../lib/recents', () => ({ recordRecent: jest.fn() }))
jest.mock('../../../../lib/supabase', () => ({ supabase: { storage: { from: () => ({ createSignedUrl: jest.fn() }) } } }))

const NO_SAVES = { tutorials: [], toys: [], challenges: [] }
const pick = (id: string, title: string, required = false) => ({
  position: 1,
  required,
  tutorials: { id, title, kind: 'toy_adaptation', difficulty: 'easy', toy_photo_url: null, status: 'approved', maturity: 'complete', build_minutes: 20 },
})
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
  tutorial_pdf_url: null,
  photo_urls: [],
  toy_photo_url: null,
  rejection_note: null,
  created_at: '',
  reviewed_at: null,
  tutorial_contributors: [{ profile_id: 'c1', role: 'primary', profiles: { name: 'Sam T.' } }],
  tutorial_orgs: [],
  tutorial_recommendations: [],
  parts: [],
  tools: [],
  stl_files: [],
  steps: [
    { id: 's1', tutorial_id: '1', position: 1, title: 'Open it', body: 'One screw.', photo_url: null },
    { id: 's2', tutorial_id: '1', position: 2, title: 'Close it', body: 'Two screws.', photo_url: null },
  ],
}

function load(detail: object = DETAIL, notes: object[] = []) {
  ;(apiClient.get as jest.Mock).mockImplementation((p: string) =>
    p === '/api/saves/ids' ? Promise.resolve(NO_SAVES)
      : p === '/api/child-profiles' ? Promise.resolve([])
        : p === '/api/tutorials/1/thanks' ? Promise.resolve({ thanked: false, own: false })
          : p.endsWith('/notes') ? Promise.resolve(notes)
            : Promise.resolve(detail)
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(apiClient.post as jest.Mock).mockResolvedValue({})
  ;(apiClient.delete as jest.Mock).mockResolvedValue({})
  load()
})

describe('DetailScreen hero actions', () => {
  it('files a report about this guide from the hero', async () => {
    render(<DetailScreen id="1" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Report a problem' }))
    fireEvent.press(screen.getByRole('radio', { name: 'Wrong or missing info' }))
    fireEvent.changeText(screen.getByLabelText('What happened?'), 'Step 2 is missing a part')
    fireEvent.press(screen.getByRole('button', { name: 'Send report' }))
    await waitFor(() =>
      expect(apiClient.post).toHaveBeenCalledWith('/api/reports', expect.objectContaining({
        subject_kind: 'guide', subject_id: '1', subject_label: 'Build a Robot Arm', category: 'wrong_info', body: 'Step 2 is missing a part',
      }))
    )
  })

  it('saves the guide, and the toast Undo takes the save back', async () => {
    render(<DetailScreen id="1" />)
    fireEvent.press(await screen.findByRole('button', { name: 'Save' }))
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/saves', { entity_type: 'tutorial', entity_id: '1' }))
    fireEvent.press(screen.getByText('Undo'))
    await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/api/saves/tutorials/1'))
    expect(await screen.findByRole('button', { name: 'Save' })).toBeTruthy()
  })
})

describe('DetailScreen hero photos', () => {
  const photos = { ...DETAIL, photo_urls: ['https://x.test/a.jpg', 'https://x.test/b.jpg'], photo_captions: ['The drum', 'The lid'] }

  it('counts and captions the photo in view, then the next one after a swipe', async () => {
    load(photos)
    render(<DetailScreen id="1" />)
    expect(await screen.findByText('1/2 · The drum')).toBeTruthy()
    const carousel = screen.UNSAFE_getAllByType('RCTScrollView' as never).find((s) => (s.props as { pagingEnabled?: boolean }).pagingEnabled)!
    fireEvent(carousel, 'scroll', {
      nativeEvent: { contentOffset: { x: 750, y: 0 }, contentSize: { width: 1500, height: 100 }, layoutMeasurement: { width: 750, height: 100 } },
    })
    expect(await screen.findByText('2/2 · The lid')).toBeTruthy()
  })
})

describe('DetailScreen byline and picks', () => {
  it('opens the contributor from the byline and the backing organisation from its chip', async () => {
    load({
      ...DETAIL,
      tutorial_orgs: [{ status: 'accepted', organizations: { id: 'o1', name: 'Northbank' } }],
    })
    render(<DetailScreen id="1" />)
    await screen.findByText('Build a Robot Arm')
    fireEvent.press(screen.getAllByText('Sam T.')[0])
    expect(mockPush).toHaveBeenCalledWith('/guides/contributor/c1')
    fireEvent.press(screen.getAllByText('Backed by Northbank')[0])
    expect(mockPush).toHaveBeenCalledWith('/guides/organisation/o1')
  })

  it('shows at most three picks under Also worth a look, and opening one pushes its guide', async () => {
    load({ ...DETAIL, tutorial_recommendations: [pick('r1', 'Pick One'), pick('r2', 'Pick Two', true), pick('r3', 'Pick Three'), pick('r4', 'Pick Four')] })
    render(<DetailScreen id="1" />)
    expect(await screen.findByText('Also worth a look')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pick One' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pick Two, do this first' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Pick Three' })).toBeTruthy()
    expect(screen.queryByText('Pick Four')).toBeNull()
    fireEvent.press(screen.getByRole('button', { name: 'Pick Three' }))
    expect(mockPush).toHaveBeenCalledWith('/guides/r3')
  })

  it('shows no Also worth a look when the author picked nothing', async () => {
    render(<DetailScreen id="1" />)
    await screen.findByText('Build a Robot Arm')
    expect(screen.queryByText('Also worth a look')).toBeNull()
  })
})

describe('DetailScreen description links', () => {
  const withDescription = (rest: string) => load({ ...DETAIL, description: `A drum. ${rest}` })

  it('names a linked host and opens that address when tapped', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    withDescription('Files at https://github.com/makers/switch.')
    render(<DetailScreen id="1" />)
    fireEvent.press(await screen.findByRole('link', { name: 'github.com' }))
    expect(open).toHaveBeenCalledWith('https://github.com/makers/switch')
  })

  it('leaves a look-alike address as plain text with no link', async () => {
    withDescription('Files at https://github.com@evil.example/x for now.')
    render(<DetailScreen id="1" />)
    expect(await screen.findByText(/https:\/\/github\.com@evil\.example\/x/)).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'github.com' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'evil.example' })).toBeNull()
  })
})

describe('DetailScreen tabs', () => {
  const notes = [{ id: 'n1', body: 'Use a longer screw', step_position: 2, pinned_at: null, pinned_by_name: null, author_name: 'Al' }]

  it('shows the steps on Overview and swaps them for the notes on the Notes tab', async () => {
    load(DETAIL, notes)
    render(<DetailScreen id="1" />)
    expect(await screen.findByText('Open it')).toBeTruthy()
    fireEvent.press(screen.getByRole('tab', { name: 'Notes 1' }))
    expect(screen.getByRole('tab', { name: 'Notes 1' }).props.accessibilityState.selected).toBe(true)
    expect(screen.queryByText('Open it')).toBeNull()
    fireEvent.press(screen.getByRole('tab', { name: 'Overview' }))
    expect(screen.getByText('Open it')).toBeTruthy()
  })

  it('labels the tab with just Notes while there are none', async () => {
    render(<DetailScreen id="1" />)
    await screen.findByText('Open it')
    expect(screen.getByRole('tab', { name: 'Notes' })).toBeTruthy()
  })
})
