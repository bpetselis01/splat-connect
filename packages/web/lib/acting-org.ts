/**
 * Which led organisation the org pages act for. The phone keeps the same choice
 * in app storage; web keeps it in this cookie so server pages can read it.
 * A missing cookie, or one naming an organisation the person no longer leads,
 * falls back to the first led organisation. Callers have already checked
 * ledOrgs is non-empty.
 */
import { cookies } from 'next/headers'
import type { Capabilities, Organization } from '@splat-connect/types'

export const ACTING_ORG_COOKIE = 'splat_acting_org'

export function pickActingOrg(ledOrgs: Organization[], id: string | undefined): Organization {
  return ledOrgs.find((o) => o.id === id) ?? ledOrgs[0]
}

export async function actingOrg(caps: Pick<Capabilities, 'ledOrgs'>): Promise<Organization> {
  const jar = await cookies()
  return pickActingOrg(caps.ledOrgs, jar.get(ACTING_ORG_COOKIE)?.value)
}
