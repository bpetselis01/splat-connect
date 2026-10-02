import { subResourceRoutes } from './sub-resource.js'

type PartInput = { name: string; quantity: number; is_optional: boolean; buy_links: unknown[]; price_cents?: number | null }

export function partsError(parts: PartInput[]): string | null {
  for (const [i, p] of parts.entries()) {
    if (p.price_cents != null && !(Number.isInteger(p.price_cents) && p.price_cents >= 0)) {
      return `Part ${i + 1}'s price must be a whole number of cents, 0 or more`
    }
  }
  return null
}

export default subResourceRoutes<PartInput>({
  path: 'parts',
  table: 'parts',
  bodyKey: 'parts',
  validate: partsError,
  mapRow: (p, tutorialId) => ({
    tutorial_id: tutorialId,
    name: p.name,
    quantity: p.quantity,
    is_optional: p.is_optional,
    buy_links: p.buy_links,
    price_cents: p.price_cents ?? null,
  }),
})
