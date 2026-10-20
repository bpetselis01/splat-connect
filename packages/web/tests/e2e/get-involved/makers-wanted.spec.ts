import { test, expect } from '@playwright/test'
import { acceptTerms, adminClient, createContributor, createTutorial, deleteUser, signIn, uniqueTitle } from '../helpers'

type Member = Awaited<ReturnType<typeof createContributor>>

async function named(name: string): Promise<Member> {
  const m = await createContributor()
  await adminClient().from('profiles').update({ name }).eq('id', m.id)
  await acceptTerms(m.id)
  return { ...m, name }
}

/** An open Makers wanted post, as the board stores it. */
async function openBuild(requesterId: string, tutorialId: string, over: Record<string, unknown> = {}) {
  const { data, error } = await adminClient()
    .from('toy_transactions')
    .insert({
      type: 'build', status: 'requested', tutorial_id: tutorialId, requester_id: requesterId,
      owner_id: null, owner_org_id: null, travel_km: 10, requester_suburb: 'Newtown', urgency: 'No rush',
      build_brief: 'Leo lights up at bubbles.', ...over,
    })
    .select('id')
    .single()
  if (error) throw new Error(`openBuild failed: ${error.message}`)
  return data.id as string
}

async function cleanup(tutorialId: string, members: Member[]) {
  await adminClient().from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await Promise.all(members.map((m) => deleteUser(m.id)))
}

test('WI23 a signed-out visitor sees the explainer and signs in to come back to the board', async ({ page }) => {
  await page.goto('/get-involved/makers-wanted')
  await expect(page.getByRole('heading', { level: 1, name: 'Makers wanted' })).toBeVisible()
  await expect(page.getByText('Nobody has claimed this yet')).toHaveCount(0)
  await page.getByRole('link', { name: 'Sign in to see requests' }).click()
  await expect(page).toHaveURL(/\/login\?next=%2Fget-involved%2Fmakers-wanted$/)
})

test('WI24 the board lists an open request under Needs a maker, and a claimed one under Live', async ({ page }) => {
  const family = await named('Fern Family')
  const maker = await named('Max Maker')
  const guide = uniqueTitle('Bubble guide')
  const tutorialId = await createTutorial(family.id, { title: guide, status: 'approved' })
  await openBuild(family.id, tutorialId)
  await openBuild(family.id, tutorialId, {
    status: 'accepted', owner_id: maker.id, owner_code: '111111', requester_code: '222222', requester_suburb: 'Enmore',
  })
  try {
    await signIn(page, maker.email, maker.password)
    await page.goto('/get-involved/makers-wanted')
    const open = page.getByRole('article').filter({ hasText: guide })
    await expect(open).toHaveCount(1)
    await expect(open.getByText('Needs a maker')).toBeVisible()
    await expect(open.getByText('Family in Newtown:')).toBeVisible()
    await expect(open.getByText('Can travel 10 km')).toBeVisible()

    await page.getByRole('tab', { name: /^Live/ }).click()
    const live = page.getByRole('article').filter({ hasText: guide })
    await expect(live).toHaveCount(1)
    await expect(live.getByText('You are building it')).toBeVisible()
    await expect(live.getByText('Family in Enmore:')).toBeVisible()
  } finally {
    await cleanup(tutorialId, [family, maker])
  }
})

test('WI25 a maker claims an open request, lands in the build thread, and the family is told', async ({ page }) => {
  const family = await named('Fern Family')
  const maker = await named('Max Maker')
  const guide = uniqueTitle('Bubble guide')
  const tutorialId = await createTutorial(family.id, { title: guide, status: 'approved' })
  const id = await openBuild(family.id, tutorialId)
  try {
    await signIn(page, maker.email, maker.password)
    await page.goto('/get-involved/makers-wanted')
    await page.getByRole('article').filter({ hasText: guide }).getByRole('button', { name: "I'll build this" }).click()

    await expect(page).toHaveURL(new RegExp(`/dashboard/exchanges/build/${id}$`))
    const db = adminClient()
    const { data: tx } = await db.from('toy_transactions').select('status, owner_id').eq('id', id).single()
    expect(tx).toEqual({ status: 'accepted', owner_id: maker.id })
    const { data: notes } = await db.from('notifications').select('recipient_id, type, actor_name').eq('toy_transaction_id', id)
    expect(notes).toEqual([{ recipient_id: family.id, type: 'toy_accepted', actor_name: 'Max Maker' }])

    await page.goto('/get-involved/makers-wanted')
    await expect(page.getByRole('article').filter({ hasText: guide })).toHaveCount(0)
  } finally {
    await cleanup(tutorialId, [family, maker])
  }
})

test('WI26 a family posts a request to Makers wanted and finds it under Your requests', async ({ page }) => {
  const family = await named('Fern Family')
  const guide = uniqueTitle('Bubble guide')
  const tutorialId = await createTutorial(family.id, { title: guide, status: 'approved' })
  try {
    await signIn(page, family.email, family.password)
    await page.goto('/get-involved/makers-wanted/new')
    await expect(page.getByRole('button', { name: 'Post to Makers wanted' })).toBeDisabled()
    await page.getByPlaceholder('Search by toy, switch type or guide name').fill(guide)
    await page.getByRole('button', { name: new RegExp(guide) }).click()
    await page.getByPlaceholder('Newtown').fill('Marrickville')
    await page.getByRole('button', { name: '25 km' }).click()
    await page.getByLabel(/you cover the toy and parts/i).check()
    await page.getByRole('button', { name: 'Post to Makers wanted' }).click()

    await expect(page).toHaveURL(/\/dashboard\/exchanges\/build\/[0-9a-f-]+$/)
    const { data } = await adminClient()
      .from('toy_transactions')
      .select('status, owner_id, owner_org_id, requester_suburb, travel_km')
      .eq('tutorial_id', tutorialId)
      .single()
    expect(data).toEqual({ status: 'requested', owner_id: null, owner_org_id: null, requester_suburb: 'Marrickville', travel_km: 25 })

    await page.goto('/get-involved/makers-wanted')
    await page.getByRole('tab', { name: /^Your requests/ }).click()
    const mine = page.getByRole('article').filter({ hasText: guide })
    await expect(mine.getByText('This is your request')).toBeVisible()
    await expect(mine.getByText('Marrickville')).toBeVisible()
  } finally {
    await cleanup(tutorialId, [family])
  }
})
