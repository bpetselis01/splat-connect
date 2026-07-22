import { test, expect } from '@playwright/test'
import { signUpParent, uniqueParentEmail, openSubScreen, selectPill } from './helpers'

test('challenge chips enforce the max-3 cap', async ({ page }) => {
  await signUpParent(page, uniqueParentEmail())
  await openSubScreen(page, 'Everyday Needs')

  await selectPill(page, 'Grasping')
  await selectPill(page, 'Holding')
  await selectPill(page, 'Fine motor') // 3rd — hits the cap

  // A 4th selection is blocked.
  await page.getByRole('button', { name: 'Fatigue', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Fatigue', exact: true })).toHaveAttribute('aria-selected', 'false')
})
