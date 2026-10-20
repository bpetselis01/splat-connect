import { test, expect } from '@playwright/test'
import path from 'path'
import { readFileSync } from 'fs'
import { adminClient, createContributor, createTutorial, deleteUser, signIn, uniqueTitle } from '../helpers'

const PDF_FIXTURE = path.join(__dirname, '..', 'fixtures', 'test.pdf')
const STL_FIXTURE = path.join(__dirname, '..', 'fixtures', 'test.stl')

/**
 * The gate on tutorial files, end to end: a signed-out click is a detour to
 * signup that says why; a signed-in request comes back with the PDF bytes,
 * which means the bucket flip, the select policy, the route handler and the
 * signed URL all held. Signup itself is not completed here — it needs an
 * email confirmation, the same reason saves.spec.ts stops at the detour.
 */
test('WT05 a signed-out visitor is sent to sign up from the PDF, pointed back at the tutorial', async ({ page }) => {
  const contributor = await createContributor()
  const tutorialId = await createTutorial(contributor.id, { title: uniqueTitle('E2E Gate'), status: 'approved' })

  try {
    await page.goto(`/tutorials/${tutorialId}`)
    // The button names the gate to a signed-out reader (1909fb6a).
    await page.getByRole('link', { name: 'Sign in to download' }).click()

    await expect(page).toHaveURL(new RegExp(`/signup\\?next=%2Ftutorials%2F${tutorialId}&reason=download`))
    await expect(page.getByText('You need an account to download tutorial files')).toBeVisible()
  } finally {
    await deleteUser(contributor.id)
  }
})

test('WT05 a signed-in visitor gets the PDF', async ({ page }) => {
  const contributor = await createContributor()
  const tutorialId = await createTutorial(contributor.id, { title: uniqueTitle('E2E Download'), status: 'approved' })
  const objectPath = `${tutorialId}/tutorial.pdf`
  const admin = adminClient()
  const { error } = await admin.storage
    .from('tutorial-pdfs')
    .upload(objectPath, readFileSync(PDF_FIXTURE), { contentType: 'application/pdf', upsert: true })
  expect(error).toBeNull()

  try {
    // signIn() waits out the login handler's cookie write (see helpers.ts);
    // this spec is where that race was first found.
    await signIn(page, contributor.email, contributor.password)
    await page.goto(`/tutorials/${tutorialId}`)
    const href = await page.getByRole('link', { name: 'Download guide (PDF)' }).getAttribute('href')
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

test('WT04 a signed-out visitor is sent to sign up from an STL, and a signed-in one is handed the file under its own name', async ({ page }) => {
  const contributor = await createContributor()
  const tutorialId = await createTutorial(contributor.id, { title: uniqueTitle('E2E STL Gate'), status: 'approved' })
  const objectPath = `${tutorialId}/e2e-mount.stl`
  const admin = adminClient()
  const { error } = await admin.storage
    .from('stl-files')
    .upload(objectPath, readFileSync(STL_FIXTURE), { contentType: 'model/stl', upsert: true })
  expect(error).toBeNull()

  try {
    await page.goto(`/tutorials/${tutorialId}`)
    await page.getByRole('tab', { name: 'Files & print settings' }).click()
    await page.getByRole('link', { name: 'Download e2e-mount.stl' }).click()
    await expect(page).toHaveURL(new RegExp(`/signup\\?next=%2Ftutorials%2F${tutorialId}&reason=download`))

    await signIn(page, contributor.email, contributor.password)
    await page.goto(`/tutorials/${tutorialId}`)
    await page.getByRole('tab', { name: 'Files & print settings' }).click()
    const href = await page.getByRole('link', { name: 'Download e2e-mount.stl' }).getAttribute('href')
    expect(href).toBe(`/files/stl-files/${objectPath}`)
    const res = await page.request.get(href!)
    expect(res.status()).toBe(200)
    expect(res.headers()['content-disposition']).toContain('e2e-mount.stl')
    expect((await res.body()).length).toBeGreaterThan(0)
  } finally {
    await admin.storage.from('stl-files').remove([objectPath])
    await deleteUser(contributor.id)
  }
})
