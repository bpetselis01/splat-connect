import { buyLinksError, subResourceRoutes } from './sub-resource.js'

type ToolInput = { name: string; is_optional: boolean; buy_links: unknown[]; note?: string | null; get_by?: string | null }

const GET_BY = new Set(['buy', 'borrow', 'substitute'])

export function toolsError(tools: ToolInput[]): string | null {
  for (const [i, t] of tools.entries()) {
    const n = i + 1
    const links = buyLinksError(t.buy_links, `Tool ${n}`)
    if (links) return links
    if (t.note != null && (typeof t.note !== 'string' || t.note.trim().length > 200)) return `Tool ${n}'s note is over 200 characters`
    if (t.get_by != null && !GET_BY.has(t.get_by)) return `Tool ${n}: choose buy once, borrow or substitute`
  }
  return null
}

export default subResourceRoutes<ToolInput>({
  path: 'tools',
  table: 'tools',
  bodyKey: 'tools',
  validate: toolsError,
  mapRow: (t, tutorialId) => ({
    tutorial_id: tutorialId,
    name: t.name,
    is_optional: t.is_optional,
    buy_links: t.buy_links,
    note: t.note?.trim() || null,
    get_by: t.get_by ?? null,
  }),
})
