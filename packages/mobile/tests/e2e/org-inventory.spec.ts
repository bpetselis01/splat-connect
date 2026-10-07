// journeys: L09 L10
import { test, expect } from '@playwright/test'
import { adminClient, createContributor, makeOrgLeader, signInAsNewContributor, uniqueTitle } from './helpers'
import { seedOrgToy } from './org-fixtures'

/**
 * The org's shelf: the add button carries the organisation into the new-toy
 * form, and Remove is offered only on a retired toy no handover names.
 */

test('an empty shelf offers + Add to inventory, which opens the new-toy form for this organisation', async ({ page }) => {
  const leader = await signInAsNewContributor(page)
  const orgId = await makeOrgLeader(leader.id)

  await page.goto('/organisation/toys')
  await expect(page.getByText('Nothing on the shelf yet.')).toBeVisible()
  await page.getByRole('button', { name: '+ Add to inventory' }).click()
  await expect(page).toHaveURL(new RegExp(`/toys/new\\?org=${orgId}$`))
})

test('Remove deletes a retired toy; a toy a handover names, and a toy still on offer, have no Remove', async ({ page }) => {
  const leader = await signInAsNewContributor(page)
  const orgId = await makeOrgLeader(leader.id)
  const family = await createContributor()
  const goneName = uniqueTitle('E2E Retired Bear')
  const keptName = uniqueTitle('E2E Handed Bear')
  const liveName = uniqueTitle('E2E Live Bear')
  const goneId = await seedOrgToy(orgId, { name: goneName, retired: true })
  const keptId = await seedOrgToy(orgId, { name: keptName, retired: true })
  await seedOrgToy(orgId, { name: liveName })
  const { error } = await adminClient()
    .from('toy_transactions')
    .insert({ type: 'donation', status: 'completed', toy_id: keptId, owner_org_id: orgId, requester_id: family.id })
  if (error) throw new Error(error.message)

  await page.goto('/organisation/toys')
  await expect(page.getByText(liveName)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove' })).toHaveCount(1)

  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByText(`${goneName} removed from the shelf`)).toBeVisible()
  await expect(page.getByRole('button', { name: new RegExp(goneName) })).toHaveCount(0)

  const { data: rows } = await adminClient().from('toys').select('id').in('id', [goneId, keptId])
  expect(rows).toEqual([{ id: keptId }])
  await expect(page.getByRole('button', { name: new RegExp(keptName) })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove' })).toHaveCount(0)
})
