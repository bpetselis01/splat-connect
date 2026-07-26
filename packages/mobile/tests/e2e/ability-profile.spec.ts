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

test('the questionnaire estimates MACS/BFMF and persists them', async ({ page }) => {
  await signUpParent(page, uniqueParentEmail())
  await openSubScreen(page, 'Ability Profile')

  await page.getByText('Not sure of the clinical terms?').click()
  // First option of every question → all zeros → MACS I / BFMF 1.
  for (const option of [
    'Easily, with either hand',
    'Independently with both hands',
    'Uses it well as a helper',
    'None',
  ]) {
    await page.getByText(option, { exact: true }).click()
  }
  // exact: the questionnaire's own blurb ("we'll estimate MACS BFMF for you")
  // is a substring match for a loose "Estimate".
  await page.getByText('Estimate', { exact: true }).click()

  await expect(page.getByRole('button', { name: 'I', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: '1', exact: true })).toHaveAttribute('aria-selected', 'true')

  await page.waitForTimeout(1000)
  await page.reload()
  await expect(page.getByRole('button', { name: 'I', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: '1', exact: true })).toHaveAttribute('aria-selected', 'true')
})

test('changing a manual selection to a different value persists', async ({ page }) => {
  await signUpParent(page, uniqueParentEmail())
  await openSubScreen(page, 'Ability Profile')

  await selectPill(page, 'Cerebral palsy')
  await selectPill(page, 'II')

  // Single-select fields cannot be cleared — fields.tsx calls onChange(value)
  // with no toggle-off, unlike the multi-select chips. Changing to another
  // value is the reverse transition that actually exists.
  await selectPill(page, 'III')
  await expect(page.getByRole('button', { name: 'II', exact: true })).toHaveAttribute(
    'aria-selected',
    'false'
  )

  await page.waitForTimeout(1000)
  await page.reload()

  await expect(page.getByRole('button', { name: 'III', exact: true })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(page.getByRole('button', { name: 'II', exact: true })).toHaveAttribute(
    'aria-selected',
    'false'
  )
})
