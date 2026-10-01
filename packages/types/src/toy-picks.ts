/**
 * "Also worth a look" on a toy (102): automatic, or up to three the holder
 * picked from their own toys and published guides.
 */
export type PicksMode = 'auto' | 'picked'

export type ToyPickInput = { entity_type: 'toy' | 'tutorial'; entity_id: string }

/** One card, as the public read sends it. A guide's kind is its tutorials.kind (048). */
export interface ToyPick {
  kind: 'toy' | 'toy_adaptation' | 'assistive_tech'
  id: string
  title: string
  photo_url: string | null
  /** A toy's grade word; nothing for a guide. */
  meta: string | null
}

/** The board's eyebrow over each card (MB mToyRecs). */
export const PICK_KIND_LABEL: Record<ToyPick['kind'], string> = {
  toy: 'Toy in the library',
  toy_adaptation: 'Toy adaptation guide',
  assistive_tech: 'Assistive tech guide',
}

/** Automatic picks: up to three of the same holder's other listed toys, newest first. */
export function autoPicks<T extends { id: string; created_at: string; owner_id: string | null; owner_org_id: string | null }>(
  toy: Pick<T, 'id' | 'owner_id' | 'owner_org_id'>,
  listed: readonly T[]
): T[] {
  return listed
    .filter((t) => t.id !== toy.id && (toy.owner_org_id ? t.owner_org_id === toy.owner_org_id : t.owner_id === toy.owner_id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 3)
}
