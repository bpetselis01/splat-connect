import { tabBarFor, resetLastTab } from '../../../lib/tab-bar-routes'

beforeEach(resetLastTab)

it('lights Home for Home, Guides, Toys, Explore and everything pushed inside them', () => {
  for (const s of [
    ['(tabs)', 'home'],
    ['(tabs)', 'guides'],
    ['(tabs)', 'guides', '[id]'],
    ['(tabs)', 'guides', 'contributor', '[id]'],
    ['(tabs)', 'toy-library', '[id]'],
    ['(tabs)', 'explore', 'learn', '[slug]'],
  ]) expect(tabBarFor(s)).toEqual({ show: true, lit: 'home' })
})

it('lights Map, Inbox and Me for themselves', () => {
  expect(tabBarFor(['(tabs)', 'map'])).toEqual({ show: true, lit: 'map' })
  expect(tabBarFor(['(tabs)', 'inbox'])).toEqual({ show: true, lit: 'inbox' })
  expect(tabBarFor(['(tabs)', 'me'])).toEqual({ show: true, lit: 'me' })
})

it('hides before sign-in, in a first run, in chats, sheets and build mode', () => {
  for (const s of [
    [], ['(auth)', 'sign-in'], ['(onboarding)', 'child'], ['terms'],
    ['(my)', 'exchanges', '[id]'], ['(my)', 'exchanges', 'build', '[id]'],
    ['(my)', 'messages', '[cid]'], ['(my)', 'messages', 'org', '[orgId]'],
    ['(tabs)', 'explore', 'challenges', '[id]'], ['printing', 'jobs', '[id]'],
    ['(tabs)', 'guides', '[id]', 'build'], ['(tabs)', 'guides', 'new'], ['printing', 'request'],
    ['somewhere-new'],
  ]) expect(tabBarFor(s).show).toBe(false)
})

it('keeps the list screens beside the chats showing the bar', () => {
  expect(tabBarFor(['(my)', 'exchanges']).show).toBe(true)
  expect(tabBarFor(['(my)', 'exchanges', 'build', 'ask', '[id]']).show).toBe(true)
  expect(tabBarFor(['(tabs)', 'explore', 'challenges']).show).toBe(true)
})

it('lights the last tab you were on for screens pushed over the tabs, Me by default', () => {
  expect(tabBarFor(['(my)', 'saved'])).toEqual({ show: true, lit: 'me' })
  tabBarFor(['(tabs)', 'map'])
  expect(tabBarFor(['(my)', 'saved'])).toEqual({ show: true, lit: 'map' })
  expect(tabBarFor(['printing'])).toEqual({ show: true, lit: 'map' })
  tabBarFor(['(tabs)', 'guides', '[id]'])
  expect(tabBarFor(['not-built'])).toEqual({ show: true, lit: 'home' })
})
