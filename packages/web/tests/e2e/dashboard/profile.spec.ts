import { test, expect } from '@playwright/test'
import {
  acceptTerms,
  adminClient,
  createContributor,
  createOrg,
  createTutorial,
  deleteUser,
  signIn,
  uniqueTitle,
} from '../helpers'

async function member() {
  const m = await createContributor()
  await acceptTerms(m.id)
  return m
}

test('WD07 Sign out ends the session and the dashboard sends the visitor to sign in', async ({ page }) => {
  const m = await member()
  try {
    await signIn(page, m.email, m.password)
    await page.goto('/dashboard/profile')
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('banner').getByRole('link', { name: 'Sign in' })).toBeVisible()

    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  } finally {
    await deleteUser(m.id)
  }
})

test('WD11 the featured guide is chosen from my published guides and shows on my public profile', async ({ page }) => {
  const m = await member()
  const live = uniqueTitle('Featured pick')
  const draft = uniqueTitle('Still a draft')
  await createTutorial(m.id, { title: live, status: 'approved' })
  await createTutorial(m.id, { title: draft, status: 'draft' })
  try {
    await signIn(page, m.email, m.password)
    await page.goto('/dashboard/profile')
    const select = page.getByLabel('Featured guide')
    await expect(select.locator('option', { hasText: draft })).toHaveCount(0)
    await select.selectOption({ label: live })
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('main').getByText('Saved', { exact: true })).toBeVisible()

    await page.goto(`/contributors/${m.id}`)
    const featured = page.locator('#ctb-featured')
    await expect(featured.getByRole('heading', { name: 'Featured' })).toBeVisible()
    await expect(featured).toContainText(live)
  } finally {
    await deleteUser(m.id)
  }
})

test('WD08 WD09 an organisation invitation is accepted into a leader seat, and another is declined without one', async ({ page }) => {
  const m = await member()
  const joinName = uniqueTitle('Join Org')
  const skipName = uniqueTitle('Skip Org')
  const joinId = await createOrg(joinName)
  const skipId = await createOrg(skipName)
  const db = adminClient()
  await db.from('org_leader_invites').insert([
    { org_id: joinId, invited_profile_id: m.id },
    { org_id: skipId, invited_profile_id: m.id },
  ])
  const leads = async (orgId: string) =>
    (await db.from('org_leaders').select('user_id').eq('org_id', orgId).eq('user_id', m.id)).data!.length
  const invites = async () => (await db.from('org_leader_invites').select('id').eq('invited_profile_id', m.id)).data!.length

  try {
    await signIn(page, m.email, m.password)
    await page.goto('/dashboard/profile')
    const card = (name: string) => page.locator('strong', { hasText: name }).locator('xpath=ancestor::div[1]')
    await expect(card(skipName)).toBeVisible()
    await expect(card(joinName)).toBeVisible()

    await card(skipName).getByRole('button', { name: 'Decline' }).click()
    await expect(card(skipName)).toHaveCount(0)
    expect(await leads(skipId)).toBe(0)
    expect(await invites()).toBe(1)

    await card(joinName).getByRole('button', { name: 'Accept' }).click()
    await expect(page.getByText(`Leader — ${joinName}`)).toBeVisible()
    await expect(card(joinName)).toHaveCount(0)
    expect(await leads(joinId)).toBe(1)
    expect(await invites()).toBe(0)
  } finally {
    await db.from('organizations').delete().in('id', [joinId, skipId])
    await deleteUser(m.id)
  }
})
