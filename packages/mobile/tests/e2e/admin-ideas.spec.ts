import { test, expect, type Page } from '@playwright/test'
import { adminClient, createContributor, createTutorial, uniqueTitle } from './helpers'
import { cardCount, expectCard, seedIdea, signInAdmin } from './admin-fixtures'

const IDEAS_CARD = 'Ideas awaiting review'
const stage = (page: Page, label: string) => page.getByRole('button', { name: new RegExp(`^${label}, \\d+$`) })
const ideaRow = (page: Page, title: string) => page.getByRole('button', { name: new RegExp(title) })
const notified = async (recipientId: string, ideaId: string) =>
  (await adminClient().from('notifications').select('type, actor_name, body').eq('recipient_id', recipientId).eq('idea_id', ideaId)).data

async function openIdea(page: Page, status: string, title: string) {
  await page.goto('/admin/ideas')
  await stage(page, status).click()
  await ideaRow(page, title).click()
}

test('Q26 the Ideas card opens the queue, whose Pending count matches it and whose segments split by status', async ({ page }) => {
  const pending = await seedIdea('pending')
  const live = await seedIdea('challenge')
  await signInAdmin(page)
  await expect(async () => {
    const card = await cardCount(page, IDEAS_CARD)
    await page.getByRole('button', { name: new RegExp(`^${IDEAS_CARD}, ${card}$`) }).click()
    await expect(page).toHaveURL(/\/admin\/ideas$/)
    await expect(stage(page, 'Pending')).toHaveAccessibleName(`Pending, ${card}`)
  }).toPass()
  await expect(ideaRow(page, pending.title)).toBeVisible()
  await expect(ideaRow(page, live.title)).toHaveCount(0)

  await stage(page, 'Published').click()
  await expect(ideaRow(page, live.title)).toBeVisible()
  await expect(ideaRow(page, pending.title)).toHaveCount(0)
})

test('Q27 a queue row opens that idea on /admin/ideas/:id', async ({ page }) => {
  const idea = await seedIdea('pending')
  await signInAdmin(page)
  await page.goto('/admin/ideas')
  await ideaRow(page, idea.title).click()
  await expect(page).toHaveURL(new RegExp(`/admin/ideas/${idea.id}$`))
  await expect(page.getByText(idea.title, { exact: true }).filter({ visible: true })).toBeVisible()
  await expect(page.getByText('Seeded for the admin queue.')).toBeVisible()
})

test('Q28 Publish makes the idea a challenge: it leaves Pending, tells the author, joins the board and drops the card by one', async ({ page }) => {
  const idea = await seedIdea('pending')
  await signInAdmin(page)
  const before = await cardCount(page, IDEAS_CARD)

  await openIdea(page, 'Pending', idea.title)
  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/ideas$/)
  await expect(ideaRow(page, idea.title)).toHaveCount(0)
  await stage(page, 'Published').click()
  await expect(ideaRow(page, idea.title)).toBeVisible()

  expect((await adminClient().from('toy_ideas').select('status').eq('id', idea.id).single()).data).toEqual({ status: 'challenge' })
  expect(await notified(idea.authorId, idea.id)).toEqual([{ type: 'idea_approved', actor_name: 'SPLAT', body: null }])
  await expectCard(page, IDEAS_CARD, before - 1)
  await page.goto('/explore/challenges')
  await expect(page.getByRole('button', { name: idea.title })).toBeVisible()
})

test('Q29 Reject needs a reason, then stores it, tells the author with it and drops the card by one', async ({ page }) => {
  const idea = await seedIdea('pending')
  await signInAdmin(page)
  const before = await cardCount(page, IDEAS_CARD)

  await openIdea(page, 'Pending', idea.title)
  await page.getByRole('button', { name: 'Reject', exact: true }).click()
  await expect(page.getByText('Say why. The author sees this note.')).toBeVisible()
  expect((await adminClient().from('toy_ideas').select('status').eq('id', idea.id).single()).data).toEqual({ status: 'pending' })

  await page.getByLabel('Reason for rejecting').fill('Too close to one we already have')
  await page.getByRole('button', { name: 'Reject', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/ideas$/)
  await expect(ideaRow(page, idea.title)).toHaveCount(0)
  await stage(page, 'Rejected').click()
  await expect(ideaRow(page, idea.title)).toBeVisible()

  expect((await adminClient().from('toy_ideas').select('status, review_note').eq('id', idea.id).single()).data)
    .toEqual({ status: 'rejected', review_note: 'Too close to one we already have' })
  expect(await notified(idea.authorId, idea.id)).toEqual([{ type: 'idea_rejected', actor_name: 'SPLAT', body: 'Too close to one we already have' }])
  await expectCard(page, IDEAS_CARD, before - 1)
})

test('Q29 Unpublish on a live challenge takes it off the board with a reason', async ({ page }) => {
  const idea = await seedIdea('challenge')
  const stays = await seedIdea('challenge')
  await signInAdmin(page)
  await page.goto('/explore/challenges')
  await expect(page.getByRole('button', { name: idea.title })).toBeVisible()

  await openIdea(page, 'Published', idea.title)
  await page.getByLabel('Why is this being withdrawn?').fill('Withdrawn after a safety question')
  await page.getByRole('button', { name: 'Unpublish', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/ideas$/)

  expect((await adminClient().from('toy_ideas').select('status, review_note').eq('id', idea.id).single()).data)
    .toEqual({ status: 'rejected', review_note: 'Withdrawn after a safety question' })
  expect(await notified(idea.authorId, idea.id)).toEqual([{ type: 'idea_rejected', actor_name: 'SPLAT', body: 'Withdrawn after a safety question' }])
  await page.goto('/explore/challenges')
  await expect(page.getByRole('button', { name: stays.title })).toBeVisible()
  await expect(page.getByRole('button', { name: idea.title })).toHaveCount(0)
})

test('Q30 Graduate to draft creates a draft guide for the writer and moves the idea to Being written up', async ({ page }) => {
  const idea = await seedIdea('challenge')
  await signInAdmin(page)

  await openIdea(page, 'Published', idea.title)
  await page.getByRole('button', { name: 'Graduate to draft', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/ideas$/)
  await expect(ideaRow(page, idea.title)).toHaveCount(0)
  await stage(page, 'Being written up').click()
  await expect(ideaRow(page, idea.title)).toBeVisible()

  const { data: row } = await adminClient().from('toy_ideas').select('status, tutorial_id').eq('id', idea.id).single()
  expect(row).toMatchObject({ status: 'graduated', tutorial_id: expect.any(String) })
  expect((await adminClient().from('tutorials').select('status').eq('id', row!.tutorial_id).single()).data).toEqual({ status: 'draft' })
  expect((await adminClient().from('tutorial_contributors').select('profile_id, role').eq('tutorial_id', row!.tutorial_id)).data)
    .toEqual([{ profile_id: idea.authorId, role: 'primary' }])
  expect((await notified(idea.authorId, idea.id))!.map((n) => n.type)).toEqual(['idea_graduated'])
})

test('Q31 a graduated idea offers View the draft guide, which opens the draft in the review screen', async ({ page }) => {
  const author = await createContributor()
  const guideTitle = uniqueTitle('E2E Graduated Guide')
  const tutorialId = await createTutorial(author.id, { title: guideTitle, status: 'draft' })
  const idea = await seedIdea('graduated', { authorId: author.id })
  await adminClient().from('toy_ideas').update({ tutorial_id: tutorialId }).eq('id', idea.id)
  await signInAdmin(page)

  await openIdea(page, 'Being written up', idea.title)
  await page.getByRole('button', { name: /View the draft guide/ }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/review/${tutorialId}$`))
  await expect(page.getByText(guideTitle, { exact: true })).toBeVisible()
})
