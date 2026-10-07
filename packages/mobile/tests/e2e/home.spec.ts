// journeys: H01 H02 H03 H06
import { test, expect } from '@playwright/test'
import {
  createChallenge,
  createContributor,
  createNotification,
  createTutorial,
  signInAsNewContributor,
  uniqueTitle,
} from './helpers'

/**
 * Home: the manual iPhone checks of 2026-10-02/03 that the web build can see.
 * What it cannot (sheet drag, insets, edge-swipe, the real tab bar) lives in
 * .maestro/flows/home-shell.yaml.
 */

test('Pick up where you left off is absent until a guide is opened, then reopens it with no tab bar and the ✕ goes Home', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Recent Guide')
  await createTutorial(contributor.id, { title, status: 'approved' })

  await page.goto('/home')
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible()
  await expect(page.getByText('Pick up where you left off')).toBeHidden()

  await page.goto('/guides')
  await page.getByText(title).click()
  await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible()

  // A guide opened in the Guides stack is a drill-down: the ✕ closes to the list, which shows the bar.
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('tab', { name: 'Home' }).click()
  await expect(page.getByText('Pick up where you left off')).toBeVisible()
  await page.getByRole('button', { name: new RegExp(`^${title}`) }).click()

  // A guide opened from a recents row is a drill-down: no tab bar over it.
  await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Home' })).toHaveCount(0)

  // The ✕ closes to the opener (Home), not to the Guides list.
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page).toHaveURL(/\/home$/)
  await expect(page.getByRole('tab')).toHaveCount(4)
})

test('the Request a print shortcut opens the finder', async ({ page }) => {
  await signInAsNewContributor(page)
  await page.goto('/home')
  await page.getByRole('button', { name: 'Request a print', exact: true }).click()
  await expect(page).toHaveURL(/\/printing$/)
  await expect(page.getByText('Find a printer').first()).toBeVisible()
})

test('tapping empty space on Home leaves edit mode', async ({ page }) => {
  await signInAsNewContributor(page)
  await page.goto('/home')
  await page.getByRole('button', { name: 'Edit' }).click()
  await expect(page.getByRole('button', { name: 'Done' })).toBeVisible()

  // The background target fills the screen; its top-left corner is clear of every control.
  await page.getByTestId('home-background').click({ position: { x: 2, y: 2 } })
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Done' })).toBeHidden()
})

test('the Inbox badge and the Today card drop by the rows read', async ({ page }) => {
  const viewer = await signInAsNewContributor(page)
  const author = await createContributor()
  const ideaId = await createChallenge(author.id, { title: uniqueTitle('E2E Badge Challenge') })
  for (const type of ['challenge_joined', 'challenge_left', 'challenge_joined']) {
    await createNotification(viewer.id, { type, idea_id: ideaId, actor_name: 'Robin' })
  }

  await page.goto('/home')
  await expect(page.getByRole('button', { name: /^3 new messages/ })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Inbox, 3 unread' })).toBeVisible()

  await page.getByRole('tab', { name: /^Inbox/ }).click()
  const marked = page.waitForResponse((r) => r.url().includes('/api/notifications/') && r.request().method() === 'PATCH')
  await page.getByText('Robin left your design challenge').click()
  expect((await marked).status()).toBe(204)

  // Exactly the one row opened: 3 -> 2, in the bar and on the Today card.
  // The challenge opened over the Inbox is a drill-down with no bar; the ✕ first.
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('tab', { name: /^Home/ }).click()
  await expect(page.getByRole('tab', { name: 'Inbox, 2 unread' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^2 new messages/ })).toBeVisible()
})
