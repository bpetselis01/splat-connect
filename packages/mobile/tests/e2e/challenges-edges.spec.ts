// journeys: C02 C10 C12 C14
import { test, expect } from '@playwright/test'
import { adminClient, createChallenge, createContributor, signInAsNewContributor, uniqueTitle } from './helpers'

/**
 * Challenges at their edges: an idea with awkward characters and posted
 * anonymously, the form's refusal of blanks, an ended challenge that cannot be
 * joined, and a question's own join wording.
 *
 * Imports from helpers only, never from components.
 */

test('an idea with awkward characters, posted anonymously, shows as typed and carries no author name', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const title = `O'Brien <b>idea</b> & "quotes" ${Date.now()}`

  await page.goto('/explore/challenges/new')
  await page.getByLabel('Idea name').fill(`  ${title}  `)
  await page.getByLabel('Summarise it in one sentence').fill('Zoë 🧸 سارة — one sentence.')
  await page.getByRole('checkbox', { name: 'Post anonymously' }).click()
  await page.getByRole('button', { name: 'Submit idea' }).click()
  await expect(page.getByText('Idea sent.')).toBeVisible()

  const { data } = await adminClient().from('toy_ideas').select('title, summary, anonymous, status').eq('author_id', me.id)
  expect(data).toEqual([{ title, summary: 'Zoë 🧸 سارة — one sentence.', anonymous: true, status: 'pending' }])

  await page.getByRole('button', { name: 'See your ideas' }).click()
  await expect(page.getByText(title, { exact: true })).toBeVisible()
})

test('the idea form refuses a title or summary of spaces, keeps what was typed, and sends nothing', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  await page.goto('/explore/challenges/new')

  await page.getByLabel('Idea name').fill('   ')
  await page.getByLabel('Summarise it in one sentence').fill('A summary')
  await page.getByRole('button', { name: 'Submit idea' }).click()
  await expect(page.getByText('A title and a summary are required.')).toBeVisible()
  await expect(page.getByLabel('Summarise it in one sentence')).toHaveValue('A summary')

  const { data } = await adminClient().from('toy_ideas').select('id').eq('author_id', me.id)
  expect(data).toEqual([])
})

test('a challenge that has become a guide offers Follow the write-up and no join', async ({ page }) => {
  await signInAsNewContributor(page)
  const author = await createContributor()
  const title = uniqueTitle('E2E Ended Challenge')
  const id = await createChallenge(author.id, { title, status: 'graduated' })

  await page.goto(`/explore/challenges/${id}`)
  await expect(page.getByText(title)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Follow the write-up' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Join/ })).toBeHidden()
  await expect(page.getByText('Somebody solved it')).toBeVisible()
})

test('a question says Join to answer, not Join this challenge', async ({ page }) => {
  await signInAsNewContributor(page)
  const author = await createContributor()
  const title = uniqueTitle('E2E Question')
  const id = await createChallenge(author.id, { title })
  await adminClient().from('toy_ideas').update({ kind: 'question' }).eq('id', id)

  await page.goto(`/explore/challenges/${id}`)
  await expect(page.getByRole('button', { name: 'Join to answer' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Join this challenge' })).toBeHidden()
  await expect(page.getByText('Open, waiting for an answer')).toBeVisible()
})

test('an idea still under review is not on the public board, but its author can open it from their list', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Pending Idea')
  const id = await createChallenge(me.id, { title, status: 'pending' })

  await page.goto('/explore/challenges')
  await expect(page.getByRole('button', { name: title })).toBeHidden()

  await page.goto(`/explore/challenges/${id}`)
  await expect(page.getByText('An admin is reading it')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Withdraw the idea' })).toBeVisible()
})
