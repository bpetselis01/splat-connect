import { test, expect } from '@playwright/test'
import { createContributor, createTutorial, uniqueTitle } from '../helpers'

test('the library lists an approved tutorial and hides a pending one', async ({ page }) => {
  const contributor = await createContributor()
  const approved = uniqueTitle('E2E Library Approved')
  const pending = uniqueTitle('E2E Library Pending')
  await createTutorial(contributor.id, { title: approved, status: 'approved' })
  await createTutorial(contributor.id, { title: pending, status: 'pending' })

  await page.goto('/library')

  await expect(page.getByRole('heading', { name: 'Toy Adaptation Library' })).toBeVisible()
  await expect(page.getByText(approved)).toBeVisible()
  await expect(page.getByText(pending)).toHaveCount(0)
})

test('the search box filters the grid by title', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Library Search')
  await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto('/library')

  await page.getByPlaceholder('Search by toy name…').fill(title)
  await expect(page.getByText(title)).toBeVisible()

  await page.getByPlaceholder('Search by toy name…').fill('Nonexistent Toy Name')
  await expect(page.getByText(title)).toHaveCount(0)
  await expect(page.getByText('No tutorials found.')).toBeVisible()
})

test('the difficulty filter narrows the grid to the selected difficulty', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Library Easy')
  await createTutorial(contributor.id, { title, status: 'approved', difficulty: 'easy' })

  await page.goto('/library')

  await page.getByRole('button', { name: 'hard', exact: true }).click()
  await expect(page.getByText(title)).toHaveCount(0)

  await page.getByRole('button', { name: 'easy', exact: true }).click()
  await expect(page.getByText(title)).toBeVisible()
})

test('search combined with a difficulty filter narrows to the intersection', async ({ page }) => {
  const contributor = await createContributor()
  const marker = `E2E Combo ${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const easy = `${marker} Easy`
  const hard = `${marker} Hard`
  await createTutorial(contributor.id, { title: easy, status: 'approved', difficulty: 'easy' })
  await createTutorial(contributor.id, { title: hard, status: 'approved', difficulty: 'hard' })

  await page.goto('/library')

  await page.getByPlaceholder('Search by toy name…').fill(marker)
  await expect(page.getByText(easy)).toBeVisible()
  await expect(page.getByText(hard)).toBeVisible()

  await page.getByRole('button', { name: 'easy', exact: true }).click()
  await expect(page.getByText(easy)).toBeVisible()
  await expect(page.getByText(hard)).toHaveCount(0)
})

test('a search with no matches shows the empty state', async ({ page }) => {
  await page.goto('/library')

  await page.getByPlaceholder('Search by toy name…').fill('zzz-no-such-toy-zzz')

  await expect(page.getByText('No tutorials found.')).toBeVisible()
  await expect(
    page.getByText('Try a shorter search, or set the difficulty filter back to All.')
  ).toBeVisible()
})
