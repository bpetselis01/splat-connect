import { test, expect } from '@playwright/test'
import { createContributor, signIn } from './helpers'

test('a contributor signs in to the account view, not the child profile', async ({ page }) => {
  const { email, password } = await createContributor()
  await signIn(page, email, password)

  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible()
  // The role-branch must NOT show the parent child-profile home.
  await expect(page.getByText('Customization Metrics')).toHaveCount(0)
})
