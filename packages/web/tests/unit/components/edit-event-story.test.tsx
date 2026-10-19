import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EventForm, localParts } from '@/components/event-form'
import { StoryForm } from '@/components/story-form'
import { browserApiClient } from '@/lib/browser-api-client'
import type { OrgEvent, OrgEventQuestion, OrgStory } from '@splat-connect/types'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { post: vi.fn(), patch: vi.fn(), put: vi.fn() },
}))
const patch = vi.mocked(browserApiClient.patch)
const put = vi.mocked(browserApiClient.put)

// 6:05pm on the host's own clock, stored as UTC the way the API keeps it.
const SIX_PM = new Date(2026, 9, 3, 18, 5).toISOString()

const EVENT = {
  id: 'e1', org_id: 'o1', kind: 'build_day', title: 'Build day', summary: null,
  starts_at: SIX_PM, ends_at: null, format: 'in_person', location: 'The hall',
  suburb: 'Newtown', state: 'NSW', online_url: null, audience: 'Families',
  description: null, what_to_bring: null, tools: [], capacity: null, prints_parts: false,
  part_sets_max: null, accessibility_note: null, cost_cents: null, cost_note: null,
  photo_urls: [], status: 'published', registrations_closed_at: null, cancelled_at: null,
} as unknown as OrgEvent
const QUESTION = { id: 'q1', prompt: 'Any allergies?', answer_type: 'short', required: false, options: [] } as unknown as OrgEventQuestion

const STORY = {
  id: 's1', org_id: 'o1', kind: 'family', title: 'A toy for Sam', summary: 'One sentence.',
  body: 'A paragraph.', byline: 'The club', consent_confirmed: true, pull_quote: null,
  pull_quote_by: null, status: 'published', published_at: SIX_PM,
} as unknown as OrgStory

beforeEach(() => {
  vi.clearAllMocks()
  patch.mockImplementation(async (path: string) => ({ id: path.split('/').pop() }) as never)
  put.mockResolvedValue([] as never)
})

describe('localParts', () => {
  it('reads a stored instant back on the host clock, not UTC', () => {
    expect(localParts(SIX_PM)).toEqual({ date: '2026-10-03', time: '18:05' })
  })
})

describe('EventForm editing a published event', () => {
  it('saves in place and keeps the questions it was given', async () => {
    render(<EventForm orgId="o1" orgName="The club" event={EVENT} questions={[QUESTION]} />)
    expect(screen.queryByRole('button', { name: 'Save as draft' })).toBeNull()
    expect((screen.getByDisplayValue('18:05') as HTMLInputElement).value).toBe('18:05')

    fireEvent.click(screen.getByRole('button', { name: /Save changes/ }))
    await waitFor(() => expect(put).toHaveBeenCalled())
    expect(patch).toHaveBeenCalledWith(
      '/api/organizations/o1/events/e1',
      expect.objectContaining({ title: 'Build day', starts_at: SIX_PM, status: 'published' }),
    )
    expect(put).toHaveBeenCalledWith('/api/organizations/o1/events/e1/questions', {
      questions: [expect.objectContaining({ id: 'q1', prompt: 'Any allergies?' })],
    })
    expect(push).toHaveBeenCalledWith('/get-involved/events/e1')
  })
})

describe('StoryForm editing a published story', () => {
  it('starts with consent unticked and saves only once it is ticked again', async () => {
    render(<StoryForm orgId="o1" orgName="The club" story={STORY} />)
    const save = screen.getByRole('button', { name: /Save changes/ }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Save as draft' })).toBeNull()

    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(save)
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(
        '/api/organizations/o1/stories/s1',
        expect.objectContaining({ title: 'A toy for Sam', consent_confirmed: true, status: 'published' }),
      ),
    )
    expect(push).toHaveBeenCalledWith('/about/stories/s1')
  })
})
