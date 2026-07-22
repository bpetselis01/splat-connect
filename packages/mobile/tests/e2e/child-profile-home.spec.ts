import { test, expect } from '@playwright/test'
import { signUpParent, uniqueParentEmail } from './helpers'

test('the age field autosaves and survives a reload', async ({ page }) => {
  await signUpParent(page, uniqueParentEmail())
  await page.getByPlaceholder('Age').fill('6')
  await page.waitForTimeout(1000) // debounced autosave → PUT
  await page.reload()
  await expect(page.getByPlaceholder('Age')).toHaveValue('6')
})
