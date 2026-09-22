import path from 'node:path'
import { test, expect } from '@playwright/test'
import { signIn, createContributor, acceptTerms, deleteUser } from '../helpers'

const PHOTO_FIXTURE = path.join(__dirname, '..', 'fixtures', 'test.jpg')

test('a contributor adds a toy, edits it, uploads a cover photo, publishes it, and deletes it', async ({
  page,
}) => {
  const contributor = await createContributor()
  await acceptTerms(contributor.id)

  try {
    await signIn(page, contributor.email, contributor.password)
    await page.waitForURL('**/dashboard')

    await page.goto('/dashboard/toys')
    await page.getByRole('link', { name: 'Add a toy' }).click()
    await page.waitForURL('**/dashboard/toys/new')
    // The board's one card: kind, name, condition, photos. No locked wizard.
    await page.getByRole('radio', { name: /Standard toy/ }).click()
    await page.locator('#new-toy-name').fill('E2E Test Toy')
    await page.locator('#new-toy-condition').fill('6')
    await page.getByRole('button', { name: /Create listing/ }).click()
    // Creation opens the listing editor on Status.
    await page.waitForURL(/\/dashboard\/toys\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('heading', { name: 'E2E Test Toy' })).toBeVisible()

    await page.getByRole('tab', { name: 'Details' }).click()
    await page.locator('#toy-condition').fill('9')
    await page.getByRole('button', { name: 'Save' }).click()
    // Scoped to <main>: the rail carries a "Saved" row of its own.
    await expect(page.getByRole('main').getByText('Saved')).toBeVisible()

    // Listing needs a photo and an offer type; the header button waits for both.
    const list = page.getByRole('button', { name: 'List it in the library' }).first()
    await expect(list).toBeDisabled()

    await page.getByRole('tab', { name: 'Photos' }).click()
    // A photo uploads and saves as it is added, so the tile appearing IS the
    // confirmation.
    await page.locator('#toy-add-photo').setInputFiles(PHOTO_FIXTURE)
    await expect(page.getByText('Cover')).toBeVisible({ timeout: 20_000 })

    await page.getByRole('tab', { name: 'Status' }).click()
    await expect(list).toBeDisabled()
    await page.getByRole('radio', { name: /Donation/ }).click()
    await expect(list).toBeEnabled()
    await list.click()
    await expect(page.getByText('Families can ask for this')).toBeVisible()

    await page.goto('/dashboard/toys')
    const card = page.getByRole('link', { name: /E2E Test Toy/ })
    await expect(card).toBeVisible()
    // The board's stage words: Live once listed, never Hidden.
    await expect(card.getByText('Live')).toBeVisible()
    await expect(card.getByText('Hidden')).toHaveCount(0)

    await card.click()
    await page.getByRole('button', { name: 'Delete toy' }).click()
    await page.getByLabel(/to confirm/i).fill('confirm_delete_toy')
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await page.waitForURL('**/dashboard/toys')
    await expect(page.getByText('E2E Test Toy')).toHaveCount(0)
  } finally {
    await deleteUser(contributor.id)
  }
})
