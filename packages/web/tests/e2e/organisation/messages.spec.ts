import { test, expect } from '@playwright/test'
import { adminClient, createContributor, deleteUser } from '../helpers'
import { createLeaderSeat, removeLeaderSeat, signInAs, type LeaderSeat } from './leader'

let leader: LeaderSeat
let family: Awaited<ReturnType<typeof createContributor>>
let quiet: LeaderSeat
let conversationId: string

test.beforeAll(async () => {
  leader = await createLeaderSeat(`Messages Org ${Date.now()}`)
  quiet = await createLeaderSeat(`Quiet Org ${Date.now()}`)
  family = await createContributor()
  const db = adminClient()
  const { data, error } = await db
    .from('org_conversations')
    .insert({ org_id: leader.orgId, profile_id: family.id })
    .select('id')
    .single()
  if (error || !data) throw new Error(`conversation seed failed: ${error?.message}`)
  conversationId = data.id
  await db.from('org_messages').insert({ conversation_id: conversationId, sender_id: family.id, body: 'Can we bring our own switch?' })
})

test.afterAll(async () => {
  await removeLeaderSeat(leader)
  await removeLeaderSeat(quiet)
  await deleteUser(family.id)
})

test('WB36 the messages list shows the family’s latest line and opens the conversation thread', async ({ page }) => {
  await signInAs(page, leader)
  await page.goto('/dashboard/organisation/messages')
  const row = page.getByRole('link', { name: /E2E Contributor/ })
  await expect(row).toContainText('Can we bring our own switch?')
  await expect(row).toHaveAttribute('href', `/dashboard/messages/${conversationId}`)
  await row.click()
  await expect(page).toHaveURL(`/dashboard/messages/${conversationId}`)
  await expect(page.getByText('Can we bring our own switch?')).toBeVisible()
})

test('WB36 an organisation nobody has written to says so', async ({ page }) => {
  await signInAs(page, quiet)
  await page.goto('/dashboard/organisation/messages')
  await expect(page.getByText(/Nobody has written yet/)).toBeVisible()
})
