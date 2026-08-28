import { describe, it, expect } from 'vitest'
import {
  PUBLIC_NAV,
  FOOTER_LEGAL,
  sectionFor,
  SCAFFOLD_KEYS,
  ACCOUNT_NAV,
  crossesAccountBoundary,
  nestsRail,
} from '@/lib/public-nav'

describe('public nav model', () => {
  it('has exactly the seven sections, pillars first', () => {
    // 3D Printing joined the top level on 2026-08-20: it is one of the three
    // things SPLAT provides, not a Get Involved sub-item. The three pillars lead.
    expect(PUBLIC_NAV.map((s) => s.label)).toEqual([
      'Guides',
      'Toy Library',
      '3D Printing',
      'Learn',
      'Get Involved',
      'Impact',
      'About',
    ])
  })

  it('leaves the two flat catalogues without children so no subnav renders', () => {
    const flat = PUBLIC_NAV.filter((s) => s.children.length === 0)
    expect(flat.map((s) => s.href)).toEqual(['/library', '/toy-library'])
  })

  it('gives every other section children', () => {
    for (const section of PUBLIC_NAV) {
      if (section.href === '/library' || section.href === '/toy-library') continue
      expect(section.children.length).toBeGreaterThan(0)
    }
  })

  it('never repeats an href anywhere in the tree', () => {
    const all = [
      ...PUBLIC_NAV.map((s) => s.href),
      ...PUBLIC_NAV.flatMap((s) => s.children.map((c) => c.href)),
      ...FOOTER_LEGAL.map((l) => l.href),
    ]
    expect(new Set(all).size).toBe(all.length)
  })

  it('gives every item a label and a blurb, because hub cards and the footer both need them', () => {
    const items = [...PUBLIC_NAV.flatMap((s) => s.children), ...FOOTER_LEGAL]
    for (const item of items) {
      expect(item.label.length).toBeGreaterThan(0)
      expect(item.blurb.length).toBeGreaterThan(0)
    }
  })

  it('maps a nested path to its section', () => {
    expect(sectionFor('/learn/switch-types')?.label).toBe('Learn')
    expect(sectionFor('/get-involved/families')?.label).toBe('Get Involved')
  })

  // The one case a plain path-prefix test gets wrong: /organizations is a child
  // of Impact but shares no prefix with /impact.
  it('maps /organizations to Impact', () => {
    expect(sectionFor('/organizations')?.label).toBe('Impact')
    expect(sectionFor('/organizations/abc/public')?.label).toBe('Impact')
  })

  it('returns account section for dashboard routes', () => {
    expect(sectionFor('/dashboard')).toBe(ACCOUNT_NAV)
  })

  it('lists a scaffold key for every soon child, and nothing else', () => {
    const soon = PUBLIC_NAV.flatMap((s) => s.children).filter((c) => c.state === 'soon')
    expect(SCAFFOLD_KEYS.length).toBe(soon.length)
    expect(new Set(SCAFFOLD_KEYS).size).toBe(SCAFFOLD_KEYS.length)
  })

  it('has six footer legal links', () => {
    expect(FOOTER_LEGAL).toHaveLength(6)
  })
})

describe('three-pillar IA', () => {
  it('carries seven sections', () => {
    expect(PUBLIC_NAV).toHaveLength(7)
  })

  it('marks exactly three pillars, in the order SPLAT provides them', () => {
    const pillars = PUBLIC_NAV.filter((s) => s.rank === 'pillar').map((s) => s.href)
    expect(pillars).toEqual(['/library', '/toy-library', '/printing'])
  })

  it('gives the pillars the three distinct accents and everything else the blue family', () => {
    const byHref = Object.fromEntries(PUBLIC_NAV.map((s) => [s.href, s.tone]))
    expect(byHref['/library']).toBe('brand')
    expect(byHref['/toy-library']).toBe('mint')
    expect(byHref['/printing']).toBe('apricot')
    for (const s of PUBLIC_NAV) expect(s.tone).toBeTruthy()
  })

  it('moves 3D printing out of Learn and out of Get Involved', () => {
    const childHrefs = PUBLIC_NAV.flatMap((s) => s.children.map((c) => c.href))
    expect(childHrefs).not.toContain('/learn/3d-printing-basics')
    expect(
      PUBLIC_NAV.find((s) => s.href === '/get-involved')!.children.map((c) => c.href)
    ).not.toContain('/printing')
  })

  it('gives the printing pillar a live child, so its hub is never a placeholder', () => {
    const printing = PUBLIC_NAV.find((s) => s.href === '/printing')!
    expect(printing.children.map((c) => c.href)).toEqual([
      '/printing/basics',
      '/printing/requests',
      '/printing/parts',
    ])
    expect(printing.children.find((c) => c.href === '/printing/basics')!.state).toBe('live')
  })

  it('resolves the new printing routes to their section', () => {
    expect(sectionFor('/printing/basics')?.label).toBe('3D Printing')
    expect(sectionFor('/printing')?.label).toBe('3D Printing')
  })
})

describe('the account section', () => {
  // Tests: sectionFor resolves account routes onto ACCOUNT_NAV
  // How:   calls sectionFor with the section root and a child route
  // Chain: the breadcrumb, the backdrop tone and the header's active pill all
  //        read sectionFor, so this one match is what makes all three work on
  //        dashboard pages without any of them learning about accounts
  it('resolves dashboard routes to the account section', () => {
    expect(sectionFor('/dashboard')).toBe(ACCOUNT_NAV)
    expect(sectionFor('/dashboard/toys')).toBe(ACCOUNT_NAV)
    expect(sectionFor('/dashboard/challenges')).toBe(ACCOUNT_NAV)
  })

  // Tests: admin lives inside the account section, not beside it
  // How:   calls sectionFor with the admin root and a nested admin route
  // Chain: admin is reached through a rail row under Account, so admin pages are
  //        inside the account section by construction; this keeps the quiet
  //        header rule a single rule with no special case
  it('resolves admin routes to the account section', () => {
    expect(sectionFor('/admin')).toBe(ACCOUNT_NAV)
    expect(sectionFor('/admin/review')).toBe(ACCOUNT_NAV)
  })

  // Tests: the authoring pages resolve to the account section even though one
  //        of them is nested under a public prefix
  // How:   /upload (a plain prefix) and /tutorials/[id]/edit (a pattern),
  //        against the public /tutorials/[id] that must not follow it
  // Chain: sectionFor is the single input to nestsRail, isAccountRoute, the
  //        breadcrumb and the back-to-My-SPLAT dock — all four were wrong on
  //        these pages together
  it('resolves the authoring pages to the account section', () => {
    expect(sectionFor('/upload')).toBe(ACCOUNT_NAV)
    expect(sectionFor('/tutorials/abc/edit')).toBe(ACCOUNT_NAV)
    expect(sectionFor('/tutorials/abc')).toBeUndefined()
  })

  // Tests: the organisation leader pages resolve to the account section, and
  //        the public routes they are nested among do not
  // How:   the leader dashboard and its review screen against the public list
  //        and the public profile that sits one segment deeper
  // Chain: /organizations nests public -> account -> public, so a prefix in
  //        either direction is wrong: '/organizations' would drag the leader
  //        pages public, and a leader prefix would drag /public account
  it('resolves the organisation leader pages to the account section', () => {
    expect(sectionFor('/organizations/abc')).toBe(ACCOUNT_NAV)
    expect(sectionFor('/organizations/abc/projects/def')).toBe(ACCOUNT_NAV)
    expect(sectionFor('/organizations')?.href).toBe('/impact')
    expect(sectionFor('/organizations/abc/public')?.href).toBe('/impact')
  })

  // Tests: /notifications is a rail row too, even though it is not a /dashboard
  //        child
  // How:   calls sectionFor with the bare route
  // Chain: an account route that ACCOUNT_PREFIXES misses silently loses the
  //        rail and the quiet header on that one page — this caught exactly
  //        that gap in an earlier version of ACCOUNT_PREFIXES
  it('resolves /notifications to the account section', () => {
    expect(sectionFor('/notifications')).toBe(ACCOUNT_NAV)
  })

  // Tests: the public tree still wins, including its one explicit-child case
  // How:   checks a public section root and /organizations, which sits under
  //        Impact and shares no prefix with /impact
  // Chain: adding an account match must not disturb the existing child-first
  //        matching order that /organizations depends on
  it('leaves public routes resolving to their public section', () => {
    expect(sectionFor('/learn/switch-types')?.href).toBe('/learn')
    expect(sectionFor('/organizations')?.href).toBe('/impact')
  })

  // Tests: ACCOUNT_NAV stays out of the public tree
  // How:   asserts no PUBLIC_NAV entry carries the account href
  // Chain: public-footer.tsx and the homepage launcher map PUBLIC_NAV, so an
  //        entry here would show the account area to signed-out visitors
  it('is not a public section', () => {
    expect(PUBLIC_NAV.map((s) => s.href)).not.toContain(ACCOUNT_NAV.href)
    expect(PUBLIC_NAV).toHaveLength(7)
  })
})

describe('crossesAccountBoundary', () => {
  // Tests: leaving the account section for a public destination needs a full
  //        page load
  // How:   pathname inside /dashboard, href a public section
  // Chain: this is the exact staleness bug (public-footer.tsx, hub-grid.tsx
  //        and the other seven sites the final review found) — a soft
  //        transition here would leave the rail and the quiet header stale
  it('is true from an account page to a public destination', () => {
    expect(crossesAccountBoundary('/dashboard', '/library')).toBe(true)
    expect(crossesAccountBoundary('/dashboard/challenges', '/get-involved/submit-an-idea')).toBe(
      true
    )
  })

  // Tests: the same bug in reverse — entering the account section from a
  //        public page (app/upload/page.tsx and the tutorial editor link
  //        back to /dashboard)
  // How:   pathname a public route, href an account destination
  it('is true from a public page to an account destination', () => {
    expect(crossesAccountBoundary('/library', '/dashboard')).toBe(true)
    expect(crossesAccountBoundary('/get-involved', '/notifications')).toBe(true)
  })

  // Tests: staying on one side of the boundary never forces a full reload,
  //        whichever side — this is what stops the guard from becoming so
  //        broad it downgrades every link on the site
  // How:   both same-section (Learn -> Learn) and same-side-different-section
  //        (Learn -> Impact, /dashboard -> /dashboard/tutorials)
  it('is false within the public site and between two rail pages', () => {
    expect(crossesAccountBoundary('/learn/switch-types', '/learn/safety-and-cleaning')).toBe(
      false
    )
    expect(crossesAccountBoundary('/learn', '/impact')).toBe(false)
    expect(crossesAccountBoundary('/dashboard/tutorials', '/dashboard/challenges')).toBe(false)
  })

  // Tests: /dashboard itself renders the header, not the rail — every other
  //        account page renders the rail, not the header. Crossing between
  //        them needs a full page load in both directions, or the stale-chrome
  //        bug the account/public boundary was fixed for reopens one level in.
  // How:   both directions between /dashboard and a rail page
  // Chain: components/hub-grid.tsx (My SPLAT's own cards) and the
  //        back-to-My-SPLAT dock both rely on this
  it('is true between /dashboard and any other account page', () => {
    expect(crossesAccountBoundary('/dashboard', '/dashboard/tutorials')).toBe(true)
    expect(crossesAccountBoundary('/dashboard/challenges', '/dashboard')).toBe(true)
    expect(crossesAccountBoundary('/dashboard', '/admin')).toBe(true)
  })


  // Tests: the authoring pages that live outside /dashboard are on the account
  //        side of the boundary like any other rail page
  // How:   /upload and the tutorial editor against a rail page, /dashboard and
  //        a public page
  // Chain: while these resolved to undefined, entering them from the public
  //        site was a soft transition, which left the header on a page that
  //        renders the rail — the exact staleness bug this guard exists for.
  it('puts the authoring pages on the account side', () => {
    expect(crossesAccountBoundary('/dashboard/tutorials', '/upload')).toBe(false)
    expect(crossesAccountBoundary('/upload', '/tutorials/abc/edit')).toBe(false)
    expect(crossesAccountBoundary('/upload', '/dashboard')).toBe(true)
    expect(crossesAccountBoundary('/library', '/upload')).toBe(true)
    expect(crossesAccountBoundary('/library', '/tutorials/abc/edit')).toBe(true)
  })

  // Tests: the public tutorial page is NOT dragged across with its own editor
  // How:   the same id, with and without the /edit segment
  // Chain: a prefix match on /tutorials would put the whole public detail page
  //        behind the rail — this is why sectionFor matches a pattern there
  it('keeps a leader inside the account section across the review flow', () => {
    expect(crossesAccountBoundary('/dashboard/organisation', '/organizations/a/projects/b')).toBe(false)
    expect(crossesAccountBoundary('/organizations', '/organizations/a')).toBe(true)
    expect(crossesAccountBoundary('/organizations/a', '/organizations/a/public')).toBe(true)
  })

  it('leaves the public tutorial page on the public side', () => {
    expect(crossesAccountBoundary('/library', '/tutorials/abc')).toBe(false)
    expect(crossesAccountBoundary('/dashboard/tutorials', '/tutorials/abc')).toBe(true)
  })
})

describe('nestsRail', () => {
  it('is false for /dashboard itself', () => {
    expect(nestsRail('/dashboard')).toBe(false)
  })

  it('is true for every other account page', () => {
    expect(nestsRail('/dashboard/toys')).toBe(true)
    expect(nestsRail('/admin')).toBe(true)
    expect(nestsRail('/notifications')).toBe(true)
  })

  it('is false outside the account section', () => {
    expect(nestsRail('/library')).toBe(false)
    expect(nestsRail('/login')).toBe(false)
  })

  // Tests: the two authoring pages that do not live under /dashboard still get
  //        the rail, and the public tutorial page still does not
  // How:   /upload and /tutorials/[id]/edit against /tutorials/[id]
  // Chain: app/layout.tsx reads nestsRail to choose AppShell over Nav, so a
  //        false here is literally the header rendering on a signed-in page
  it('is true for the authoring pages outside /dashboard', () => {
    expect(nestsRail('/upload')).toBe(true)
    expect(nestsRail('/tutorials/abc/edit')).toBe(true)
    expect(nestsRail('/tutorials/abc')).toBe(false)
  })

  // Tests: a leader gets the rail on both organisation pages, and the public
  //        profile beside them still gets the header
  // How:   the leader dashboard, its review screen, and /public
  // Chain: both are reached from /dashboard/organisation, which has the rail —
  //        without this the chrome flips halfway through a leader's review
  it('is true for the organisation leader pages', () => {
    expect(nestsRail('/organizations/abc')).toBe(true)
    expect(nestsRail('/organizations/abc/projects/def')).toBe(true)
    expect(nestsRail('/organizations/abc/public')).toBe(false)
    expect(nestsRail('/organizations')).toBe(false)
  })
})
