import { test, expect } from '@playwright/test'
import { adminClient, createChallenge, createContributor, signInAsNewContributor, uniqueTitle } from './helpers'
import { acceptNextConfirm, notificationsFor, partyPage } from './family-toys-fixtures'

/**
 * The challenge actions the board-and-thread spec leaves out: leaving (and the
 * author hearing of it), marking a question's answer, adding a constraint,
 * withdrawing a pending idea, resubmitting a rejected one, and an idea's photo.
 * Each row is read back from the table it writes.
 */

async function participate(ideaId: string, profileId: string) {
  const { error } = await adminClient().from('toy_idea_participants').insert({ idea_id: ideaId, profile_id: profileId })
  if (error) throw new Error(`participate failed: ${error.message}`)
}

test('C04 Leave asks first, drops the participant row and tells the author', async ({ page, browser, baseURL }) => {
  const me = await signInAsNewContributor(page)
  const author = await createContributor()
  const title = uniqueTitle('E2E Leavable Challenge')
  const id = await createChallenge(author.id, { title })
  await participate(id, me.id)

  await page.goto(`/explore/challenges/${id}`)
  await expect(page.getByText('✓ You joined')).toBeVisible()

  // A dismissed confirm changes nothing.
  page.once('dialog', (d) => void d.dismiss())
  await page.getByRole('button', { name: 'Leave', exact: true }).click()
  await expect(page.getByText('✓ You joined')).toBeVisible()
  const { data: still } = await adminClient().from('toy_idea_participants').select('profile_id').eq('idea_id', id)
  expect(still).toEqual([{ profile_id: me.id }])

  acceptNextConfirm(page)
  await page.getByRole('button', { name: 'Leave', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Join this challenge' })).toBeVisible()
  const { data: gone } = await adminClient().from('toy_idea_participants').select('profile_id').eq('idea_id', id)
  expect(gone).toEqual([])

  // The author's side: one challenge_left row pointing at the idea.
  const rows = await notificationsFor(author.id, 'challenge_left')
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ idea_id: id })
  const authorPage = await partyPage(browser, baseURL, author)
  try {
    await authorPage.goto('/inbox')
    await expect(authorPage.getByText(/left your design challenge/)).toBeVisible()
  } finally {
    await authorPage.context().close()
  }
})

test('C06 the asker marks a reply as the answer, and unmarks it', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const helper = await createContributor()
  const id = await createChallenge(me.id, { title: uniqueTitle('E2E Asked Question') })
  await adminClient().from('toy_ideas').update({ kind: 'question' }).eq('id', id)
  await participate(id, helper.id)
  const reply = uniqueTitle('Try a mercury tilt switch')
  const { data: msg, error } = await adminClient()
    .from('toy_idea_messages')
    .insert({ idea_id: id, sender_id: helper.id, kind: 'user', body: reply })
    .select('id')
    .single()
  if (error || !msg) throw new Error(error?.message)

  const answerOf = async () =>
    (await adminClient().from('toy_ideas').select('answer_message_id').eq('id', id).single()).data?.answer_message_id

  await page.goto(`/explore/challenges/${id}`)
  await page.getByRole('tab', { name: /^Thread/ }).click()
  await expect(page.getByText(reply)).toBeVisible()
  await page.getByRole('button', { name: 'Mark as the answer', exact: true }).click()
  await expect(page.getByText('The answer · marked by the asker')).toBeVisible()
  expect(await answerOf()).toBe(msg.id)

  await page.getByRole('button', { name: 'Unmark', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Mark as the answer', exact: true })).toBeVisible()
  await expect(page.getByText('The answer · marked by the asker')).toHaveCount(0)
  expect(await answerOf()).toBeNull()
})

test('C07 an author adds a constraint, and it joins the challenge', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const id = await createChallenge(me.id, { title: uniqueTitle('E2E Constrained Challenge') })

  await page.goto(`/explore/challenges/${id}`)
  await page.getByRole('tab', { name: /^Constraints/ }).click()
  const add = page.getByRole('button', { name: 'Add a constraint', exact: true })
  await expect(add).toBeDisabled()
  await page.getByLabel('Constraint', { exact: true }).fill('Must work with one hand')
  await page.getByLabel('Note (optional)', { exact: true }).fill('She cannot grip.')
  await add.click()

  await expect(page.getByLabel('Constraint', { exact: true })).toHaveValue('')
  await expect
    .poll(async () => {
      const { data } = await adminClient().from('toy_idea_constraints').select('label, note, added_by').eq('idea_id', id)
      return data
    })
    .toEqual([{ label: 'Must work with one hand', note: 'She cannot grip.', added_by: me.id }])
  await expect(page.getByText('Must work with one hand', { exact: true })).toBeVisible()
})

test('C08 Withdraw the idea removes a pending idea and says nothing was published', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const id = await createChallenge(me.id, { title: uniqueTitle('E2E Withdrawn Idea'), status: 'pending' })

  await page.goto(`/explore/challenges/${id}`)
  await page.getByRole('button', { name: 'Withdraw the idea', exact: true }).click()

  await expect(page.getByText('Withdrawn — nothing was published')).toBeVisible()
  const { data } = await adminClient().from('toy_ideas').select('id').eq('id', id)
  expect(data).toEqual([])
})

test('C09 a rejected idea offers Submit a revised idea, prefilled, and files a new one', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Rejected Idea')
  const id = await createChallenge(me.id, { title, status: 'rejected', summary: 'First try at a summary.' })

  await page.goto(`/explore/challenges/${id}`)
  await page.getByRole('button', { name: 'Submit a revised idea', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/explore/challenges/new\\?from=${id}$`))
  await expect(page.getByLabel('Idea name')).toHaveValue(title)
  await expect(page.getByLabel('Summarise it in one sentence')).toHaveValue('First try at a summary.')

  const revised = `${title} revised`
  await page.getByLabel('Idea name').fill(revised)
  await page.getByRole('button', { name: 'Submit idea', exact: true }).click()
  await expect(page.getByText('Idea sent.')).toBeVisible()

  // A new idea is filed; the rejected one stays as it was judged.
  const { data } = await adminClient().from('toy_ideas').select('title, status').eq('author_id', me.id).order('created_at')
  expect(data).toEqual([
    { title, status: 'rejected' },
    { title: revised, status: 'pending' },
  ])
})

test("C13 an idea's photo uploads, saves with the idea, and shows on its brief", async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Photo Idea')

  await page.goto('/explore/challenges/new')
  await page.getByLabel('Idea name').fill(title)
  await page.getByLabel('Summarise it in one sentence').fill('An idea with a picture.')
  const chooser = page.waitForEvent('filechooser')
  await page.getByLabel('Tap to add a photo').click()
  await (await chooser).setFiles('tests/e2e/fixtures/test.jpg')
  await expect(page.getByLabel('Your photo')).toBeVisible()
  await page.getByRole('button', { name: 'Submit idea', exact: true }).click()
  await expect(page.getByText('Idea sent.')).toBeVisible()

  const { data } = await adminClient().from('toy_ideas').select('id, photo_path').eq('author_id', me.id).single()
  expect(data?.photo_path).toMatch(new RegExp(`^ideas/${me.id}/`))

  await page.goto(`/explore/challenges/${data!.id}`)
  await page.getByRole('tab', { name: /^Brief/ }).click()
  await expect(page.getByTestId('challenge-photo')).toBeVisible()
})
