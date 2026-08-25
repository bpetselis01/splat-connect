import { describe, it, expect, vi } from 'vitest'
// fireEvent, not user-event: @testing-library/user-event is not a dependency
// of this package and the no-new-dependencies constraint applies to tests too.
import { render } from '@testing-library/react'
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
    <ShellFrame groups={GROUPS}>
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

  // Tests: <main> is still a focusable, identifiable skip-link target
  // How:   checks id/tabindex directly, since the anchor itself now lives one
  //        level up in app/layout.tsx (the persistent header sits above the
  //        shell, so there is exactly one skip link for the whole app)
  // Chain: WCAG 2.4.1 (Level A) — see app/layout.tsx's skip link and
  //        tests/e2e/dashboard/shell.spec.ts for the rendered-page assertion.
  it('keeps <main> a valid skip-link target', () => {
    const { container } = shell()
    const main = container.querySelector('main')!
    expect(main).toHaveAttribute('id', 'main')
    expect(main).toHaveAttribute('tabindex', '-1')
  })
})
