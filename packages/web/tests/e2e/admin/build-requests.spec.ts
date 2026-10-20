import { test, expect } from '@playwright/test'
import { acceptTerms, adminClient, createContributor, createTutorial, uniqueTitle } from '../helpers'
import { cardCount, signInAdmin } from './support'

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString()
const tutorialIds: string[] = []

test.afterAll(async () => {
  await adminClient().from('toy_transactions').delete().in('tutorial_id', tutorialIds)
})

test('WM32 a build request unclaimed for 20 days is flagged Needs attention, listed before healthy ones, and opens its thread', async ({ page }) => {
  const maker = await createContributor()
  const family = await createContributor()
  const stale = uniqueTitle('E2E Stale Build Guide')
  const fresh = uniqueTitle('E2E Fresh Build Guide')
  const staleGuide = await createTutorial(maker.id, { title: stale, status: 'approved' })
  const freshGuide = await createTutorial(maker.id, { title: fresh, status: 'approved' })
  tutorialIds.push(staleGuide, freshGuide)
  const db = adminClient()
  const { data: staleBuild, error } = await db
    .from('toy_transactions')
    .insert({ type: 'build', tutorial_id: staleGuide, requester_id: family.id, build_brief: 'For Leo, who has a tremor', status: 'requested', owner_id: null, created_at: daysAgo(20) })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  await db.from('toy_transactions').insert({ type: 'build', tutorial_id: freshGuide, requester_id: family.id, status: 'requested', owner_id: null, created_at: daysAgo(1) })

  const admin = await signInAdmin(page)
  await acceptTerms(admin.id)
  const nudgeCard = /Build requests needing a nudge/
  expect(await cardCount(page, nudgeCard)).toBeGreaterThanOrEqual(1)

  await page.goto('/admin/build-requests')
  const staleRow = page.getByRole('listitem').filter({ hasText: stale })
  const freshRow = page.getByRole('listitem').filter({ hasText: fresh })
  await expect(staleRow).toContainText('20 days unclaimed')
  await expect(staleRow).toContainText('“For Leo, who has a tremor”')
  await expect(staleRow).toContainText('Needs attention')
  await expect(freshRow).toContainText('1 day open')
  await expect(freshRow).toContainText('Healthy')

  const rows = await page.getByRole('listitem').allInnerTexts()
  expect(rows.findIndex((r) => r.includes(stale))).toBeLessThan(rows.findIndex((r) => r.includes(fresh)))

  await staleRow.getByRole('link', { name: 'Open the thread' }).click()
  await page.waitForURL(`**/dashboard/exchanges/build/${staleBuild.id}`)
  await expect(page.getByText(stale).first()).toBeVisible()
})
