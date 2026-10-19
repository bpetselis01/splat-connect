import { test, expect } from '@playwright/test'
import {
  acceptTerms, adminClient, createContributor, createOrg, createTutorial, deleteOrg, deleteUser, makeLeader, signIn, uniqueTitle,
} from '../helpers'

test('WI27 a signed-out visitor is offered sign-up, and a member gets Ask for a build and sees their own request', async ({ page }) => {
  await page.goto('/get-involved/requests')
  await page.getByRole('link', { name: 'Create an account to ask' }).click()
  await expect(page).toHaveURL(/\/signup$/)

  const family = await createContributor()
  await acceptTerms(family.id)
  const guide = uniqueTitle('Bubble guide')
  const tutorialId = await createTutorial(family.id, { title: guide, status: 'approved' })
  const maker = await createContributor()
  const { data: tx } = await adminClient()
    .from('toy_transactions')
    .insert({ type: 'build', status: 'requested', tutorial_id: tutorialId, requester_id: family.id, owner_id: maker.id })
    .select('id')
    .single()
  try {
    await signIn(page, family.email, family.password)
    await page.goto('/get-involved/requests')
    await expect(page.getByRole('link', { name: 'Create an account to ask' })).toHaveCount(0)
    await expect(page.getByText('Your build requests')).toBeVisible()
    await expect(page.getByText(guide)).toBeVisible()
    await page.getByRole('link', { name: 'Thread' }).click()
    await expect(page).toHaveURL(new RegExp(`/dashboard/exchanges/build/${tx!.id}$`))

    await page.goto('/get-involved/requests')
    await page.getByRole('link', { name: 'Ask for a build' }).click()
    await expect(page).toHaveURL(/\/get-involved\/requests\/new$/)
  } finally {
    await adminClient().from('toy_transactions').delete().eq('tutorial_id', tutorialId)
    await adminClient().from('tutorials').delete().eq('id', tutorialId)
    await Promise.all([deleteUser(family.id), deleteUser(maker.id)])
  }
})

test('WI28 a member asks an organisation to build a guide and its leader is told', async ({ page }) => {
  const family = await createContributor()
  await acceptTerms(family.id)
  const leader = await createContributor()
  const orgName = uniqueTitle('Northside Therapy')
  const orgId = await makeLeader(leader.id, orgName)
  const guide = uniqueTitle('Bubble guide')
  const tutorialId = await createTutorial(leader.id, { title: guide, status: 'approved' })
  try {
    await signIn(page, family.email, family.password)
    await page.goto('/get-involved/requests/new')
    await page.getByLabel('Which guide').selectOption({ label: guide })
    await page.getByLabel('Who you are asking').selectOption({ label: orgName })
    await page.getByLabel('What they need to know').fill('For Mia, 5. She uses a big button.')
    await page.getByRole('button', { name: 'Send the request' }).click()

    await expect(page).toHaveURL(/\/dashboard\/exchanges\/build\/[0-9a-f-]+$/)
    const db = adminClient()
    const { data: tx } = await db
      .from('toy_transactions')
      .select('id, status, owner_org_id, owner_id, requester_id, build_brief')
      .eq('tutorial_id', tutorialId)
      .single()
    expect(tx).toMatchObject({
      status: 'requested', owner_org_id: orgId, owner_id: null, requester_id: family.id, build_brief: 'For Mia, 5. She uses a big button.',
    })
    const { data: notes } = await db.from('notifications').select('recipient_id, type').eq('toy_transaction_id', tx!.id)
    expect(notes).toEqual([{ recipient_id: leader.id, type: 'toy_request' }])
  } finally {
    await adminClient().from('toy_transactions').delete().eq('tutorial_id', tutorialId)
    await adminClient().from('tutorials').delete().eq('id', tutorialId)
    await deleteOrg(orgId)
    await Promise.all([deleteUser(family.id), deleteUser(leader.id)])
  }
})
