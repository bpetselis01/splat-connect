/**
 * 083 repoints a departed author's guide credit to the placeholder profile, so
 * the embed names "Deleted member". A guide credit reads better as who they
 * were: the names of those who ticked "Keep my name on my published guides"
 * (former_names), then a count of the rest (former_count minus the names).
 */
export const DELETED_MEMBER_ID = '00000000-0000-4000-8000-00000000dead'

type Credit = {
  profile_id: string
  former_names?: string[] | null
  former_count?: number | null
  profiles?: { name: string } | null
}

const list = (parts: string[]) =>
  parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`

/** "A former contributor", "2 former contributors", "Sam", "Sam and 1 former contributor". */
export function formerCredit(names: string[], count: number): string {
  const rest = Math.max(count - names.length, 0)
  if (!names.length) return rest > 1 ? `${rest} former contributors` : 'A former contributor'
  if (!rest) return list(names)
  return list([...names, `${rest} former contributor${rest === 1 ? '' : 's'}`])
}

export function nameFormerContributors<T extends Credit>(credits: T[] | null | undefined): T[] {
  for (const c of credits ?? []) {
    if (c.profile_id === DELETED_MEMBER_ID && c.profiles) {
      c.profiles = { ...c.profiles, name: formerCredit(c.former_names ?? [], c.former_count ?? 1) }
    }
  }
  return credits ?? []
}
