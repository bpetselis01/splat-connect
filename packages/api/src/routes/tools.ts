import { subResourceRoutes } from './sub-resource.js'

type ToolInput = { name: string; is_optional: boolean; buy_links: unknown[] }

export default subResourceRoutes<ToolInput>({
  path: 'tools',
  table: 'tools',
  bodyKey: 'tools',
  mapRow: (t, tutorialId) => ({
    tutorial_id: tutorialId,
    name: t.name,
    is_optional: t.is_optional,
    buy_links: t.buy_links,
  }),
})
