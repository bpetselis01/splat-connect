import { test, expect } from '@playwright/test'
import { createContributor, createTutorial, uniqueTitle } from './helpers'

test('tapping a tutorial navigates to its detail screen', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Mobile Detail')
  await createTutorial(contributor.id, { title, status: 'approved', difficulty: 'easy' })

  await page.goto('/home')
  await page.getByText(title).click()

  // .last() throughout: the library screen stays mounted behind the detail
  // screen, so the title, description and badge each match twice.
  await expect(page.getByText(title).last()).toBeVisible()
  await expect(page.getByText('Created by a Playwright E2E test.').last()).toBeVisible()
  await expect(page.getByText('Easy', { exact: true }).last()).toBeVisible()
  await expect(page.getByText('E2E part × 2')).toBeVisible()
  await expect(page.getByText('E2E tool')).toBeVisible()
})

test('tapping Preview Tutorial navigates to the preview screen', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Mobile Preview')
  await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto('/home')
  await page.getByText(title).click()
  await page.getByText('Preview Tutorial').click()

  await expect(page.getByText('Open in Browser')).toBeVisible()
})

test('an aborted detail request shows the retry message', async ({ page }) => {
  const contributor = await createContributor()
  const id = await createTutorial(contributor.id, {
    title: uniqueTitle('E2E Mobile Detail Error'),
    status: 'approved',
  })

  await page.route(`**/api/public/tutorials/${id}`, (route) => route.abort())
  await page.goto(`/home/${id}`)

  await expect(page.getByText("Couldn't load tutorial. Please try again.")).toBeVisible()
})

test('an unknown tutorial id shows the load-failure state', async ({ page }) => {
  await page.goto('/home/00000000-0000-0000-0000-000000000000')

  // The API answers an unknown id with a 404, which apiClient raises, so the
  // screen takes its `error` branch. The `!tutorial` branch ("Tutorial not
  // found.") is therefore unreachable through this path — see the spec's
  // negative space.
  await expect(page.getByText("Couldn't load tutorial. Please try again.")).toBeVisible()
})

test('optional parts and tools are badged on the detail screen', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Mobile Optional')
  await createTutorial(contributor.id, { title, status: 'approved', withOptionalExtras: true })

  await page.goto('/home')
  await page.getByText(title).click()

  // Mobile marks optional items inline in the row label — there is no separate
  // badge here, unlike the web detail page.
  await expect(page.getByText('E2E optional part × 1 (optional)')).toBeVisible()
  await expect(page.getByText('E2E optional tool (optional)')).toBeVisible()
  await expect(page.getByText('E2E part × 2', { exact: true })).toBeVisible()
})

test('the preview screen explains when a tutorial has no PDF', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Mobile No PDF')
  await createTutorial(contributor.id, { title, status: 'approved', withPdf: false })

  await page.goto('/home')
  await page.getByText(title).click()
  await page.getByText('Preview Tutorial').click()

  await expect(page.getByText('No PDF is available for this tutorial yet.')).toBeVisible()
  await expect(page.getByText('Open in Browser')).toHaveCount(0)
})
