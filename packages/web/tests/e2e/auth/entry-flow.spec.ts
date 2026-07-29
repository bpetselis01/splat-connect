import { test, expect } from '@playwright/test'

// Chain: "Contribute" named one of three audiences and pointed at signup. With one
//        account type behind it (parents and contributors alike), it was wrong for
//        the other two and wrong about the destination — a returning user had no
//        obvious way to sign in. The nav's logged-out control is now "Sign in" → /login.
//
// Note: the login page's own onward link to /signup ("Create an account") is not
// covered here — that link's wording is rewritten in a later task, not this one.
test.describe('the entry point', () => {
  test('a logged-out visitor is offered sign in, which reaches the login page', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/login$/)
  })
})
