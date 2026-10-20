import { test, expect } from '@playwright/test'
import { acceptTerms, adminClient, createContributor, createTutorial, deleteUser, signIn, uniqueTitle } from '../helpers'
import { signInAdmin } from './support'

const tutorialIds: string[] = []

test.afterAll(async () => {
  await adminClient().from('toy_transactions').delete().in('tutorial_id', tutorialIds)
  await adminClient().from('tutorials').delete().in('id', tutorialIds)
})

test('WM37 WM38 an admin opens a member build thread, cannot act on it, posts a SPLAT admin message, and the family sees the label', async ({ page }) => {
  const maker = await createContributor()
  const family = await createContributor()
  await acceptTerms(family.id)
  const title = uniqueTitle('E2E Admin Thread Guide')
  const guideId = await createTutorial(maker.id, { title, status: 'approved' })
  tutorialIds.push(guideId)
  const { data: build, error } = await adminClient()
    .from('toy_transactions')
    .insert({
      type: 'build', tutorial_id: guideId, requester_id: family.id, owner_id: maker.id,
      build_brief: 'For Leo', status: 'requested', created_at: new Date(Date.now() - 20 * 864e5).toISOString(),
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  try {
    const admin = await signInAdmin(page)
    await acceptTerms(admin.id)
    await page.goto('/admin/build-requests')
    await page.getByRole('listitem').filter({ hasText: title }).getByRole('link', { name: 'Open the thread' }).click()
    await page.waitForURL(`**/dashboard/exchanges/build/${build.id}`)

    // WM38: the maker would be offered Accept and Decline here; an admin gets neither, nor Withdraw.
    await expect(page.getByRole('button', { name: 'Decline' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Accept' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Withdraw/ })).toHaveCount(0)

    await page.getByPlaceholder('Write a message').fill('Checking in on this one')
    await page.getByRole('button', { name: 'Send' }).click()
    const log = page.getByRole('log', { name: 'Conversation' })
    await expect(log.getByText('Checking in on this one')).toBeVisible()
    await expect(log.getByText('SPLAT admin', { exact: false }).first()).toBeVisible()

    await signIn(page, family.email, family.password)
    await page.waitForURL('**/dashboard')
    await page.goto(`/dashboard/exchanges/build/${build.id}`)
    await expect(page.getByRole('log', { name: 'Conversation' }).getByText('Checking in on this one')).toBeVisible()
    await expect(page.getByRole('log', { name: 'Conversation' }).getByText('SPLAT admin', { exact: false }).first()).toBeVisible()
  } finally {
    await deleteUser(maker.id)
    await deleteUser(family.id)
  }
})
