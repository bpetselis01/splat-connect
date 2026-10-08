// journeys: V01 V02 V03 V06
import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createTutorial, signInAsNewContributor, uniqueTitle } from './helpers'
import { seedPublicOrg } from './family-toys-fixtures'

/**
 * My events (a registration made on the web, read back on the phone: Can't
 * make it, a declined part request's Pick a printer) and the Cancel on a
 * recycling drop-off.
 */

/** A published in-person event 30 days out, run by a throwaway host. */
async function seedPublishedEvent(orgId: string, title: string, overrides: Record<string, unknown> = {}) {
  const host = await createContributor()
  const { data, error } = await adminClient()
    .from('org_events')
    .insert({
      org_id: orgId,
      created_by: host.id,
      title,
      status: 'published',
      starts_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      format: 'in_person',
      location: 'E2E Hall, 1 Test St',
      suburb: 'Testville',
      state: 'NSW',
      ...overrides,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`seedPublishedEvent failed: ${error?.message}`)
  return data.id as string
}

/** What the web register form leaves behind. */
async function register(eventId: string, userId: string) {
  const { error } = await adminClient()
    .from('org_event_registrations')
    .insert({ event_id: eventId, user_id: userId, name: 'E2E Family', email: 'family@example.com' })
  if (error) throw new Error(`register failed: ${error.message}`)
}

const registrationRow = async (eventId: string, userId: string) =>
  (await adminClient().from('org_event_registrations').select('cancelled_at').eq('event_id', eventId).eq('user_id', userId).single())
    .data

test('My events lists what a web registration booked, and Can\'t make it cancels the seat', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const org = await seedPublicOrg()
  const title = uniqueTitle('E2E Build Day')
  const eventId = await seedPublishedEvent(org.id, title)
  await register(eventId, me.id)

  await page.goto('/events')
  await expect(page.getByText(title, { exact: true })).toBeVisible()
  await expect(page.getByText(new RegExp(`${org.name} · Testville, NSW`))).toBeVisible()

  const deleted = page.waitForResponse((r) => r.url().endsWith(`/api/events/${eventId}/registrations`) && r.request().method() === 'DELETE')
  await page.getByRole('button', { name: "Can't make it", exact: true }).click()
  expect((await deleted).status()).toBe(200)

  // Gone from the list; the row keeps its history as a timestamp, not a delete.
  await expect(page.getByText(title, { exact: true })).toHaveCount(0)
  expect((await registrationRow(eventId, me.id))?.cancelled_at).not.toBeNull()
})

test('an event the host cancelled stays on My events as Cancelled, with nothing to cancel', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const org = await seedPublicOrg()
  const title = uniqueTitle('E2E Cancelled Day')
  const eventId = await seedPublishedEvent(org.id, title, { cancelled_at: new Date().toISOString() })
  await register(eventId, me.id)

  await page.goto('/events')
  await expect(page.getByText(title, { exact: true })).toBeVisible()
  await expect(page.getByText('Cancelled', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: "Can't make it", exact: true })).toHaveCount(0)
})

test('a declined part request says so and Pick a printer opens the printer search', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const org = await seedPublicOrg()
  const title = uniqueTitle('E2E Parts Day')
  const eventId = await seedPublishedEvent(org.id, title, { prints_parts: true, part_sets_max: 4 })
  await register(eventId, me.id)
  const author = await createContributor()
  const guideId = await createTutorial(author.id, { title: uniqueTitle('E2E Parts Guide') })
  const { error } = await adminClient().from('toy_transactions').insert({
    toy_id: null,
    offered_toy_id: null,
    tutorial_id: guideId,
    printer_id: null,
    event_id: eventId,
    part_sets: 1,
    type: 'print',
    status: 'rejected',
    decline_reason: 'Our machine is down',
    requester_id: me.id,
    owner_id: null,
    owner_org_id: org.id,
  })
  if (error) throw new Error(`part request seed failed: ${error.message}`)

  await page.goto('/events')
  await expect(page.getByText('Parts declined', { exact: true })).toBeVisible()
  await expect(page.getByText(`${org.name} cannot print your parts — Our machine is down`)).toBeVisible()
  await page.getByRole('button', { name: 'Pick a printer', exact: true }).click()
  await expect(page).toHaveURL(/\/printing$/)
})

test('Cancel the drop-off cancels a booked drop-off and takes the button away', async ({ page }) => {
  const me = await signInAsNewContributor(page)
  const org = await seedPublicOrg()
  const { data, error } = await adminClient()
    .from('recycling_dropoffs')
    .insert({ org_id: org.id, contributor_id: me.id, material: 'PLA', estimated_grams: 3000, status: 'booked' })
    .select('id')
    .single()
  if (error || !data) throw new Error(`drop-off seed failed: ${error?.message}`)

  await page.goto('/explore/recycling')
  await expect(page.getByText('3.0 kg PLA')).toBeVisible()
  await expect(page.getByText('Booked in', { exact: true })).toBeVisible()
  const cancelled = page.waitForResponse((r) => r.url().endsWith(`/recycling/${data.id}/cancel`) && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Cancel the PLA drop-off', exact: true }).click()
  expect((await cancelled).status()).toBe(200)

  await expect(page.getByRole('button', { name: 'Cancel the PLA drop-off', exact: true })).toHaveCount(0)
  await expect(page.getByText('Cancelled', { exact: true })).toBeVisible()
  const { data: row } = await adminClient().from('recycling_dropoffs').select('status').eq('id', data.id).single()
  expect(row?.status).toBe('cancelled')
})
