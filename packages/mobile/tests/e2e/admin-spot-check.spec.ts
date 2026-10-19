import { test, expect, type Page } from '@playwright/test'
import { adminClient, createContributor, createTutorial, makeLeader, uniqueTitle } from './helpers'
import { cardCount, signInAdmin } from './admin-fixtures'

const SPOT_CARD = 'Spot-check'
const row = (page: Page, title: string) => page.getByRole('button', { name: new RegExp(title) })

/** A live guide an organisation leader approved, so it is eligible for the sample. */
async function leaderApprovedGuide() {
  const author = await createContributor()
  const leader = await createContributor()
  const orgName = uniqueTitle('E2E Spot Org')
  const orgId = await makeLeader(leader.id, orgName)
  const title = uniqueTitle('E2E Spot Guide')
  const id = await createTutorial(author.id, { title, status: 'approved' })
  await adminClient().from('tutorials').update({ reviewed_by: leader.id, reviewed_for_org_id: orgId }).eq('id', id)
  return { id, title, authorId: author.id }
}

// The API samples the first ten eligible guides, so these specs assume fewer than ten other
// leader-approved guides exist at the moment they run.
async function openSample(page: Page, title: string) {
  await expect(async () => {
    await page.goto('/admin/spot-check')
    await expect(row(page, title)).toBeVisible({ timeout: 3000 })
  }).toPass()
}

test('Q47 the Spot-check card opens a sample that lists a guide an organisation leader approved', async ({ page }) => {
  const guide = await leaderApprovedGuide()
  await signInAdmin(page)
  expect(await cardCount(page, SPOT_CARD)).toBeGreaterThanOrEqual(1)
  await page.getByRole('button', { name: /^Spot-check, \d+$/ }).click()
  await expect(page).toHaveURL(/\/admin\/spot-check$/)
  await openSample(page, guide.title)
  await expect(row(page, guide.title)).toContainText('Approved')
})

test('Q48 a Spot-check row opens that guide on /admin/review/:id', async ({ page }) => {
  const guide = await leaderApprovedGuide()
  await signInAdmin(page)
  await openSample(page, guide.title)
  await row(page, guide.title).click()
  await expect(page).toHaveURL(new RegExp(`/admin/review/${guide.id}$`))
  await expect(page.getByText(guide.title, { exact: true }).filter({ visible: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Unpublish', exact: true })).toBeVisible()
})

test('Q49 Unpublish needs a note, then rejects the live guide, tells its writer and drops the Spot-check card', async ({ page }) => {
  const guide = await leaderApprovedGuide()
  const eligible = async () =>
    (await adminClient().from('tutorials').select('id', { count: 'exact', head: true }).eq('status', 'approved').not('reviewed_by', 'is', null)).count!
  await signInAdmin(page)
  await openSample(page, guide.title)
  const before = await eligible()
  await row(page, guide.title).click()

  await page.getByRole('button', { name: 'Unpublish', exact: true }).click()
  await expect(page.getByText('Say why you are taking it down. The contributor sees this note.')).toBeVisible()
  expect((await adminClient().from('tutorials').select('status').eq('id', guide.id).single()).data).toEqual({ status: 'approved' })

  await page.getByLabel('Why are you taking it down?').fill('The battery cover is unsafe')
  await page.getByRole('button', { name: 'Unpublish', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/spot-check$/)
  await expect(row(page, guide.title)).toHaveCount(0)

  expect((await adminClient().from('tutorials').select('status, rejection_note').eq('id', guide.id).single()).data)
    .toEqual({ status: 'rejected', rejection_note: 'The battery cover is unsafe' })
  expect((await adminClient().from('notifications').select('type, actor_name, body').eq('recipient_id', guide.authorId).eq('tutorial_id', guide.id)).data)
    .toEqual([{ type: 'tutorial_rejected', actor_name: 'SPLAT', body: 'The battery cover is unsafe' }])
  expect(await eligible()).toBe(before - 1)
  expect(await cardCount(page, SPOT_CARD)).toBe(Math.min(before - 1, 10))
})
