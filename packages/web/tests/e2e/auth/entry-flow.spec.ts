import { test, expect } from '@playwright/test'

// Chain: "Contribute" named one of three audiences and pointed at signup. With one
//        account type behind it (parents and contributors alike), it was wrong for
//        the other two and wrong about the destination — a returning user had no
//        obvious way to sign in. The nav's logged-out control is now "Sign in" → /login.
test.describe('the entry point', () => {
  test('WC07 a logged-out visitor is offered sign in, which reaches the login page', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/login\?next=%2F$/)
  })

  test('WA07 the login page links onward to signup', async ({ page }) => {
    await page.goto('/login')
    // The board's line under the sign-in card.
    await page.getByRole('link', { name: 'Create one' }).click()
    await expect(page).toHaveURL(/\/signup$/)
  })
})
