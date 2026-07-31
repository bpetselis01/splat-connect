import { describe, it, expect, vi } from 'vitest'
// fireEvent, not user-event: @testing-library/user-event is not a dependency
// of this package and the no-new-dependencies constraint applies to tests too.
import { render, screen } from '@testing-library/react'
import { ShellFrame } from '@/components/shell-frame'
import type { NavGroup } from '@/lib/nav-model'

// Rail signs out through the browser client; ShellFrame renders two Rails.
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { signOut: vi.fn() } }),
}))
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }))

const GROUPS: NavGroup[] = [
  { heading: 'Yours', rows: [{ href: '/dashboard', label: 'My tutorials', icon: 'file' }] },
]

function shell() {
  return render(
    <ShellFrame groups={GROUPS} collapsed={false}>
      <p>page body</p>
    </ShellFrame>
  )
}

describe('ShellFrame', () => {
  // Tests: <main> keeps a width cap
  // How:   renders the shell and reads the utility classes on the main landmark
  // Chain: this is the root layout's <main> for every signed-in page, so an uncapped
  //        one stretches library grids, prose and admin tables across an ultrawide
  //        display while a signed-out visitor on the same URL still gets a column.
  //        jsdom applies no Tailwind, so the class is the assertable artefact here;
  //        tests/e2e/dashboard/shell.spec.ts measures the rendered box at 2560px.
  it('caps the width of the main content column', () => {
    const { container } = shell()
    const main = container.querySelector('main')!
    expect(main.className).toMatch(/\bmax-w-/)
  })

  // Tests: the skip link exists, is first in the tab order, and targets a focusable <main>
  // How:   checks the anchor precedes the rail in document order and that its fragment
  //        resolves to an element that can hold focus
  // Chain: WCAG 2.4.1 (Level A). The rail put up to fourteen tab stops ahead of the page
  //        content on every route. tabIndex -1 is the load-bearing half: without it the
  //        browser scrolls to <main> but leaves focus on the link, which does not bypass
  //        anything. jsdom does not implement fragment-navigation focus, so the focus move
  //        itself is asserted in tests/e2e/dashboard/shell.spec.ts.
  it('offers a skip link that targets a focusable main landmark', () => {
    const { container } = shell()
    const link = screen.getByRole('link', { name: 'Skip to main content' })
    expect(link).toHaveAttribute('href', '#main')

    const main = container.querySelector('main')!
    expect(main).toHaveAttribute('id', 'main')
    expect(main).toHaveAttribute('tabindex', '-1')

    // Ahead of the rail it bypasses, or it bypasses nothing.
    const rail = container.querySelector('.shell-rail')!
    expect(link.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  // Chain: a skip link that is visible at rest is a stray link on every page; one that
  //        stays hidden while focused is a keyboard trap you cannot see. It has to be
  //        sr-only until focus lands on it.
  it('hides the skip link until it is focused', () => {
    shell()
    const link = screen.getByRole('link', { name: 'Skip to main content' })
    expect(link.className).toMatch(/\bsr-only\b/)
    expect(link.className).toMatch(/\bfocus:not-sr-only\b/)
  })
})
