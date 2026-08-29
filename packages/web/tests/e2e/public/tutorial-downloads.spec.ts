import { test, expect } from '@playwright/test'
import path from 'path'
import { readFileSync } from 'fs'
import { adminClient, createContributor, createTutorial, deleteUser, signIn, uniqueTitle } from '../helpers'

const PDF_FIXTURE = path.join(__dirname, '..', 'fixtures', 'test.pdf')

/**
 * The gate on tutorial files, end to end: a signed-out click is a detour to
 * signup that says why; a signed-in request comes back with the PDF bytes,
 * which means the bucket flip, the select policy, the route handler and the
 * signed URL all held. Signup itself is not completed here — it needs an
 * email confirmation, the same reason saves.spec.ts stops at the detour.
 */
test('a signed-out visitor is sent to sign up, pointed back at the tutorial', async ({ page }) => {
  const contributor = await createContributor()
  const tutorialId = await createTutorial(contributor.id, { title: uniqueTitle('E2E Gate'), status: 'approved' })

  try {
    await page.goto(`/tutorials/${tutorialId}`)
    await page.getByRole('link', { name: 'Download Tutorial PDF' }).click()

    await expect(page).toHaveURL(new RegExp(`/signup\\?next=%2Ftutorials%2F${tutorialId}&reason=download`))
    await expect(page.getByText('You need an account to download tutorial files')).toBeVisible()
  } finally {
    await deleteUser(contributor.id)
  }
})

test('a signed-in visitor gets the PDF', async ({ page }) => {
  const contributor = await createContributor()
  const tutorialId = await createTutorial(contributor.id, { title: uniqueTitle('E2E Download'), status: 'approved' })
  const objectPath = `${tutorialId}/tutorial.pdf`
  const admin = adminClient()
  const { error } = await admin.storage
    .from('tutorial-pdfs')
    .upload(objectPath, readFileSync(PDF_FIXTURE), { contentType: 'application/pdf', upsert: true })
  expect(error).toBeNull()

  try {
    await signIn(page, contributor.email, contributor.password)
    // signIn()'s click resolves as soon as the click event fires, not once the
    // login form's async handler finishes (signInWithPassword, then getUser,
    // then a profile fetch, then the redirect) — that handler is what writes
    // the sb-*-auth-token cookie. Navigating immediately after the click loses
    // that race every time: the SSR tutorial page sees no cookie and renders
    // the signed-out (signup) href. Every other spec sidesteps this by
    // asserting a specific post-login URL; a fresh contributor here has not
    // accepted terms, so it lands on /onboarding/contributor-terms instead of
    // /dashboard — waiting for "anywhere but /login" is the one wait that
    // holds regardless of which page wins.
    await page.waitForURL((url) => !url.pathname.startsWith('/login'))
    await page.goto(`/tutorials/${tutorialId}`)
    const href = await page.getByRole('link', { name: 'Download Tutorial PDF' }).getAttribute('href')
    expect(href).toBe(`/files/tutorial-pdfs/${objectPath}`)

    // page.request shares the browser context's cookies, so this is the same
    // session the page has — and it follows the 302 to the signed URL.
    const res = await page.request.get(href!)
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('application/pdf')
    expect((await res.body()).length).toBeGreaterThan(0)
  } finally {
    await admin.storage.from('tutorial-pdfs').remove([objectPath])
    await deleteUser(contributor.id)
  }
})
