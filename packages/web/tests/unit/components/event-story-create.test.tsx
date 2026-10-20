import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EventForm } from '@/components/event-form'
import { StoryForm } from '@/components/story-form'
import { browserApiClient } from '@/lib/browser-api-client'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))
vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { post: vi.fn(), patch: vi.fn(), put: vi.fn() },
}))
const post = vi.mocked(browserApiClient.post)
const put = vi.mocked(browserApiClient.put)

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

function fillEvent() {
  type('Event name', 'Term 4 build day')
  type('Date', '2026-11-14')
  type('Starts', '10:00')
  type('Venue and street', 'The hall, 1 High St')
  type('Suburb', 'Newtown')
  type('Who is it for?', 'Families')
}

beforeEach(() => {
  vi.clearAllMocks()
  post.mockResolvedValue({ id: 'new1' } as never)
  put.mockResolvedValue([] as never)
})

describe('EventForm creating an event', () => {
  it('WB19 "Publish to Events" posts the event as published, then its questions, and opens the public page', async () => {
    render(<EventForm orgId="o1" orgName="The club" />)
    expect(screen.getByRole('button', { name: 'Publish to Events' })).toBeDisabled()
    fillEvent()
    fireEvent.click(screen.getByRole('button', { name: 'Publish to Events' }))
    await waitFor(() => expect(put).toHaveBeenCalled())
    expect(post).toHaveBeenCalledWith(
      '/api/organizations/o1/events',
      expect.objectContaining({
        title: 'Term 4 build day',
        kind: 'build_day',
        format: 'in_person',
        location: 'The hall, 1 High St',
        suburb: 'Newtown',
        audience: 'Families',
        starts_at: new Date('2026-11-14T10:00').toISOString(),
        cost_cents: 0,
        status: 'published',
      }),
    )
    expect(put).toHaveBeenCalledWith('/api/organizations/o1/events/new1/questions', { questions: [] })
    expect(push).toHaveBeenCalledWith('/get-involved/events/new1')
  })

  it('WB19 "Save as draft" needs nothing filled in, posts status draft and returns to the list', async () => {
    render(<EventForm orgId="o1" orgName="The club" />)
    type('Event name', 'Half done')
    fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() => expect(put).toHaveBeenCalled())
    expect(post).toHaveBeenCalledWith('/api/organizations/o1/events', expect.objectContaining({ title: 'Half done', status: 'draft' }))
    expect(push).toHaveBeenCalledWith('/dashboard/organisation/publish')
  })
})

describe('StoryForm creating a story', () => {
  function fillStory() {
    type('Title', 'Leo’s drum')
    type('One-sentence summary', 'A drum, six weeks on.')
    type(/^The story/, 'It still gets played every day.')
    type(/Byline/, 'The club')
  }

  it('WB25 "Publish to Stories" stays held until consent is ticked, then posts the story as published', async () => {
    render(<StoryForm orgId="o1" orgName="The club" />)
    fillStory()
    const publish = screen.getByRole('button', { name: 'Publish to Stories' })
    expect(publish).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    expect(publish).toBeEnabled()
    fireEvent.click(publish)
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/api/organizations/o1/stories',
        expect.objectContaining({ title: 'Leo’s drum', byline: 'The club', consent_confirmed: true, status: 'published' }),
      ),
    )
    expect(push).toHaveBeenCalledWith('/about/stories/new1')
  })

  it('WB25 "Save as draft" posts status draft without consent and returns to the list', async () => {
    render(<StoryForm orgId="o1" orgName="The club" />)
    type('Title', 'Draft story')
    fireEvent.click(screen.getByRole('button', { name: 'Save as draft' }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/api/organizations/o1/stories',
        expect.objectContaining({ title: 'Draft story', consent_confirmed: false, status: 'draft' }),
      ),
    )
    expect(push).toHaveBeenCalledWith('/dashboard/organisation/publish')
  })
})
