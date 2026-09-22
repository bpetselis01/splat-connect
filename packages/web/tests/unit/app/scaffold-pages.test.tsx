import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SCAFFOLD_KEYS } from '@/lib/public-nav'
import MapPage from '@/app/impact/map/page'
import PrintingPartsPage from '@/app/printing/parts/page'

// Paired with the featureKey each page actually passes to NotifyForm, not
// just position — SCAFFOLD_KEYS order (derived from PUBLIC_NAV) does not
// match this array's order, so a length check alone would not catch page N
// carrying the wrong key.
/*
 * Five became two on 2026-09-17.
 *
 * /impact/news and /impact/events are real screens now (/about/stories and
 * /get-involved/events) and the old URLs redirect. Ask an expert, Partners and
 * Support are real too.
 *
 * The map stays a scaffold ON PURPOSE: the artboard's own Deliveries map screen
 * is a "Not built yet" with a notify form, so shipping one would be inventing a
 * feature the design does not have. Printable parts likewise.
 */
const pages = [
  ['map', MapPage],
  ['printing-parts', PrintingPartsPage],
] as const

describe('scaffold pages', () => {
  it('covers every scaffold key declared in the nav model', () => {
    expect(pages).toHaveLength(SCAFFOLD_KEYS.length)
    expect(pages.map(([key]) => key).sort()).toEqual([...SCAFFOLD_KEYS].sort())
  })

  it.each(pages)(
    '%s scaffold page says it is not built, routes onward, and offers to notify under its own key',
    (expectedKey, Page) => {
      render(<Page />)
      expect(screen.getByText(/not built yet/i)).toBeInTheDocument()
      // The plan layout ends on Guides; the board's "Not built yet" layout on
      // its "In the meantime" links. Either way, not a dead end.
      expect(screen.getAllByRole('link').length).toBeGreaterThan(0)
      expect(screen.getByLabelText(/email/i).id).toBe(`notify-${expectedKey}`)
    }
  )
})
