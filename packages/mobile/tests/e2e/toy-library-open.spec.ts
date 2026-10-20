import { test, expect } from '@playwright/test'
import { createContributor, createPublishedToy, signInAsNewContributor, uniqueTitle } from './helpers'

test('Y03 tapping a toy card opens that toy’s detail page', async ({ page }) => {
  await signInAsNewContributor(page)
  const owner = await createContributor()
  const name = uniqueTitle('E2E Card Toy')
  const id = await createPublishedToy(owner.id, { name })

  await page.goto('/toy-library')
  await page.getByPlaceholder('Search toys').fill(name)
  await page.getByRole('button', { name }).click()

  await expect(page).toHaveURL(new RegExp(`/toy-library/${id}$`))
  await expect(page.getByRole('heading', { name }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ask to collect it', exact: true })).toBeVisible()
})
