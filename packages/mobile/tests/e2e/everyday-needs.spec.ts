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

test('selecting Other reveals a free-text field that persists', async ({ page }) => {
  await signUpParent(page, uniqueParentEmail())
  await openSubScreen(page, 'Everyday Needs')

  await selectPill(page, 'Other')
  await page.getByPlaceholder('Describe the other challenge').fill('Buttoning shirts')

  await page.waitForTimeout(1000)
  await page.reload()

  await expect(page.getByRole('button', { name: 'Other', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByPlaceholder('Describe the other challenge')).toHaveValue('Buttoning shirts')
})

test('grip type and usage environment persist across a reload', async ({ page }) => {
  await signUpParent(page, uniqueParentEmail())
  await openSubScreen(page, 'Everyday Needs')

  await page.getByRole('button', { name: 'Pincer', exact: true }).click() // grip type
  await page.getByRole('button', { name: 'School', exact: true }).click() // usage environment

  await page.waitForTimeout(1000)
  await page.reload()

  await expect(page.getByRole('button', { name: 'Pincer', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: 'School', exact: true })).toHaveAttribute('aria-selected', 'true')
})

test('dropping back under the cap re-enables the blocked chips', async ({ page }) => {
  await signUpParent(page, uniqueParentEmail())
  await openSubScreen(page, 'Everyday Needs')

  await selectPill(page, 'Grasping')
  await selectPill(page, 'Holding')
  await selectPill(page, 'Fine motor')

  await page.getByRole('button', { name: 'Fatigue', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Fatigue', exact: true })).toHaveAttribute(
    'aria-selected',
    'false'
  )

  // Free a slot; the previously-blocked chip must become selectable again.
  await page.getByRole('button', { name: 'Grasping', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Grasping', exact: true })).toHaveAttribute(
    'aria-selected',
    'false'
  )

  await selectPill(page, 'Fatigue')
})
