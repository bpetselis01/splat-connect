import { test, expect } from '@playwright/test'

/**
 * The scaffold rule, enforced rather than remembered.
 *
 * Eleven placeholder pages linked from a top nav teaches a visitor the site is
 * mostly empty — the exact failure the design session set out to avoid. So every
 * top-level link must land on real content, and placeholders live one level down
 * behind a "soon" pill.
 */
const TOP_LEVEL = [
  { href: '/library', label: 'Guides' },
  { href: '/toy-library', label: 'Toy Library' },
  // Promoted from a Get Involved scaffold on 2026-08-20: 3D printing is one of
  // the three things SPLAT provides. The no-placeholder rule below is what
  // forced its hub to become a real page rather than a ComingSoon.
  { href: '/printing', label: '3D Printing' },
  { href: '/learn', label: 'Learn' },
  { href: '/get-involved', label: 'Get Involved' },
  { href: '/impact', label: 'Impact' },
  { href: '/about', label: 'About' },
]

/*
 * Since the board's NAV5 (859eee42, 2026-09-22) five of the seven are tabs and
 * Learn and Impact sit behind a More disclosure, beside the board's other
 * secondary destinations.
 */
const TABS = ['/library', '/toy-library', '/printing', '/get-involved', '/about']
const BEHIND_MORE = TOP_LEVEL.filter((s) => !TABS.includes(s.href))

test.describe('public navigation', () => {
  test('every top-level link resolves and none is a placeholder', async ({ page }) => {
    for (const section of TOP_LEVEL) {
      const res = await page.goto(section.href)
      expect(res?.status(), `${section.href} should not error`).toBeLessThan(400)
      // Exact match on ComingSoon's own marker text, not a loose substring: the
      // Get Involved, Impact and About hubs are real pages that legitimately
      // mention "not built yet" in a caption pointing at their scaffolded
      // children (e.g. "Some of this is not built yet."), which a case-
      // insensitive substring match would wrongly flag as a placeholder itself.
      await expect(
        page.getByText('Not built yet', { exact: true }),
        `${section.href} must not be a scaffold`
      ).toHaveCount(0)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    }
  })

  test('the top bar carries five sections as tabs and the other two behind More', async ({ page }) => {
    await page.goto('/')
    const header = page.locator('header')
    for (const section of TOP_LEVEL.filter((s) => TABS.includes(s.href))) {
      await expect(header.getByRole('link', { name: section.label, exact: true })).toHaveAttribute(
        'href',
        section.href
      )
    }
    // One disclosure, and only one: More. Its links are hidden until it opens.
    await expect(page.locator('[aria-expanded]')).toHaveCount(1)
    const more = header.getByRole('button', { name: 'More' })
    await expect(more).toHaveAttribute('aria-expanded', 'false')
    for (const section of BEHIND_MORE) {
      await expect(header.getByRole('link', { name: section.label, exact: true })).toHaveCount(0)
    }
    await more.click()
    await expect(more).toHaveAttribute('aria-expanded', 'true')
    for (const section of BEHIND_MORE) {
      await expect(header.getByRole('link', { name: new RegExp(`^${section.label}\\b`) })).toHaveAttribute(
        'href',
        section.href
      )
    }
  })

  test('a section page carries one navigation bar, not two', async ({ page }) => {
    // A section subnav used to render a second full-width bar directly beneath
    // the top bar, on every public route. It was duplicating navigation that
    // already existed twice over: the top bar marks the active section and
    // links to its hub, and the hub page lists every sibling as a card with a
    // blurb. Two stacked bars cost ~100px of chrome to say nothing new.
    for (const path of ['/learn', '/learn/switch-types', '/toy-library']) {
      await page.goto(path)
      await expect(page.locator('header'), `${path} should have one header`).toHaveCount(1)
      await expect(
        page.getByRole('navigation', { name: /pages$/i }),
        `${path} should have no section subnav`
      ).toHaveCount(0)
    }
  })

  test('the top bar marks which section you are in', async ({ page }) => {
    // This is what makes the subnav unnecessary rather than merely absent: the
    // sticky top bar is the wayfinding, and it is one click back to the hub.
    // A tab section: its tab is the current page.
    await page.goto('/printing/basics')
    const tab = page.locator('header').locator('[aria-current="page"]')
    await expect(tab).toHaveText('3D Printing')
    await expect(tab).toHaveAttribute('href', '/printing')

    // A section behind More (859eee42): the More button is marked, and inside
    // it the section's own link is the current page.
    await page.goto('/learn/switch-types')
    const more = page.locator('header').getByRole('button', { name: 'More' })
    await expect(more).toHaveAttribute('data-current', 'true')
    await more.click()
    const current = page.locator('header').locator('[aria-current="page"]')
    await expect(current).toHaveText(/^Learn/)
    await expect(current).toHaveAttribute('href', '/learn')
  })

  test('the organisations directory is reachable with no session', async ({ page }) => {
    const res = await page.goto('/organizations')
    expect(res?.status()).toBeLessThan(400)
    expect(page.url()).not.toContain('/login')
  })

  /*
   * Repointed from /get-involved/requests, which stopped being a scaffold with
   * 057 — a build request is a real record now. The claim is about what an
   * unbuilt destination does, so it needs one that is still unbuilt.
   */
  test('a scaffold page explains itself and offers to notify', async ({ page }) => {
    await page.goto('/printing/parts')
    await expect(page.getByText('Not built yet', { exact: true })).toBeVisible()
    await expect(page.getByLabel(/email address/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /guides/i }).first()).toBeVisible()
  })

  test('the homepage reaches all seven sections', async ({ page }) => {
    // The launcher grid went with the Soft Pop rebuild of / (a23f5dad); the
    // header is what reaches every section now, two of them through More.
    await page.goto('/')
    await page.locator('header').getByRole('button', { name: 'More' }).click()
    for (const section of TOP_LEVEL) {
      await expect(page.locator(`a[href="${section.href}"]`).first()).toBeVisible()
    }
  })

  test('the moved printing article redirects permanently to its new home', async ({ page }) => {
    // /learn/3d-printing-basics was the only real 3D printing content on the site,
    // so it moved to anchor the new pillar. Inbound links must follow it.
    const res = await page.goto('/learn/3d-printing-basics')
    expect(res?.status()).toBeLessThan(400)
    expect(page.url()).toContain('/printing/basics')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('no section is left invisible when the entrance animation cannot run', async ({ page }) => {
    // The entrance was briefly a JS scroll reveal that server-rendered sections at
    // opacity:0. This asserts content does not depend on an animation to be seen.
    //
    // Asserted under reduced motion rather than on a freshly loaded page. The
    // entrance is a CSS animation with `both` fill and a stagger of up to 120ms,
    // so a section legitimately reads opacity:0 while its delay is still
    // running: sampling straight after load raced the stagger and the result
    // depended on how fast the machine rendered. Reduced motion collapses the
    // duration to 0.01ms, which lands every section on its final frame at once —
    // and is the state this test actually cares about, since it is the path a
    // visitor who cannot run the animation gets.
    //
    // Since the Soft Pop rebuild of / (a23f5dad) the animated content is the
    // scroll-world's five scenes, which the flight fades and marks inert as
    // they leave the stage. Under reduced motion every one must be readable.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')

    const scenes = page.getByRole('region', { name: 'How SPLAT works, as a journey' }).locator('article')
    await expect(scenes).toHaveCount(5)

    // Polled: the server render marks scenes 2-5 inert until the script takes
    // over, so the first sample can land before hydration.
    await expect
      .poll(() =>
        scenes.evaluateAll(
          (els) => els.filter((e) => getComputedStyle(e).opacity === '0' || e.hasAttribute('inert')).length
        )
      )
      .toBe(0)
  })
})
