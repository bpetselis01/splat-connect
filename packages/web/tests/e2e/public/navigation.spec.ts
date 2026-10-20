import { test, expect } from '@playwright/test'
import { acceptTerms, createContributor, createNotification, createTutorial, deleteUser, signIn, uniqueTitle } from '../helpers'

/**
 * The scaffold rule, enforced rather than remembered.
 *
 * Eleven placeholder pages linked from a top nav teaches a visitor the site is
 * mostly empty — the exact failure the design session set out to avoid. So every
 * top-level link must land on real content, and placeholders live one level down
 * behind a "soon" pill.
 */
const TOP_LEVEL = [
  { href: '/library', label: 'Guides' },
  { href: '/toy-library', label: 'Toy Library' },
  // Promoted from a Get Involved scaffold on 2026-08-20: 3D printing is one of
  // the three things SPLAT provides. The no-placeholder rule below is what
  // forced its hub to become a real page rather than a ComingSoon.
  { href: '/printing', label: '3D Printing' },
  { href: '/learn', label: 'Learn' },
  { href: '/get-involved', label: 'Get Involved' },
  { href: '/impact', label: 'Impact' },
  { href: '/about', label: 'About' },
]

/*
 * Since the board's NAV5 (859eee42, 2026-09-22) five of the seven are tabs and
 * Learn and Impact sit behind a More disclosure, beside the board's other
 * secondary destinations.
 */
const TABS = ['/library', '/toy-library', '/printing', '/get-involved', '/about']
const BEHIND_MORE = TOP_LEVEL.filter((s) => !TABS.includes(s.href))

test.describe('public navigation', () => {
  test('WC02 every top-level link resolves and none is a placeholder', async ({ page }) => {
    for (const section of TOP_LEVEL) {
      const res = await page.goto(section.href)
      expect(res?.status(), `${section.href} should not error`).toBeLessThan(400)
      // Exact match on ComingSoon's own marker text, not a loose substring: the
      // Get Involved, Impact and About hubs are real pages that legitimately
      // mention "not built yet" in a caption pointing at their scaffolded
      // children (e.g. "Some of this is not built yet."), which a case-
      // insensitive substring match would wrongly flag as a placeholder itself.
      await expect(
        page.getByText('Not built yet', { exact: true }),
        `${section.href} must not be a scaffold`
      ).toHaveCount(0)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    }
  })

  test('WC02 WC03 the top bar carries five sections as tabs and the other two behind More', async ({ page }) => {
    await page.goto('/')
    const header = page.locator('header')
    for (const section of TOP_LEVEL.filter((s) => TABS.includes(s.href))) {
      await expect(header.getByRole('link', { name: section.label, exact: true })).toHaveAttribute(
        'href',
        section.href
      )
    }
    // One disclosure, and only one: More. Its links are hidden until it opens.
    await expect(page.locator('[popovertarget]')).toHaveCount(1)
    const more = header.getByRole('button', { name: 'More' })
    for (const section of BEHIND_MORE) {
      await expect(header.getByRole('link', { name: section.label, exact: true })).toHaveCount(0)
    }
    await more.click()
    for (const section of BEHIND_MORE) {
      await expect(header.getByRole('link', { name: new RegExp(`^${section.label}\\b`) })).toHaveAttribute(
        'href',
        section.href
      )
    }
  })

  test('a section page carries one navigation bar, not two', async ({ page }) => {
    // A section subnav used to render a second full-width bar directly beneath
    // the top bar, on every public route. It was duplicating navigation that
    // already existed twice over: the top bar marks the active section and
    // links to its hub, and the hub page lists every sibling as a card with a
    // blurb. Two stacked bars cost ~100px of chrome to say nothing new.
    for (const path of ['/learn', '/learn/switch-types', '/toy-library']) {
      await page.goto(path)
      await expect(page.locator('header'), `${path} should have one header`).toHaveCount(1)
      await expect(
        page.getByRole('navigation', { name: /pages$/i }),
        `${path} should have no section subnav`
      ).toHaveCount(0)
    }
  })

  test('WC02 WC03 the top bar marks which section you are in', async ({ page }) => {
    // This is what makes the subnav unnecessary rather than merely absent: the
    // sticky top bar is the wayfinding, and it is one click back to the hub.
    // A tab section: its tab is the current page.
    await page.goto('/printing/basics')
    const tab = page.locator('header').locator('[aria-current="page"]')
    await expect(tab).toHaveText('3D Printing')
    await expect(tab).toHaveAttribute('href', '/printing')

    // A section behind More (859eee42): the More button is marked, and inside
    // it the section's own link is the current page.
    await page.goto('/learn/switch-types')
    const more = page.locator('header').getByRole('button', { name: 'More' })
    await expect(more).toHaveAttribute('data-current', 'true')
    await more.click()
    const current = page.locator('header').locator('[aria-current="page"]')
    await expect(current).toHaveText(/^Learn/)
    await expect(current).toHaveAttribute('href', '/learn')
  })

  test('WA28 the organisations directory is reachable with no session', async ({ page }) => {
    const res = await page.goto('/organizations')
    expect(res?.status()).toBeLessThan(400)
    expect(page.url()).not.toContain('/login')
  })

  test('WC03 the homepage reaches all seven sections', async ({ page }) => {
    // The launcher grid went with the Soft Pop rebuild of / (a23f5dad); the
    // header is what reaches every section now, two of them through More.
    await page.goto('/')
    await page.locator('header').getByRole('button', { name: 'More' }).click()
    for (const section of TOP_LEVEL) {
      await expect(page.locator(`a[href="${section.href}"]`).first()).toBeVisible()
    }
  })

  test('the moved printing article redirects permanently to its new home', async ({ page }) => {
    // /learn/3d-printing-basics was the only real 3D printing content on the site,
    // so it moved to anchor the new pillar. Inbound links must follow it.
    const res = await page.goto('/learn/3d-printing-basics')
    expect(res?.status()).toBeLessThan(400)
    expect(page.url()).toContain('/printing/basics')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('no section is left invisible when the entrance animation cannot run', async ({ page }) => {
    // The entrance was briefly a JS scroll reveal that server-rendered sections at
    // opacity:0. This asserts content does not depend on an animation to be seen.
    //
    // Asserted under reduced motion rather than on a freshly loaded page. The
    // entrance is a CSS animation with `both` fill and a stagger of up to 120ms,
    // so a section legitimately reads opacity:0 while its delay is still
    // running: sampling straight after load raced the stagger and the result
    // depended on how fast the machine rendered. Reduced motion collapses the
    // duration to 0.01ms, which lands every section on its final frame at once —
    // and is the state this test actually cares about, since it is the path a
    // visitor who cannot run the animation gets.
    //
    // Since the Soft Pop rebuild of / (a23f5dad) the animated content is the
    // scroll-world's five scenes, which the flight fades and marks inert as
    // they leave the stage. Under reduced motion every one must be readable.
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')

    const scenes = page.getByRole('region', { name: 'How SPLAT works, as a journey' }).locator('article')
    await expect(scenes).toHaveCount(5)

    // Polled: the server render marks scenes 2-5 inert until the script takes
    // over, so the first sample can land before hydration.
    await expect
      .poll(() =>
        scenes.evaluateAll(
          (els) => els.filter((e) => getComputedStyle(e).opacity === '0' || e.hasAttribute('inert')).length
        )
      )
      .toBe(0)
  })
})

test.describe('header controls', () => {
  test('WC01 the brand link goes to the home page', async ({ page }) => {
    await page.goto('/about')
    await page.locator('header').getByRole('link', { name: 'SPLAT Connect home' }).click()
    await expect(page).toHaveURL(/localhost:\d+\/$/)
  })

  test('WC03 choosing a More item opens its page and closes the menu', async ({ page }) => {
    await page.goto('/')
    const header = page.locator('header')
    await header.getByRole('button', { name: 'More' }).click()
    const contact = header.getByRole('link', { name: /^Contact/ })
    await expect(contact).toBeVisible()
    await contact.click()
    await expect(page).toHaveURL(/\/contact$/)
    await expect(header.getByRole('link', { name: /^Contact/ })).toBeHidden()
  })

  test('WC05 the header search opens the library filtered by the query', async ({ page }) => {
    await page.goto('/about')
    await page.locator('header').getByRole('searchbox', { name: 'Search' }).fill('switch')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/library\?q=switch$/)
    // The library shows the query as a removable chip.
    await expect(page.getByRole('button', { name: '“switch”' })).toBeVisible()
  })

  test('WC06 the dark mode toggle sets the mode and keeps it on reload', async ({ page }) => {
    await page.goto('/about')
    await page.locator('header').getByRole('button', { name: 'Dark mode' }).click()
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'dark')

    await page.reload()
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'dark')
    await expect(page.locator('header').getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('WC06 the reduce-motion toggle sets the attribute and keeps it on reload', async ({ page }) => {
    await page.goto('/about')
    await page.locator('header').getByRole('button', { name: /motion/i }).click()
    await expect(page.locator('body')).toHaveAttribute('data-motion', 'reduced')

    await page.reload()
    await expect(page.locator('body')).toHaveAttribute('data-motion', 'reduced')
  })

  test('WC11 the skip link is the first Tab stop and moves focus to the main landmark', async ({ page }) => {
    await page.goto('/about')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Skip to main content' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/about#main$/)
    await expect(page.locator('#main')).toBeFocused()
  })
})

test.describe('header on a phone', () => {
  test.use({ viewport: { width: 390, height: 800 } })

  test('WC04 the Menu button unfolds the tabs and Escape folds them again', async ({ page }) => {
    await page.goto('/about')
    const guides = page.locator('header').getByRole('link', { name: 'Guides', exact: true })
    const menu = page.locator('header').getByRole('button', { name: 'Menu' })
    await expect(guides).toBeHidden()

    await menu.click()
    await expect(menu).toHaveAttribute('aria-expanded', 'true')
    await expect(guides).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(menu).toHaveAttribute('aria-expanded', 'false')
    await expect(guides).toBeHidden()
  })
})

test.describe('signed-in chrome', () => {
  test('WC08 the My SPLAT link shows the unread count and opens the dashboard', async ({ page }) => {
    const member = await createContributor()
    try {
      await acceptTerms(member.id)
      const title = uniqueTitle('Chrome badge')
      const tutorialId = await createTutorial(member.id, { title, status: 'approved' })
      await createNotification(member.id, { type: 'tutorial_approved', tutorial_id: tutorialId, tutorial_title: title })
      await signIn(page, member.email, member.password)
      await page.waitForURL('**/dashboard')

      await page.goto('/about')
      const account = page.locator('header').getByRole('link', { name: /My SPLAT/ })
      await expect(account).toHaveAccessibleName(/1 unread/)
      await expect(account.locator('.nav-account__badge')).toHaveText('1')

      await account.click()
      await expect(page).toHaveURL(/\/dashboard$/)
    } finally {
      await deleteUser(member.id)
    }
  })

  test('WC12 the Back to My SPLAT dock appears on public pages only when signed in', async ({ page }) => {
    await page.goto('/about')
    await expect(page.getByRole('link', { name: /Back to My SPLAT/ })).toHaveCount(0)

    const member = await createContributor()
    try {
      await acceptTerms(member.id)
      await signIn(page, member.email, member.password)
      await page.waitForURL('**/dashboard')

      await page.goto('/about')
      const dock = page.getByRole('link', { name: /Back to My SPLAT/ })
      await expect(dock).toHaveAttribute('href', '/dashboard')
      await dock.click()
      await expect(page).toHaveURL(/\/dashboard$/)
      await expect(page.getByRole('link', { name: /Back to My SPLAT/ })).toHaveCount(0)
    } finally {
      await deleteUser(member.id)
    }
  })

  test('WC13 the dock on /library opens a menu of the page\'s actions', async ({ page }) => {
    const member = await createContributor()
    try {
      await acceptTerms(member.id)
      await signIn(page, member.email, member.password)
      await page.waitForURL('**/dashboard')

      await page.goto('/library')
      await page.getByRole('button', { name: 'Library actions' }).click()
      await expect(page.getByRole('link', { name: 'Upload a tutorial' })).toHaveAttribute('href', '/upload')
      await expect(page.getByRole('link', { name: 'My tutorials' })).toHaveAttribute('href', '/dashboard/tutorials')
      await expect(page.getByRole('link', { name: 'Saved' })).toHaveAttribute('href', '/dashboard/saved')
      await page.getByRole('link', { name: 'My tutorials' }).click()
      await expect(page).toHaveURL(/\/dashboard\/tutorials$/)
    } finally {
      await deleteUser(member.id)
    }
  })

  test('WC13 the dock on /toy-library opens the toy actions', async ({ page }) => {
    const member = await createContributor()
    try {
      await acceptTerms(member.id)
      await signIn(page, member.email, member.password)
      await page.waitForURL('**/dashboard')

      await page.goto('/toy-library')
      await page.getByRole('button', { name: 'Toy library actions' }).click()
      const item = (name: string) => page.locator('.corner-menu-item').filter({ hasText: name })
      await expect(item('Give a toy')).toHaveAttribute('href', '/dashboard/toys/new')
      await expect(item('My exchanges')).toHaveAttribute('href', '/dashboard/exchanges')
      await item('My toys').click()
      await expect(page).toHaveURL(/\/dashboard\/toys$/)
    } finally {
      await deleteUser(member.id)
    }
  })

  test('WC14 the breadcrumb links up through My SPLAT and leaves the page itself unlinked', async ({ page }) => {
    const member = await createContributor()
    try {
      await acceptTerms(member.id)
      await signIn(page, member.email, member.password)
      await page.waitForURL('**/dashboard')

      await page.goto('/dashboard/toys/new')
      const trail = page.getByRole('navigation', { name: 'Breadcrumb' })
      await expect(trail.getByRole('link', { name: 'My SPLAT' })).toHaveAttribute('href', '/dashboard')
      await expect(trail.locator('[aria-current="page"]')).toHaveText('Add a toy')
      await trail.getByRole('link', { name: 'My toys' }).click()
      await expect(page).toHaveURL(/\/dashboard\/toys$/)
    } finally {
      await deleteUser(member.id)
    }
  })
})
