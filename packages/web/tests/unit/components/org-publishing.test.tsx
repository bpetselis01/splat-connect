import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { OrgPublishing } from '@/components/org-publishing'
import { browserApiClient } from '@/lib/browser-api-client'
import type { OrgEvent, OrgStory } from '@splat-connect/types'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { patch: vi.fn(), delete: vi.fn() } }))

const future = new Date(Date.now() + 14 * 864e5).toISOString()
const event = (over: Record<string, unknown>) =>
  ({
    id: 'e1', org_id: 'o1', kind: 'build_day', title: 'Live build day', starts_at: future, ends_at: null,
    format: 'in_person', suburb: 'Newtown', state: 'NSW', location: 'The hall', status: 'published', ...over,
  }) as unknown as OrgEvent
const story = (over: Record<string, unknown>) =>
  ({
    id: 's1', org_id: 'o1', kind: 'family', title: 'Live story', byline: 'The club', status: 'published',
    consent_confirmed: true, published_at: '2026-10-01T00:00:00Z', created_at: '2026-10-01T00:00:00Z', ...over,
  }) as unknown as OrgStory

const events = [event({}), event({ id: 'e2', title: 'Draft day', status: 'draft' })]
const stories = [story({}), story({ id: 's2', title: 'Draft story', status: 'draft', consent_confirmed: false })]

const renderIt = (over: Partial<Parameters<typeof OrgPublishing>[0]> = {}) =>
  render(<OrgPublishing orgId="o1" events={events} stories={stories} going={{ e1: 4 }} toAnswer={{ e1: 2 }} {...over} />)
const row = (title: string) => screen.getByRole('heading', { name: title }).closest('article')!
const openStories = () => fireEvent.mouseDown(screen.getByRole('tab', { name: /Stories/ }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(browserApiClient.patch).mockResolvedValue({} as never)
  vi.mocked(browserApiClient.delete).mockResolvedValue(null as never)
})

describe('OrgPublishing', () => {
  it('WB15 counts upcoming events, people going, live stories and drafts, and badges each row', () => {
    renderIt()
    const chips = Array.from(document.querySelectorAll('.count-chip')).map((c) => c.textContent)
    expect(chips).toEqual(['1Upcoming events', '4People going', '1Stories live', '2Drafts'])
    expect(screen.getByRole('tab', { name: /Events/ })).toHaveTextContent('Events 2')
    expect(screen.getByRole('tab', { name: /Stories/ })).toHaveTextContent('Stories 2')
    expect(within(row('Live build day')).getByText('Published')).toBeInTheDocument()
    expect(within(row('Draft day')).getByText('Draft')).toBeInTheDocument()
    expect(row('Live build day')).toHaveTextContent('Newtown NSW')
    expect(row('Live build day')).toHaveTextContent('4 going · 2 to answer')
  })

  it('WB15 offers a way in from an empty Events tab and an empty Stories tab', () => {
    renderIt({ events: [], stories: [] })
    expect(screen.getByText('No events yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Publish an event' })).toHaveAttribute('href', '/dashboard/organisation/events/new')
    openStories()
    expect(screen.getByText('No stories yet')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Write a story' })).toHaveAttribute('href', '/dashboard/organisation/stories/new')
  })

  it('WB16 Unpublish sends status draft for a live event, and Publish sends status published for a draft one', async () => {
    renderIt()
    fireEvent.click(within(row('Live build day')).getByRole('button', { name: 'Unpublish' }))
    await waitFor(() => expect(browserApiClient.patch).toHaveBeenCalledWith('/api/organizations/o1/events/e1', { status: 'draft' }), { timeout: 5000 })
    await waitFor(() => expect(within(row('Draft day')).getByRole('button', { name: 'Publish' })).toBeEnabled(), { timeout: 5000 })
    fireEvent.click(within(row('Draft day')).getByRole('button', { name: 'Publish' }))
    await waitFor(() => expect(browserApiClient.patch).toHaveBeenCalledWith('/api/organizations/o1/events/e2', { status: 'published' }), { timeout: 5000 })
    expect(refresh).toHaveBeenCalled()
  })

  it('WB16 publishes a story through the stories endpoint, and shows the refusal in words', async () => {
    renderIt()
    openStories()
    vi.mocked(browserApiClient.patch).mockRejectedValueOnce(new Error('400 {"error":"Confirm consent first"}'))
    fireEvent.click(within(row('Draft story')).getByRole('button', { name: 'Publish' }))
    await waitFor(() => expect(browserApiClient.patch).toHaveBeenCalledWith('/api/organizations/o1/stories/s2', { status: 'published' }), { timeout: 5000 })
    expect(await screen.findByRole('alert')).toHaveTextContent('Confirm consent first')
  })

  it('WB17 the bin removes an event or a story through its own endpoint', async () => {
    renderIt()
    fireEvent.click(screen.getByRole('button', { name: 'Remove Draft day' }))
    await waitFor(() => expect(browserApiClient.delete).toHaveBeenCalledWith('/api/organizations/o1/events/e2'), { timeout: 5000 })
    openStories()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove Live story' })).toBeEnabled(), { timeout: 5000 })
    fireEvent.click(screen.getByRole('button', { name: 'Remove Live story' }))
    await waitFor(() => expect(browserApiClient.delete).toHaveBeenCalledWith('/api/organizations/o1/stories/s1'), { timeout: 5000 })
    expect(refresh).toHaveBeenCalled()
  })

  it('WB18 gives a live event Manage, View and Edit links, and a draft only Edit', () => {
    renderIt()
    const live = within(row('Live build day'))
    expect(live.getByRole('link', { name: /Manage/ })).toHaveAttribute('href', '/dashboard/org/events/e1')
    expect(live.getByRole('link', { name: /Manage/ })).toHaveTextContent('2')
    expect(live.getByRole('link', { name: 'View' })).toHaveAttribute('href', '/get-involved/events/e1')
    expect(live.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/dashboard/organisation/events/e1/edit')
    const draft = within(row('Draft day'))
    expect(draft.queryByRole('link', { name: /Manage/ })).toBeNull()
    expect(draft.queryByRole('link', { name: 'View' })).toBeNull()
    expect(draft.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/dashboard/organisation/events/e2/edit')
    openStories()
    expect(within(row('Live story')).getByRole('link', { name: 'View' })).toHaveAttribute('href', '/about/stories/s1')
    expect(within(row('Draft story')).getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/dashboard/organisation/stories/s2/edit')
  })
})
