import { describe, it, expect, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
import { render, screen } from '@testing-library/react'
import type { EventListItem } from '@splat-connect/types'
import { EventCard } from '@/components/event-card'

const event = (over: Partial<EventListItem>) =>
  ({
    id: 'ev-1',
    title: 'Switch build day',
    kind: 'build_day',
    format: 'in_person',
    starts_at: '2026-11-01T01:00:00Z',
    ends_at: '2026-11-01T04:00:00Z',
    suburb: 'Fitzroy',
    state: 'VIC',
    location: null,
    photo_urls: [],
    cost_cents: null,
    org_name: 'Northside Makers',
    going_count: 0,
    seats_left: null,
    viewer_going: false,
    has_questions: false,
    ...over,
  }) as EventListItem

describe('EventCard', () => {
  // The API refuses a costed registration without cost_acknowledged, which
  // only the register form sends, so a one-tap POST would always fail.
  it('WI33 sends a costed event with no questions to the register form', () => {
    render(<EventCard event={event({ cost_cents: 450 })} signedIn hasQuestions={false} />)
    expect(screen.getByRole('link', { name: /I.m going/ })).toHaveAttribute('href', '/get-involved/events/ev-1/register')
  })

  it('WI31 registers a free event with no questions in one tap', () => {
    render(<EventCard event={event({})} signedIn hasQuestions={false} />)
    expect(screen.getByRole('button', { name: /I.m going/ })).toBeInTheDocument()
  })

  it('WI30 opens the event page from the title', () => {
    render(<EventCard event={event({})} signedIn hasQuestions={false} />)
    expect(screen.getByRole('link', { name: 'Switch build day' })).toHaveAttribute('href', '/get-involved/events/ev-1')
  })
})
