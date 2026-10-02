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

/** The most a holder can hand-pick; 102's position check (1–3) backs it. */
export const MAX_PICKS = 3

export const samePick = (a: ToyPickInput, b: ToyPickInput) => a.entity_type === b.entity_type && a.entity_id === b.entity_id

/** What the editors start from: the saved picks, in position order. */
export function initialPicks(toy: { toy_picks?: ({ position: number } & ToyPickInput)[] }): ToyPickInput[] {
  return [...(toy.toy_picks ?? [])]
    .sort((a, b) => a.position - b.position)
    .map(({ entity_type, entity_id }) => ({ entity_type, entity_id }))
}

/** What a holder can pick: their other listed, unretired toys, then the published guides. */
export function pickOptions(
  toy: { id: string },
  ownToys: readonly { id: string; name: string; status: string; retired_at?: string | null }[],
  guides: readonly { id: string; title: string }[]
): { pick: ToyPickInput; label: string }[] {
  return [
    ...ownToys
      .filter((t) => t.id !== toy.id && t.status === 'published' && !t.retired_at)
      .map((t) => ({ pick: { entity_type: 'toy' as const, entity_id: t.id }, label: t.name })),
    ...guides.map((g) => ({ pick: { entity_type: 'tutorial' as const, entity_id: g.id }, label: g.title })),
  ]
}
