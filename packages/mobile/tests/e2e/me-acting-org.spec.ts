import { test, expect } from '@playwright/test'
import { adminClient, createContributor, makeLeader, signIn, uniqueTitle } from './helpers'

test('Q20 the Acting-for pill opens the sheet, a pick is kept across a reload and the leader screens follow it', async ({ page }) => {
  const leader = await createContributor()
  const north = uniqueTitle('E2E North Org')
  const west = uniqueTitle('E2E West Org')
  const orgIds = [await makeLeader(leader.id, north), await makeLeader(leader.id, west)]
  test.info().annotations.push({ type: 'orgs', description: orgIds.join(',') })
  await signIn(page, leader.email, leader.password)
  await expect(page).toHaveURL(/\/home$/)

  await page.goto('/me')
  const pill = page.getByRole('button', { name: /^Acting for .*\. Change organisation\.$/ })
  const current = (await pill.getAttribute('aria-label'))!.match(/^Acting for (.*)\. Change organisation\.$/)![1]
  expect([north, west]).toContain(current)
  const other = current === north ? west : north

  await pill.click()
  await expect(page.getByText('Act for which organisation?')).toBeVisible()
  await expect(page.getByRole('radio', { name: current })).toBeVisible()
  await page.getByRole('radio', { name: other }).click()
  await expect(page.getByText('Act for which organisation?')).toHaveCount(0)
  await expect(pill).toHaveAccessibleName(`Acting for ${other}. Change organisation.`)

  await page.goto('/organisation/publish')
  await expect(page.getByText(`Published items are live on ${other}'s public page right now.`)).toBeVisible()

  await page.reload()
  await page.goto('/me')
  await expect(page.getByRole('button', { name: `Acting for ${other}. Change organisation.` })).toBeVisible()
})

test.afterEach(async () => {
  const ids = test.info().annotations.find((a) => a.type === 'orgs')?.description?.split(',') ?? []
  await adminClient().from('organizations').delete().in('id', ids)
})
