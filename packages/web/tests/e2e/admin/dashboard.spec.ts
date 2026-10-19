import { test, expect } from '@playwright/test'
import { signIn, createAdmin, createContributor, createTutorial, uniqueTitle } from '../helpers'
import { cardCount, expectCardMoved, liveCount } from './support'

const CARDS: Array<[RegExp, string]> = [
  [/Site content/, '/admin/content'],
  [/Tutorials awaiting review/, '/admin/review'],
  [/Reports from members/, '/admin/reports'],
  [/Design challenges awaiting review/, '/admin/ideas'],
  [/Spot-check/, '/admin/spot-check'],
  [/Print jobs stalled/, '/admin/print-jobs'],
  [/Test prints/, '/admin/test-prints'],
  [/Build requests needing a nudge/, '/admin/build-requests'],
  [/Inbox/, '/admin/inbox'],
  [/Accounts/, '/admin/contributors'],
  [/Organisations Create/, '/admin/organizations'],
  [/Organisation requests/, '/admin/organization-requests'],
]

test('WM01 the admin dashboard links every queue card, and a new pending guide raises the review card', async ({ page }) => {
  const admin = await createAdmin()
  const contributor = await createContributor()
  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')

  await expect(page.getByRole('heading', { name: 'Admin dashboard' })).toBeVisible()
  for (const [name, href] of CARDS) {
    await expect(page.getByRole('link', { name })).toHaveAttribute('href', href)
    expect(Number.isInteger(Number(await page.getByRole('link', { name }).locator('p').first().innerText()))).toBe(true)
  }

  await cardCount(page, /Tutorials awaiting review/)
  const before = await liveCount('tutorials')
  await createTutorial(contributor.id, { title: uniqueTitle('E2E Card Raise'), status: 'pending' })
  await expectCardMoved(page, 'tutorials', before, 1)

  await page.getByRole('link', { name: /Tutorials awaiting review/ }).click()
  await expect(page).toHaveURL(/\/admin\/review$/)
  await expect(page.getByRole('heading', { name: 'Review queue' })).toBeVisible()
})
