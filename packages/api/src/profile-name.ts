import type { createAdminClient } from './supabase/client.js'
import { chunk } from './chunk.js'
import { createAdminClient as adminClientFor } from './supabase/client.js'

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

/**
 * Each guide's primary contributor's name, by id through the admin client —
 * never a profiles(...) embed, which fails silently under the 033/045 grants.
 * Null when a read fails, so the caller can 500 rather than show a list with
 * every author missing.
 */
export async function primaryAuthorNames(tutorialIds: string[]): Promise<Map<string, string> | null> {
  const out = new Map<string, string>()
  if (tutorialIds.length === 0) return out
  const admin = adminClientFor()
  const links = await Promise.all(
    chunk(tutorialIds).map((ids) =>
      admin.from('tutorial_contributors').select('tutorial_id, profile_id').eq('role', 'primary').in('tutorial_id', ids)
    )
  )
  if (links.some((r) => r.error)) return null
  const rows = links.flatMap((r) => r.data ?? [])
  const people = await Promise.all(
    chunk([...new Set(rows.map((r) => r.profile_id as string))]).map((ids) =>
      admin.from('profiles').select('id, name').in('id', ids)
    )
  )
  if (people.some((r) => r.error)) return null
  const name = new Map(people.flatMap((r) => r.data ?? []).map((p) => [p.id as string, p.name as string]))
  for (const r of rows) {
    const n = name.get(r.profile_id as string)
    if (n) out.set(r.tutorial_id as string, n)
  }
  return out
}
