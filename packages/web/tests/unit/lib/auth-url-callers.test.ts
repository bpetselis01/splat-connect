import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// The one builder is authUrl(); a hand-built `/signup?next=` string skips its sanitiser.
const components = ['save-button', 'thanks-button', 'person-thanks-button', 'org-actions', 'nav', 'challenge-thread']

describe('client links to /login and /signup', () => {
  it.each(components)('%s builds them with authUrl, not a hand-built string', (name) => {
    const src = readFileSync(resolve(__dirname, `../../../components/${name}.tsx`), 'utf8')
    expect(src).toContain('authUrl(')
    expect(src).not.toMatch(/[`'"]\/(signup|login)\?next=/)
    expect(src).not.toMatch(/href="\/login"/)
  })
})
