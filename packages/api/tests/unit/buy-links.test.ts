import { describe, it, expect } from 'vitest'
import { buyLinksError } from '../../src/routes/sub-resource.js'
import { partsError } from '../../src/routes/parts.js'
import { toolsError } from '../../src/routes/tools.js'

// Buy links are rendered as links on both clients (an href on web), so only a
// web address gets in: javascript: there would run in a reader's browser.
describe('buy links', () => {
  it('takes web addresses with a shop name, and no links at all', () => {
    expect(buyLinksError([{ label: 'Jaycar', url: 'https://www.jaycar.com.au/p/123' }], 'Part 1')).toBeNull()
    expect(buyLinksError([], 'Part 1')).toBeNull()
    expect(buyLinksError(undefined, 'Part 1')).toBeNull()
  })
  it('refuses javascript:, data:, tel: and app schemes, and a missing name', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'tel:0400000000', 'intent://x', 'jaycar.com.au']) {
      expect(buyLinksError([{ label: 'Shop', url }], 'Part 1')).toMatch(/web address/)
    }
    expect(buyLinksError([{ label: ' ', url: 'https://a.b' }], 'Tool 2')).toMatch(/^Tool 2: each buy link needs a shop name/)
  })
  it('is checked for every part and tool', () => {
    expect(partsError([{ name: 'Switch', quantity: 1, is_optional: false, buy_links: [{ label: 'x', url: 'javascript:1' }] }])).toMatch(/^Part 1:/)
    expect(toolsError([{ name: 'Iron', is_optional: false, buy_links: [{ label: 'x', url: 'javascript:1' }] }])).toMatch(/^Tool 1:/)
  })
})
