// Where the floating tab bar shows, and which tab it lights. One table, first
// match wins, keyed on the route segments useSegments() reports (route groups
// included, index routes omitted).
export type BarTab = 'home' | 'map' | 'inbox' | 'me'
type Rule = { path: string; show: boolean; lit: BarTab | 'last' }

// A trailing `/*` matches that prefix and anything under it.
const RULES: Rule[] = [
  // No bar before sign-in, or in a first run.
  { path: '(auth)/*', show: false, lit: 'home' },
  { path: '(onboarding)/*', show: false, lit: 'home' },
  { path: 'terms', show: false, lit: 'home' },
  // Conversations: a chat has a composer at the bottom, so Back returns to the list.
  { path: '(my)/exchanges/[id]', show: false, lit: 'home' },
  { path: '(my)/exchanges/build/[id]', show: false, lit: 'home' },
  { path: '(my)/messages/*', show: false, lit: 'home' },
  { path: '(tabs)/explore/challenges/[id]', show: false, lit: 'home' },
  { path: 'printing/jobs/[id]', show: false, lit: 'home' },
  // Deleting the account has its own close and nowhere to wander off to.
  { path: '(my)/account/delete', show: false, lit: 'me' },
  // Sheets and build mode cover the bar on a phone; web draws them as plain screens.
  { path: '(tabs)/guides/new', show: false, lit: 'home' },
  { path: '(tabs)/guides/[id]/build', show: false, lit: 'home' },
  { path: '(tabs)/explore/makers-wanted/new', show: false, lit: 'home' },
  { path: 'printing/request', show: false, lit: 'home' },
  // Guides, Toys and Explore are places reached from Home.
  { path: '(tabs)/home/*', show: true, lit: 'home' },
  { path: '(tabs)/guides/*', show: true, lit: 'home' },
  { path: '(tabs)/toy-library/*', show: true, lit: 'home' },
  { path: '(tabs)/explore/*', show: true, lit: 'home' },
  { path: '(tabs)/map', show: true, lit: 'map' },
  { path: '(tabs)/inbox', show: true, lit: 'inbox' },
  { path: '(tabs)/me', show: true, lit: 'me' },
  // Pushed over the tabs: whichever tab you came from stays lit.
  { path: '(my)/*', show: true, lit: 'last' },
  { path: 'printing/*', show: true, lit: 'last' },
  { path: 'not-built', show: true, lit: 'last' },
]

const matches = (pattern: string, segments: string[]) => {
  const parts = pattern.split('/')
  const prefix = parts[parts.length - 1] === '*'
  const want = prefix ? parts.slice(0, -1) : parts
  if (prefix ? segments.length < want.length : segments.length !== want.length) return false
  return want.every((p, i) => p === segments[i])
}

let lastTab: BarTab = 'me'
export const resetLastTab = () => {
  lastTab = 'me'
}

/** Unknown routes show no bar: a new screen opts in by joining the table. */
export function tabBarFor(segments: string[]): { show: boolean; lit: BarTab } {
  const rule = RULES.find((r) => matches(r.path, segments))
  if (!rule) return { show: false, lit: lastTab }
  if (rule.show && rule.lit !== 'last') lastTab = rule.lit
  return { show: rule.show, lit: rule.lit === 'last' ? lastTab : rule.lit }
}
