import { test, expect, type Page } from '@playwright/test'

/**
 * The public shell and its decorative layer.
 *
 * Two properties that no other spec covers, both of which have already been
 * broken once in review rather than in theory:
 *
 *  1. The shell is one measure. The top bar, the content column and the footer
 *     are three separate elements that have to agree, and an earlier pass
 *     narrowed the content on articles without narrowing the other two — so
 *     navigating from a hub to the privacy policy shifted the whole chrome
 *     inward by up to 192px at 1920. Nothing failed; it was caught by eye.
 *
 *  2. The art placeholders are decoration. Stickers and animation slots are
 *     pinned inside and over navigation links, so if one ever loses its
 *     `aria-hidden` it starts dictating that link's accessible name — a
 *     screen reader would announce "ART Switch types explained", and the
 *     visual test suite would go on passing.
 */

/** Left edge and width of the three elements that must share one measure. */
async function shellBoxes(page: Page) {
  return page.evaluate(() => {
    const box = (sel: string) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { left: Math.round(r.left), width: Math.round(r.width) }
    }
    return {
      nav: box('header nav'),
      main: box('main'),
      footer: box('footer > div'),
    }
  })
}

// One of each page class the design system defines: a hub with the full
// treatment, a catalogue, and an article in the quiet register. The article is
// the one that regressed, and it only regresses relative to the others, so a
// single-page assertion could not have caught it.
const PAGE_CLASSES = [
  { path: '/', kind: 'homepage' },
  { path: '/learn', kind: 'section hub' },
  { path: '/library', kind: 'catalogue' },
  { path: '/privacy', kind: 'article (quiet register)' },
]

test.describe('the public shell', () => {
  test('keeps the content and the footer on one edge, and the bar identical everywhere', async ({ page }) => {
    // Since the parity pass (105d3b5d) the bar is the board's own "unified
    // chrome" — a 1400px row with 28px of padding — and no longer shares the
    // 1216px content column; the footer still does. What must not happen is
    // what this guarded in the first place: the chrome moving between pages.
    //
    // Pinned to 1920, where the bar's 1400 cap and the column's 1216 cap both
    // bite, so a bar or footer that drifted onto another width shows.
    await page.setViewportSize({ width: 1920, height: 1080 })

    const bars = new Set<string>()
    for (const { path, kind } of PAGE_CLASSES) {
      await page.goto(path)
      const { nav, main, footer } = await shellBoxes(page)

      expect(nav, `${path} should render a top bar`).not.toBeNull()
      expect(main, `${path} should render a content column`).not.toBeNull()
      expect(footer, `${path} should render a footer`).not.toBeNull()

      expect(footer!.left, `${kind} (${path}): footer and content must start together`).toBe(
        main!.left
      )
      expect(footer!.width, `${kind} (${path}): footer and content must be the same width`).toBe(
        main!.width
      )
      bars.add(`${nav!.left}:${nav!.width}`)
    }
    expect([...bars], 'the bar must sit in the same place on every page').toEqual(['260:1400'])
  })

  test('uses the same measure on every page, so the chrome never jumps', async ({ page }) => {
    // 1920, deliberately, and this is the whole reason the test is credible.
    // The shell is min(100% - 4rem, 1216px); an article cap narrower than
    // that only bites once the window is wide enough, so the regression this
    // guards can hide at small widths and the test would pass through it.
    await page.setViewportSize({ width: 1920, height: 1080 })

    const measures = new Map<string, string>()

    for (const { path } of PAGE_CLASSES) {
      await page.goto(path)
      const { main } = await shellBoxes(page)
      measures.set(path, `${main!.left}:${main!.width}`)
    }

    // The regression this exists for: an article that narrows relative to a hub
    // moves the entire page frame when a visitor navigates between the two.
    const distinct = new Set(measures.values())
    expect(
      distinct.size,
      `every page must share one shell measure, got ${JSON.stringify(
        Object.fromEntries(measures)
      )}`
    ).toBe(1)
  })

  test('puts the content where the board does at desktop width', async ({ page }) => {
    // The board's outermost section is `max-width:1280px; padding: 0 32px`
    // under border-box: 1216px of content at x=112 in a 1440 window, measured
    // on ten screens. It replaced the proportional 80% column this used to
    // assert (globals.css .public-shell, landed in 105d3b5d).
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')

    const { main } = await shellBoxes(page)
    expect(main).toEqual({ left: 112, width: 1216 })
  })

  test('never scrolls sideways, at a phone width or a desktop one', async ({ page }) => {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const { path } of PAGE_CLASSES) {
        await page.goto(path)
        const overflows = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth
        )
        expect(overflows, `${path} at ${width}px must not scroll horizontally`).toBe(false)
      }
    }
  })
})

test.describe('the art placeholders', () => {
  test('stay out of the accessibility tree', async ({ page }) => {
    // /learn is the densest case: every hub card carries a sticker, and the
    // lead card carries the section illustration instead of an empty slot.
    await page.goto('/learn')

    // The marks the placeholders render. If any reaches an accessible name, a
    // screen reader reads it aloud as part of the link.
    for (const mark of [/\bART\b/, /^Animation/, /^Overlay/]) {
      await expect(
        page.getByRole('link', { name: mark }),
        `no link's accessible name may contain ${mark}`
      ).toHaveCount(0)
    }
  })

  test('leave the hub card links named by their own content', async ({ page }) => {
    await page.goto('/learn')

    // Positive counterpart to the assertion above: proving the marks are absent
    // is only meaningful if the real names are present.
    //
    // Scoped to main because the fat footer lists every Learn child too, so the
    // page-wide count is 2 and an unscoped assertion fails for a reason that has
    // nothing to do with what this test is about.
    await expect(
      page.locator('main').getByRole('link', { name: /^Switch types explained/ })
    ).toHaveCount(1)
  })

  // Deliberately not tested here: that a sticker cannot swallow a click. A
  // sticker is rendered *inside* the card's own <a>, so a click on it reaches
  // the link whether or not pointer-events is set — verified by removing
  // pointer-events-none and watching the test pass anyway. There is no
  // production change that would make such a test fail, so it would assert
  // nothing. `Slot`'s pointer-events and aria-hidden are covered where they can
  // actually fail, in tests/unit/components/pixel.test.tsx.

})
