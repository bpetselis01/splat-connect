import { CLEARANCE, scrollPaddings } from '../../bottom-spacing'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { TextInput } from 'react-native'
import { OrgPublishScreen } from '../../../../components/organisation/org-publish-screen'
import { StoryFormScreen } from '../../../../components/organisation/story-form-screen'
import { OrgNewsScreen } from '../../../../components/organisation/org-news-screen'
import { NAMES } from '../../../special-strings'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn(); const mockPost = jest.fn(); const mockPatch = jest.fn(); const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), patch: (...a: unknown[]) => mockPatch(...a), delete: (...a: unknown[]) => mockDelete(...a) },
}))
const mockPush = jest.fn(); const mockBack = jest.fn(); const mockReplace = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace }), useFocusEffect: (e: () => void) => useEffect(e, [e]) }
})
let mockCaps: { ledOrgs: { id: string; name: string }[] } | null = { ledOrgs: [{ id: 'o1', name: 'Northside' }] }
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: mockCaps, loading: false }) }))
jest.mock('../../../../lib/confirm', () => ({ confirmDestructive: (_t: string, _m: string, _c: string, ok: () => void) => ok() }))

beforeEach(() => {
  jest.clearAllMocks()
  mockCaps = { ledOrgs: [{ id: 'o1', name: 'Northside' }] }
  mockPost.mockResolvedValue({}); mockPatch.mockResolvedValue({}); mockDelete.mockResolvedValue({})
})

describe('OrgPublishScreen', () => {
  const ev = (over: object = {}) => ({ id: 'e1', title: 'Build day', kind: 'build_day', format: 'in_person', suburb: 'Fitzroy', starts_at: '2099-05-04T10:00:00Z', ends_at: null, status: 'published', ...over })
  const st = (over: object = {}) => ({ id: 's1', title: 'Leo drum', kind: 'family', byline: 'Northside', status: 'draft', consent_confirmed: false, published_at: null, created_at: '2026-09-01T00:00:00Z', ...over })
  const serve = (events: unknown, stories: unknown) =>
    mockGet.mockImplementation((p: string) => {
      const v = p.endsWith('/events') ? events : stories
      return v instanceof Error ? Promise.reject(v) : Promise.resolve(v)
    })

  it('L18 counts events and stories in the chips and starts on events', async () => {
    serve([ev(), ev({ id: 'e2', title: 'Second' })], [st()])
    render(<OrgPublishScreen />)
    expect(await screen.findByRole('radio', { name: 'Events · 2' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Stories · 1' })).toBeTruthy()
    expect(screen.getByText('Build day')).toBeTruthy()
  })

  it('empty events and empty stories each say so', async () => {
    serve([], [])
    render(<OrgPublishScreen />)
    expect(await screen.findByText('No events yet')).toBeTruthy()
    fireEvent.press(screen.getByRole('radio', { name: 'Stories · 0' }))
    expect(screen.getByText('No stories yet')).toBeTruthy()
  })

  it('both lists failing says so, not an empty page', async () => {
    serve(new Error('500'), new Error('500'))
    render(<OrgPublishScreen />)
    expect(await screen.findByText("Couldn't load your events and stories.")).toBeTruthy()
  })

  it('one list failing still shows the other', async () => {
    serve(new Error('500'), [st()])
    render(<OrgPublishScreen />)
    expect(await screen.findByText('No events yet')).toBeTruthy()
  })

  it('a published event in the past reads Past; a draft reads Draft; a live one Published', async () => {
    serve([
      ev({ id: 'a', title: 'Gone', starts_at: '2020-01-01T10:00:00Z' }),
      ev({ id: 'b', title: 'Pending', status: 'draft' }),
      ev({ id: 'c', title: 'Live' }),
    ], [])
    render(<OrgPublishScreen />)
    await screen.findByText('Live')
    expect(screen.getAllByText('Past')).toHaveLength(1)
    expect(screen.getAllByText('Draft')).toHaveLength(1)
    expect(screen.getAllByText('Published')).toHaveLength(1)
  })

  it('online events say Online; an in-person one with no suburb says In person', async () => {
    serve([ev({ id: 'a', format: 'online', suburb: null }), ev({ id: 'b', title: 'Park', suburb: null })], [])
    render(<OrgPublishScreen />)
    expect(await screen.findByText(/· Online ·/)).toBeTruthy()
    expect(screen.getByText(/· In person ·/)).toBeTruthy()
  })

  it('a story without consent is flagged on its row', async () => {
    serve([], [st(), st({ id: 's2', title: 'OK', consent_confirmed: true })])
    render(<OrgPublishScreen />)
    fireEvent.press(await screen.findByRole('radio', { name: 'Stories · 2' }))
    expect(screen.getAllByText(/consent not confirmed/)).toHaveLength(1)
  })

  it('L21 Unpublish moves a live item to draft, Publish moves a draft to published, then reloads', async () => {
    serve([ev()], [st()])
    render(<OrgPublishScreen />)
    fireEvent.press(await screen.findByRole('button', { name: 'Unpublish' }))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/organizations/o1/events/e1', { status: 'draft' }))
    fireEvent.press(screen.getByRole('radio', { name: /Stories/ }))
    fireEvent.press(await screen.findByRole('button', { name: 'Publish' }))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/organizations/o1/stories/s1', { status: 'published' }))
    await waitFor(() => expect(mockGet.mock.calls.length).toBeGreaterThan(4))
  })

  it('publishing a story the API refuses (no consent) shows the API\'s own words', async () => {
    serve([], [st()])
    mockPatch.mockRejectedValue(new Error('Request failed with status 400: Consent must be confirmed before publishing'))
    render(<OrgPublishScreen />)
    fireEvent.press(await screen.findByRole('radio', { name: 'Stories · 1' }))
    fireEvent.press(screen.getByRole('button', { name: 'Publish' }))
    expect(await screen.findByText('Consent must be confirmed before publishing')).toBeTruthy()
  })

  it('an offline failure says offline; an unknown 500 says the generic line', async () => {
    serve([ev()], [])
    mockPatch.mockRejectedValueOnce(new Error('Network request failed'))
    render(<OrgPublishScreen />)
    fireEvent.press(await screen.findByRole('button', { name: 'Unpublish' }))
    expect(await screen.findByText("You're offline. Check your connection and try again.")).toBeTruthy()
    mockPatch.mockRejectedValueOnce(new Error('Request failed with status 500'))
    fireEvent.press(screen.getByRole('button', { name: 'Unpublish' }))
    expect(await screen.findByText('That did not save. Check your connection and try again.')).toBeTruthy()
  })

  it('L22 Remove deletes through the confirm and reloads', async () => {
    serve([ev()], [])
    render(<OrgPublishScreen />)
    fireEvent.press(await screen.findByRole('button', { name: 'Remove Build day' }))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/organizations/o1/events/e1'))
  })

  it('titles with quotes, angle brackets, emoji and RTL are plain text, and the remove label carries them', async () => {
    const title = '<b>"Tom & Jerry"</b> 🧸 سارة'
    serve([ev({ title })], [])
    render(<OrgPublishScreen />)
    expect(await screen.findByText(title)).toBeTruthy()
    expect(screen.getByRole('button', { name: `Remove ${title}` })).toBeTruthy()
  })

  it('New event and New story open their own forms', async () => {
    serve([], [])
    render(<OrgPublishScreen />)
    fireEvent.press(await screen.findByRole('button', { name: 'New event' }))
    fireEvent.press(screen.getByRole('button', { name: 'New story' }))
    expect(mockPush.mock.calls).toEqual([['/organisation/events/new'], ['/organisation/stories/new']])
  })

  it('leading no organisation never calls the API', () => {
    mockCaps = { ledOrgs: [] }
    render(<OrgPublishScreen />)
    expect(mockGet).not.toHaveBeenCalled()
  })
})

describe('StoryFormScreen', () => {
  // TextField carries no accessibilityLabel from its label, so inputs are found in form order.
  const ORDER = ['Title', 'One-sentence summary', 'The story', 'Byline (who wrote it)', 'The quote', 'Who said it']
  const field = (label: string) => screen.UNSAFE_getAllByType(TextInput)[ORDER.indexOf(label)]
  const fill = (title = 'Leo drum', summary = 'It works', body = 'It went well.') => {
    fireEvent.changeText(field('Title'), title)
    fireEvent.changeText(field('One-sentence summary'), summary)
    fireEvent.changeText(field('The story'), body)
  }
  const consent = () => fireEvent.press(screen.getByRole('checkbox'))
  const publish = () => screen.getByRole('button', { name: 'Publish to Stories' })

  it('Publish stays off until the story is filled in AND consent is ticked', () => {
    render(<StoryFormScreen />)
    expect(publish()).toBeDisabled()
    fill()
    expect(publish()).toBeDisabled()
    consent()
    expect(publish()).not.toBeDisabled()
    consent()
    expect(publish()).toBeDisabled()
  })

  it.each([['title', ['  ', 'S', 'B']], ['summary', ['T', '\n', 'B']], ['story', ['T', 'S', '   \t ']]])(
    'a whitespace-only %s keeps Publish off', (_n, [t, s, b]) => {
      render(<StoryFormScreen />)
      fill(t, s, b); consent()
      expect(publish()).toBeDisabled()
    })

  it('a byline cleared to blank keeps Publish off; left alone it is the organisation\'s name', () => {
    render(<StoryFormScreen />)
    fill(); consent()
    expect(field('Byline (who wrote it)').props.value).toBe('Northside')
    fireEvent.changeText(field('Byline (who wrote it)'), '   ')
    expect(publish()).toBeDisabled()
  })

  it('a pull quote with nobody saying it blocks Publish and explains why', () => {
    render(<StoryFormScreen />)
    fill(); consent()
    fireEvent.changeText(field('The quote'), 'It was great')
    expect(publish()).toBeDisabled()
    expect(screen.getByText(/A quote needs someone to have said it/)).toBeTruthy()
    fireEvent.changeText(field('Who said it'), 'Hannah')
    expect(publish()).not.toBeDisabled()
  })

  it('counts words, never reads 0 minutes, and reads 2 min for ~400 words', () => {
    render(<StoryFormScreen />)
    expect(screen.getByText('0 words · about 1 min read')).toBeTruthy()
    fireEvent.changeText(field('The story'), Array(400).fill('w').join(' '))
    expect(screen.getByText('400 words · about 2 min read')).toBeTruthy()
  })

  it('words are counted across newlines and runs of spaces', () => {
    render(<StoryFormScreen />)
    fireEvent.changeText(field('The story'), 'one  two\n\nthree\tfour')
    expect(screen.getByText(/^4 words/)).toBeTruthy()
  })

  it('L20 posts trimmed fields, null for blank quote parts, the chosen kind, and goes back', async () => {
    render(<StoryFormScreen />)
    fireEvent.press(screen.getByRole('radio', { name: 'Maker story' }))
    fill('  Leo drum  ', '  Works  ', '  Para one.\n\nPara two.  '); consent()
    fireEvent.press(publish())
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    const [path, body] = mockPost.mock.calls[0]
    expect(path).toBe('/api/organizations/o1/stories')
    expect(body).toMatchObject({ kind: 'maker', title: 'Leo drum', summary: 'Works', body: 'Para one.\n\nPara two.', byline: 'Northside', pull_quote: null, pull_quote_by: null, consent_confirmed: true, status: 'published' })
    await waitFor(() => expect(mockBack).toHaveBeenCalled())
  })

  it('the announcement kind (admin-only) is not offered', () => {
    render(<StoryFormScreen />)
    expect(screen.queryByRole('radio', { name: /Announcement/i })).toBeNull()
  })

  it('L20 a draft can be saved without consent, and says draft', async () => {
    render(<StoryFormScreen />)
    fill()
    fireEvent.press(screen.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/organizations/o1/stories', expect.objectContaining({ status: 'draft', consent_confirmed: false })))
  })

  it('the consent hint appears only once the story is ready and unconsented', () => {
    render(<StoryFormScreen />)
    expect(screen.queryByText(/Publishing is held until consent/)).toBeNull()
    fill()
    expect(screen.getByText(/Publishing is held until consent/)).toBeTruthy()
    consent()
    expect(screen.queryByText(/Publishing is held until consent/)).toBeNull()
  })

  it('a refused save shows the API words, stays on the form, keeps the text and unlocks the buttons', async () => {
    mockPost.mockRejectedValueOnce(new Error('Request failed with status 400: Title is too long'))
    render(<StoryFormScreen />)
    fill('Leo drum'); consent()
    fireEvent.press(publish())
    expect(await screen.findByText('Title is too long')).toBeTruthy()
    expect(mockBack).not.toHaveBeenCalled()
    expect(field('Title').props.value).toBe('Leo drum')
    expect(publish()).not.toBeDisabled()
  })

  it('a double tap on Publish posts once', async () => {
    let resolve!: (v: unknown) => void
    mockPost.mockReturnValue(new Promise((r) => { resolve = r }))
    render(<StoryFormScreen />)
    fill(); consent()
    fireEvent.press(publish()); fireEvent.press(publish())
    expect(mockPost).toHaveBeenCalledTimes(1)
    resolve({})
  })

  // 'very long' is left out: maxLength is native, and fireEvent bypasses it.
  it.each(NAMES.filter((c) => c.label !== 'very long').map((c): [string, string] => [c.label, c.value]))('a title with %s is posted verbatim (trimmed)', async (_l, v) => {
    render(<StoryFormScreen />)
    fill(v); consent()
    fireEvent.press(publish())
    await waitFor(() => expect(mockPost).toHaveBeenCalled())
    expect(mockPost.mock.calls[0][1].title).toBe(v.trim())
  })

  it('shows skeletons rather than a form for someone who leads nothing', () => {
    mockCaps = { ledOrgs: [] }
    render(<StoryFormScreen />)
    expect(screen.queryByLabelText('Title')).toBeNull()
  })
})

describe('OrgNewsScreen', () => {
  it('L30 a story notification resolves its organisation and replaces itself with that profile', async () => {
    mockGet.mockResolvedValue({ org_id: 'o9' })
    render(<OrgNewsScreen kind="story" id="x1" />)
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith({ pathname: '/toy-library/organisation/[id]', params: { id: 'o9' } }))
    expect(mockGet).toHaveBeenCalledWith('/api/public/stories/x1')
  })

  it('L30 an event link goes straight to the event screen without a lookup', () => {
    render(<OrgNewsScreen kind="event" id="x1" />)
    expect(mockReplace).toHaveBeenCalledWith('/events/x1')
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('an unpublished or deleted item says it is no longer published', async () => {
    mockGet.mockRejectedValue(new Error('Request failed with status 404'))
    render(<OrgNewsScreen kind="story" id="x1" />)
    expect(await screen.findByText('That is no longer published.')).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('a row with no organisation says the same, rather than navigating to /undefined', async () => {
    mockGet.mockResolvedValue({ org_id: null })
    render(<OrgNewsScreen kind="story" id="x1" />)
    expect(await screen.findByText('That is no longer published.')).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
  })
})

jest.mock('react-native-safe-area-context', () => require('../../bottom-spacing').insetMock())

describe('StoryFormScreen — bottom spacing', () => {
  it('ends its scroll one gutter above the home indicator', () => {
    render(<StoryFormScreen />)
    expect(scrollPaddings(screen)).toEqual([CLEARANCE])
  })
})
