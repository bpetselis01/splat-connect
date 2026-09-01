import { test, expect } from '@playwright/test'
import {
  createChallenge,
  createContributor,
  createNotification,
  signInAsNewContributor,
  uniqueTitle,
} from './helpers'

/**
 * The Inbox: web's copy on the row, the row's link, and mark-read at both
 * grains.
 *
 * Rows are seeded straight into `notifications` rather than provoked through
 * the actions that write them — a join, an approval, an invite each need a
 * second account and two or three screens to produce one row, and none of that
 * is what this screen is being tested for.
 */

test("a seeded notification reads exactly as web's copy says it should", async ({ page }) => {
  const viewer = await signInAsNewContributor(page)
  const author = await createContributor()
  const ideaId = await createChallenge(author.id, { title: uniqueTitle('E2E Inbox Challenge') })
  await createNotification(viewer.id, {
    type: 'challenge_joined',
    idea_id: ideaId,
    actor_name: 'Robin',
  })

  await page.goto('/inbox')

  await expect(page.getByText('Challenges', { exact: true })).toBeVisible()
  await expect(page.getByText('1 unread')).toBeVisible()
  await expect(page.getByText('Robin joined your design challenge')).toBeVisible()
})

test('tapping a row marks it read and opens what it is about', async ({ page }) => {
  const viewer = await signInAsNewContributor(page)
  const author = await createContributor()
  const title = uniqueTitle('E2E Linked Challenge')
  const ideaId = await createChallenge(author.id, { title })
  await createNotification(viewer.id, { type: 'idea_approved', idea_id: ideaId })

  await page.goto('/inbox')
  // Marking read is fire-and-forget by design, so the PATCH is still in flight
  // when the row opens. A goto() below would abort it — waiting for it here is
  // what makes this test about the behaviour rather than about the race.
  const marked = page.waitForResponse(
    (r) => r.url().includes('/api/notifications/') && r.request().method() === 'PATCH'
  )
  await page.getByText('Your idea was published as a design challenge').click()

  await expect(page).toHaveURL(new RegExp(`/explore/challenges/${ideaId}$`))
  expect((await marked).status()).toBe(204)

  // Back in the inbox the row is read, so the bucket offers nothing to mark.
  await page.goto('/inbox')
  await expect(page.getByText('Your idea was published as a design challenge')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mark Challenges read' })).toBeHidden()
})

test('marking a bucket read clears its count and leaves the others alone', async ({ page }) => {
  const viewer = await signInAsNewContributor(page)
  const author = await createContributor()
  const ideaId = await createChallenge(author.id, { title: uniqueTitle('E2E Bucket Challenge') })
  await createNotification(viewer.id, { type: 'challenge_joined', idea_id: ideaId, actor_name: 'Robin' })
  await createNotification(viewer.id, { type: 'challenge_left', idea_id: ideaId, actor_name: 'Alex' })

  await page.goto('/inbox')
  await expect(page.getByText('2 unread')).toBeVisible()

  const marked = page.waitForResponse(
    (r) => r.url().endsWith('/api/notifications/me/read') && r.request().method() === 'POST'
  )
  await page.getByRole('button', { name: 'Mark Challenges read' }).click()
  expect((await marked).status()).toBe(204)

  // Reloaded, so this asserts the server took it rather than the optimistic
  // update that ran locally.
  await page.reload()
  await expect(page.getByText('Robin joined your design challenge')).toBeVisible()
  await expect(page.getByText('2 unread')).toBeHidden()
})

test('an inbox with nothing in it says so', async ({ page }) => {
  await signInAsNewContributor(page)
  await page.goto('/inbox')
  await expect(page.getByText('Nothing yet.')).toBeVisible()
})

test('the same inbox is reachable behind MY SPLAT, without the tab header', async ({ page }) => {
  const viewer = await signInAsNewContributor(page)
  const author = await createContributor()
  const ideaId = await createChallenge(author.id, { title: uniqueTitle('E2E MySplat Challenge') })
  await createNotification(viewer.id, { type: 'challenge_joined', idea_id: ideaId, actor_name: 'Robin' })

  await page.goto('/notifications')

  await expect(page.getByText('Robin joined your design challenge')).toBeVisible()
  // The native modal header carries the title there, so the screen's own
  // subtitle — the tab's header — must not also be on the page.
  await expect(page.getByText('Everything waiting on you, newest first.')).toBeHidden()
})
