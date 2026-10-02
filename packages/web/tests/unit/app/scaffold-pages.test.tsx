import { describe, it, expect } from 'vitest'
import { SCAFFOLD_KEYS } from '@/lib/public-nav'

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
 * Printable parts shipped on 2026-10-01 and the deliveries map on 2026-10-02
 * (Byron's B4), so no public scaffold is left. The next 'soon' child needs its
 * page listed here and the "says it is not built ... offers to notify" check
 * back (git history, this file before impact-map shipped).
 */
const pages: ReadonlyArray<readonly [string, unknown]> = []

describe('scaffold pages', () => {
  it('covers every scaffold key declared in the nav model', () => {
    expect(pages).toHaveLength(SCAFFOLD_KEYS.length)
    expect(pages.map(([key]) => key).sort()).toEqual([...SCAFFOLD_KEYS].sort())
  })
})
