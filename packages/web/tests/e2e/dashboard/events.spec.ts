import { test, expect } from '@playwright/test'
import { acceptTerms, adminClient, createContributor, createEvent, createOrg, deleteUser, signIn, uniqueTitle } from '../helpers'

async function member() {
  const m = await createContributor()
  await acceptTerms(m.id)
  return m
}

async function register(eventId: string, userId: string) {
  const { error } = await adminClient()
    .from('org_event_registrations')
    .insert({ event_id: eventId, user_id: userId, name: 'E2E Contributor', email: 'family@web-e2e.local', answers: {} })
  if (error) throw new Error(`register failed: ${error.message}`)
}

test('WD27 a Member with no registrations sees "Nothing booked yet"', async ({ page }) => {
  const m = await member()
  try {
    await signIn(page, m.email, m.password)
    await page.goto('/dashboard/events')
    await expect(page.getByRole('heading', { name: 'My events' })).toBeVisible()
    await expect(page.getByText('Nothing booked yet')).toBeVisible()
    await page.getByRole('link', { name: 'All events' }).click()
    await expect(page).toHaveURL('/get-involved/events')
  } finally {
    await deleteUser(m.id)
  }
})

test('WD27 WD26 My events lists a registered event, opens its public page, and Can’t make it takes it off the list', async ({ page }) => {
  const m = await member()
  const host = await createContributor()
  const orgId = await createOrg(uniqueTitle('Host Org'))
  const title = uniqueTitle('Saturday build day')
  const eventId = await createEvent(orgId, host.id, { title, status: 'published' })
  await register(eventId, m.id)
  try {
    await signIn(page, m.email, m.password)
    await page.goto('/dashboard/events')
    const row = page.getByRole('article').filter({ hasText: title })
    await expect(row).toContainText('Testville, NSW')

    await row.getByRole('link', { name: title }).click()
    await expect(page).toHaveURL(`/get-involved/events/${eventId}`)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()

    await page.goto('/dashboard/events')
    await page.getByRole('article').filter({ hasText: title }).getByRole('button', { name: /Can.t make it/ }).click()
    await expect(page.getByText(title)).toHaveCount(0)
    await expect(page.getByText('Nothing booked yet')).toBeVisible()
    const { data } = await adminClient().from('org_event_registrations').select('cancelled_at').eq('event_id', eventId).eq('user_id', m.id).single()
    expect(data!.cancelled_at).not.toBeNull()
  } finally {
    await adminClient().from('organizations').delete().eq('id', orgId)
    await deleteUser(m.id)
    await deleteUser(host.id)
  }
})
