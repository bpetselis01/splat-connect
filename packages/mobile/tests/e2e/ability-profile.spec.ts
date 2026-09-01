import { test, expect } from '@playwright/test'
import { signUpNewAccount, uniqueSignupEmail, openSubScreen, selectPill } from './helpers'

// The MACS/BFMF dropdowns live behind the collapsed "Clinical scores
// (optional)" disclosure; its state is local, so a reload folds it shut and
// every assertion against those pills must reopen it first.
async function openClinicalScores(page: import('@playwright/test').Page) {
  await page.getByText('Clinical scores (optional)').click()
}

test('manual ability selections persist across a reload', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  await openSubScreen(page, 'Ability Profile')

  await selectPill(page, 'Unilateral') // reveals assisting hand once committed
  await selectPill(page, 'Left') // assisting hand
  await openClinicalScores(page)
  await selectPill(page, 'II') // MACS level
  await selectPill(page, '3') // BFMF score

  await page.waitForTimeout(1000)
  await page.reload()

  await expect(page.getByRole('button', { name: 'Left', exact: true })).toHaveAttribute('aria-selected', 'true')
  await openClinicalScores(page)
  await expect(page.getByRole('button', { name: 'II', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: '3', exact: true })).toHaveAttribute('aria-selected', 'true')
})

test('the questionnaire derives the fit pair and persists it', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  await openSubScreen(page, 'Ability Profile')

  await page.getByText('How does your child use their hands?').click()
  // First option of every question → all zeros → internal I / 1.
  for (const option of [
    'Easily, with either hand',
    'Independently with both hands',
    'Uses it well as a helper',
    'None',
  ]) {
    await page.getByText(option, { exact: true }).click()
  }
  await page.getByText('Save answers', { exact: true }).click()

  // The derived pair lands in the clinical-scores dropdowns, never in the quiz UI.
  await openClinicalScores(page)
  await expect(page.getByRole('button', { name: 'I', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: '1', exact: true })).toHaveAttribute('aria-selected', 'true')

  await page.waitForTimeout(1000)
  await page.reload()
  await openClinicalScores(page)
  await expect(page.getByRole('button', { name: 'I', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: '1', exact: true })).toHaveAttribute('aria-selected', 'true')
})

test('changing a manual selection to a different value persists', async ({ page }) => {
  await signUpNewAccount(page, uniqueSignupEmail())
  await openSubScreen(page, 'Ability Profile')

  await openClinicalScores(page)
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

  await openClinicalScores(page)
  await expect(page.getByRole('button', { name: 'III', exact: true })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  await expect(page.getByRole('button', { name: 'II', exact: true })).toHaveAttribute(
    'aria-selected',
    'false'
  )
})
