import { test, expect } from '@playwright/test'
import {
  acceptTerms,
  adminClient,
  createContributor,
  createOrgWithLeader,
  deleteOrg,
  deleteUser,
  signIn,
  uniqueTitle,
} from '../helpers'

/**
 * A leader reopens a published event and a published story from Events and
 * stories, fixes them, and the public pages show the fix. The rules (status
 * kept, consent re-ticked, the story's date kept) have API and unit coverage;
 * this proves the Edit links and the two edit pages are wired to them.
 */
test('WB18 WB20 WB26 a leader edits a published event and story in place', async ({ page }) => {
  const leader = await createContributor()
  const orgId = await createOrgWithLeader(leader.id, `Edit Org ${Date.now()}`)
  const eventTitle = uniqueTitle('Build day')
  const storyTitle = uniqueTitle('A drum for Leo')
  const db = adminClient()
  const { data: event } = await db
    .from('org_events')
    .insert({
      org_id: orgId, kind: 'build_day', title: eventTitle, starts_at: new Date(Date.now() + 14 * 864e5).toISOString(),
      format: 'in_person', location: 'The hall', suburb: 'Crows Nest', state: 'NSW', audience: 'Families',
      status: 'published', created_by: leader.id,
    })
    .select('id')
    .single()
  const { data: story } = await db
    .from('org_stories')
    .insert({
      org_id: orgId, kind: 'family', title: storyTitle, summary: 'One sentence.', body: 'A paragraph.',
      byline: 'The club', consent_confirmed: true, status: 'published', published_at: new Date().toISOString(),
      created_by: leader.id,
    })
    .select('id')
    .single()

  try {
    await acceptTerms(leader.id)
    await acceptTerms(leader.id, 'org_leader_terms')
    await signIn(page, leader.email, leader.password)

    await page.goto('/dashboard/organisation/publish')
    await page.locator('article', { hasText: eventTitle }).getByRole('link', { name: 'Edit' }).click()
    await expect(page).toHaveURL(`/dashboard/organisation/events/${event!.id}/edit`)
    await expect(page.getByRole('button', { name: 'Save as draft' })).toHaveCount(0)
    await page.getByLabel('Event name').fill(`${eventTitle} (moved)`)
    await page.getByRole('button', { name: /Save changes/ }).click()
    await expect(page).toHaveURL(`/get-involved/events/${event!.id}`)
    await expect(page.getByRole('heading', { name: `${eventTitle} (moved)` })).toBeVisible()

    await page.goto('/dashboard/organisation/publish')
    await page.getByRole('tab', { name: /Stories/ }).click()
    await page.locator('article', { hasText: storyTitle }).getByRole('link', { name: 'Edit' }).click()
    await expect(page).toHaveURL(`/dashboard/organisation/stories/${story!.id}/edit`)
    // Consent starts unticked on an edit, so saving waits for a fresh tick.
    await expect(page.getByRole('button', { name: /Save changes/ })).toBeDisabled()
    await page.getByLabel('Title').fill(`${storyTitle} (fixed)`)
    await page.getByRole('checkbox').check({ force: true })
    await page.getByRole('button', { name: /Save changes/ }).click()
    await expect(page).toHaveURL(`/about/stories/${story!.id}`)
    await expect(page.getByRole('heading', { name: `${storyTitle} (fixed)` })).toBeVisible()
  } finally {
    await deleteOrg(orgId)
    await deleteUser(leader.id)
  }
})
