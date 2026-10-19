import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createTutorial, makeOrgLeader, renameProfile, signInAsNewContributor, uniqueTitle } from './helpers'

test('T03 a row on My tutorials opens that guide’s hub', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const title = uniqueTitle('E2E Hub Row')
  const id = await createTutorial(contributor.id, { title, status: 'draft' })
  await createTutorial(contributor.id, { title: uniqueTitle('E2E Other Row'), status: 'draft' })

  await page.goto('/tutorials')
  await page.getByText(title, { exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/tutorials/${id}$`))
  await expect(page.getByTestId('hub-submit')).toBeVisible()
  await expect(page.getByText(title, { exact: true }).last()).toBeVisible()
})

test('T18 Ask <org> on Backing files a pending request, tells the leader, and offers Withdraw', async ({ page }) => {
  const contributor = await signInAsNewContributor(page)
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Ask Backing'), status: 'draft' })
  const leader = await createContributor()
  const orgName = uniqueTitle('E2E Ask Org')
  const orgId = await makeOrgLeader(leader.id, orgName)

  await page.goto(`/tutorials/${id}/backing`)
  const posted = page.waitForResponse((r) => r.url().includes(`/api/tutorials/${id}/orgs`) && r.request().method() === 'POST')
  await page.getByRole('button', { name: `Ask ${orgName}`, exact: true }).click()
  expect((await posted).ok()).toBe(true)
  await expect(page.getByRole('button', { name: `Withdraw from ${orgName}`, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: `Ask ${orgName}`, exact: true })).toHaveCount(0)

  const admin = adminClient()
  const { data } = await admin.from('tutorial_orgs').select('org_id, status').eq('tutorial_id', id)
  expect(data).toEqual([{ org_id: orgId, status: 'pending' }])
  const { data: told } = await admin.from('notifications').select('type').eq('recipient_id', leader.id).eq('tutorial_id', id)
  expect(told?.map((n) => n.type)).toEqual(['backing_requested'])
})

test('T23 the owner invites a collaborator by email, who then shows as PENDING and is told', async ({ page }) => {
  const owner = await signInAsNewContributor(page)
  const id = await createTutorial(owner.id, { title: uniqueTitle('E2E Invite'), status: 'draft' })
  const invitee = await createContributor()
  const name = uniqueTitle('E2E Invitee')
  await renameProfile(invitee.id, name)

  await page.goto(`/tutorials/${id}/collaborators`)
  await page.getByLabel('Their email').fill(invitee.email)
  const posted = page.waitForResponse((r) => r.url().includes(`/api/tutorials/${id}/collaborators/invite`) && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Invite', exact: true }).click()
  expect((await posted).status()).toBe(201)
  await expect(page.getByText(name, { exact: true })).toBeVisible()
  await expect(page.getByText('PENDING', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Their email')).toHaveValue('')

  const admin = adminClient()
  const { data } = await admin.from('tutorial_collaborator_invites').select('invited_profile_id, status').eq('tutorial_id', id)
  expect(data).toEqual([{ invited_profile_id: invitee.id, status: 'pending' }])
  const { data: told } = await admin.from('notifications').select('type').eq('recipient_id', invitee.id).eq('tutorial_id', id)
  expect(told?.map((n) => n.type)).toEqual(['collaborator_invited'])
})

test('T24 the owner removes a collaborator, who loses the seat and is told', async ({ page }) => {
  const owner = await signInAsNewContributor(page)
  const id = await createTutorial(owner.id, { title: uniqueTitle('E2E Remove'), status: 'draft' })
  const member = await createContributor()
  const name = uniqueTitle('E2E Member')
  await renameProfile(member.id, name)
  await adminClient().from('tutorial_contributors').insert({ tutorial_id: id, profile_id: member.id, role: 'collaborator' })

  await page.goto(`/tutorials/${id}/collaborators`)
  await expect(page.getByText(name, { exact: true })).toBeVisible()
  const deleted = page.waitForResponse((r) => r.url().includes(`/api/tutorials/${id}/collaborators/${member.id}`) && r.request().method() === 'DELETE')
  await page.getByRole('button', { name: `Remove ${name}`, exact: true }).click()
  expect((await deleted).status()).toBe(204)
  await expect(page.getByText(name, { exact: true })).toHaveCount(0)

  const admin = adminClient()
  const { data: seats } = await admin.from('tutorial_contributors').select('profile_id').eq('tutorial_id', id)
  expect(seats).toEqual([{ profile_id: owner.id }])
  const { data: told } = await admin.from('notifications').select('type').eq('recipient_id', member.id).eq('tutorial_id', id)
  expect(told?.map((n) => n.type)).toEqual(['collaborator_removed'])
})

test('T24 a collaborator leaves and lands back on My tutorials without the guide, and the owner is told', async ({ page }) => {
  const member = await signInAsNewContributor(page)
  const owner = await createContributor()
  const title = uniqueTitle('E2E Leave')
  const id = await createTutorial(owner.id, { title, status: 'draft' })
  await adminClient().from('tutorial_contributors').insert({ tutorial_id: id, profile_id: member.id, role: 'collaborator' })

  await page.goto(`/tutorials/${id}/collaborators`)
  const deleted = page.waitForResponse((r) => r.url().includes(`/api/tutorials/${id}/collaborators/${member.id}`) && r.request().method() === 'DELETE')
  await page.getByRole('button', { name: 'Leave', exact: true }).click()
  expect((await deleted).status()).toBe(204)
  await expect(page).toHaveURL(/\/tutorials$/)
  await expect(page.getByText(title, { exact: true })).toHaveCount(0)

  const admin = adminClient()
  const { data: seats } = await admin.from('tutorial_contributors').select('profile_id').eq('tutorial_id', id)
  expect(seats).toEqual([{ profile_id: owner.id }])
  const { data: told } = await admin.from('notifications').select('type').eq('recipient_id', owner.id).eq('tutorial_id', id)
  expect(told?.map((n) => n.type)).toEqual(['collaborator_left'])
})
