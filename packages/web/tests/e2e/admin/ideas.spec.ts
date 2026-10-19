import { test, expect } from '@playwright/test'
import { adminClient, pageUntilVisible, signIn, uniqueTitle } from '../helpers'
import { createMember, expectCardMoved, expectInboxLine, liveCount, pollRow, seedIdea, signInAdmin } from './support'

const ideaIds: string[] = []
const trackIdea = async (authorId: string, status: 'pending' | 'challenge', title: string) => {
  const id = await seedIdea(authorId, status, title)
  ideaIds.push(id)
  return id
}

test.afterAll(async () => {
  const db = adminClient()
  const { data } = await db.from('toy_ideas').select('tutorial_id').in('id', ideaIds)
  await db.from('toy_ideas').delete().in('id', ideaIds)
  const drafts = (data ?? []).map((r) => r.tutorial_id).filter((id): id is string => !!id)
  if (drafts.length) await db.from('tutorials').delete().in('id', drafts)
})

test('WM11 the idea list puts a pending idea in front and its row opens the idea page', async ({ page }) => {
  const author = await createMember()
  const title = uniqueTitle('E2E Idea List')
  const id = await trackIdea(author.id, 'pending', title)
  await signInAdmin(page)

  await page.goto('/admin/ideas')
  const link = page.getByRole('link', { name: new RegExp(title) })
  await pageUntilVisible(page, link)
  await expect(link).toContainText('Pending')
  await expect(link).toContainText('E2E Contributor')
  await link.click()
  await page.waitForURL(`**/admin/ideas/${id}`)
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
})

test('WM12 publishing a pending idea makes it a challenge, tells the author and drops the card', async ({ page }) => {
  const author = await createMember()
  const title = uniqueTitle('E2E Idea Publish')
  const id = await trackIdea(author.id, 'pending', title)
  await signInAdmin(page)
  const before = await liveCount('ideas')

  await page.goto(`/admin/ideas/${id}`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: /Publish as a challenge/ }).click()
  await expect(page.getByText(/Published as a challenge/)).toBeVisible()
  await pollRow('toy_ideas', id, 'status', 'challenge')
  await expectCardMoved(page, 'ideas', before, -1)

  await expectInboxLine(page, author, 'Your idea was published as a design challenge')
})

test('WM13 rejecting a pending idea needs a note, tells the author and drops the card', async ({ page }) => {
  const author = await createMember()
  const title = uniqueTitle('E2E Idea Reject')
  const id = await trackIdea(author.id, 'pending', title)
  await signInAdmin(page)
  const before = await liveCount('ideas')

  await page.goto(`/admin/ideas/${id}`)
  await page.waitForLoadState('networkidle')
  await expect(page.getByLabel(/Reason for rejecting/)).toHaveAttribute('required', '')
  await page.getByLabel(/Reason for rejecting/).fill('Too broad for a first challenge.')
  await page.getByRole('button', { name: /^Reject/ }).click()
  await expect(page.getByText('Rejected: Too broad for a first challenge.')).toBeVisible()
  await pollRow('toy_ideas', id, 'status', 'rejected')
  await expectCardMoved(page, 'ideas', before, -1)

  await expectInboxLine(page, author, 'Your idea was reviewed and not taken forward')
})

test('WM13 unpublishing a live challenge needs a note and shows the idea as rejected', async ({ page }) => {
  const author = await createMember()
  const id = await trackIdea(author.id, 'challenge', uniqueTitle('E2E Idea Unpublish'))
  await signInAdmin(page)

  await page.goto(`/admin/ideas/${id}`)
  await page.waitForLoadState('networkidle')
  await page.getByLabel(/Why is this being withdrawn/).fill('Unsafe grip.')
  await page.getByRole('button', { name: /Unpublish/ }).click()
  await expect(page.getByText('Rejected: Unsafe grip.')).toBeVisible()
  await pollRow('toy_ideas', id, 'status', 'rejected')
})

test('WM14 WM15 graduating a live challenge starts a draft guide, tells the participant, and the page links the draft', async ({ page }) => {
  const author = await createMember()
  const participant = await createMember()
  const title = uniqueTitle('E2E Idea Graduate')
  const id = await trackIdea(author.id, 'challenge', title)
  await adminClient().from('toy_idea_participants').insert({ idea_id: id, profile_id: participant.id })
  await signInAdmin(page)

  await page.goto(`/admin/ideas/${id}`)
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: /Graduate to draft guide/ }).click()
  await expect(page.getByText(/Graduated/)).toBeVisible()
  await pollRow('toy_ideas', id, 'status', 'graduated')

  const draftLink = page.getByRole('link', { name: 'view the draft guide' })
  await expect(draftLink).toBeVisible()
  await draftLink.click()
  await page.waitForURL(/\/admin\/review\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { name: title })).toBeVisible()

  await expectInboxLine(page, participant, /A challenge you were part of is being written up as a guide/)
})

test('a member cannot open the idea queue', async ({ page }) => {
  const member = await createMember()
  await signIn(page, member.email, member.password)
  await page.goto('/admin/ideas')
  await expect(page).not.toHaveURL(/\/admin/)
})
