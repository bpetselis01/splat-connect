import { test, expect } from '@playwright/test'
import { createContributor, createTutorial, uniqueTitle } from './helpers'

test('the library lists a tutorial with its difficulty badge', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Mobile Library')
  await createTutorial(contributor.id, { title, status: 'approved', difficulty: 'easy' })

  await page.goto('/home')

  await expect(page.getByText(title)).toBeVisible()
  // The badge is uppercased in CSS, not in the string, so the text node stays
  // "Easy" — getByText matches textContent, not the rendered transform.
  // .last() because the "Easy" difficulty filter chip renders above the list.
  await expect(page.getByText('Easy', { exact: true }).last()).toBeVisible()
})

test('search narrows the list and clearing it restores the tutorial', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Mobile Search')
  await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto('/home')

  await page.getByPlaceholder('Search tutorials').fill('no such toy')
  await expect(page.getByText(title)).toHaveCount(0)

  await page.getByPlaceholder('Search tutorials').fill('')
  await expect(page.getByText(title)).toBeVisible()
})

test('the difficulty filter narrows results', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Mobile Filter')
  await createTutorial(contributor.id, { title, status: 'approved', difficulty: 'easy' })

  await page.goto('/home')

  await page.getByText('Medium', { exact: true }).click()
  await expect(page.getByText(title)).toHaveCount(0)

  await page.getByText('Easy', { exact: true }).click()
  await expect(page.getByText(title)).toBeVisible()
})
