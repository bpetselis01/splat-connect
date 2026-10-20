import { test, expect } from '@playwright/test'
import { adminClient, createContributor, makeOrgLeader, renameProfile, signInAsNewContributor, uniqueTitle } from './helpers'
import { addOrgLeader, partyPage } from './org-fixtures'

/**
 * Who leads an organisation, from the profile editor: invite a co-leader (the
 * invitee answers on their own Account screen), cancel an invitation, and step
 * down once somebody else leads. The invitation email is off until
 * email-delivery ships, so the row and the invitee's Account are the proof.
 */

async function invitesFor(orgId: string) {
  const { data } = await adminClient().from('org_leader_invites').select('id, invited_profile_id, invited_by').eq('org_id', orgId)
  return data ?? []
}

test('L25 inviting a leader writes the invite, and the invitee finds it on their Account screen', async ({ page, browser, baseURL }) => {
  const leader = await signInAsNewContributor(page)
  const orgName = uniqueTitle('E2E Inviting Org')
  const orgId = await makeOrgLeader(leader.id, orgName)
  const invitee = await createContributor()

  await page.goto('/organisation/profile')
  await page.getByLabel('Invite a leader', { exact: true }).fill(invitee.email)
  await page.getByRole('button', { name: 'Send invitation' }).click()
  await expect(page.getByText('Invited. They become a leader once they accept on their Account screen.')).toBeVisible()
  await expect(page.getByText(/· invited$/)).toBeVisible()
  expect(await invitesFor(orgId)).toEqual([
    expect.objectContaining({ invited_profile_id: invitee.id, invited_by: leader.id }),
  ])

  const inviteePage = await partyPage(browser, baseURL, invitee)
  try {
    await inviteePage.goto('/account')
    await expect(inviteePage.getByText(`${orgName} invited you to be one of its leaders.`, { exact: false })).toBeVisible()
  } finally {
    await inviteePage.context().close()
  }

  // An address nobody signed up with is refused in the leader's words.
  await page.getByLabel('Invite a leader', { exact: true }).fill('nobody@mobile-e2e.local')
  await page.getByRole('button', { name: 'Send invitation' }).click()
  await expect(page.getByText('No SPLAT account uses that email. Ask them to sign up first.')).toBeVisible()
  expect(await invitesFor(orgId)).toHaveLength(1)
})

test('L26 Cancel invitation deletes the invite and it leaves the invitee’s Account screen', async ({ page, browser, baseURL }) => {
  const leader = await signInAsNewContributor(page)
  const orgName = uniqueTitle('E2E Cancelling Org')
  const orgId = await makeOrgLeader(leader.id, orgName)
  const invitee = await createContributor()
  await renameProfile(invitee.id, uniqueTitle('Invited Person'))
  const { error } = await adminClient()
    .from('org_leader_invites')
    .insert({ org_id: orgId, invited_profile_id: invitee.id, invited_by: leader.id })
  if (error) throw new Error(error.message)

  const inviteePage = await partyPage(browser, baseURL, invitee)
  try {
    await inviteePage.goto('/account')
    await expect(inviteePage.getByText(`${orgName} invited you`, { exact: false })).toBeVisible()

    await page.goto('/organisation/profile')
    await page.getByRole('button', { name: 'Cancel invitation' }).click()
    await expect(page.getByRole('button', { name: 'Cancel invitation' })).toBeHidden()
    expect(await invitesFor(orgId)).toEqual([])

    await inviteePage.goto('/account')
    await expect(inviteePage.getByText('Account', { exact: true }).first()).toBeVisible()
    await expect(inviteePage.getByText(`${orgName} invited you`, { exact: false })).toHaveCount(0)
  } finally {
    await inviteePage.context().close()
  }
})

test('L27 Step down appears only with a co-leader, removes the leadership, and takes the leader off the public page', async ({ page, browser, baseURL }) => {
  const leader = await signInAsNewContributor(page)
  const orgName = uniqueTitle('E2E Stepping Org')
  const orgId = await makeOrgLeader(leader.id, orgName)
  const stepper = leader
  const leaderName = uniqueTitle('Stepping Leader')
  await renameProfile(stepper.id, leaderName)

  // The only leader cannot step down: no button.
  await page.goto('/organisation/profile')
  await expect(page.getByText('(you)')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Step down as leader' })).toBeHidden()

  const colleague = await createContributor()
  await addOrgLeader(orgId, colleague.id)
  await page.reload()

  const colleaguePage = await partyPage(browser, baseURL, colleague)
  try {
    await colleaguePage.goto(`/toy-library/organisation/${orgId}`)
    await expect(colleaguePage.getByText(leaderName)).toBeVisible()

    await page.getByRole('button', { name: 'Step down as leader' }).click()
    await expect
      .poll(async () => (await adminClient().from('org_leaders').select('user_id').eq('org_id', orgId)).data?.map((r) => r.user_id))
      .toEqual([colleague.id])

    // Counterpart: the colleague still leads; the stepper is gone from the page's leaders.
    await colleaguePage.reload()
    await expect(colleaguePage.getByRole('heading', { name: orgName })).toBeVisible()
    await expect(colleaguePage.getByText(leaderName)).toHaveCount(0)
  } finally {
    await colleaguePage.context().close()
  }

  // And the stepper no longer gets the leader screens.
  await page.goto('/organisation')
  await expect(page.getByText('This screen belongs to organisation leaders.')).toBeVisible()
})
