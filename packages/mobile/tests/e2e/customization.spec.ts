import { test, expect } from '@playwright/test'
import { signUpParent, uniqueParentEmail, openSubScreen } from './helpers'

test('palm and wrist metrics autosave and survive a reload', async ({ page }) => {
  await signUpParent(page, uniqueParentEmail())
  await openSubScreen(page, 'Customization Metrics')

  await page.getByPlaceholder('Palm width').fill('62')
  await page.getByPlaceholder('Wrist circumference').fill('48')

  await page.waitForTimeout(1000)
  await page.reload()

  await expect(page.getByPlaceholder('Palm width')).toHaveValue('62')
  await expect(page.getByPlaceholder('Wrist circumference')).toHaveValue('48')
})
