import { type Page } from '@playwright/test'
import { acceptTerms, adminClient, createContributor, deleteOrg, deleteUser, makeLeader, signIn, uniqueTitle } from '../helpers'

export type LeaderSeat = { id: string; email: string; password: string; orgId: string; orgName: string }

/** A contributor who leads a fresh organisation, with both terms accepted so no gate stands in the way. */
export async function createLeaderSeat(orgName = `Leader Org ${Date.now()}`): Promise<LeaderSeat> {
  const user = await createContributor()
  await acceptTerms(user.id)
  const orgId = await makeLeader(user.id, orgName)
  return { id: user.id, email: user.email, password: user.password, orgId, orgName }
}

export async function signInAs(page: Page, who: { email: string; password: string }) {
  await page.context().clearCookies()
  await signIn(page, who.email, who.password)
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

export async function removeLeaderSeat(seat: LeaderSeat) {
  await deleteOrg(seat.orgId)
  await deleteUser(seat.id)
}

/** Org stock straight into toys, with a photo so it can be published. */
export async function createOrgToy(
  orgId: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await adminClient()
    .from('toys')
    .insert({
      name: uniqueTitle('Org toy'),
      condition: 8,
      owner_id: null,
      owner_org_id: orgId,
      quantity: 2,
      offer_type: 'donation',
      photo_urls: ['https://placeholder.invalid/toy.jpg'],
      status: 'published',
      ...overrides,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createOrgToy failed: ${error?.message}`)
  return data.id
}
