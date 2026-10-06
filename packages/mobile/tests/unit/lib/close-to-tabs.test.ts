import { closedState, type NavState } from '../../../lib/close-to-tabs'

// The shape expo-router really hands over: its own __root stack around the
// app's, (tabs) in the app's, and a guide trail three deep in the Guides stack.
const tabs = (index: number, extra: NavState['routes'] = []) => ({
  index: 0,
  routes: [
    {
      name: '__root',
      state: {
        index: extra.length,
        routes: [
          {
            name: '(tabs)',
            state: {
              index,
              history: [{ type: 'route', key: 'home-k' }],
              routes: [
                { name: 'home', key: 'home-k', state: { index: 0, routes: [{ name: 'index' }] } },
                { name: 'me', key: 'me-k' },
                {
                  name: 'guides',
                  key: 'guides-k',
                  state: { index: 2, routes: [{ name: 'index' }, { name: '[id]/index' }, { name: '[id]/index' }] },
                },
              ],
            },
          },
          ...extra,
        ],
      },
    },
  ],
})

const appStack = (s: NavState | null) => s!.routes[0].state!
const tabState = (s: NavState | null) => appStack(s).routes[0].state!

it('trims the stack you were in and lands on its list', () => {
  const next = closedState(tabs(2), 'guides')
  expect(tabState(next).index).toBe(2)
  expect(tabState(next).routes[2].state!.routes.map((r) => r.name)).toEqual(['index'])
})

it('switches to another tab and leaves no trail behind in the one you left', () => {
  const next = closedState(tabs(2), 'home')
  expect(tabState(next).index).toBe(0)
  expect(tabState(next).routes[2].state!.routes).toHaveLength(1)
  expect(tabState(next).history).toContainEqual({ type: 'route', key: 'home-k' })
})

it('drops a screen pushed over the tabs', () => {
  const next = closedState(tabs(2, [{ name: '(my)', state: { index: 0, routes: [{ name: 'toys/index' }] } }]), 'me')
  expect(appStack(next).routes.map((r) => r.name)).toEqual(['(tabs)'])
  expect(appStack(next).index).toBe(0)
  expect(tabState(next).index).toBe(1)
})

it('gives up when there are no tabs to land on', () => {
  expect(closedState({ index: 0, routes: [{ name: '(auth)' }] }, 'home')).toBeNull()
})
