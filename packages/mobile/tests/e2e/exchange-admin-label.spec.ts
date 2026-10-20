import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createPublishedToy, signInAsNewContributor, uniqueTitle } from './helpers'
import { seedDonation } from './family-toys-fixtures'

test('X16 a member sees an admin message in their exchange labelled SPLAT admin', async ({ page }) => {
  const owner = await signInAsNewContributor(page)
  const requester = await createContributor()
  const admin = await createContributor()
  await adminClient().from('profiles').update({ role: 'admin' }).eq('id', admin.id)
  const toyId = await createPublishedToy(owner.id, { name: uniqueTitle('E2E Admin Label Toy'), offer_type: 'donation' })
  const txId = await seedDonation(owner.id, requester.id, toyId, 'requested')
  const { error } = await adminClient()
    .from('toy_transaction_messages')
    .insert({ transaction_id: txId, sender_id: admin.id, kind: 'admin', body: 'Checking in on this one' })
  expect(error).toBeNull()

  await page.goto(`/exchanges/${txId}`)
  await expect(page.getByText('Checking in on this one')).toBeVisible()
  await expect(page.getByLabel('SPLAT admin said: Checking in on this one')).toBeVisible()
})
