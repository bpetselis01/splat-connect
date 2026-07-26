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

test('an aborted tutorials request shows the retry message', async ({ page }) => {
  await page.route('**/api/public/tutorials*', (route) => route.abort())

  await page.goto('/home')

  await expect(page.getByText("Couldn't load tutorials. Pull to retry.")).toBeVisible()
})

test('a search with no matches shows the empty state', async ({ page }) => {
  const contributor = await createContributor()
  await createTutorial(contributor.id, { title: uniqueTitle('E2E Mobile Empty'), status: 'approved' })

  await page.goto('/home')
  await page.getByPlaceholder('Search tutorials').fill('zzz-no-such-toy-zzz')

  await expect(page.getByText('zzz-no-such-toy-zzz')).toBeVisible()
  await expect(page.locator('text=/No tutorials/i').first()).toBeVisible()
})

test('the skeleton renders while the tutorial request is in flight', async ({ page }) => {
  // Delayed rather than raced: the loading state is otherwise gone before an
  // assertion can reach it. If this ever proves flaky, delete it rather than
  // retry it — a skeleton regression is cosmetic and a flaky test gating main
  // costs more than the bug it catches.
  await page.route('**/api/public/tutorials*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    await route.continue()
  })

  await page.goto('/home')

  await expect(page.getByTestId('skeleton-row').first()).toBeVisible()
})
