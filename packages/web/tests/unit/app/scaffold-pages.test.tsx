import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SCAFFOLD_KEYS } from '@/lib/public-nav'
import AskAnExpertPage from '@/app/learn/ask-an-expert/page'
import MapPage from '@/app/impact/map/page'
import PartnersPage from '@/app/about/partners/page'
import SupportPage from '@/app/about/support/page'
import PrintingPartsPage from '@/app/printing/parts/page'

// Paired with the featureKey each page actually passes to NotifyForm, not
// just position — SCAFFOLD_KEYS order (derived from PUBLIC_NAV) does not
// match this array's order, so a length check alone would not catch page N
// carrying the wrong key.
// /impact/news and /impact/events were on this list until 2026-09-17. Both are
// real screens now — /about/stories and /get-involved/events — and the old
// URLs redirect rather than render, so there is no scaffold left to check.
const pages = [
  ['ask-an-expert', AskAnExpertPage],
  ['map', MapPage],
  ['partners', PartnersPage],
  ['support', SupportPage],
  ['printing-parts', PrintingPartsPage],
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
