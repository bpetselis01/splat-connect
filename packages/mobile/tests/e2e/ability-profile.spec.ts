import { test, expect } from '@playwright/test'
import { signUpParent, uniqueParentEmail, openSubScreen, selectPill } from './helpers'

test('manual ability selections persist across a reload', async ({ page }) => {
  await signUpParent(page, uniqueParentEmail())
  await openSubScreen(page, 'Ability Profile')

  await selectPill(page, 'Cerebral palsy')
  await selectPill(page, 'II') // MACS level
  await selectPill(page, 'Unilateral') // reveals assisting hand once committed
  await selectPill(page, 'Left') // assisting hand
  await selectPill(page, '3') // BFMF score

  await page.waitForTimeout(1000)
  await page.reload()

  await expect(page.getByRole('button', { name: 'Cerebral palsy', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: 'II', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: 'Left', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: '3', exact: true })).toHaveAttribute('aria-selected', 'true')
})
