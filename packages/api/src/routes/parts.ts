import { subResourceRoutes } from './sub-resource.js'

type PartInput = { name: string; quantity: number; is_optional: boolean; buy_links: unknown[] }

export default subResourceRoutes<PartInput>({
  path: 'parts',
  table: 'parts',
  bodyKey: 'parts',
  mapRow: (p, tutorialId) => ({
    tutorial_id: tutorialId,
    name: p.name,
    quantity: p.quantity,
    is_optional: p.is_optional,
    buy_links: p.buy_links,
  }),
})
