import type { createAdminClient } from './supabase/client.js'

/**
 * The display name to stamp on a denormalised row (013's actor_name), or the
 * fallback. Every caller wants the same thing: a missing or unreadable profile
 * must never fail the notification that named it.
 */
export async function profileName(
  admin: ReturnType<typeof createAdminClient>,
  id: string,
  fallback: string
): Promise<string> {
  const { data } = await admin.from('profiles').select('name').eq('id', id).maybeSingle()
  return (data?.name as string | undefined) ?? fallback
}
