/**
 * 083 repoints a deleted person's guide credit to the placeholder profile, so
 * the embed names "Deleted member". A guide credit reads better as "A former
 * contributor" — or the person's own name, when they ticked "Keep my name on
 * my published guides" (stored in tutorial_contributors.former_name).
 */
export const DELETED_MEMBER_ID = '00000000-0000-4000-8000-00000000dead'

type Credit = { profile_id: string; former_name?: string | null; profiles?: { name: string } | null }

export function nameFormerContributors<T extends Credit>(credits: T[] | null | undefined): T[] {
  for (const c of credits ?? []) {
    if (c.profile_id === DELETED_MEMBER_ID && c.profiles) {
      c.profiles = { ...c.profiles, name: c.former_name || 'A former contributor' }
    }
  }
  return credits ?? []
}
