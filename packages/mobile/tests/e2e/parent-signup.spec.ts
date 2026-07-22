import { test, expect } from '@playwright/test'
import { signUpParent, uniqueParentEmail } from './helpers'

test('a parent can sign up and reach the child-profile home', async ({ page }) => {
  await signUpParent(page, uniqueParentEmail())
  // The three data-capture sub-screens are the child-profile home's signature.
  await expect(page.getByText('Ability Profile')).toBeVisible()
  await expect(page.getByText('Everyday Needs')).toBeVisible()
  await expect(page.getByText('Customization Metrics')).toBeVisible()
})
