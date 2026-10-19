import { test, expect } from '@playwright/test'
import { adminClient, deleteOrg, uniqueTitle } from '../helpers'
import { createMember, expectCardMoved, liveCount, signInAdmin } from './support'

const requestIds: string[] = []
const orgNames: string[] = []

async function seedRequest(requesterId: string, orgName: string) {
  const { data, error } = await adminClient()
    .from('organization_requests')
    .insert({ requester_id: requesterId, org_name: orgName, what_they_do: 'Prints switch toys for families.', verification: 'My work email is on the club site.' })
    .select('id')
    .single()
  if (error) throw new Error(`seedRequest failed: ${error.message}`)
  requestIds.push(data.id)
  orgNames.push(orgName)
  return data.id as string
}

test.afterAll(async () => {
  const db = adminClient()
  const { data } = await db.from('organizations').select('id').in('name', orgNames)
  for (const org of data ?? []) await deleteOrg(org.id)
  await db.from('organization_requests').delete().in('id', requestIds)
})

const card = (page: import('@playwright/test').Page, orgName: string) =>
  page.getByRole('listitem').filter({ has: page.getByText(orgName, { exact: true }) })

test('WM23 approving an organisation request creates the organisation with the requester as its leader, and the request card drops', async ({ page }) => {
  const requester = await createMember()
  const orgName = uniqueTitle('E2E Approved Request')
  const requestId = await seedRequest(requester.id, orgName)
  await signInAdmin(page)
  const requestsBefore = await liveCount('orgRequests')

  await page.goto('/admin/organization-requests')
  await page.waitForLoadState('networkidle')
  await expect(card(page, orgName)).toContainText('Prints switch toys for families.')
  await card(page, orgName).getByRole('button', { name: 'Approve and create it' }).click()

  await expect(card(page, orgName).getByRole('link', { name: 'Open the organisation' })).toBeVisible()
  await expect(card(page, orgName).getByRole('button', { name: 'Approve and create it' })).toHaveCount(0)
  const { data: request } = await adminClient().from('organization_requests').select('status, organization_id').eq('id', requestId).single()
  expect(request?.status).toBe('approved')
  const { data: leaders } = await adminClient().from('org_leaders').select('user_id').eq('org_id', request!.organization_id)
  expect((leaders ?? []).map((l) => l.user_id)).toEqual([requester.id])
  await expectCardMoved(page, 'orgRequests', requestsBefore, -1)
  await expectCardMoved(page, 'organisations', 0, 0)
})

test('WM24 declining an organisation request needs a note, shows the note on the request, and the request card drops', async ({ page }) => {
  const requester = await createMember()
  const orgName = uniqueTitle('E2E Declined Request')
  const requestId = await seedRequest(requester.id, orgName)
  await signInAdmin(page)
  const before = await liveCount('orgRequests')

  await page.goto('/admin/organization-requests')
  await page.waitForLoadState('networkidle')
  await card(page, orgName).getByRole('button', { name: 'Decline' }).click()
  await expect(card(page, orgName).getByRole('button', { name: 'Send the decline' })).toBeDisabled()
  await card(page, orgName).getByLabel(/Why, in a way they can act on/).fill('Please ask from your work address.')
  await card(page, orgName).getByRole('button', { name: 'Send the decline' }).click()

  await expect(card(page, orgName)).toContainText('Note: Please ask from your work address.')
  await expect(card(page, orgName).getByRole('button', { name: 'Decline' })).toHaveCount(0)
  const { data } = await adminClient().from('organization_requests').select('status, organization_id').eq('id', requestId).single()
  expect(data).toEqual({ status: 'declined', organization_id: null })
  await expectCardMoved(page, 'orgRequests', before, -1)
})
