// journeys: Q05
import { test, expect } from '@playwright/test'
import { signInAsNewContributor } from './helpers'

test('offline inbox: says so with Try again, then loads once back online', async ({ page }) => {
  await signInAsNewContributor(page)

  const consoleErrors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })

  // Armed after sign-in so only the inbox's three requests fail (a browser
  // abort surfaces as the same TypeError a dropped phone connection does).
  const inboxRequests = ['**/api/notifications/me', '**/api/toy-transactions', '**/api/collaborators/me/invites']
  for (const url of inboxRequests) await page.route(url, (route) => route.abort())
  await page.goto('/inbox')

  await expect(page.getByText('You seem to be offline.')).toBeVisible()
  await expect(page.getByText('Check your connection and try again.')).toBeVisible()
  await expect(page.getByText('Nothing yet.')).toHaveCount(0)
  expect(consoleErrors.filter((t) => !/Failed to load resource|ERR_FAILED/.test(t))).toEqual([])

  for (const url of inboxRequests) await page.unroute(url)
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByText('Nothing yet.')).toBeVisible()
  await expect(page.getByText('You seem to be offline.')).toHaveCount(0)
})
