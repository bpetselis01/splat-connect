import { test, expect } from '@playwright/test'
import {
  adminClient,
  createContributor,
  createNotification,
  createPublishedToy,
  makeOrgLeader,
  renameProfile,
  signInAsNewContributor,
  uniqueTitle,
} from './helpers'
import { partyPage, seedOrgToy } from './org-fixtures'

/**
 * The badges that say how much is waiting: the Inbox and Me tab badges, the
 * Inbox's "N unread", Me's "N waiting". Each test does the thing that should
 * change one (open a thread, answer a request, accept an invitation, send a
 * message) and reads the number off a screen that was not reloaded, then reads
 * the row back from the database.
 */

async function seedRequest(toyId: string, requesterId: string, owner: { ownerId?: string; orgId?: string }) {
  const { data, error } = await adminClient()
    .from('toy_transactions')
    .insert({
      type: 'donation',
      status: 'requested',
      toy_id: toyId,
      requester_id: requesterId,
      owner_id: owner.ownerId ?? null,
      owner_org_id: owner.orgId ?? null,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`seedRequest failed: ${error?.message}`)
  return data.id as string
}

test('Q10: opening an exchange thread clears its unread dot, the bucket count and the Inbox tab badge', async ({ page }) => {
  const viewer = await signInAsNewContributor(page)
  const owner = await createContributor()
  await renameProfile(owner.id, uniqueTitle('Thread Partner'))
  const toyName = uniqueTitle('E2E Thread Toy')
  const toyId = await createPublishedToy(owner.id, { name: toyName, offer_type: 'donation' })
  const txId = await seedRequest(toyId, viewer.id, { ownerId: owner.id })
  const ids = [
    await createNotification(viewer.id, { type: 'toy_message', toy_transaction_id: txId, toy_name: toyName }),
    await createNotification(viewer.id, { type: 'toy_message', toy_transaction_id: txId, toy_name: toyName }),
  ]

  await page.goto('/inbox')
  await expect(page.getByText('2 unread', { exact: true })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Inbox, 2 unread' })).toBeVisible()

  await page.getByRole('button', { name: new RegExp(`^${toyName} with `) }).click()
  await page.waitForURL(new RegExp(`/exchanges/${txId}`))
  await expect
    .poll(async () => {
      const { data } = await adminClient().from('notifications').select('read_at').in('id', ids)
      return (data ?? []).filter((r) => r.read_at !== null).length
    })
    .toBe(2)

  await page.goBack()
  await expect(page.getByText('2 unread', { exact: true })).toBeHidden()
  await expect(page.getByRole('tab', { name: /^Inbox(,|$)/ })).toBeVisible()
})

test('L16: declining a request moves the requests tab, then the Me waiting count, down without a reload', async ({
  page,
}) => {
  const leader = await signInAsNewContributor(page)
  const orgName = uniqueTitle('E2E Waiting Org')
  const orgId = await makeOrgLeader(leader.id, orgName)
  const toyId = await seedOrgToy(orgId, { name: uniqueTitle('E2E Waiting Bear'), quantity: 2 })
  const familyA = await createContributor()
  const familyB = await createContributor()
  const nameA = uniqueTitle('Waiting A')
  await renameProfile(familyA.id, nameA)
  await renameProfile(familyB.id, uniqueTitle('Waiting B'))
  const txA = await seedRequest(toyId, familyA.id, { orgId })
  await seedRequest(toyId, familyB.id, { orgId })

  await page.goto('/me')
  await expect(page.getByText(`Leads ${orgName} · 2 waiting`)).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Me, 2 waiting' })).toBeVisible()

  await page.getByRole('button', { name: 'Requests to you', exact: true }).click()
  await expect(page.getByRole('radio', { name: 'Lend a toy · 2' })).toBeVisible()
  await page.getByRole('button', { name: new RegExp(`^${nameA}, `) }).click()
  await page.waitForURL(new RegExp(`/exchanges/${txA}$`))
  await page.getByRole('button', { name: 'Decline', exact: true }).click()
  await expect
    .poll(async () => (await adminClient().from('toy_transactions').select('status').eq('id', txA).single()).data?.status)
    .toBe('rejected')

  await page.goBack()
  await expect(page.getByRole('radio', { name: 'Lend a toy · 1' })).toBeVisible()
  await page.goBack()
  await expect(page.getByText(`Leads ${orgName} · 1 waiting`)).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Me, 1 waiting' })).toBeVisible()
})

test('L31: accepting a leader invitation adds the Organisation group to Me; declining leaves it out', async ({ page }) => {
  const invitee = await signInAsNewContributor(page)
  const inviter = await createContributor()
  const orgName = uniqueTitle('E2E Invite Org')
  const orgId = await makeOrgLeader(inviter.id, orgName)
  const declinedName = uniqueTitle('E2E Declined Org')
  const declinedOrgId = await makeOrgLeader(inviter.id, declinedName)
  const admin = adminClient()
  for (const id of [orgId, declinedOrgId]) {
    const { error } = await admin
      .from('org_leader_invites')
      .insert({ org_id: id, invited_profile_id: invitee.id, invited_by: inviter.id })
    if (error) throw new Error(error.message)
  }

  await page.goto('/me')
  await expect(page.getByText('Organisation', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Account', exact: true }).click()
  await expect(page.getByText(declinedName)).toBeVisible()

  // Decline the second one first: the Organisation group must still not appear.
  const declined = page.locator('div').filter({ hasText: declinedName }).getByRole('button', { name: 'Decline' }).last()
  await declined.click()
  await expect(page.getByText(declinedName)).toHaveCount(0)
  expect((await admin.from('org_leader_invites').select('id').eq('org_id', declinedOrgId)).data).toEqual([])
  expect((await admin.from('org_leaders').select('user_id').eq('org_id', declinedOrgId).eq('user_id', invitee.id)).data).toEqual([])

  await page.getByRole('button', { name: 'Accept', exact: true }).click()
  await expect(page.getByText(orgName)).toHaveCount(0)
  await expect
    .poll(async () => (await admin.from('org_leaders').select('user_id').eq('org_id', orgId).eq('user_id', invitee.id)).data?.length)
    .toBe(1)

  await page.goBack()
  await expect(page.getByText('Organisation', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Review queue', exact: true })).toBeVisible()
})

test('P10 L29 each message adds one to the other side\'s Inbox, and opening it clears it', async ({
  page,
  browser,
  baseURL,
}) => {
  const leader = await signInAsNewContributor(page)
  const orgName = uniqueTitle('E2E Badge Org')
  const orgId = await makeOrgLeader(leader.id, orgName)
  const family = await createContributor()
  const familyName = uniqueTitle('Badge Family')
  await renameProfile(family.id, familyName)

  // The family has two pages in one session: one idles on Home as the app
  // would, one writes. The idle one is the one whose badge is read.
  const familyHome = await partyPage(browser, baseURL, family)
  const familyWrites = await familyHome.context().newPage()
  try {
    // P10: the family writes; the leader, idle on Home, sees Inbox 1 unread after moving between tabs.
    await familyWrites.goto(`/toy-library/organisation/${orgId}`)
    await familyWrites.getByRole('button', { name: 'Message', exact: true }).click()
    const question = uniqueTitle('Do you take switch toys')
    await familyWrites.getByLabel(`Message ${orgName}`, { exact: true }).fill(question)
    await familyWrites.getByRole('button', { name: 'Send', exact: true }).click()
    await expect(familyWrites.getByRole('list', { name: 'Conversation' }).getByText(question)).toBeVisible()
    const convo = (
      await adminClient().from('org_conversations').select('id').eq('org_id', orgId).eq('profile_id', family.id).single()
    ).data!

    await page.getByRole('tab', { name: /^Me(,|$)/ }).click()
    await page.getByRole('tab', { name: /^Inbox/ }).click()
    await expect(page.getByRole('tab', { name: 'Inbox, 1 unread' })).toBeVisible()
    await expect(page.getByText('1 unread', { exact: true })).toBeVisible()

    // Opening the notice opens the conversation and clears the count.
    await page.getByText(`${familyName} messaged ${orgName}`).click()
    await page.waitForURL(new RegExp(`/messages/${convo.id}`))

    // L29: the leader answers; the family, still idle on Home, now has one unread.
    const answer = uniqueTitle('Yes we do')
    await page.getByLabel(`Message ${familyName}`, { exact: true }).fill(answer)
    await page.getByRole('button', { name: 'Send', exact: true }).click()
    await expect(page.getByRole('list', { name: 'Conversation' }).getByText(answer)).toBeVisible()
    const sent = (await adminClient().from('org_messages').select('body').eq('conversation_id', convo.id)).data ?? []
    expect(sent.map((m) => m.body).sort()).toEqual([answer, question].sort())

    await page.goBack()
    await expect(page.getByText('1 unread', { exact: true })).toBeHidden()
    await expect(page.getByRole('tab', { name: /^Inbox(,|$)/ })).toBeVisible()

    await familyHome.getByRole('tab', { name: /^Me(,|$)/ }).click()
    await familyHome.getByRole('tab', { name: /^Inbox/ }).click()
    await expect(familyHome.getByRole('tab', { name: 'Inbox, 1 unread' })).toBeVisible()
    await expect(familyHome.getByText('1 unread', { exact: true })).toBeVisible()
  } finally {
    await familyHome.context().close()
  }
})
