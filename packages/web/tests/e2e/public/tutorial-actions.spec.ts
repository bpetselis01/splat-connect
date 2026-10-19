import { test, expect } from '@playwright/test'
import { acceptTerms, adminClient, createContributor, createTutorial, signIn, uniqueTitle } from '../helpers'

/*
 * What a signed-in reader and a guide's author do on the published guide page:
 * save, thank, log a build, pin a community note, share. The guide's own
 * rendering is tutorial-detail.spec.ts; the downloads are tutorial-downloads.spec.ts.
 */

test('WT08 a reader saves the guide from its rail, finds it under Saved tutorials, and unsaves it', async ({ page }) => {
  const author = await createContributor()
  const reader = await createContributor()
  await acceptTerms(reader.id)
  const title = uniqueTitle('E2E Rail Save')
  const id = await createTutorial(author.id, { title, status: 'approved' })

  await signIn(page, reader.email, reader.password)
  await page.goto(`/tutorials/${id}`)
  const save = page.getByRole('button', { name: 'Save', exact: true })
  await save.click()
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toHaveAttribute('aria-pressed', 'true')

  await page.reload()
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.goto('/dashboard/saved/tutorials')
  await expect(page.getByText(title)).toBeVisible()

  await page.goto(`/tutorials/${id}`)
  await page.getByRole('button', { name: 'Saved', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await page.goto('/dashboard/saved/tutorials')
  await expect(page.getByText(title)).toHaveCount(0)
})

test('WT09 a reader thanks a guide once, the count shows, and the author finds an unnamed thanks in their inbox', async ({ page, browser }) => {
  const author = await createContributor()
  const reader = await createContributor()
  const title = uniqueTitle('E2E Thanks Inbox')
  const id = await createTutorial(author.id, { title, status: 'approved' })

  await signIn(page, reader.email, reader.password)
  await page.goto(`/tutorials/${id}`)
  await page.getByRole('button', { name: /Say thanks/ }).click()
  await expect(page.getByRole('status')).toHaveText('Thanks sent — they will see it in their notifications')
  await expect(page.getByRole('button', { name: 'Thanked. 1 thanks' })).toBeDisabled()

  const owner = await browser.newContext()
  const ownerPage = await owner.newPage()
  await signIn(ownerPage, author.email, author.password)
  await ownerPage.goto('/notifications')
  await expect(ownerPage.getByText(`A family said thanks for "${title}"`)).toBeVisible()
  // The author sees their own count read only, with nothing to press.
  await ownerPage.goto(`/tutorials/${id}`)
  await expect(ownerPage.getByText('1 thank', { exact: true })).toBeVisible()
  await expect(ownerPage.getByRole('button', { name: /Say thanks/ })).toHaveCount(0)
  await owner.close()
})

test('WT10 "Mark this build done" logs the build for the reader', async ({ page }) => {
  const author = await createContributor()
  const reader = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Build Done'), status: 'approved' })

  await signIn(page, reader.email, reader.password)
  await page.goto(`/tutorials/${id}`)
  await page.getByRole('button', { name: 'Mark this build done' }).click()

  await expect(page.getByRole('status')).toHaveText('Build logged — nice work')
  await expect(page.getByRole('button', { name: 'Build logged' })).toBeDisabled()
  const { data } = await adminClient().from('tutorial_builds').select('profile_id').eq('tutorial_id', id)
  expect(data).toEqual([{ profile_id: reader.id }])
})

test('WT11 the guide author pins a community note as a revision and unpins it; a reader sees no controls', async ({ page, browser }) => {
  const author = await createContributor()
  const reader = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Pin Note'), status: 'approved' })
  const { error } = await adminClient()
    .from('tutorial_notes')
    .insert({ tutorial_id: id, author_id: reader.id, body: 'Two zip ties hold the lid better.', step_position: null })
  expect(error).toBeNull()

  const guest = await browser.newContext()
  const readerPage = await guest.newPage()
  await signIn(readerPage, reader.email, reader.password)
  await readerPage.goto(`/tutorials/${id}`)
  await expect(readerPage.getByRole('button', { name: /pin/i })).toHaveCount(0)
  await guest.close()

  await signIn(page, author.email, author.password)
  await page.goto(`/tutorials/${id}`)
  await expect(page.getByText('Two zip ties hold the lid better.')).toBeVisible()
  await page.getByRole('button', { name: 'Pin as revision' }).click()
  await expect(page.getByText('1 pinned revision')).toBeVisible()
  await expect(page.getByText(`Pinned by ${author.name}`)).toBeVisible()

  await page.getByRole('button', { name: 'Unpin' }).click()
  await expect(page.getByText('1 pinned revision')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Pin as revision' })).toBeVisible()
})

test('WT07 Share copies the guide address to the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  // A desktop browser with no share sheet, so the clipboard path is the one taken.
  await page.addInitScript(() => Object.defineProperty(navigator, 'share', { value: undefined }))
  const author = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Share'), status: 'approved' })

  await page.goto(`/tutorials/${id}`)
  await page.getByRole('button', { name: 'Share' }).click()

  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(page.url())
})
