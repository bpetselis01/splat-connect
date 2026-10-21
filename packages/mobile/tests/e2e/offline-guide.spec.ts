import { test, expect } from '@playwright/test'
import { signInAsNewContributor, createTutorial, uniqueTitle } from './helpers'

test('G29 offline guide: says so, no console error, Try again loads it once back online', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Offline Guide')
  const id = await createTutorial(contributor.id, { title, status: 'approved' })

  const consoleErrors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })

  // Armed after sign-in so only the guide's own requests fail (a browser
  // abort surfaces as the same TypeError a dropped phone connection does).
  const guideRequests = `**/api/**/tutorials/${id}**`
  await page.route(guideRequests, (route) => route.abort())
  await page.goto(`/guides/${id}`)

  await expect(page.getByText('You seem to be offline.')).toBeVisible()
  await expect(page.getByText('Check your connection and try again.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  // The browser logs the aborted requests itself as "Failed to load
  // resource"; the app's own logging must add nothing.
  expect(consoleErrors.filter((t) => !/Failed to load resource|ERR_FAILED/.test(t))).toEqual([])

  await page.unroute(guideRequests)
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText(title).last()).toBeVisible()
  await expect(page.getByText('You seem to be offline.')).toHaveCount(0)
})
