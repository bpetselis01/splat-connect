'use server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { ACTING_ORG_COOKIE } from '@/lib/acting-org'

// Any id is safe to store: actingOrg ignores one the person doesn't lead.
export async function setActingOrg(orgId: string) {
  const jar = await cookies()
  jar.set(ACTING_ORG_COOKIE, orgId, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  revalidatePath('/dashboard', 'layout')
}
