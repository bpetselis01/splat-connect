import { test, expect } from '@playwright/test'
import { signIn, createAdmin, createContributor, makeLeader, deleteOrg } from '../helpers'
import { expectCardMoved, liveCount } from './support'

test('WM17 an admin deletes a contributor account and the Accounts card drops', async ({ page }) => {
  const admin = await createAdmin()
  const victim = await createContributor()

  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')
  const accountsBefore = await liveCount('accounts')

  await page.goto(`/admin/contributors?q=${encodeURIComponent(victim.email)}`)
  await expect(page.getByText(victim.email)).toBeVisible()

  const row = page.getByTestId('contributor-row').filter({ hasText: victim.email })
  await row.getByRole('button', { name: 'Delete account' }).click()
  await row.getByLabel(/to confirm/i).fill('confirm_delete_account')
  await row.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.waitForLoadState('networkidle')

  await expect(page.getByText(victim.email)).toHaveCount(0)
  await expect(page.getByText('No accounts match.')).toBeVisible()
  await expectCardMoved(page, 'accounts', accountsBefore, -1)
})

test('WM17 removing the sole leader of an organisation changes nothing', async ({ page }) => {
  const admin = await createAdmin()
  const leader = await createContributor()
  const orgId = await makeLeader(leader.id)
  try {
    await signIn(page, admin.email, admin.password)
    await page.waitForURL('**/admin')
    await page.goto(`/admin/contributors?q=${encodeURIComponent(leader.email)}`)
    const row = page.getByTestId('contributor-row').filter({ hasText: leader.email })
    await row.getByRole('button', { name: 'Delete account' }).click()
    await row.getByLabel(/to confirm/i).fill('confirm_delete_account')
    await row.getByRole('button', { name: 'Delete', exact: true }).click()
    await page.waitForLoadState('networkidle')

    // The API answers 409; the account is still listed after a reload.
    await page.goto(`/admin/contributors?q=${encodeURIComponent(leader.email)}`)
    await expect(page.getByTestId('contributor-row').filter({ hasText: leader.email })).toBeVisible()
  } finally {
    await deleteOrg(orgId)
  }
})

test('WM16 the contributors list renders name, email and joined date', async ({ page }) => {
  const admin = await createAdmin()
  const contributor = await createContributor()

  await signIn(page, admin.email, admin.password)
  await page.waitForURL('**/admin')
  await page.goto('/admin/contributors')

  const row = page.getByTestId('contributor-row').filter({ hasText: contributor.email })
  await expect(row).toContainText(contributor.name)
  await expect(row).toContainText(contributor.email)
  await expect(row).toContainText(/[A-Z][a-z]{2} \d{4}/)
})

test('WM16 search and the Leaders chip narrow the list, and a leader is tagged Leader', async ({ page }) => {
  const admin = await createAdmin()
  const leader = await createContributor()
  const plain = await createContributor()
  const orgId = await makeLeader(leader.id)
  try {
    await signIn(page, admin.email, admin.password)
    await page.waitForURL('**/admin')
    await page.goto('/admin/contributors')
    await page.waitForLoadState('networkidle')
    const search = page.getByRole('searchbox', { name: 'Search accounts' })
    await search.fill(leader.email)
    await search.press('Enter')
    await expect(page).toHaveURL(/q=/)
    await expect(page.getByTestId('contributor-row')).toHaveCount(1)
    await expect(page.getByTestId('contributor-row')).toContainText('Leader')

    await page.getByRole('navigation', { name: 'Filter accounts' }).getByRole('link', { name: /^Contributors/ }).click()
    await expect(page.getByText('No accounts match.')).toBeVisible()

    await page.goto(`/admin/contributors?cap=leaders&q=${encodeURIComponent(plain.email)}`)
    await expect(page.getByText('No accounts match.')).toBeVisible()
    await page.goto(`/admin/contributors?cap=leaders&q=${encodeURIComponent(leader.email)}`)
    await expect(page.getByTestId('contributor-row')).toHaveCount(1)
  } finally {
    await deleteOrg(orgId)
  }
})
