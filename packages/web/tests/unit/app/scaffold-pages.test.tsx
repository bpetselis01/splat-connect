import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SCAFFOLD_KEYS } from '@/lib/public-nav'
import RequestsPage from '@/app/get-involved/requests/page'
import DesignChallengesPage from '@/app/get-involved/design-challenges/page'
import AskAnExpertPage from '@/app/learn/ask-an-expert/page'
import NewsPage from '@/app/impact/news/page'
import EventsPage from '@/app/impact/events/page'
import MapPage from '@/app/impact/map/page'
import PartnersPage from '@/app/about/partners/page'
import SupportPage from '@/app/about/support/page'
import PrintingPage from '@/app/printing/page'

// Paired with the featureKey each page actually passes to NotifyForm, not
// just position — SCAFFOLD_KEYS order (derived from PUBLIC_NAV) does not
// match this array's order, so a length check alone would not catch page N
// carrying the wrong key.
const pages = [
  ['requests', RequestsPage],
  ['design-challenges', DesignChallengesPage],
  ['ask-an-expert', AskAnExpertPage],
  ['news', NewsPage],
  ['events', EventsPage],
  ['map', MapPage],
  ['partners', PartnersPage],
  ['support', SupportPage],
  ['printing', PrintingPage],
] as const

describe('scaffold pages', () => {
  it('covers every scaffold key declared in the nav model', () => {
    expect(pages).toHaveLength(SCAFFOLD_KEYS.length)
    expect(pages.map(([key]) => key).sort()).toEqual([...SCAFFOLD_KEYS].sort())
  })

  it.each(pages)(
    '%s scaffold page explains the plan and offers to notify under its own key',
    (expectedKey, Page) => {
      render(<Page />)
      expect(screen.getByText(/not built yet/i)).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2, name: /how it will work/i })).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i).id).toBe(`notify-${expectedKey}`)
    }
  )
})
