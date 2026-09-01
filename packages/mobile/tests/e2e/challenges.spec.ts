import { test, expect } from '@playwright/test'
import {
  createChallenge,
  createContributor,
  signInAsNewContributor,
  uniqueTitle,
} from './helpers'

/**
 * The design-challenge surfaces end to end: the public board, joining a
 * challenge someone else posted, the thread that unlocks, and submitting an
 * idea of your own.
 *
 * Every challenge here is authored by a SECOND contributor. 038's join policy
 * refuses a join onto your own challenge, so a spec that seeded one under the
 * signed-in account would be testing the author's view by accident.
 *
 * NOT covered here, deliberately: leaving a challenge. It is gated on
 * Alert.alert, and react-native-web ships Alert as a literal no-op
 * (`static alert() {}`), so on this web-export harness the button cannot open
 * anything to confirm. The same blind spot already covers every other
 * Alert-gated action in the app — deleting a guide, deleting a toy. Leave's
 * two branches are covered at unit level instead, with the Alert spied.
 */

test('the board separates open challenges from the ones that became guides', async ({ page }) => {
  await signInAsNewContributor(page)
  const author = await createContributor()
  const open = uniqueTitle('E2E Open Challenge')
  const solved = uniqueTitle('E2E Solved Challenge')
  await createChallenge(author.id, { title: open })
  await createChallenge(author.id, { title: solved, status: 'graduated' })

  await page.goto('/explore/challenges')

  await expect(page.getByText('Open challenges')).toBeVisible()
  await expect(page.getByText('Solved · became guides')).toBeVisible()
  await expect(page.getByRole('button', { name: open })).toBeVisible()
  await expect(page.getByRole('button', { name: solved })).toBeVisible()
})

test('joining unlocks the thread, and a message posted there comes back', async ({ page }) => {
  await signInAsNewContributor(page)
  const author = await createContributor()
  const title = uniqueTitle('E2E Joinable Challenge')
  const id = await createChallenge(author.id, { title })

  await page.goto(`/explore/challenges/${id}`)

  // Before joining: the invitation, and no composer.
  await expect(
    page.getByText('Join this challenge to read and take part in the conversation.')
  ).toBeVisible()
  await expect(page.getByLabel('Message this challenge')).toBeHidden()

  await page.getByRole('button', { name: 'Join this challenge' }).click()
  await expect(page.getByText('✓ You joined')).toBeVisible()

  // The API writes a system line for the join; the thread reads it back.
  await expect(page.getByText('joined this challenge', { exact: false })).toBeVisible()

  const message = uniqueTitle('Trying a proximity switch')
  await page.getByLabel('Message this challenge').fill(message)
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByLabel(`You said: ${message}`)).toBeVisible()

  // And the board now marks it.
  await page.goto('/explore/challenges')
  await expect(page.getByRole('button', { name: title })).toBeVisible()
  await expect(page.getByText("YOU'RE IN")).toBeVisible()
})

test('a submitted idea lands in My challenges, awaiting review', async ({ page }) => {
  await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Submitted Idea')

  await page.goto('/explore/challenges/new')
  await page.getByLabel('Idea name').fill(title)
  await page.getByLabel('Summarise it in one sentence').fill('A switch she can actually hit.')
  await page.getByLabel('Full description').fill('She swipes rather than presses.')
  await page.getByLabel('Intended use').fill('A bubble machine during therapy.')
  await page.getByLabel('Primary user').fill('A three-year-old with low muscle tone.')
  await page.getByRole('button', { name: 'Clarification' }).click()
  await page.getByRole('button', { name: 'Submit idea' }).click()

  await expect(page.getByText('Idea sent.')).toBeVisible()
  await page.getByRole('button', { name: 'See your ideas' }).click()

  await page.waitForURL(/\/challenges$/)
  await expect(page.getByText(title)).toBeVisible()
  // Pending is the only status an idea can have straight off the form, and a
  // pending idea has no public page — so its row is not a link.
  await expect(page.getByText('PENDING REVIEW')).toBeVisible()
  await expect(page.getByRole('button', { name: title })).toBeHidden()
})

test('My challenges reaches the public brief, across the modal boundary', async ({ page }) => {
  // The one navigation in this phase with no precedent anywhere in the app:
  // My challenges lives in the (my) modal group and its rows push into (tabs).
  // Nothing else crosses that boundary, so it is asserted rather than assumed.
  await signInAsNewContributor(page)
  const author = await createContributor()
  const joinable = uniqueTitle('E2E Crossing Challenge')
  const id = await createChallenge(author.id, { title: joinable })

  await page.goto(`/explore/challenges/${id}`)
  await page.getByRole('button', { name: 'Join this challenge' }).click()
  await expect(page.getByText('✓ You joined')).toBeVisible()

  await page.goto('/challenges')
  await expect(page.getByText('Challenges you joined')).toBeVisible()

  await page.getByRole('button', { name: joinable }).click()
  await expect(page).toHaveURL(new RegExp(`/explore/challenges/${id}$`))
  // Landed on the real brief, not an empty shell.
  await expect(page.getByText('THE PROBLEM')).toBeVisible()
})
