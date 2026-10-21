import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { EditEventScreen, localParts } from '../../../../components/organisation/event-form-screen'
import { EditStoryScreen } from '../../../../components/organisation/story-form-screen'
import { OrgPublishScreen } from '../../../../components/organisation/org-publish-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn(); const mockPatch = jest.fn(); const mockPut = jest.fn(); const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a), patch: (...a: unknown[]) => mockPatch(...a),
    put: (...a: unknown[]) => mockPut(...a), post: (...a: unknown[]) => mockPost(...a),
  },
}))
const mockPush = jest.fn(); const mockBack = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: mockPush, back: mockBack }), useFocusEffect: (e: () => void) => useEffect(e, [e]) }
})
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: { ledOrgs: [{ id: 'o1', name: 'Northside' }] }, loading: false }) }))
jest.mock('../../../../components/ui/DateTimeField', () => {
  const { TextInput } = jest.requireActual('react-native')
  return { DateTimeField: ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} />
  ) }
})

// 6:05pm on the host's own clock, stored as UTC the way the API keeps it.
const SIX_PM = new Date(2099, 9, 3, 18, 5).toISOString()
const EVENT = {
  id: 'e1', org_id: 'o1', kind: 'build_day', title: 'Build day', summary: null, starts_at: SIX_PM, ends_at: null,
  format: 'in_person', location: '14 Corella St', suburb: 'Crows Nest', state: 'NSW', online_url: null,
  audience: 'Parents', description: null, what_to_bring: null, tools: [], capacity: null, prints_parts: false,
  part_sets_max: null, accessibility_note: null, cost_cents: null, cost_note: null, status: 'published',
}
const STORY = {
  id: 's1', org_id: 'o1', kind: 'family', title: 'Leo drum', summary: 'One sentence.', body: 'A paragraph.',
  byline: 'Northside', consent_confirmed: true, pull_quote: null, pull_quote_by: null, status: 'published',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockPatch.mockImplementation(async (p: string) => ({ id: p.split('/').pop() }))
  mockPut.mockResolvedValue([])
})

it('localParts reads a stored instant back on the host clock, not UTC', () => {
  expect(localParts(SIX_PM)).toEqual({ date: '2099-10-03', time: '18:05' })
})

describe('EditEventScreen', () => {
  it('L35 fills the form from the saved event and saves it in place, keeping question ids', async () => {
    mockGet.mockImplementation(async (p: string) =>
      p.endsWith('/questions') ? [{ id: 'q1', prompt: 'Any allergies?', answer_type: 'short', required: false, options: [] }] : [EVENT],
    )
    render(<EditEventScreen eventId="e1" />)
    const save = await screen.findByRole('button', { name: 'Save changes' })
    expect(screen.queryByRole('button', { name: 'Save as draft' })).toBeNull()
    expect(screen.getByLabelText('Starts').props.value).toBe('18:05')

    fireEvent.press(save)
    await waitFor(() => expect(mockBack).toHaveBeenCalled())
    expect(mockPost).not.toHaveBeenCalled()
    expect(mockPatch).toHaveBeenCalledWith('/api/organizations/o1/events/e1', expect.objectContaining({ title: 'Build day', starts_at: SIX_PM, status: 'published' }))
    expect(mockPut).toHaveBeenCalledWith('/api/organizations/o1/events/e1/questions', {
      questions: [expect.objectContaining({ id: 'q1', prompt: 'Any allergies?' })],
    })
  })

  it('a draft keeps both buttons', async () => {
    mockGet.mockImplementation(async (p: string) => (p.endsWith('/questions') ? [] : [{ ...EVENT, status: 'draft' }]))
    render(<EditEventScreen eventId="e1" />)
    expect(await screen.findByRole('button', { name: 'Publish to Events' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save as draft' })).toBeTruthy()
  })

  it('an id that is not theirs says so instead of an empty form', async () => {
    mockGet.mockImplementation(async (p: string) => (p.endsWith('/questions') ? [] : [EVENT]))
    render(<EditEventScreen eventId="nope" />)
    expect(await screen.findByText('That event is not one of yours any more.')).toBeTruthy()
  })
})

describe('EditStoryScreen', () => {
  it('L36 starts with consent unticked and saves only once it is ticked again', async () => {
    mockGet.mockResolvedValue([STORY])
    render(<EditStoryScreen storyId="s1" />)
    const save = await screen.findByRole('button', { name: 'Save changes' })
    expect(save).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save as draft' })).toBeNull()

    fireEvent.press(screen.getByRole('checkbox'))
    fireEvent.press(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(mockBack).toHaveBeenCalled())
    expect(mockPatch).toHaveBeenCalledWith('/api/organizations/o1/stories/s1', expect.objectContaining({ title: 'Leo drum', consent_confirmed: true, status: 'published' }))
  })

  it('an id that is not theirs says so instead of an empty form', async () => {
    mockGet.mockResolvedValue([STORY])
    render(<EditStoryScreen storyId="nope" />)
    expect(await screen.findByText('That story is not one of yours any more.')).toBeTruthy()
  })
})

it('L37 every row on Events and stories opens its edit form', async () => {
  mockGet.mockImplementation(async (p: string) => (p.endsWith('/events') ? [EVENT] : [STORY]))
  render(<OrgPublishScreen />)
  fireEvent.press(await screen.findByRole('button', { name: 'Edit Build day' }))
  fireEvent.press(screen.getByRole('radio', { name: /Stories/ }))
  fireEvent.press(await screen.findByRole('button', { name: 'Edit Leo drum' }))
  expect(mockPush.mock.calls).toEqual([['/organisation/events/e1/edit'], ['/organisation/stories/s1/edit']])
})
