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

  test('the top bar carries all seven sections and no expandable menu', async ({ page }) => {
    await page.goto('/')
    const header = page.locator('header')
    for (const section of TOP_LEVEL) {
      await expect(header.getByRole('link', { name: section.label, exact: true })).toBeVisible()
    }
    await expect(page.locator('[aria-expanded]')).toHaveCount(0)
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
    await page.goto('/learn/switch-types')
    const current = page.locator('header').locator('[aria-current="page"]')
    await expect(current).toHaveText('Learn')
    await expect(current).toHaveAttribute('href', '/learn')
  })

  test('the organisations directory is reachable with no session', async ({ page }) => {
    const res = await page.goto('/organizations')
    expect(res?.status()).toBeLessThan(400)
    expect(page.url()).not.toContain('/login')
  })

  test('a scaffold page explains itself and offers to notify', async ({ page }) => {
    await page.goto('/get-involved/requests')
    await expect(page.getByText('Not built yet', { exact: true })).toBeVisible()
    await expect(page.getByLabel(/email address/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /guides/i }).first()).toBeVisible()
  })

  test('the homepage launcher reaches all six sections', async ({ page }) => {
    await page.goto('/')
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

  test('reduced motion removes every tilt rather than animating to it', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    const transforms = await page
      .locator('[class*="tilt-"]')
      .evaluateAll((els) => els.map((e) => getComputedStyle(e).transform))
    expect(transforms.length).toBeGreaterThan(0)
    for (const t of transforms) {
      expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(t)
    }
  })

  test('no section is left invisible when the entrance animation cannot run', async ({ page }) => {
    // The entrance was briefly a JS scroll reveal that server-rendered sections at
    // opacity:0. This asserts content does not depend on an animation to be seen.
    await page.goto('/')
    const hidden = await page
      .locator('.rise')
      .evaluateAll((els) => els.filter((e) => getComputedStyle(e).opacity === '0').length)
    expect(hidden).toBe(0)
  })
})
