import { type Page } from '@playwright/test'
import { acceptTerms, createContributor, deleteOrg, deleteUser, makeLeader, signIn } from '../helpers'

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
