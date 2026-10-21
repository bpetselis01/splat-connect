import { test, expect } from '@playwright/test'
import { adminClient, uniqueEmail, uniqueTitle } from '../helpers'
import { expectCardMoved, liveCount, signInAdmin } from './support'

const messageIds: string[] = []

async function seedMessage(topic: 'safety' | 'other', body: string, email = uniqueEmail('inbox')) {
  const { data, error } = await adminClient()
    .from('contact_messages')
    .insert({ topic, name: 'Jen Parent', email, body })
    .select('id')
    .single()
  if (error) throw new Error(`seedMessage failed: ${error.message}`)
  messageIds.push(data.id)
  return { id: data.id as string, email }
}

test.afterAll(async () => {
  await adminClient().from('contact_messages').delete().in('id', messageIds)
})

test('WM25 marking a message Replied moves it to the Replied tab and the Inbox card drops', async ({ page }) => {
  const body = uniqueTitle('A screw came loose on the spoon holder')
  const { id, email } = await seedMessage('safety', body)
  await signInAdmin(page)
  const before = await liveCount('inbox')

  await page.goto('/admin/inbox')
  await page.waitForLoadState('networkidle')
  const row = page.getByRole('listitem').filter({ hasText: body })
  await expect(row).toContainText('Safety report')
  await expect(row.getByRole('link', { name: email })).toHaveAttribute('href', new RegExp(`^mailto:${email}`))
  await row.getByRole('button', { name: /Replied/ }).click()

  await expect(page.getByRole('listitem').filter({ hasText: body })).toHaveCount(0)
  await expectCardMoved(page, 'inbox', before, -1)
  await page.goto('/admin/inbox')
  await page.getByRole('tab', { name: /^Replied/ }).click()
  await expect(page.getByRole('listitem').filter({ hasText: body })).toBeVisible()
  const { data } = await adminClient().from('contact_messages').select('status').eq('id', id).single()
  expect(data?.status).toBe('replied')
})

test('WM25 Close takes a message off the queue and Reopen puts it back', async ({ page }) => {
  const body = uniqueTitle('Do you run workshops in Newtown')
  await seedMessage('other', body)
  await signInAdmin(page)

  await page.goto('/admin/inbox')
  await page.waitForLoadState('networkidle')
  await page.getByRole('listitem').filter({ hasText: body }).getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: body })).toHaveCount(0)

  await page.getByRole('tab', { name: /^Closed/ }).click()
  await page.getByRole('listitem').filter({ hasText: body }).getByRole('button', { name: 'Reopen' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: body })).toHaveCount(0)
  await page.getByRole('tab', { name: /^Open/ }).click()
  await expect(page.getByRole('listitem').filter({ hasText: body })).toBeVisible()
})
