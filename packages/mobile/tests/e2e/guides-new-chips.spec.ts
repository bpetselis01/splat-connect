import { test, expect } from '@playwright/test'
import { adminClient, signInAsNewContributor, uniqueTitle } from './helpers'
import { chooseFile, idAfter, PHOTO_FIXTURE } from './family-fixtures'

// The new-guide screen's own controls: the start chips, the kind / difficulty
// chips with the age range, and the cover photo that uploads after the create.

test('N01 the Start blank / Start from a PDF chips swap the form for the PDF chooser and back', async ({ page }) => {
  await signInAsNewContributor(page)
  await page.goto('/guides/new')
  await expect(page.getByRole('radio', { name: 'Start blank', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByPlaceholder('Title')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Choose PDF', exact: true })).toHaveCount(0)

  await page.getByRole('radio', { name: 'Start from a PDF', exact: true }).click()
  await expect(page.getByRole('radio', { name: 'Start from a PDF', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: 'Choose PDF', exact: true })).toBeVisible()
  await expect(page.getByPlaceholder('Title')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Create draft', exact: true })).toHaveCount(0)

  await page.getByRole('radio', { name: 'Start blank', exact: true }).click()
  await expect(page.getByRole('radio', { name: 'Start blank', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByPlaceholder('Title')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create draft', exact: true })).toBeVisible()
})

test('N04 the kind and difficulty chips and the ages are what the new draft is saved with', async ({ page }) => {
  await signInAsNewContributor(page)
  const title = uniqueTitle('E2E New Chips')
  await page.goto('/guides/new')
  await page.getByPlaceholder('Title').fill(title)
  await page.getByRole('button', { name: 'Assistive tech', exact: true }).click()
  await page.getByRole('button', { name: 'Hard', exact: true }).click()
  await page.getByLabel('Youngest age').fill('4')
  await page.getByLabel('Oldest age').fill('9')
  await page.getByRole('button', { name: 'Create draft', exact: true }).click()
  await expect(page).toHaveURL(/\/tutorials\/[0-9a-f-]{36}/)
  const id = idAfter(page, '/tutorials/')

  await expect
    .poll(async () => (await adminClient().from('tutorials').select('kind, difficulty, age_min, age_max').eq('id', id).single()).data)
    .toEqual({ kind: 'assistive_tech', difficulty: 'hard', age_min: 4, age_max: 9 })
})

test('N03 a cover photo chosen on the new-guide screen is uploaded after the create and stored as the guide photo', async ({ page }) => {
  await signInAsNewContributor(page)
  const title = uniqueTitle('E2E New Cover')
  await page.goto('/guides/new')
  await page.getByPlaceholder('Title').fill(title)
  await chooseFile(page, 'Add a cover photo', PHOTO_FIXTURE)
  await expect(page.getByText('Cover photo chosen')).toBeVisible()
  const uploaded = page.waitForResponse((r) => r.url().includes('/api/upload/photo') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Create draft', exact: true }).click()
  expect((await uploaded).ok()).toBe(true)
  await expect(page).toHaveURL(/\/tutorials\/[0-9a-f-]{36}/)
  const id = idAfter(page, '/tutorials/')

  await expect
    .poll(async () => ((await adminClient().from('tutorials').select('photo_urls').eq('id', id).single()).data?.photo_urls ?? []).length)
    .toBe(1)
  const { data } = await adminClient().from('tutorials').select('photo_urls').eq('id', id).single()
  expect(data?.photo_urls?.[0]).toContain(id)
})
