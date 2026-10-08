import { type Browser, type Page, expect } from '@playwright/test'
import { adminClient, signIn, uniqueTitle } from './helpers'

/**
 * Fixtures the family-toys specs (toy editor, exchange actions, challenge
 * actions, org public page, events and recycling) share and helpers.ts has no
 * answer for.
 */

/** A signed-in page of its own, settled on Home (own context, own storage). */
export async function partyPage(
  browser: Browser,
  baseURL: string | undefined,
  party: { email: string; password: string }
): Promise<Page> {
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  await signIn(page, party.email, party.password)
  await expect(page).toHaveURL(/\/home$/)
  return page
}

/** Notification rows of one type addressed to one person. */
export async function notificationsFor(recipientId: string, type: string) {
  const { data, error } = await adminClient()
    .from('notifications')
    .select('id, type, actor_name, idea_id, toy_transaction_id')
    .eq('recipient_id', recipientId)
    .eq('type', type)
  if (error) throw new Error(`notificationsFor failed: ${error.message}`)
  return data ?? []
}

/**
 * Fills and sends the Report a problem sheet that is already open, then
 * returns the member_reports rows this reporter has filed.
 */
export async function sendReport(page: Page, reporterId: string, reason: string, body: string) {
  await expect(page.getByText('Tell SPLAT what happened')).toBeVisible()
  await page.getByRole('radio', { name: reason, exact: true }).click()
  await page.getByLabel('What happened?').fill(body)
  const posted = page.waitForResponse((r) => r.url().endsWith('/api/reports') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Send report', exact: true }).click()
  expect((await posted).status()).toBe(201)
  // 'Sent to SPLAT…' normally, 'Sent. Safety reports go to the top…' for a safety report.
  await expect(page.getByText(/^Sent/)).toBeVisible()
  const { data, error } = await adminClient()
    .from('member_reports')
    .select('subject_kind, subject_id, subject_label, category, body, status')
    .eq('reporter_id', reporterId)
  if (error) throw new Error(`member_reports read failed: ${error.message}`)
  return data ?? []
}

/** Accept the next window.confirm (the web build's stand-in for Alert.alert). */
export function acceptNextConfirm(page: Page) {
  page.once('dialog', (d) => void d.accept())
}

/**
 * An active organisation whose public page shows the print and recycling
 * panels and two doors. No leader: a family visits it.
 */
export async function seedPublicOrg(
  overrides: Partial<{ name: string; doors: { title: string; body: string; target: string }[] }> = {}
) {
  const admin = adminClient()
  const name = overrides.name ?? uniqueTitle('E2E Public Org')
  const { data: org, error } = await admin
    .from('organizations')
    .insert({
      name,
      status: 'active',
      rate_note: 'We cover the filament for the first print.',
      recycling_materials: ['PLA'],
    })
    .select('id')
    .single()
  if (error || !org) throw new Error(`seedPublicOrg failed: ${error?.message}`)
  const doors = overrides.doors ?? []
  if (doors.length) {
    const { error: doorError } = await admin
      .from('org_doors')
      .insert(doors.map((d, i) => ({ org_id: org.id, position: i + 1, ...d })))
    if (doorError) throw new Error(`seedPublicOrg doors failed: ${doorError.message}`)
  }
  return { id: org.id as string, name }
}

/**
 * A donation between two people, straight into toy_transactions at the stage a
 * spec needs. A 'completed' one also moves the toy to the requester as a draft,
 * the way the confirm handler's transferToy leaves it.
 */
export async function seedDonation(
  ownerId: string,
  requesterId: string,
  toyId: string,
  status: 'requested' | 'accepted' | 'completed'
): Promise<string> {
  const admin = adminClient()
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('toy_transactions')
    .insert({
      toy_id: toyId,
      owner_id: ownerId,
      requester_id: requesterId,
      type: 'donation',
      status,
      // The accept handler mints these; a seeded accepted row has to carry its own.
      ...(status === 'requested'
        ? {}
        : { owner_code: String(100000 + Math.floor(Math.random() * 899999)), requester_code: String(100000 + Math.floor(Math.random() * 899999)) }),
      ...(status === 'requested'
        ? {}
        : { pickup_line1: '12 Seeded St', pickup_suburb: 'Testville', pickup_state: 'VIC', pickup_postcode: '3000' }),
      ...(status === 'completed' ? { owner_confirmed_at: now, requester_confirmed_at: now } : {}),
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`seedDonation failed: ${error?.message}`)
  if (status === 'completed') {
    const { error: moveError } = await admin
      .from('toys')
      .update({ owner_id: requesterId, status: 'draft' })
      .eq('id', toyId)
    if (moveError) throw new Error(`seedDonation transfer failed: ${moveError.message}`)
  }
  return data.id as string
}
