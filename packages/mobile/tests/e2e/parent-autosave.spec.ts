import { test, expect } from '@playwright/test'
import { signUpParent, uniqueParentEmail } from './helpers'

test('a customization metric autosaves and survives a reload', async ({ page }) => {
  await signUpParent(page, uniqueParentEmail())

  await page.getByText('Customization Metrics').click()
  await page.getByPlaceholder('Palm width').fill('62')

  // Autosave is debounced (250ms) then PUT to /api/child-profile. Give it a
  // moment, then reload — the session persists in localStorage, so the parent
  // stays signed in and the screen refetches the saved value.
  await expect(page.getByPlaceholder('Palm width')).toHaveValue('62')
  await page.waitForTimeout(1000)
  await page.reload()

  await expect(page.getByPlaceholder('Palm width')).toHaveValue('62')
})
