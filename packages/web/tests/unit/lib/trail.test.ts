import { describe, it, expect } from 'vitest'
import { trailFor } from '@/lib/trail'

describe('trailFor', () => {
  // Tests: the hub is the root of every trail and has none of its own
  // Chain: rendering a one-crumb trail on /dashboard would draw a link to the
  //        page you are already on
  it('gives the hub no trail', () => {
    expect(trailFor('/dashboard')).toEqual([])
  })

  // Tests: a page one level down is hub + itself, and only the hub is a link
  it('puts the hub above a first-level page', () => {
    expect(trailFor('/dashboard/toys')).toEqual([
      { label: 'My SPLAT', href: '/dashboard' },
      { label: 'My toys' },
    ])
  })

  // Tests: the trail is the parent chain, not the URL
  // How:   /upload and the editor both hang off My tutorials despite sharing
  //        no path prefix with it
  // Chain: this is the whole reason lib/trail.ts is a table. A pathname split
  //        would put the editor under the public guide it edits, and /upload
  //        directly under the hub
  it('follows declared parents rather than path segments', () => {
    expect(trailFor('/upload')).toEqual([
      { label: 'My SPLAT', href: '/dashboard' },
      { label: 'My tutorials', href: '/dashboard/tutorials' },
      { label: 'Add a tutorial' },
    ])
    expect(trailFor('/tutorials/abc/edit')).toEqual([
      { label: 'My SPLAT', href: '/dashboard' },
      { label: 'My tutorials', href: '/dashboard/tutorials' },
      { label: 'Tutorial editor' },
    ])
  })

  // Tests: a literal segment beats a dynamic one at the same depth
  // Chain: /dashboard/toys/new and /dashboard/toys/[id] are both three
  //        segments; without the literal-count tiebreak "Add a toy" would
  //        render as "Toy detail" depending on object key order
  it('prefers a literal segment over a dynamic one', () => {
    expect(trailFor('/dashboard/toys/new').at(-1)).toEqual({ label: 'Add a toy' })
    expect(trailFor('/dashboard/toys/abc123').at(-1)).toEqual({ label: 'Toy detail' })
  })

  // Tests: a deep admin page walks all the way back to the hub
  it('walks a multi-level chain to the hub', () => {
    expect(trailFor('/admin/review/abc')).toEqual([
      { label: 'My SPLAT', href: '/dashboard' },
      { label: 'Admin dashboard', href: '/admin' },
      { label: 'Review queue', href: '/admin/review' },
      { label: 'Review a tutorial' },
    ])
  })

  // Tests: public and unmodelled paths get nothing, so components/breadcrumb.tsx
  //        falls through to its public eyebrow
  it('returns nothing for a path it does not model', () => {
    expect(trailFor('/library')).toEqual([])
    expect(trailFor('/tutorials/abc')).toEqual([])
    expect(trailFor('/nope/at/all')).toEqual([])
  })

  // Tests: a parent that is itself parametrised renders as text, not a link
  // How:   the leader's guide review sits under the org queue, but its own
  //        parent chain is checked for the general property
  // Chain: a trail cannot invent an id, so an href built from a `[x]` pattern
  //        would be a 404 waiting to be clicked
  it('never links a crumb whose route has a dynamic segment', () => {
    for (const path of ['/dashboard/exchanges/build/abc', '/dashboard/child/abc', '/organizations/a/projects/b']) {
      for (const crumb of trailFor(path)) {
        expect(crumb.href ?? '').not.toContain('[x]')
      }
    }
  })
})
