import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createPublishedToy, renameProfile, signInAsNewContributor, uniqueTitle } from './helpers'

/**
 * My exchanges: the rows a Member is party to, active before history, and the
 * ?toy= filter the toy editor's offers row opens. Pull-to-refresh is a touch
 * gesture the web export cannot make; the reload on focus is what this drives.
 */

async function seedRequest(toyId: string, requesterId: string, ownerId: string, status: 'requested' | 'withdrawn') {
  const { data, error } = await adminClient()
    .from('toy_transactions')
    .insert({ type: 'donation', status, toy_id: toyId, requester_id: requesterId, owner_id: ownerId })
    .select('id')
    .single()
  if (error || !data) throw new Error(`seedRequest failed: ${error?.message}`)
  return data.id as string
}

test('X01 My exchanges lists active rows then history, and the toy filter narrows to one toy', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const other = await createContributor()
  const otherName = uniqueTitle('E2E Exchange Other')
  await renameProfile(other.id, otherName)

  const asked = uniqueTitle('E2E Asked Toy')
  const old = uniqueTitle('E2E Old Toy')
  const mine = uniqueTitle('E2E My Toy')
  const askedToy = await createPublishedToy(other.id, { name: asked })
  const oldToy = await createPublishedToy(other.id, { name: old })
  const myToy = await createPublishedToy(me.id, { name: mine })
  await seedRequest(askedToy, me.id, other.id, 'requested')
  await seedRequest(oldToy, me.id, other.id, 'withdrawn')
  await seedRequest(myToy, other.id, me.id, 'requested')

  await page.goto('/exchanges')
  const row = (toy: string) => page.getByRole('button', { name: new RegExp(`^${toy}`) })
  await expect(row(asked)).toBeVisible()
  await expect(row(mine)).toBeVisible()
  await expect(row(old)).toBeVisible()
  await expect(row(asked)).toContainText(`Donation with ${otherName}`)
  await expect(row(old)).toContainText('Withdrawn')

  // Active comes before History down the page.
  const top = async (l: ReturnType<typeof page.getByText>) => (await l.boundingBox())!.y
  const history = await top(page.getByText('History', { exact: true }))
  expect(await top(page.getByText('Active', { exact: true }))).toBeLessThan(await top(row(asked)))
  expect(await top(row(asked))).toBeLessThan(history)
  expect(history).toBeLessThan(await top(row(old)))

  await page.goto(`/exchanges?toy=${myToy}`)
  await expect(page.getByRole('button', { name: `Clear filter: offers on ${mine}` })).toBeVisible()
  await expect(row(mine)).toBeVisible()
  await expect(row(asked)).toHaveCount(0)
  await page.getByRole('button', { name: `Clear filter: offers on ${mine}` }).click()
  await expect(row(asked)).toBeVisible()
})
