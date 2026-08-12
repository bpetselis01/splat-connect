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
    await page.locator('#new-toy-name').fill('E2E Test Toy')
    await page.locator('#new-toy-condition').fill('6')
    await page.locator('#new-toy-description').fill('A toy created by Playwright.')
    await page.getByRole('button', { name: 'Create' }).click()
    await page.waitForURL(/\/dashboard\/toys\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('heading', { name: 'E2E Test Toy' })).toBeVisible()

    await page.locator('#toy-condition').fill('9')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Saved')).toBeVisible()

    await page.getByRole('tab', { name: 'Review' }).click()
    await expect(page.getByText(/Add .*to publish/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Publish' })).toBeDisabled()

    await page.getByRole('tab', { name: 'Photos' }).click()
    await page.locator('input[name="toy_cover_photo"]').setInputFiles(PHOTO_FIXTURE)
    await page.getByRole('button', { name: 'Save photos' }).click()
    await expect(page.getByRole('button', { name: 'Save photos' })).toBeDisabled({
      timeout: 20_000,
    })

    await page.getByRole('tab', { name: 'Review' }).click()
    await expect(page.getByRole('button', { name: 'Publish' })).toBeEnabled()
    await page.getByRole('button', { name: 'Publish' }).click()
    await expect(page.getByText('Published')).toBeVisible()

    await page.goto('/dashboard/toys')
    const card = page.getByRole('link', { name: /E2E Test Toy/ })
    await expect(card).toBeVisible()
    await expect(card.getByText('Draft')).toHaveCount(0)

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
