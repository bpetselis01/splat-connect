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

test('the arm-attachment toggle gates the forearm-length field', async ({ page }) => {
  await signUpParent(page, uniqueParentEmail())
  await openSubScreen(page, 'Customization Metrics')

  await expect(page.getByPlaceholder('Forearm length')).toHaveCount(0)
  await page.getByRole('switch').click()
  await page.getByPlaceholder('Forearm length').fill('130')

  await page.waitForTimeout(1000)
  await page.reload()

  await expect(page.getByPlaceholder('Forearm length')).toHaveValue('130')
})

test('hand dominance and sensory preferences persist across a reload', async ({ page }) => {
  await signUpParent(page, uniqueParentEmail())
  await openSubScreen(page, 'Customization Metrics')

  await page.getByRole('button', { name: 'Right', exact: true }).click() // hand dominance
  await page.getByRole('button', { name: 'Soft', exact: true }).click() // sensory preference

  await page.waitForTimeout(1000)
  await page.reload()

  await expect(page.getByRole('button', { name: 'Right', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: 'Soft', exact: true })).toHaveAttribute('aria-selected', 'true')
})
