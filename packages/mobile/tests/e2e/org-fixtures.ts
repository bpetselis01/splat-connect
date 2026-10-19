import { type Browser, type Page, expect } from '@playwright/test'
import { adminClient, createEvent, makeLeader, signIn } from './helpers'

/**
 * Fixtures the organisation-leader specs share and helpers.ts has no answer
 * for: a second signed-in party, a follower, org content seeded straight into
 * the tables, and the notification rows a journey is supposed to leave.
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

/** A family that follows the organisation, so a publish has someone to tell. */
export async function followOrg(orgId: string, profileId: string) {
  const { error } = await adminClient().from('org_follows').insert({ org_id: orgId, profile_id: profileId })
  if (error) throw new Error(`followOrg failed: ${error.message}`)
}

/** A second leader, org-leader terms accepted. */
export async function addOrgLeader(orgId: string, userId: string) {
  await makeLeader(userId, undefined, orgId)
}

/** Notification rows of one type addressed to one person. */
export async function notificationsOf(recipientId: string, type: string) {
  const { data, error } = await adminClient()
    .from('notifications')
    .select('id, type, actor_name, tutorial_title, org_event_id, org_story_id, org_conversation_id, org_id')
    .eq('recipient_id', recipientId)
    .eq('type', type)
  if (error) throw new Error(`notificationsOf failed: ${error.message}`)
  return data ?? []
}

/** YYYY-MM-DD, `days` from today, on the browser's (this machine's) clock. */
export function futureDate(days = 30) {
  const d = new Date(Date.now() + days * 86_400_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** An in-person event, straight into org_events. */
export const seedEvent = (
  orgId: string,
  createdBy: string,
  overrides: Partial<{ title: string; status: 'draft' | 'published' }> & { title: string }
) => createEvent(orgId, createdBy, overrides)

/** A story, straight into org_stories (consent ticked so it can be published). */
export async function seedStory(
  orgId: string,
  createdBy: string,
  overrides: { title: string; status?: 'draft' | 'published' }
): Promise<string> {
  const status = overrides.status ?? 'draft'
  const { data, error } = await adminClient()
    .from('org_stories')
    .insert({
      org_id: orgId,
      created_by: createdBy,
      kind: 'org_update',
      title: overrides.title,
      summary: 'Seeded by a Playwright E2E test.',
      body: 'One thing that happened, told plainly.',
      byline: 'E2E Org',
      consent_confirmed: true,
      status,
      published_at: status === 'published' ? new Date().toISOString() : null,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`seedStory failed: ${error?.message}`)
  return data.id
}

/** A booked recycling drop-off at an organisation. */
export async function seedDropoff(
  orgId: string,
  contributorId: string,
  overrides: Partial<{ material: string; estimated_grams: number }> = {}
): Promise<string> {
  const { data, error } = await adminClient()
    .from('recycling_dropoffs')
    .insert({
      org_id: orgId,
      contributor_id: contributorId,
      material: overrides.material ?? 'PLA',
      estimated_grams: overrides.estimated_grams ?? 3000,
      status: 'booked',
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`seedDropoff failed: ${error?.message}`)
  return data.id
}

/** A toy the organisation holds. */
export async function seedOrgToy(
  orgId: string,
  overrides: { name: string; retired?: boolean; quantity?: number }
): Promise<string> {
  const { data, error } = await adminClient()
    .from('toys')
    .insert({
      owner_org_id: orgId,
      name: overrides.name,
      condition: 8,
      quantity: overrides.quantity ?? 1,
      status: 'published',
      offer_type: 'donation',
      retired_at: overrides.retired ? new Date().toISOString() : null,
      retired_note: overrides.retired ? 'Retired by an E2E test' : null,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`seedOrgToy failed: ${error?.message}`)
  return data.id
}
