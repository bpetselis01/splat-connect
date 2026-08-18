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

  test('the top bar carries all six sections and no expandable menu', async ({ page }) => {
    await page.goto('/')
    const header = page.locator('header')
    for (const section of TOP_LEVEL) {
      await expect(header.getByRole('link', { name: section.label, exact: true })).toBeVisible()
    }
    await expect(page.locator('[aria-expanded]')).toHaveCount(0)
  })

  test('the subnav appears inside a section and not on a flat catalogue', async ({ page }) => {
    await page.goto('/learn')
    await expect(page.getByRole('navigation', { name: /learn pages/i })).toBeVisible()

    await page.goto('/toy-library')
    await expect(page.getByRole('navigation', { name: /pages$/i })).toHaveCount(0)
  })

  test('the subnav marks where you are', async ({ page }) => {
    await page.goto('/learn/switch-types')
    const subnav = page.getByRole('navigation', { name: /learn pages/i })
    await expect(subnav.locator('[aria-current="page"]')).toHaveText(/switch types/i)
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
})
