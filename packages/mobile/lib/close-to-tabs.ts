// What the header ✕ does to the navigation state. router.navigate pushes a
// fresh copy in a stack and router.dismissTo stays inside one stack, but a
// trail can run through a tab's stack, across tabs and into (my) or printing.
// So this rewrites the root state in one go: drop everything pushed over the
// tabs, trim the tab you were in and the one you land on back to their first
// screen, and select the landing tab.

// The slice of react-navigation's state this reads and writes.
export type NavState = { index?: number; routes: NavRoute[]; history?: unknown[] }
type NavRoute = { key?: string; name: string; state?: NavState }

const trim = (route: NavRoute): NavRoute => {
  const s = route.state
  if (!s || s.routes.length <= 1) return route
  return { ...route, state: { ...s, index: 0, routes: [s.routes[0]] } }
}

/** The root state with the ✕ applied; null when there are no tabs to land on. */
export function closedState(root: NavState, tab: string): NavState | null {
  const at = root.routes.findIndex((r) => r.name === '(tabs)')
  if (at < 0) {
    // expo-router wraps the app's own root stack in one of its own (__root).
    const i = root.index ?? 0
    const inner = root.routes[i]?.state
    const next = inner && closedState(inner, tab)
    return next ? { ...root, routes: root.routes.map((r, n) => (n === i ? { ...r, state: next } : r)) } : null
  }
  const tabs = root.routes[at].state
  if (!tabs) return null
  const landing = tabs.routes.findIndex((r) => r.name === tab)
  if (landing < 0) return null
  const from = tabs.routes[tabs.index ?? 0]?.name
  const routes = tabs.routes.map((r) => (r.name === tab || r.name === from ? trim(r) : r))
  const key = routes[landing].key
  const history = tabs.history && key ? [...tabs.history, { type: 'route', key }] : undefined
  return {
    ...root,
    index: at,
    routes: [
      ...root.routes.slice(0, at),
      { ...root.routes[at], state: { ...tabs, index: landing, routes, ...(history ? { history } : {}) } },
    ],
  }
}
