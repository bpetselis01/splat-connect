import { test, expect } from '@playwright/test'
import { FOOTER_COLUMNS } from '../../../lib/public-nav'

/**
 * The broadest guard in the suite.
 *
 * The footer's columns are a literal list (the board's labels are not the
 * nav's), so walking every one of its links is what catches a typo'd or
 * never-built href.
 */
const ALL_HREFS = FOOTER_COLUMNS.flatMap((c) => c.rows.map((r) => r.href))

test.describe('fat footer', () => {
  test('renders on a public page with every destination', async ({ page }) => {
    await page.goto('/')
    const footer = page.locator('footer')
    await expect(footer).toBeVisible()
    for (const href of ALL_HREFS) {
      await expect(footer.locator(`a[href="${href}"]`).first()).toBeAttached()
    }
  })

  test('every destination it lists actually resolves', async ({ page }) => {
    for (const href of ALL_HREFS) {
      const res = await page.goto(href)
      expect(res?.status(), `${href} should resolve`).toBeLessThan(400)
      await expect(page.getByRole('heading', { level: 1 }), `${href} needs an h1`).toBeVisible()
    }
  })

  test('is present on a scaffold page too, so a placeholder is never a dead end', async ({ page }) => {
    await page.goto('/impact/news')
    await expect(page.locator('footer').getByRole('link', { name: 'Privacy policy' })).toBeVisible()
  })

  // /login and /signup left the bare list on 2026-09-18 (app/layout.tsx,
  // BARE_PREFIXES; landed in 105d3b5d): the board draws the full site chrome on
  // both. The gates under /auth and /onboarding stay bare.
  test('is absent on the gate pages, which are deliberately bare', async ({ page }) => {
    await page.goto('/auth/confirmed')
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.locator('footer')).toHaveCount(0)
    await expect(page.getByRole('banner')).toHaveCount(0)
  })

  test('renders on the sign-in page, which the board draws with the site chrome', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('footer').getByRole('link', { name: 'Privacy policy' })).toBeVisible()
  })
})
